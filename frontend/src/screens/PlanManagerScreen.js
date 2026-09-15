import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppLayout from '../components/AppLayout';
import { LibraryPicker as DropdownPicker, LibraryButton as PanelButton, useLibraryTheme as usePanelTheme } from '../components/WorkoutLibraryUI';
import { LoadState } from '../components/TrainerPanels';
import { LibraryInput, UNITS, unitInfo } from '../components/WorkoutLibraryUI';
import { askConfirmation, showError } from '../services/confirm';
import * as api from '../services/api';

const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
});
const cleanSupersets = rows => rows.map(row => ({ ...row,
  superset_id: row.superset_id && rows.filter(r => r.superset_id === row.superset_id).length > 1 ? row.superset_id : null,
}));

export default function PlanManagerScreen({ navigation, embedded = false, header, initialPlanId = '', createInitially = false, registerGuard, onCreated, onDeleted }) {
  const { s, C, T } = usePanelTheme();
  const [plans, setPlans] = useState([]), [library, setLibrary] = useState([]);
  const [planId, setPlanId] = useState(initialPlanId), [rows, setRows] = useState([]), [dirty, setDirty] = useState(false);
  const [newForm, setNewForm] = useState(createInitially), [name, setName] = useState(''), [exerciseId, setExerciseId] = useState(''), [search, setSearch] = useState('');
  const [groups, setGroups] = useState([]), [newExercise, setNewExercise] = useState(false), [exerciseName, setExerciseName] = useState(''), [exerciseGroup, setExerciseGroup] = useState(''), [exerciseUnit, setExerciseUnit] = useState('KG');
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [detailLoading, setDetailLoading] = useState(false), [detailError, setDetailError] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const lock = useRef(false), sequence = useRef(0), librarySequence = useRef(0), leaving = useRef(false), confirming = useRef(false);
  useEffect(() => {
    registerGuard?.(async () => !lock.current && (!(dirty || name.trim() || exerciseName.trim()) || await askConfirmation('Niezapisane zmiany', 'Odrzucić niezapisane dane i zmienić partię lub plan?', 'Odrzuć zmiany')));
    return () => registerGuard?.(null);
  }, [registerGuard, dirty, name, exerciseName]);
  const loadLibrary = useCallback(async () => {
    const seq = ++librarySequence.current; setLoading(true); setError('');
    try {
      const [ps, grouped, gs] = await Promise.all([api.getPlans(), api.getExercisesGrouped(), api.getMuscleGroups()]);
      if (seq !== librarySequence.current) return;
      setPlans(ps); setGroups(gs); setLibrary(Object.entries(grouped).flatMap(([part, list]) => list.map(e => ({ ...e, part }))));
    } catch (e) { if (seq === librarySequence.current) setError(e.message); }
    finally { if (seq === librarySequence.current) setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { loadLibrary(); return () => { librarySequence.current++; }; }, [loadLibrary]));
  const loadPlan = useCallback(async id => {
    const seq = ++sequence.current; setDetailLoading(true); setDetailError(''); setRows([]); setMessage('');
    try {
      const value = id ? await api.getPlanExercises(id) : [];
      if (seq === sequence.current) { setRows(value.map(r => ({ ...r, sets_data: Array.isArray(r.sets_data) ? r.sets_data : [] }))); setDirty(false); }
    } catch (e) { if (seq === sequence.current) setDetailError(e.message); }
    finally { if (seq === sequence.current) setDetailLoading(false); }
  }, []);
  useEffect(() => { loadPlan(planId); return () => { sequence.current++; }; }, [planId, loadPlan]);
  useEffect(() => navigation.addListener('beforeRemove', async e => {
    if (leaving.current || (!dirty && !lock.current)) return;
    e.preventDefault();
    if (lock.current || confirming.current) return;
    confirming.current = true;
    const discard = await askConfirmation('Niezapisane zmiany', 'Opuścić edytor i odrzucić zmiany serii, kolejności i superserii?', 'Odrzuć zmiany');
    confirming.current = false;
    if (discard) { leaving.current = true; navigation.dispatch(e.data.action); }
  }), [navigation, dirty]);
  async function canSwitch() {
    return !dirty || await askConfirmation('Niezapisane zmiany', 'Zmienić plan i odrzucić zmiany serii, kolejności i superserii?', 'Odrzuć zmiany');
  }
  async function run(action) {
    if (lock.current) return;
    const trigger = typeof document !== 'undefined' ? document.activeElement : null;
    lock.current = true; setBusy(true); setMessage('');
    try { await action(); } catch (e) { await showError(e.message); }
    finally { lock.current = false; setBusy(false); requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus(); }); }
  }
  async function persist() {
    if (!dirty) return;
    const results = await Promise.allSettled(rows.map((r, i) => api.updatePlanExercise(r.id, {
      sets_data: r.sets_data, sort_order: i, superset_id: r.superset_id || null,
    })));
    if (results.some(r => r.status === 'rejected' || !r.value?.id)) {
      throw new Error('Nie wszystkie zmiany zostały zapisane. Twoje dane zostały w edytorze. Sprawdź połączenie i ponownie wybierz Zapisz plan.');
    }
    setDirty(false);
  }
  const save = () => run(async () => { await persist(); setMessage('Plan zapisany.'); });
  const create = () => run(async () => {
    if (!name.trim() || !await canSwitch()) return;
    const plan = await api.createPlan({ name: name.trim() });
    setPlans(prev => [...prev, plan]); setDirty(false); setPlanId(plan.id); setName(''); setNewForm(false); setExerciseId(''); onCreated?.(plan);
  });
  const removePlan = () => run(async () => {
    if (!await askConfirmation('Usunąć plan?', `Usunąć „${plans.find(p => p.id === planId)?.name}” razem z jego ćwiczeniami i seriami?`, 'Usuń plan')) return;
    await api.deletePlan(planId); setPlans(prev => prev.filter(p => p.id !== planId)); setDirty(false); setPlanId(''); setExerciseId(''); onDeleted?.();
  });
  const addExercise = () => run(async () => {
    if (!exerciseId) return;
    await persist();
    const exercise = library.find(e => e.id === exerciseId);
    const added = await api.addExerciseToPlan(planId, { exercise_id: exerciseId, sort_order: rows.length, sets_data: [] });
    setRows(prev => [...prev, { ...added, exercises: { ...exercise, muscle_groups: { name: exercise.part } }, sets_data: [] }]);
    setExerciseId(''); setMessage('Ćwiczenie dodane. Możesz teraz rozpisać serie.');
  });
  const createExercise = () => run(async () => {
    if (!exerciseName.trim() || !exerciseGroup) return;
    await persist();
    const created = await api.createExercise({ name: exerciseName.trim(), muscle_group_id: exerciseGroup, unit: exerciseUnit });
    const exercise = { ...created, part: groups.find(g => g.id === exerciseGroup)?.name };
    setLibrary(prev => [...prev, exercise]); setExerciseName(''); setNewExercise(false); setExerciseId(created.id);
    try {
      const added = await api.addExerciseToPlan(planId, { exercise_id: created.id, sort_order: rows.length, sets_data: [] });
      setRows(prev => [...prev, { ...added, exercises: { ...exercise, muscle_groups: { name: exercise.part } }, sets_data: [] }]);
      setExerciseId(''); setMessage('Nowe ćwiczenie utworzone i dodane do planu.');
    } catch (e) { throw new Error('Ćwiczenie utworzono w bibliotece, ale nie potwierdzono dodania do planu. Otwórz plan ponownie i sprawdź listę przed kolejną próbą. ' + e.message); }
  });
  const removeExercise = index => run(async () => {
    if (!await askConfirmation('Usunąć ćwiczenie z planu?', `Usunąć „${rows[index].exercises?.name}” i jego serie z tego planu? Ćwiczenie pozostanie w bibliotece.`, 'Usuń z planu')) return;
    await persist(); await api.removeExerciseFromPlan(rows[index].id);
    const remaining = cleanSupersets(rows.filter((_, i) => i !== index));
    setRows(remaining); setDirty(remaining.some((r, i) => r.sort_order !== i || r.superset_id !== rows.find(old => old.id === r.id)?.superset_id));
    setMessage('Ćwiczenie usunięte z planu.');
  });
  function edit(fn) { if (lock.current) return; setRows(prev => fn(prev)); setDirty(true); setMessage(''); }
  const editSets = (index, fn) => edit(prev => prev.map((r, i) => i === index ? { ...r, sets_data: fn(r.sets_data) } : r));
  const move = (index, direction) => edit(prev => {
    const next = [...prev], target = index + direction;
    [next[index], next[target]] = [next[target], next[index]]; return next;
  });
  const toggleSuperset = index => edit(prev => {
    const current = prev[index], next = prev[index + 1];
    if (current.superset_id && current.superset_id === next.superset_id) {
      return cleanSupersets(prev.map((r, i) => i === index + 1 ? { ...r, superset_id: null } : r));
    }
    const sid = current.superset_id || next.superset_id || uuid();
    return cleanSupersets(prev.map((r, i) => (i === index || i === index + 1 || next.superset_id && r.superset_id === next.superset_id) ? { ...r, superset_id: sid } : r));
  });
  const disabled = busy || detailLoading || !!detailError;
  const options = library.filter(e => !rows.some(r => r.exercise_id === e.id) && `${e.name} ${e.part}`.toLocaleLowerCase('pl').includes(search.trim().toLocaleLowerCase('pl')));
  const Layout = embedded ? React.Fragment : AppLayout;
  return <Layout {...(embedded ? {} : { navigation, title: 'Edytor planów', showBack: true })}>
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      {header}
      {!embedded && <>
      <Text style={s.heading}>Ułóż trening krok po kroku</Text>
      <Text style={s.muted}>Wybierz plan, dodaj ćwiczenia z biblioteki i rozpisz serie. Łącz ćwiczenia w superserie, gdy mają być wykonywane razem.</Text>
      </>}
      <LoadState loading={loading} error={error} retry={loadLibrary} />
      {!loading && !error && <>
        {(!embedded || newForm) && <View style={s.card}>
          {!embedded && <>
          <Text style={s.title}>Twoje plany · {plans.length}</Text>
          <DropdownPicker placeholder="Wybierz plan" selectedValue={planId} onValueChange={id => run(async () => { if (id !== planId && await canSwitch()) { setDirty(false); setPlanId(id); setExerciseId(''); } })}
            items={[{ label: 'Wybierz plan', value: '' }, ...plans.map(p => ({ label: p.name, value: p.id }))]} />
          <View style={s.row}>
            <PanelButton disabled={busy} selected={newForm} onPress={() => setNewForm(v => !v)}>Nowy plan</PanelButton>
            <PanelButton disabled={busy} onPress={() => navigation.navigate('MuscleExercises')}>Biblioteka ćwiczeń</PanelButton>
            <PanelButton disabled={busy} onPress={() => run(async () => { await persist(); navigation.navigate('Plans'); })}>Podgląd i udostępnianie</PanelButton>
          </View>
          </>}
          {newForm && <>
            <LibraryInput label="Nazwa planu" placeholder="Np. Trening A — całe ciało" value={name} onChangeText={setName} editable={!busy} maxLength={200} />
            <PanelButton disabled={busy || !name.trim()} primary onPress={create}>Utwórz plan</PanelButton>
          </>}
          {!plans.length && !newForm && <Text style={s.muted}>Zacznij od utworzenia pierwszego planu.</Text>}
        </View>}
        {!!planId && <>
          <LoadState loading={detailLoading} error={detailError} retry={() => loadPlan(planId)} />
          {!detailLoading && !detailError && <>
            <View style={[s.card, { borderColor: C.accent }]}>
              <Text style={s.heading}>{plans.find(p => p.id === planId)?.name}</Text>
              <Text style={s.muted}>{rows.length} ćwiczeń · {rows.reduce((n, r) => n + r.sets_data.length, 0)} serii</Text>
              <Text style={s.text} accessibilityLiveRegion="polite">{busy ? 'Zapisywanie…' : dirty ? 'Masz niezapisane zmiany' : message || 'Plan jest zapisany'}</Text>
              <View style={s.row}>
                <PanelButton disabled={disabled || !dirty} primary onPress={save} style={{ borderColor: C.accent }}>Zapisz plan</PanelButton>
                <PanelButton disabled={disabled} quiet onPress={removePlan}>Usuń plan</PanelButton>
              </View>
            </View>
            {rows.map((row, index) => {
              const info = unitInfo(row.exercises?.unit), linked = row.superset_id && rows[index + 1]?.superset_id === row.superset_id;
              return <View key={row.id} style={s.card} testID={`plan-exercise-${index}`}>
                <Text style={s.title}>{index + 1}. {row.exercises?.name}</Text>
                <Text style={s.muted}>{row.exercises?.muscle_groups?.name || 'Bez partii'} · {info.short}{row.superset_id ? ` · Superseria ${[...new Set(rows.map(r => r.superset_id).filter(Boolean))].indexOf(row.superset_id) + 1}` : ''}</Text>
                <View style={s.row}>
                  <PanelButton label={`Przenieś ${row.exercises?.name} wyżej`} disabled={disabled || index === 0} onPress={() => move(index, -1)}>↑ Wyżej</PanelButton>
                  <PanelButton label={`Przenieś ${row.exercises?.name} niżej`} disabled={disabled || index === rows.length - 1} onPress={() => move(index, 1)}>↓ Niżej</PanelButton>
                  <PanelButton label={`Usuń ${row.exercises?.name} z planu`} disabled={disabled} quiet onPress={() => removeExercise(index)}>Usuń</PanelButton>
                </View>
                {row.sets_data.map((set, setIndex) => <View key={setIndex} style={[s.line, { gap: 10 }]}>
                  <View style={[s.row, { justifyContent: 'space-between' }]}>
                    <Text style={s.text}>Seria {setIndex + 1}</Text>
                    <PanelButton label={`Usuń serię ${setIndex + 1} ćwiczenia ${row.exercises?.name}`} disabled={disabled} onPress={() => editSets(index, sets => sets.filter((_, i) => i !== setIndex))}>Usuń serię</PanelButton>
                  </View>
                  <View style={[s.row, { alignItems: 'flex-start' }]}>
                    {['reps', 'weight'].map(field => <LibraryInput key={field} style={{ flex: 1, minWidth: 100 }}
                      label={field === 'reps' ? (row.exercises?.unit === 'KG' || !row.exercises?.unit ? 'Powtórzenia' : 'Razy') : `${info.measure} (${info.short})`}
                      value={String(set[field] ?? '')} placeholder="—" keyboardType="decimal-pad" editable={!disabled}
                      onChangeText={value => editSets(index, sets => sets.map((entry, i) => i === setIndex ? { ...entry, [field]: value } : entry))} />)}
                  </View>
                </View>)}
                {!row.sets_data.length && <Text style={s.muted}>Dodaj pierwszą serię i określ jej wartości.</Text>}
                <PanelButton disabled={disabled} onPress={() => editSets(index, sets => [...sets, { reps: '', weight: '' }])}>Dodaj serię</PanelButton>
                {index < rows.length - 1 && <PanelButton selected={!!linked} disabled={disabled} onPress={() => toggleSuperset(index)}>{linked ? 'Rozłącz superserię' : 'Połącz z następnym w superserię'}</PanelButton>}
              </View>;
            })}
            <View style={[s.card, { backgroundColor: T.background }]}>
              <Text style={s.title}>Dodaj ćwiczenie do planu</Text>
              <LibraryInput label="Szukaj w bibliotece" value={search} onChangeText={setSearch} placeholder="Nazwa lub partia mięśniowa" />
              <DropdownPicker placeholder="Ćwiczenie do dodania" selectedValue={exerciseId} onValueChange={v => !busy && setExerciseId(v)}
                items={[{ label: 'Wybierz ćwiczenie', value: '' }, ...options.map(e => ({ value: e.id, label: `${e.name} · ${e.part} · ${unitInfo(e.unit).short}` }))]} />
              <PanelButton disabled={disabled || !exerciseId} primary onPress={addExercise}>Dodaj do planu</PanelButton>
              <PanelButton disabled={disabled} selected={newExercise} onPress={() => { setNewExercise(v => !v); if (!exerciseGroup && groups.length) setExerciseGroup(groups[0].id); }}>Stwórz nowe ćwiczenie</PanelButton>
              {!options.length && <Text style={s.muted}>Brak kolejnych ćwiczeń pasujących do wyszukiwania. Możesz utworzyć nowe poniżej.</Text>}
              {newExercise && <View style={s.line}>
                <Text style={s.title}>Nowe ćwiczenie w tym planie</Text>
                <LibraryInput label="Nazwa nowego ćwiczenia" value={exerciseName} onChangeText={setExerciseName} editable={!disabled} maxLength={200} />
                <Text style={s.muted}>Partia mięśniowa</Text>
                <DropdownPicker placeholder="Partia nowego ćwiczenia" selectedValue={exerciseGroup} onValueChange={v => !busy && setExerciseGroup(v)} items={groups.map(g => ({ label: g.name, value: g.id }))} />
                <DropdownPicker placeholder="Jednostka nowego ćwiczenia" selectedValue={exerciseUnit} onValueChange={v => !busy && setExerciseUnit(v)} items={UNITS} />
                {!groups.length && <Text style={s.muted}>Utwórz najpierw partię mięśniową w generatorze.</Text>}
                <PanelButton disabled={disabled || !exerciseName.trim() || !exerciseGroup} primary onPress={createExercise}>Utwórz i dodaj do planu</PanelButton>
              </View>}
            </View>
            {dirty && <PanelButton disabled={disabled} primary onPress={save} style={{ borderColor: C.accent }}>Zapisz plan</PanelButton>}
          </>}
        </>}
      </>}
    </ScrollView>
  </Layout>;
}
