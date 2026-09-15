import React, {useCallback, useRef, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useFocusEffect} from '@react-navigation/native';
import AppLayout from '../components/AppLayout';
import {PanelButton, LoadState, iso, mondayOf, addDays} from '../components/TrainerPanels';
import {useLibraryTheme} from '../components/WorkoutLibraryUI';
import {askConfirmation, openDialog, showMessage} from '../services/confirm';
import * as api from '../services/api';

const ACTIONS = {existing:'Już istnieje', absence:'Absencja', conflict:'Zajęty termin', protected:'Chroniony trening', past:'Termin już rozpoczęty', duplicate:'Dwie wybrane pozycje w tej samej godzinie'};
const dateLabel = day => new Date(day+'T12:00:00').toLocaleDateString('pl-PL', {weekday:'short', day:'numeric', month:'short'});

export default function ManagerScreen({navigation}) {
  const {C, T, ink, onAccent, palette} = useLibraryTheme();
  const [source, setSource] = useState(() => iso(mondayOf(new Date())));
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [selected, setSelected] = useState(new Set()), [original, setOriginal] = useState({}), [busy, setBusy] = useState(false);
  const serial = useRef(0), working = useRef(false);
  const load = useCallback(async () => {
    const seq = ++serial.current;
    setLoading(true); setError('');
    try {
      const value = await api.getManagerData(source);
      if (seq === serial.current) { setData(value); setSelected(new Set()); setOriginal({}); }
    } catch (e) { if (seq === serial.current) { setData(null); setError(e.message); } }
    finally { if (seq === serial.current) setLoading(false); }
  }, [source]);
  useFocusEffect(useCallback(() => { load(); return () => { serial.current++; }; }, [load]));
  const names = Object.fromEntries((data?.clients || []).map(c => [c.id, c.name]));
  const frozen = busy || loading;
  const toggle = key => setSelected(old => { const next = new Set(old); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const chooseGroup = items => setSelected(old => {
    const next = new Set(old), all = items.every(i => next.has(i.key));
    items.forEach(i => all ? next.delete(i.key) : next.add(i.key)); return next;
  });

  async function copy(kind, shift) {
    if (working.current || frozen) return;
    const chosen = (data?.items || []).filter(i => i.kind === kind && selected.has(i.key));
    if (!chosen.length) return;
    working.current = true; setBusy(true);
    const target = addDays(source, shift);
    const payload = {target, items:chosen.map(i => ({
      key:i.key, event_date:addDays(i.source_date, shift), event_hour:i.event_hour,
      client_id:original[i.key] && i.original_client_id ? i.original_client_id : i.client_id,
      partner_client_id:i.partner_client_id, workout_type_id:i.workout_type_id, plan_id:i.plan_id,
      main_group:i.main_group, added_groups:i.added_groups || [], replace:false,
    }))};
    try {
      // The old compact view uses the same atomic preflight/commit protection.
      let preview = await api.previewWeekCopy(payload), changed = false;
      for (const row of preview.rows.filter(r => r.action === 'conflict' && r.can_replace)) {
        const item = payload.items.find(i => i.key === row.key);
        const choice = await openDialog('Zajęty termin',
          `${dateLabel(row.event_date)}, ${row.event_hour}:00. W kalendarzu: ${names[row.occupied_client_id] || 'inny klient'}. Zastąpić ten trening treningiem ${names[item.client_id]}?`,
          [{text:'Anuluj', style:'cancel', value:'cancel'}, {text:'Pomiń termin', value:'skip'}, {text:'Zastąp trening', value:'replace'}]);
        if (!choice || choice === 'cancel') return;
        if (choice === 'replace') { item.replace = true; changed = true; }
      }
      // Explicit replacements always get a fresh preview and fingerprints.
      if (changed) preview = await api.previewWeekCopy(payload);
      const additions = preview.rows.filter(r => r.action === 'add').length;
      const replacements = preview.rows.filter(r => r.action === 'replace').length;
      const skipped = preview.rows.filter(r => !['add', 'replace'].includes(r.action));
      const details = skipped.map(r => `${dateLabel(r.event_date)}, ${r.event_hour}:00 — ${ACTIONS[r.action] || r.action}`).join('\n');
      if (!additions && !replacements) {
        await showMessage('Brak treningów do skopiowania', details || 'Wybrane treningi nie wymagają zmian.'); return;
      }
      if (!await askConfirmation('Potwierdź kopiowanie',
        `Tydzień ${target} – ${addDays(target, 6)}.\nDo dodania: ${additions}. Do zastąpienia: ${replacements}. Pominięte: ${skipped.length}.${details ? '\n\n'+details : ''}`, 'Kopiuj')) return;
      const fingerprints = Object.fromEntries(preview.rows.map(r => [r.key, r.fingerprint]));
      const result = await api.commitWeekCopy({...payload, items:payload.items.map(i => ({...i, fingerprint:fingerprints[i.key]}))});
      setSelected(old => { const next = new Set(old); chosen.forEach(i => next.delete(i.key)); return next; });
      await showMessage('Kopiowanie zakończone', `Dodano: ${result.inserted} · Zastąpiono: ${result.replaced} · Pominięto: ${result.skipped}\nTydzień ${target} – ${addDays(target, 6)}.`);
    } catch (e) {
      await showMessage('Nie udało się skopiować treningów', `${e.message}\nKliknij ponownie Kopiuj, aby sprawdzić aktualne terminy przed kolejną próbą.`);
    } finally { working.current = false; setBusy(false); }
  }

  async function clearWeek() {
    if (working.current || frozen) return;
    working.current = true; setBusy(true);
    try {
      if (!await askConfirmation('Wyczyścić ten tydzień?', `${source} – ${addDays(source, 6)}. Usunięte zostaną nieopłacone wydarzenia. Chronione rozliczenia mogą zablokować operację.`, 'Wyczyść tydzień')) return;
      await api.clearWeekEvents(source); api.invalidateCache('calendar'); api.invalidateCache('clients'); await load();
      await showMessage('Tydzień wyczyszczony', 'Stały grafik klientów pozostaje szablonem do ponownego kopiowania.');
    } catch (e) { await showMessage('Nie udało się wyczyścić tygodnia', e.message); }
    finally { working.current = false; setBusy(false); }
  }

  const displayDate = source === iso(mondayOf(new Date())) ? new Date() : new Date(source+'T12:00:00');
  const sectionTitle = [styles.sectionTitle, {color:ink}];
  return <AppLayout navigation={navigation} title="Menadżer" showBack>
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={sectionTitle}>Aktualny tydzień</Text>
      <View style={styles.weekRow}>
        <PanelButton label="Poprzedni tydzień" disabled={frozen} onPress={() => setSource(addDays(source, -7))} style={styles.arrow}><Ionicons name="chevron-back" size={22} color={ink}/></PanelButton>
        <Text style={[styles.weekText, {color:T.text}]}>{displayDate.toLocaleDateString('pl-PL', {weekday:'long', day:'numeric', month:'long'})}</Text>
        <PanelButton label="Następny tydzień" disabled={frozen} onPress={() => setSource(addDays(source, 7))} style={styles.arrow}><Ionicons name="chevron-forward" size={22} color={ink}/></PanelButton>
      </View>
      <PanelButton label="Wyczyść ten tydzień" disabled={frozen} onPress={clearWeek} style={[styles.clearButton, {borderColor:T.danger+'60', backgroundColor:T.danger+'10'}]}>
        <Ionicons name="trash-outline" size={18} color={palette.free}/><Text style={[styles.clearText, {color:palette.free}]}>Wyczyść ten tydzień</Text>
      </PanelButton>
      <LoadState loading={loading} error={error} retry={load}/>
      {data && !loading && ['schedule', 'other'].map(kind => {
        const items = data.items.filter(i => i.kind === kind), count = items.filter(i => selected.has(i.key)).length;
        const title = kind === 'schedule' ? 'Treningi z Harmonogramu' : 'Pozostałe Treningi';
        return <View key={kind} testID={`manager-${kind}`}>
          <Text style={sectionTitle}>{title}</Text>
          <View style={styles.selectBar}>
            <Text style={{color:T.textSecondary, fontSize:13}}>{items.length} treningów</Text>
            <PanelButton label={`${count === items.length && count ? 'Odznacz' : 'Zaznacz'} wszystkie: ${title}`} disabled={frozen || !items.length} onPress={() => chooseGroup(items)} style={styles.selectAll}>
              <Text style={{color:ink, fontSize:12, fontWeight:'600'}}>{count === items.length && count ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}</Text>
            </PanelButton>
          </View>
          {!items.length && <Text style={[styles.empty, {color:T.textSecondary}]}>{kind === 'schedule' ? 'Brak klientów z harmonogramem' : 'Brak pozostałych treningów'}</Text>}
          {items.map(item => <View key={item.key}>
            <PanelButton label={`Wybierz ${item.name}, ${item.source_date}, ${item.event_hour}:00`} selected={selected.has(item.key)} disabled={frozen} onPress={() => toggle(item.key)}
              style={[styles.eventRow, {backgroundColor:T.surface, borderColor:selected.has(item.key) ? C.accent : T.border, borderWidth:1}]}>
              <View style={[styles.check, {borderColor:selected.has(item.key) ? C.accent : T.textSecondary, backgroundColor:selected.has(item.key) ? C.accent : 'transparent'}]}>{selected.has(item.key) && <Ionicons name="checkmark" size={15} color={onAccent}/>}</View>
              <View style={{flex:1, minWidth:0}}>
                <Text style={[styles.eventDate, {color:T.textSecondary}]}>{dateLabel(item.source_date)} {item.event_hour}:00</Text>
                <Text style={[styles.eventClient, {color:T.text}]}>{item.name}{item.partner_client_id ? ' + '+(names[item.partner_client_id] || 'Partner') : ''}</Text>
                {!!item.original_client_id && <Text style={[styles.eventDate, {color:ink, marginTop:4}]}>ZASTĘPSTWO ZA {names[item.original_client_id] || 'klienta'}</Text>}
              </View>
            </PanelButton>
            {!!item.original_client_id && selected.has(item.key) && <PanelButton disabled={frozen} selected={!!original[item.key]} onPress={() => setOriginal(old => ({...old, [item.key]:!old[item.key]}))} style={{marginBottom:8}}>
              <Text style={{color:T.textSecondary, fontSize:13}}>{original[item.key] ? `Kopiowany: ${names[item.original_client_id]}` : `Kopiowany: ${item.name}. Wybierz pierwotnego klienta (${names[item.original_client_id] || '—'})`}</Text>
            </PanelButton>}
          </View>)}
          {[7, 28].map(shift => <PanelButton key={shift} label={`Kopiuj zaznaczone (${count}) na następny ${shift === 7 ? 'tydzień' : 'miesiąc'}: ${title}`} disabled={frozen || !count} onPress={() => copy(kind, shift)}
            style={[styles.copyButton, {backgroundColor:C.accent, borderColor:C.accent, marginTop:shift === 7 ? 24 : 8}]}>
            <Ionicons name={shift === 7 ? 'copy-outline' : 'calendar-outline'} size={20} color={onAccent}/>
            <Text style={[styles.copyText, {color:onAccent}]}>Kopiuj zaznaczone ({count}) na następny {shift === 7 ? 'tydzień' : 'miesiąc'}</Text>
          </PanelButton>)}
        </View>;
      })}
      {busy && <Text accessibilityLiveRegion="polite" style={{color:T.textSecondary, marginTop:16}}>Sprawdzanie i zapis…</Text>}
    </ScrollView>
  </AppLayout>;
}

const styles = StyleSheet.create({
  scroll:{paddingHorizontal:24, paddingBottom:120},
  sectionTitle:{fontSize:14, fontWeight:'700', marginTop:26, marginBottom:6, textTransform:'uppercase', letterSpacing:1},
  weekRow:{flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, marginBottom:8},
  weekText:{fontSize:16, fontWeight:'700', textAlign:'center', flexShrink:1},
  arrow:{borderWidth:0, paddingHorizontal:10, alignItems:'center', minWidth:44},
  selectBar:{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8},
  selectAll:{borderWidth:0, paddingHorizontal:4},
  eventRow:{flexDirection:'row', alignItems:'center', paddingVertical:12, paddingHorizontal:12, borderRadius:10, marginBottom:6, gap:12},
  check:{width:22, height:22, borderRadius:11, borderWidth:2, alignItems:'center', justifyContent:'center'},
  eventDate:{fontSize:12, fontWeight:'600'}, eventClient:{fontSize:15, fontWeight:'700', marginTop:2},
  empty:{textAlign:'center', marginTop:32, marginBottom:4, fontSize:14},
  copyButton:{flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, borderRadius:14, padding:16},
  copyText:{fontSize:14, fontWeight:'700', flexShrink:1},
  clearButton:{flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, marginTop:8, padding:12, borderRadius:10},
  clearText:{fontSize:13, fontWeight:'700'},
});
