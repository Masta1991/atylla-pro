import React, { useCallback, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppLayout from '../components/AppLayout';
import { LibraryPicker as DropdownPicker, LibraryButton as PanelButton, useLibraryTheme as usePanelTheme } from '../components/WorkoutLibraryUI';
import { LoadState } from '../components/TrainerPanels';
import { planSetText, workoutCatalog, workoutShareText } from '../services/workoutCatalog';
import { showError } from '../services/confirm';
import * as api from '../services/api';

export default function PlansScreen({ navigation }) {
  const { s, T } = usePanelTheme();
  const [catalog, setCatalog] = useState([]), [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [sending, setSending] = useState(false);
  const sequence = useRef(0), nextToken = useRef(0), selectedKeys = useRef(new Set()), sendLock = useRef(false);
  const load = useCallback(async () => {
    const seq = ++sequence.current; setLoading(true); setError('');
    try {
      const [plans, groups, grouped] = await Promise.all([api.getPlans(), api.getMuscleGroups(), api.getExercisesGrouped()]);
      if (seq === sequence.current) setCatalog(workoutCatalog(plans, groups, grouped));
    } catch (e) { if (seq === sequence.current) setError(e.message); }
    finally { if (seq === sequence.current) setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); return () => { sequence.current++; }; }, [load]));

  async function add(key) {
    const item = catalog.find(entry => entry.key === key);
    if (!item || selectedKeys.current.has(key) || sendLock.current) return;
    selectedKeys.current.add(key);
    const token = ++nextToken.current;
    setBlocks(prev => [...prev, { ...item, token, exercises: item.type === 'group' ? item.exercises : null }]);
    if (item.type === 'group') return;
    try {
      const exercises = await api.getPlanExercises(item.id);
      setBlocks(prev => prev.map(block => block.token === token ? { ...block, exercises } : block));
    } catch (e) {
      setBlocks(prev => prev.map(block => block.token === token ? { ...block, error: e.message } : block));
    }
  }
  function remove(key) {
    if (sendLock.current) return;
    selectedKeys.current.delete(key); setBlocks(prev => prev.filter(block => block.key !== key));
  }
  const pending = blocks.some(block => !block.exercises);
  async function handleSend() {
    if (sendLock.current || !blocks.length || pending) return;
    sendLock.current = true; setSending(true);
    try {
      if (Platform.OS === 'web' && navigator.canShare) {
        try {
          const htmlToImage = require('html-to-image');
          const node = document.getElementById('plan-capture-area');
          if (node) {
            // Preserve measured dimensions: adding padding only to the clone clips its content.
            const blob = await htmlToImage.toBlob(node, { backgroundColor: T.background, pixelRatio: 2,
              filter: element => !element.hasAttribute?.('data-share-control') });
            if (blob) {
              const file = new File([blob], 'plan_treningowy.png', { type: 'image/png' });
              if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: 'Plan Treningowy', text: 'Twój Plan Treningowy' });
                return;
              }
            }
          }
        } catch (e) { if (e.name === 'AbortError') return; }
      }
      await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(workoutShareText(blocks))}`);
    } catch (e) { await showError('Nie udało się otworzyć udostępniania. ' + e.message); }
    finally { sendLock.current = false; setSending(false); }
  }

  return <AppLayout navigation={navigation} title="Plany treningowe" showBack>
    <ScrollView contentContainerStyle={s.scroll}>
      <Text style={s.title}>Wybierz partię lub plan treningowy</Text>
      <Text style={s.muted}>Każdy wybór dodaje zestaw poniżej. Możesz połączyć kilka partii i planów, a następnie wysłać je razem.</Text>
      <LoadState loading={loading} error={error} retry={load} />
      {!loading && !error && <DropdownPicker placeholder="Wybierz partię lub plan" selectedValue="" onValueChange={add}
        items={[{ label: 'Wybierz z listy', value: '' }, ...catalog.filter(item => !blocks.some(block => block.key === item.key)).map(item => ({ label: item.label, value: item.key }))]} />}
      {!blocks.length && <Text style={s.muted}>Wybrane partie i plany pojawią się tutaj.</Text>}
      <View nativeID="plan-capture-area" style={{ backgroundColor: T.background, gap: 16 }}>
        {blocks.map(block => <View key={block.token} style={s.card} testID={`preview-${block.key}`}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1, minWidth: 100 }}>
              <Text style={s.muted}>{block.type === 'group' ? 'Partia mięśniowa' : 'Plan treningowy'}</Text>
              <Text style={s.heading}>{block.name}</Text>
            </View>
            <PanelButton dataSet={{ shareControl: true }} disabled={sending} label={`Usuń ${block.name} z podglądu`} quiet onPress={() => remove(block.key)}>Usuń</PanelButton>
          </View>
          {block.error ? <View style={s.line}>
            <Text style={s.error} accessibilityRole="alert">Nie udało się pobrać tego planu. {block.error}</Text>
            <PanelButton dataSet={{ shareControl: true }} onPress={() => { remove(block.key); add(block.key); }}>Pobierz ponownie</PanelButton>
          </View> : !block.exercises ? <Text style={s.muted}>Pobieranie ćwiczeń…</Text> : block.exercises.length === 0 ? <Text style={s.muted}>Brak ćwiczeń w tym zestawie.</Text> : block.exercises.map((row, i) => <View key={row.id || row.exercise_id || i} style={s.line}>
            <Text style={s.title}>{i + 1}. {row.exercises?.name || row.exercise_id}</Text>
            {(row.sets_data || []).map((set, index) => <Text key={index} style={s.text}>Seria {index + 1}: {planSetText(set, row.exercises?.unit)}</Text>)}
          </View>)}
        </View>)}
      </View>
      {!!blocks.length && <PanelButton disabled={sending || pending} primary onPress={handleSend} label="Wyślij plan przez WhatsApp">
        {sending ? 'Przygotowywanie…' : 'Wyślij plan przez WhatsApp'}
      </PanelButton>}
    </ScrollView>
  </AppLayout>;
}
