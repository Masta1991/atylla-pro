import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppLayout from '../components/AppLayout';
import { LibraryPicker as DropdownPicker, LibraryButton as PanelButton, useLibraryTheme as usePanelTheme } from '../components/WorkoutLibraryUI';
import { LoadState } from '../components/TrainerPanels';
import { LibraryInput, UNITS, unitInfo } from '../components/WorkoutLibraryUI';
import { askConfirmation, showError } from '../services/confirm';
import * as api from '../services/api';

export default function MuscleExercisesScreen({ navigation, embedded = false, header, initialGroup, registerGuard, onCreated, onDeleted }) {
  const { s, C, T } = usePanelTheme();
  const [groups, setGroups] = useState([]), [exercises, setExercises] = useState([]);
  const [tab, setTab] = useState(initialGroup?.create ? 'groups' : 'exercises'), [query, setQuery] = useState(''), [filter, setFilter] = useState(initialGroup?.name || '');
  const [form, setForm] = useState(false), [name, setName] = useState(''), [group, setGroup] = useState(initialGroup?.id || ''), [unit, setUnit] = useState('KG');
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const lock = useRef(false), sequence = useRef(0);
  useEffect(() => {
    registerGuard?.(async () => !lock.current && (!(name.trim() || groupName.trim()) || await askConfirmation('Niezapisany formularz', 'Odrzucić wpisane dane i zmienić wybór?', 'Odrzuć zmiany')));
    return () => registerGuard?.(null);
  }, [registerGuard, name, groupName]);
  const load = useCallback(async () => {
    const seq = ++sequence.current; setLoading(true); setError('');
    try {
      const [gs, grouped] = await Promise.all([api.getMuscleGroups(), api.getExercisesGrouped()]);
      if (seq !== sequence.current) return;
      setGroups(gs); setExercises(Object.entries(grouped).flatMap(([part, rows]) => rows.map(e => ({ ...e, part }))));
    } catch (e) { if (seq === sequence.current) setError(e.message); }
    finally { if (seq === sequence.current) setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); return () => { sequence.current++; }; }, [load]));
  async function run(action) {
    if (lock.current) return;
    const trigger = typeof document !== 'undefined' ? document.activeElement : null;
    lock.current = true; setBusy(true); setMessage('');
    try { await action(); } catch (e) { await showError(e.message); }
    finally { lock.current = false; setBusy(false); requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus(); }); }
  }
  const addExercise = () => run(async () => {
    if (!name.trim() || !group) return;
    await api.createExercise({ name: name.trim(), muscle_group_id: group, unit });
    setName(''); setForm(false); setMessage('Ćwiczenie dodane do biblioteki.'); await load();
  });
  const addGroup = () => run(async () => {
    if (!groupName.trim()) return;
    const created = await api.createMuscleGroup(groupName.trim());
    setGroupName(''); setGroup(created.id); setMessage('Partia mięśniowa dodana.'); await load(); onCreated?.(created);
  });
  const remove = (item, isGroup) => run(async () => {
    const details = isGroup
      ? 'Usunięcie partii usuwa też jej ćwiczenia, ich wpisy w planach i zapisane wyniki treningów. Tej operacji nie można cofnąć.'
      : 'Usunięcie ćwiczenia usuwa też jego wpisy we wszystkich planach i zapisane wyniki treningów. Tej operacji nie można cofnąć.';
    if (!await askConfirmation(`Usunąć „${item.name}”?`, details, 'Usuń trwale')) return;
    await (isGroup ? api.deleteMuscleGroup(item.id) : api.deleteExercise(item.id));
    if (isGroup && group === item.id) setGroup('');
    if (isGroup && filter === item.name) setFilter('');
    setMessage('Usunięto.'); await load(); if (isGroup) onDeleted?.();
  });
  const move = (ex, direction) => run(async () => {
    const rows = exercises.filter(e => e.part === ex.part), index = rows.findIndex(e => e.id === ex.id), target = index + direction;
    if (target < 0 || target >= rows.length) return;
    [rows[index], rows[target]] = [rows[target], rows[index]];
    const results = await Promise.allSettled(rows.map((e, i) => api.updateExercise(e.id, { sort_order: i })));
    await load();
    if (results.some(r => r.status === 'rejected')) throw new Error('Nie udało się zapisać całej kolejności. Odświeżono listę; sprawdź położenie ćwiczeń przed kolejną zmianą.');
  });
  const visible = exercises.filter(e => (!filter || e.part === filter) && `${e.name} ${e.part}`.toLocaleLowerCase('pl').includes(query.trim().toLocaleLowerCase('pl')));
  const Layout = embedded ? React.Fragment : AppLayout;
  return <Layout {...(embedded ? {} : { navigation, title: 'Ćwiczenia i partie', showBack: true })}>
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      {header}
      {!embedded && <>
      <Text style={s.heading}>Biblioteka ćwiczeń</Text>
      <Text style={s.muted}>Twórz ćwiczenia, przypisuj je do partii mięśniowych i wybieraj sposób mierzenia wyniku.</Text>
      <View style={s.row}>
        <PanelButton selected={tab === 'exercises'} disabled={busy} onPress={() => setTab('exercises')}>Ćwiczenia</PanelButton>
        <PanelButton selected={tab === 'groups'} disabled={busy} onPress={() => setTab('groups')}>Partie mięśniowe</PanelButton>
        <PanelButton disabled={busy} onPress={() => navigation.navigate('PlanManager')}>Przejdź do planów</PanelButton>
      </View>
      </>}
      <LoadState loading={loading} error={error} retry={load} />
      {!!message && <Text style={s.text} accessibilityLiveRegion="polite">{message}</Text>}
      {!loading && !error && (tab === 'groups' ? <>
        <View style={s.card}>
          <Text style={s.title}>Nowa partia mięśniowa</Text>
          <LibraryInput label="Nazwa partii" placeholder="Np. Plecy" value={groupName} onChangeText={setGroupName} editable={!busy} maxLength={120} />
          <PanelButton disabled={busy || !groupName.trim()} primary onPress={addGroup}>Dodaj partię</PanelButton>
        </View>
        {!groups.length && <Text style={s.muted}>Dodaj pierwszą partię, aby przypisać do niej ćwiczenia.</Text>}
        {!embedded && groups.map(g => <View key={g.id} style={s.card}>
          <Text style={s.title}>{g.name}</Text><Text style={s.muted}>Ćwiczenia: {exercises.filter(e => e.part === g.name).length}</Text>
          <View style={s.row}>
            <PanelButton disabled={busy} onPress={() => { setFilter(g.name); setQuery(''); setTab('exercises'); }}>Pokaż ćwiczenia</PanelButton>
            <PanelButton disabled={busy} label={`Usuń partię ${g.name}`} quiet onPress={() => remove(g, true)}>Usuń partię</PanelButton>
          </View>
        </View>)}
      </> : <>
        <View style={s.card}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <Text style={s.title}>{embedded ? `${initialGroup.name} · ${visible.length} ćwiczeń` : `Ćwiczenia · ${exercises.length}`}</Text>
            <PanelButton disabled={busy} selected={form} onPress={() => { setForm(v => !v); if (!group && groups.length) setGroup(groups[0].id); }}>Nowe ćwiczenie</PanelButton>
          </View>
          <LibraryInput label="Szukaj ćwiczenia" placeholder="Nazwa ćwiczenia lub partii" value={query} onChangeText={setQuery} />
          {!embedded && <DropdownPicker placeholder="Filtr partii" selectedValue={filter} onValueChange={setFilter}
            items={[{ label: 'Wszystkie partie', value: '' }, ...groups.map(g => ({ label: g.name, value: g.name }))]} />}
          {embedded && <PanelButton disabled={busy} quiet onPress={() => remove({ id: initialGroup.id, name: initialGroup.name }, true)}>Usuń partię</PanelButton>}
        </View>
        {form && <View style={[s.card, { borderColor: C.accent }]}>
          <Text style={s.title}>Nowe ćwiczenie</Text>
          <LibraryInput label="Nazwa ćwiczenia" placeholder="Np. Wiosłowanie hantlem" value={name} onChangeText={setName} editable={!busy} maxLength={200} />
          {groups.length ? <>
            <Text style={s.muted}>Partia mięśniowa</Text>
            {embedded ? <Text style={s.text}>{initialGroup.name}</Text> : <DropdownPicker placeholder="Partia ćwiczenia" selectedValue={group} onValueChange={v => !busy && setGroup(v)} items={groups.map(g => ({ label: g.name, value: g.id }))} />}
          </> : <PanelButton onPress={() => setTab('groups')}>Najpierw dodaj partię mięśniową</PanelButton>}
          <Text style={s.muted}>Jednostka wyniku</Text>
          <DropdownPicker placeholder="Jednostka wyniku" selectedValue={unit} onValueChange={v => !busy && setUnit(v)} items={UNITS} />
          <Text style={s.muted}>Ta jednostka będzie widoczna w planie i podczas zapisywania treningu.</Text>
          <View style={s.row}>
            <PanelButton disabled={busy || !name.trim() || !group} primary onPress={addExercise}>Dodaj ćwiczenie</PanelButton>
            <PanelButton disabled={busy} onPress={() => setForm(false)}>Anuluj</PanelButton>
          </View>
        </View>}
        <Text style={s.muted}>Wyniki wyszukiwania: {visible.length}</Text>
        {!visible.length && <Text style={s.text}>{exercises.length ? 'Brak ćwiczeń pasujących do filtrów.' : 'Biblioteka jest pusta. Dodaj pierwsze ćwiczenie.'}</Text>}
        {visible.map(ex => {
          const siblings = exercises.filter(e => e.part === ex.part), index = siblings.findIndex(e => e.id === ex.id);
          return <View key={ex.id} style={s.card}>
            <Text style={s.title}>{ex.name}</Text>
            <View style={s.row}><Text style={s.muted}>{ex.part}</Text><Text style={[s.text, { backgroundColor: T.background, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }]}>{unitInfo(ex.unit).short}</Text></View>
            <View style={s.row}>
              <PanelButton label={`Przenieś ${ex.name} wyżej`} disabled={busy || !!query || index === 0} onPress={() => move(ex, -1)}>↑ Wyżej</PanelButton>
              <PanelButton label={`Przenieś ${ex.name} niżej`} disabled={busy || !!query || index === siblings.length - 1} onPress={() => move(ex, 1)}>↓ Niżej</PanelButton>
              <PanelButton label={`Usuń ćwiczenie ${ex.name}`} disabled={busy} quiet onPress={() => remove(ex, false)}>Usuń</PanelButton>
            </View>
          </View>;
        })}
      </>)}
    </ScrollView>
  </Layout>;
}
