import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppLayout from '../components/AppLayout';
import DropdownPicker from '../components/DropdownPicker';
import { MONTHS, PanelButton, LoadState, usePanelTheme } from '../components/TrainerPanels';
import { openDialog, showError } from '../services/confirm';
import * as api from '../services/api';

export default function SeasonalityScreen({ navigation }) {
  const { s, C, T } = usePanelTheme();
  const now = new Date();
  const initial = useRef({ from: Math.max(2000, now.getFullYear() - 4), to: now.getFullYear() });
  const [from, setFrom] = useState(String(initial.current.from)), [to, setTo] = useState(String(initial.current.to));
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [editYear, setEditYear] = useState(now.getFullYear() - 1), [editMonth, setEditMonth] = useState(1), [count, setCount] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const sequence = useRef(0), lock = useRef(false), formRef = useRef(null), generateRef = useRef(null), restoreFocus = useRef(false);
  const load = useCallback(async (start, end) => {
    const seq = ++sequence.current; setLoading(true); setError('');
    try {
      const result = await api.getSeasonality(start, end);
      if (seq !== sequence.current) return;
      setData(result);
      setEditYear(y => Math.min(Math.max(y, start), end));
    } catch (e) { if (seq === sequence.current) { setError(e.message); setData(null); } }
    finally { if (seq === sequence.current) setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => {
    load(initial.current.from, initial.current.to);
    return () => { sequence.current++; };
  }, [load]));
  useEffect(() => {
    if (!restoreFocus.current || loading || busy) return;
    restoreFocus.current = false;
    if (error) generateRef.current?.focus(); else formRef.current?.focus();
  }, [loading, busy, error]);
  const selected = data?.cells.find(c => c.year === editYear && c.month === editMonth);
  useEffect(() => { setCount(selected?.count == null ? '' : String(selected.count)); }, [selected]);
  const historical = selected && (editYear < now.getFullYear() || editYear === now.getFullYear() && editMonth < now.getMonth() + 1);
  const input = { borderWidth: 1, borderColor: T.border, borderRadius: 10, padding: 12, minHeight: 44, color: T.text, backgroundColor: T.background, fontSize: 16 };
  const generate = () => {
    const start = Number(from), end = Number(to);
    if (!/^\d{4}$/.test(from) || !/^\d{4}$/.test(to) || start < 2000 || end > 2100 || end < start || end - start > 9) {
      setError('Wybierz od jednego do dziesięciu lat w zakresie 2000–2100.'); return;
    }
    initial.current = { from: start, to: end };
    setMessage(''); load(start, end);
  };
  async function save(remove = false) {
    if (!historical || lock.current || !data) return;
    if (!remove && (!/^\d+$/.test(count) || Number(count) > 10000)) { await showError('Podaj całkowitą liczbę treningów od 0 do 10000.'); return; }
    lock.current = true; setBusy(true); setMessage('');
    try {
      if (remove) {
        const action = await openDialog('Usuń ręczny wpis', 'Raport przywróci liczbę treningów z aplikacji albo pokaże brak danych. Treningi i rozliczenia pozostaną bez zmian.',
          [{ text: 'Anuluj', value: false, style: 'cancel' }, { text: 'Usuń wpis', value: true, style: 'destructive' }]);
        if (!action) return;
        await api.deleteHistoricalMonth(editYear, editMonth, selected.updated_at);
      } else {
        await api.saveHistoricalMonth(editYear, editMonth, { training_count: Number(count), expected_updated_at: selected.updated_at });
      }
      setMessage(remove ? 'Usunięto ręczny wpis.' : 'Zapisano dane historyczne.');
      restoreFocus.current = true;
      await load(data.start_year, data.end_year);
    } catch (e) {
      await showError(e.message);
      // Resolve an uncertain response or stale version before allowing another save.
      restoreFocus.current = true;
      await load(data.start_year, data.end_year);
    } finally { lock.current = false; setBusy(false); }
  }
  const quiet = data?.seasonal.filter(m => m.recurring_quiet) || [];
  const busyMonths = data?.seasonal.filter(m => m.recurring_busy) || [];
  const extremum = rows => rows?.length ? rows.map(r => `${MONTHS[r.month - 1]} ${r.year}: ${r.count}`).join(' · ') : 'Za mało zakończonych miesięcy z danymi.';
  return <AppLayout navigation={navigation} title="Raport sezonowości" showBack>
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <Text style={s.heading}>Jak zmienia się Twój rok pracy?</Text>
      <Text style={s.muted}>Porównuj treningi odbyte i odwołane opłacone. Wspólny trening liczy się jako jedna sesja trenera.</Text>
      <View style={s.card}>
        <View style={s.row}>
          <View style={{ flex: 1, minWidth: 100 }}><Text style={s.text}>Od roku</Text><TextInput ref={generateRef} accessibilityLabel="Od roku" style={input} value={from} onChangeText={setFrom} keyboardType="numeric" maxLength={4} editable={!busy}/></View>
          <View style={{ flex: 1, minWidth: 100 }}><Text style={s.text}>Do roku</Text><TextInput accessibilityLabel="Do roku" style={input} value={to} onChangeText={setTo} keyboardType="numeric" maxLength={4} editable={!busy}/></View>
        </View>
        <PanelButton disabled={loading || busy} onPress={generate}>Wygeneruj raport</PanelButton>
      </View>
      <LoadState loading={loading} error={error} retry={generate}/>
      {!loading && !error && data && <>
        <View style={s.card}>
          <Text style={s.title}>Najbardziej i najmniej pracowite miesiące</Text>
          <Text style={s.text}>Najwięcej treningów: {extremum(data.best)}</Text>
          <Text style={s.text}>Najmniej treningów: {extremum(data.worst)}</Text>
          <Text style={s.muted}>Ranking pomija brakujące dane, miesiąc bieżący i pierwszy miesiąc zapisów aplikacji. Ręczny wpis oznacza pełny wynik miesiąca.</Text>
        </View>
        <View style={s.card} testID="seasonality-patterns">
          <Text style={s.title}>Kiedy rozważyć urlop?</Text>
          <Text style={s.text}>{quiet.length ? `Powtarzające się spokojniejsze miesiące: ${quiet.map(m => MONTHS[m.month - 1]).join(', ')}.` : 'Za mało zgodnych danych, aby wskazać powtarzający się spokojny sezon.'}</Text>
          {!!busyMonths.length && <Text style={s.text}>Powtarzające się intensywne miesiące: {busyMonths.map(m => MONTHS[m.month - 1]).join(', ')}.</Text>}
          <Text style={s.muted}>Porównane pełne lata: {data.comparable_years.join(', ') || 'brak'}. Szukamy miesięcy w trzech najspokojniejszych lub najbardziej intensywnych w danym roku, powtarzających się w co najmniej dwóch i ⅔ pełnych lat. Lata bez zróżnicowania pomijamy.</Text>
          <Text style={s.muted}>To opis historii zapisanych treningów. Przed wyborem urlopu sprawdź też aktualne rezerwacje.</Text>
        </View>
        <View style={s.card}>
          <Text style={s.title}>Miesiąc do miesiąca w kolejnych latach</Text>
          <Text style={s.muted}>Przewiń tabelę w bok. Wybierz zakończony miesiąc, aby uzupełnić lub poprawić jego wynik.</Text>
          <ScrollView horizontal testID="seasonality-table">
            <View>
              <View style={{ flexDirection: 'row' }}><Text style={[s.title, { width: 100, padding: 8 }]}>Miesiąc</Text>{data.years.map(y => <Text key={y.year} style={[s.title, { width: 104, padding: 8 }]}>{y.year}</Text>)}</View>
              {MONTHS.map((name, i) => <View key={name} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[s.text, { width: 100, padding: 8 }]}>{name}</Text>
                {data.years.map(y => {
                  const cell = data.cells.find(c => c.year === y.year && c.month === i + 1);
                  const past = y.year < now.getFullYear() || y.year === now.getFullYear() && i < now.getMonth();
                  return <PanelButton key={y.year} style={{ width: 100, margin: 2, paddingHorizontal: 6 }} disabled={!past || busy}
                    label={`${name} ${y.year}: ${cell.count == null ? 'brak danych' : cell.count}, ${cell.source === 'manual' ? 'ręcznie' : cell.source === 'app' ? 'aplikacja' : 'brak danych'}`}
                    onPress={() => { setEditYear(y.year); setEditMonth(i + 1); setMessage(''); requestAnimationFrame(() => formRef.current?.focus()); }}>
                    <Text style={s.title}>{cell.count ?? '—'}</Text>
                    <Text style={[s.muted, { fontSize: 11 }]}>{cell.source === 'manual' ? 'Ręcznie' : cell.source === 'app' ? 'Aplikacja' : 'Brak danych'}{cell.partial && cell.count != null ? ' · część' : ''}</Text>
                  </PanelButton>;
                })}
              </View>)}
            </View>
          </ScrollView>
          <Text style={s.muted}>„—” oznacza brak danych, a 0 to jawnie wpisany miesiąc bez treningów. Wyniki z aplikacji odzwierciedlają zapisane sesje i mogą wymagać uzupełnienia starszej historii.</Text>
        </View>
        <View style={s.card} testID="historical-month-editor">
          <Text style={s.title}>Uzupełnij dane historyczne</Text>
          <View style={s.row}>
            <DropdownPicker accessibilityLabel="Rok historii" placeholder="Rok historii" selectedValue={editYear} onValueChange={v => { if (!busy) setEditYear(Number(v)); }} style={{ flex: 1, minWidth: 100 }} items={data.years.map(y => ({ label: String(y.year), value: y.year }))}/>
            <DropdownPicker accessibilityLabel="Miesiąc historii" placeholder="Miesiąc historii" selectedValue={editMonth} onValueChange={v => { if (!busy) setEditMonth(Number(v)); }} style={{ flex: 1, minWidth: 130 }} items={MONTHS.map((label, i) => ({ label, value: i + 1 }))}/>
          </View>
          <Text style={s.text}>Liczba treningów · {MONTHS[editMonth - 1]} {editYear}</Text>
          <TextInput ref={formRef} accessibilityLabel="Liczba treningów" style={input} value={count} onChangeText={setCount} keyboardType="numeric" editable={!busy && historical} maxLength={5}/>
          <Text style={s.muted}>Wpisz cały miesięczny wynik, obejmujący odbyte treningi i opłacone odwołania. Wartość zastępuje wynik aplikacji tylko w tym raporcie; nie zmienia pakietów ani rozliczeń.</Text>
          {!historical && <Text style={s.muted}>Wybierz zakończony miesiąc.</Text>}
          <PanelButton disabled={!historical || busy} onPress={() => save()}>{busy ? 'Zapisywanie…' : 'Zapisz miesiąc'}</PanelButton>
          {selected?.source === 'manual' && <PanelButton disabled={busy} onPress={() => save(true)}>Usuń ręczny wpis</PanelButton>}
          {!!message && <Text accessibilityLiveRegion="polite" role="status" style={s.text}>{message}</Text>}
        </View>
        <View style={s.card}>
          <Text style={s.title}>Średnia liczba treningów według miesiąca</Text>
          {data.seasonal.map(m => <View key={m.month} style={{ gap: 4 }}>
            <Text style={s.text}>{MONTHS[m.month - 1]}: {m.average ?? '—'} · liczba lat z danymi: {m.samples}</Text>
            <View accessibilityElementsHidden aria-hidden style={{ height: 8, backgroundColor: T.border, borderRadius: 4 }}><View style={{ width: `${100 * (m.average || 0) / Math.max(1, ...data.seasonal.map(x => x.average || 0))}%`, height: 8, borderRadius: 4, backgroundColor: C.accent }}/></View>
          </View>)}
          <Text style={s.muted}>Średnie opisują dostępne zakończone miesiące. Różna liczba lat i wzrost firmy mogą wpływać na ich porównanie.</Text>
        </View>
      </>}
    </ScrollView>
  </AppLayout>;
}
