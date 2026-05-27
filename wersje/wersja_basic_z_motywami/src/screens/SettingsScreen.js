import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../assets/theme';
import { useTheme, THEMES } from '../context/ThemeContext';
import AppLayout from '../components/AppLayout';
import * as api from '../services/api';

export default function SettingsScreen({ navigation }) {
  const { theme, colors: C, setTheme } = useTheme();
  const [workoutTypes, setWorkoutTypes] = useState([]);
  const [muscleGroups, setMuscleGroups] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [newWT, setNewWT] = useState('');
  const [newMG, setNewMG] = useState('');
  const [newEx, setNewEx] = useState('');
  const [selectedMG, setSelectedMG] = useState('');
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [editSection, setEditSection] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [wt, mg, ex] = await Promise.all([
      api.getWorkoutTypes().catch(() => []),
      api.getMuscleGroups().catch(() => []),
      api.getExercisesGrouped().catch(() => ({})),
    ]);
    setWorkoutTypes(wt || []);
    setMuscleGroups(mg || []);
    const flat = [];
    Object.entries(ex || {}).forEach(([part, exs]) => {
      exs.forEach(e => flat.push({ ...e, part }));
    });
    setExercises(flat);
  }

  async function addWorkoutType() {
    if (!newWT.trim()) return;
    try { await api.createWorkoutType(newWT.trim()); setNewWT(''); loadAll(); } catch (e) { Alert.alert('Błąd', e.message); }
  }
  async function deleteWorkoutType(id) {
    try { await api.deleteWorkoutType(id); loadAll(); } catch (e) { Alert.alert('Błąd', e.message); }
  }

  async function addMuscleGroup() {
    if (!newMG.trim()) return;
    try { await api.createMuscleGroup(newMG.trim()); setNewMG(''); loadAll(); } catch (e) { Alert.alert('Błąd', e.message); }
  }
  async function deleteMuscleGroup(id) {
    try { await api.deleteMuscleGroup(id); loadAll(); } catch (e) { Alert.alert('Błąd', e.message); }
  }

  async function addExercise() {
    if (!newEx.trim() || !selectedMG) return;
    try {
      const mg = muscleGroups.find(m => m.id === selectedMG);
      await api.createExercise({ muscle_group_id: selectedMG, name: newEx.trim() });
      setNewEx(''); loadAll();
    } catch (e) { Alert.alert('Błąd', e.message); }
  }
  async function deleteExercise(id) {
    try { await api.deleteExercise(id); loadAll(); } catch (e) { Alert.alert('Błąd', e.message); }
  }

  const groupedExercises = {};
  exercises.forEach(e => {
    (groupedExercises[e.part] = groupedExercises[e.part] || []).push(e);
  });
  const mgMap = {};
  muscleGroups.forEach(m => { mgMap[m.id] = m.name; });

  return (
    <AppLayout navigation={navigation} title="Ustawienia" showBack>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Text style={styles.sectionTitle}>Wygląd</Text>
        <View style={styles.themeRow}>
          {Object.entries(THEMES).map(([key, t]) => (
            <TouchableOpacity
              key={key}
              style={[styles.themeBtn, { borderColor: t.accent }, theme === key && { backgroundColor: t.accent + '25' }]}
              onPress={() => setTheme(key)}
            >
              <View style={[styles.themeDot, { backgroundColor: t.accent }]} />
              <Text style={[styles.themeName, theme === key && { color: t.accent }]}>{t.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Rodzaje treningu</Text>
        <View style={styles.row}>
          <TextInput style={[styles.input, { flex: 1 }]} value={newWT} onChangeText={setNewWT} placeholder="Nowy rodzaj..." placeholderTextColor={COLORS.textMuted} />
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: C.accent }]} onPress={addWorkoutType}>
            <Text style={styles.addBtnText}>Dodaj</Text>
          </TouchableOpacity>
        </View>
        {workoutTypes.map(wt => (
          <View key={wt.id} style={styles.itemRow}>
            <Text style={styles.itemText}>{wt.name}</Text>
            <TouchableOpacity onPress={() => deleteWorkoutType(wt.id)}>
              <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Partie mięśniowe</Text>
        <View style={styles.row}>
          <TextInput style={[styles.input, { flex: 1 }]} value={newMG} onChangeText={setNewMG} placeholder="Nowa partia..." placeholderTextColor={COLORS.textMuted} />
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: C.accent }]} onPress={addMuscleGroup}>
            <Text style={styles.addBtnText}>Dodaj</Text>
          </TouchableOpacity>
        </View>
        {muscleGroups.map(mg => (
          <View key={mg.id} style={styles.itemRow}>
            <Text style={styles.itemText}>{mg.name}</Text>
            <TouchableOpacity onPress={() => deleteMuscleGroup(mg.id)}>
              <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Ćwiczenia</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={selectedMG} onValueChange={setSelectedMG} style={styles.picker} dropdownIconColor={COLORS.textSecondary}>
            <Picker.Item label="— Wybierz partię —" value="" color={COLORS.textMuted} />
            {muscleGroups.map(mg => (
              <Picker.Item key={mg.id} label={mg.name} value={mg.id} color={COLORS.text} />
            ))}
          </Picker>
        </View>
        {selectedMG && (
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1 }]} value={newEx} onChangeText={setNewEx} placeholder="Nowe ćwiczenie..." placeholderTextColor={COLORS.textMuted} />
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: C.accent }]} onPress={addExercise}>
              <Text style={styles.addBtnText}>Dodaj</Text>
            </TouchableOpacity>
          </View>
        )}

        {Object.entries(groupedExercises).map(([part, exs]) => (
          <View key={part} style={styles.exGroup}>
            <Text style={styles.exGroupTitle}>{part}</Text>
            {exs.map(ex => (
              <View key={ex.id} style={styles.itemRow}>
                <Text style={styles.itemText}>{ex.name}</Text>
                <TouchableOpacity onPress={() => deleteExercise(ex.id)}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}

      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: 100 },
  sectionTitle: {
    color: COLORS.accent, fontSize: 14, fontWeight: '700', marginTop: 24, marginBottom: 10,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  themeRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 8 },
  themeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    borderWidth: 2, backgroundColor: COLORS.surface,
  },
  themeDot: { width: 16, height: 16, borderRadius: 8 },
  themeName: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.surface, borderRadius: 10, padding: 12, fontSize: 14,
    color: COLORS.text, borderWidth: 1, borderColor: COLORS.border,
  },
  addBtn: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, justifyContent: 'center' },
  addBtnText: { color: COLORS.background, fontWeight: '700', fontSize: 13 },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: COLORS.surface, borderRadius: 10,
    marginBottom: 4, borderWidth: 1, borderColor: COLORS.border,
  },
  itemText: { color: COLORS.text, fontSize: 14 },
  pickerWrap: { backgroundColor: COLORS.surface, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', marginBottom: 8 },
  picker: { color: COLORS.text, height: 50, backgroundColor: COLORS.surface },
  exGroup: { marginTop: 8 },
  exGroupTitle: { color: COLORS.accent, fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
});
