import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppLayout from '../components/AppLayout';
import { LibraryPicker as DropdownPicker, LibraryButton as PanelButton, useLibraryTheme as usePanelTheme } from '../components/WorkoutLibraryUI';
import { LoadState } from '../components/TrainerPanels';
import PlanManagerScreen from './PlanManagerScreen';
import MuscleExercisesScreen from './MuscleExercisesScreen';
import { workoutCatalog } from '../services/workoutCatalog';
import * as api from '../services/api';

export default function WorkoutGeneratorScreen({ navigation }) {
  const { s } = usePanelTheme();
  const [items, setItems] = useState([]), [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const sequence = useRef(0), guard = useRef(null), switching = useRef(false);
  const registerGuard = useCallback(fn => { guard.current = fn; }, []);
  const load = useCallback(async () => {
    const seq = ++sequence.current; setLoading(true); setError('');
    try {
      const [plans, groups, grouped] = await Promise.all([api.getPlans(), api.getMuscleGroups(), api.getExercisesGrouped()]);
      if (seq === sequence.current) setItems(workoutCatalog(plans, groups, grouped));
    } catch (e) { if (seq === sequence.current) setError(e.message); }
    finally { if (seq === sequence.current) setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); return () => { sequence.current++; }; }, [load]));
  async function choose(item) {
    if (switching.current || item?.key === selected?.key) return;
    switching.current = true;
    try { if (!guard.current || await guard.current()) setSelected(item); }
    finally { switching.current = false; }
  }
  const created = (record, type) => {
    setSelected({ key: `${type}:${record.id}`, type, id: record.id, name: record.name }); load();
  };
  const header = <>
    <Text style={s.heading}>Generator ćwiczeń i planów</Text>
    <Text style={s.muted}>Wybierz partię lub plan, aby dodać ćwiczenia i uporządkować trening.</Text>
    <View style={s.card}>
      <Text style={s.title}>Nad czym pracujesz?</Text>
      <DropdownPicker placeholder="Partia lub plan do edycji" selectedValue={selected?.key || ''}
        onValueChange={key => choose(items.find(item => item.key === key) || null)}
        items={[{ label: 'Wybierz partię lub plan', value: '' }, ...items.map(item => ({ label: item.label, value: item.key }))]} />
      <View style={s.row}>
        <PanelButton selected={selected?.key === 'new-group'} onPress={() => choose({ key: 'new-group', type: 'group', create: true })}>Nowa partia</PanelButton>
        <PanelButton selected={selected?.key === 'new-plan'} onPress={() => choose({ key: 'new-plan', type: 'plan', create: true })}>Nowy plan</PanelButton>
      </View>
    </View>
    <LoadState loading={loading} error={error} retry={load} />
  </>;
  return <AppLayout navigation={navigation} title="Generator" showBack>
    {selected?.type === 'plan' ? <PlanManagerScreen key={selected.key} navigation={navigation} embedded header={header}
      initialPlanId={selected.id || ''} createInitially={!!selected.create} registerGuard={registerGuard}
      onCreated={p => created(p, 'plan')} onDeleted={() => { setSelected(null); load(); }} />
    : selected?.type === 'group' ? <MuscleExercisesScreen key={selected.key} navigation={navigation} embedded header={header}
      initialGroup={selected} registerGuard={registerGuard} onCreated={g => created(g, 'group')}
      onDeleted={() => { setSelected(null); load(); }} />
    : <ScrollView contentContainerStyle={s.scroll}>{header}<View style={s.card}>
      <Text style={s.title}>Wszystko do tworzenia treningów w jednym miejscu</Text>
      <Text style={s.text}>Partia mięśniowa zbiera ćwiczenia. Plan łączy wybrane ćwiczenia w kolejności wykonania, z seriami i superseriami.</Text>
      <Text style={s.muted}>Gotowe zestawy wybierzesz i wyślesz w pozycji menu „Plany treningowe”.</Text>
    </View></ScrollView>}
  </AppLayout>;
}
