import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppLayout from '../components/AppLayout';
import TrainerSection from '../components/TrainerSection';
import DropdownPicker from '../components/DropdownPicker';
import { TrainerDesignProvider, MONTHS, PanelButton, LoadState, usePanelTheme } from '../components/TrainerPanels';
import { openDialog, showError } from '../services/confirm';
import * as api from '../services/api';

export default function SeasonalityScreen({ navigation }) {
  return <TrainerDesignProvider><SeasonalityPage navigation={navigation}/></TrainerDesignProvider>;
}
function SeasonalityPage({navigation}) {
  const {s}=usePanelTheme();
  return <AppLayout navigation={navigation} title="Raport sezonowości" showBack>
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"><SeasonalityContent/></ScrollView>
  </AppLayout>;
}

export function SeasonalityContent({onOverview}) {
  const { s, C, T } = usePanelTheme();
  const now = new Date();
  const initial = useRef({ from: Math.max(2000, now.getFullYear() - 4), to: now.getFullYear() });
  const [from, setFrom] = useState(String(initial.current.from)), [to, setTo] = useState(String(initial.current.to));
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [editYear, setEditYear] = useState(now.getFullYear() - 1), [editMonth, setEditMonth] = useState(1), [count, setCount] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [editor,setEditor]=useState(false);
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
  const changeRange=(start,end)=>{setFrom(String(start));setTo(String(end));initial.current={from:start,to:end};setMessage('');load(start,end);};
  const evidence=months=>{
    const cells=data?.cells.filter(c=>data.comparable_years.includes(c.year)&&months.some(m=>m.month===c.month)&&c.count!=null)||[];
    return cells.length?Math.round(cells.reduce((sum,c)=>sum+c.count,0)/cells.length):null;
  };
  const extremum = rows => rows?.length ? rows.map(r => `${MONTHS[r.month - 1]} ${r.year}: ${r.count}`).join(' · ') : 'Za mało zakończonych miesięcy z danymi.';
  return <>
      <View style={{gap:8}}><Text style={s.kicker}>Raport sezonowości</Text><Text style={s.heading}>Zaplanuj swój rok</Text>
      <Text style={s.muted}>Gotowe wnioski z Twojej historii treningów.</Text></View>
      <View style={{flexDirection:'row',gap:12}}>
        <View style={{flex:1,gap:6}}><Text style={s.muted}>Od roku</Text><DropdownPicker placeholder="Od roku" selectedValue={Number(from)} disabled={busy} style={input} items={Array.from({length:now.getFullYear()-1999},(_,i)=>({label:String(2000+i),value:2000+i}))} onValueChange={v=>changeRange(Number(v),Math.max(Number(v),Math.min(Number(to),Number(v)+9)))}/></View>
        <View style={{flex:1,gap:6}}><Text style={s.muted}>Do roku</Text><DropdownPicker placeholder="Do roku" selectedValue={Number(to)} disabled={busy} style={input} items={Array.from({length:now.getFullYear()-1999},(_,i)=>({label:String(2000+i),value:2000+i}))} onValueChange={v=>changeRange(Math.min(Number(v),Math.max(Number(from),Number(v)-9)),Number(v))}/></View>
      </View>
      <LoadState loading={loading} error={error} retry={generate}/>
      {!loading && !error && data && <>
        <View style={s.card} testID="seasonality-patterns">
          <Text style={s.kicker}>URLOP I SPOKOJNIEJSZY OKRES</Text>
          <Text style={s.heading}>{quiet.length ? quiet.map(m => MONTHS[m.month - 1]).join(', ') : 'Potrzebujemy więcej historii'}</Text>
          <Text style={s.text}>{quiet.length ? 'Te miesiące powtarzają się wśród spokojniejszych w pełnych latach. Rozważ w nich dłuższą przerwę, sprawdzając wcześniej aktualne rezerwacje.' : 'Nie ma jeszcze wystarczająco zgodnego wzorca spokojniejszych miesięcy. Uzupełnij historię; nie będziemy zgadywać terminu urlopu.'}</Text>
          {evidence(quiet)!=null&&<View style={s.evidence}><Text style={s.muted}>Średnio w tych miesiącach</Text><Text style={s.title}>{evidence(quiet)} sesji</Text></View>}
          <View style={{borderTopWidth:1,borderTopColor:T.border}}/>
          <Text style={s.kicker}>WIĘKSZE OBŁOŻENIE</Text>
          <Text style={s.heading}>{busyMonths.length ? busyMonths.map(m => MONTHS[m.month - 1]).join(', ') : 'Brak potwierdzonego wzorca'}</Text>
          <Text style={s.text}>{busyMonths.length ? 'W tych miesiącach warto wcześniej uzgodnić stałe terminy i zostawić więcej dostępności dla klientów. To wskazówka z historii, nie prognoza popytu.' : 'Wnioski pojawią się, gdy miesiące z większą liczbą sesji będą powtarzać się w porównywalnych latach.'}</Text>
          {evidence(busyMonths)!=null&&<View style={s.evidence}><Text style={s.muted}>Średnio w tych miesiącach</Text><Text style={s.title}>{evidence(busyMonths)} sesji</Text></View>}
        </View>
        <Text style={s.muted}>Podstawa: pełne lata {data.comparable_years.join(', ') || '— brak pełnych lat do porównania'}.</Text>
        <TrainerSection title="Porównaj liczby miesiąc po miesiącu">
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
                    onPress={() => { setEditYear(y.year); setEditMonth(i + 1); setEditor(true); setMessage(''); requestAnimationFrame(() => formRef.current?.focus()); }}>
                    <Text style={s.title}>{cell.count ?? '—'}</Text>
                    <Text style={[s.muted, { fontSize: 11 }]}>{cell.source === 'manual' ? 'Ręcznie' : cell.source === 'app' ? 'Aplikacja' : 'Brak danych'}{cell.partial && cell.count != null ? ' · część' : ''}</Text>
                  </PanelButton>;
                })}
              </View>)}
            </View>
          </ScrollView>
          <Text style={s.muted}>„—” oznacza brak danych, a 0 to jawnie wpisany miesiąc bez treningów. Wyniki z aplikacji odzwierciedlają zapisane sesje i mogą wymagać uzupełnienia starszej historii.</Text>
        </TrainerSection>
        <TrainerSection title="Uzupełnij dane historyczne" open={editor} onToggle={v=>{if(!busy)setEditor(v);}} testID="historical-month-editor">
          <View style={s.row}>
            <DropdownPicker accessibilityLabel="Miesiąc historii" placeholder="Miesiąc historii" selectedValue={editMonth} onValueChange={v => { if (!busy) setEditMonth(Number(v)); }} style={{ flex: 1, minWidth: 130 }} items={MONTHS.map((label, i) => ({ label, value: i + 1 }))}/>
            <DropdownPicker accessibilityLabel="Rok historii" placeholder="Rok historii" selectedValue={editYear} onValueChange={v => { if (!busy) setEditYear(Number(v)); }} style={{ flex: 1, minWidth: 100 }} items={data.years.map(y => ({ label: String(y.year), value: y.year }))}/>
          </View>
          <Text style={s.text}>Liczba treningów · {MONTHS[editMonth - 1]} {editYear}</Text>
          <TextInput ref={formRef} accessibilityLabel="Liczba treningów" style={input} value={count} onChangeText={setCount} keyboardType="numeric" editable={!busy && historical} maxLength={5}/>
          <Text style={s.muted}>Wpisz cały miesięczny wynik, obejmujący odbyte treningi i opłacone odwołania. Wartość zastępuje wynik aplikacji tylko w tym raporcie; nie zmienia pakietów ani rozliczeń.</Text>
          {!historical && <Text style={s.muted}>Wybierz zakończony miesiąc.</Text>}
          <PanelButton disabled={!historical || busy} onPress={() => save()}>{busy ? 'Zapisywanie…' : 'Zapisz miesiąc'}</PanelButton>
          {selected?.source === 'manual' && <PanelButton disabled={busy} onPress={() => save(true)}>Usuń ręczny wpis</PanelButton>}
          {!!message && <Text accessibilityLiveRegion="polite" role="status" style={s.text}>{message}</Text>}
        </TrainerSection>
        <TrainerSection title="Jak powstają wnioski?">
          <Text style={s.text}>Najwięcej treningów: {extremum(data.best)}</Text>
          <Text style={s.text}>Najmniej treningów: {extremum(data.worst)}</Text>
          <Text style={s.muted}>Ranking pomija brakujące dane, miesiąc bieżący i pierwszy miesiąc zapisów aplikacji. Ręczny wpis oznacza pełny wynik miesiąca.</Text>
          <Text style={s.muted}>Szukamy miesięcy w trzech najspokojniejszych lub najbardziej intensywnych w danym roku, powtarzających się w co najmniej dwóch i ⅔ pełnych lat. Lata bez zróżnicowania pomijamy. Liczymy odbyte sesje i opłacone odwołania.</Text>
        </TrainerSection>
        <TrainerSection title="Średnia liczba treningów według miesiąca">
          {data.seasonal.map(m => <View key={m.month} style={{ gap: 4 }}>
            <Text style={s.text}>{MONTHS[m.month - 1]}: {m.average ?? '—'} · liczba lat z danymi: {m.samples}</Text>
            <View accessibilityElementsHidden aria-hidden style={{ height: 8, backgroundColor: T.border, borderRadius: 4 }}><View style={{ width: `${100 * (m.average || 0) / Math.max(1, ...data.seasonal.map(x => x.average || 0))}%`, height: 8, borderRadius: 4, backgroundColor: C.accent }}/></View>
          </View>)}
          <Text style={s.muted}>Średnie opisują dostępne zakończone miesiące. Różna liczba lat i wzrost firmy mogą wpływać na ich porównanie.</Text>
        </TrainerSection>
      </>}
      {!!onOverview&&<PanelButton style={s.link} onPress={onOverview}><Text style={[s.text,{color:T.copper}]}>← Podsumowanie miesiąca</Text></PanelButton>}
  </>;
}
