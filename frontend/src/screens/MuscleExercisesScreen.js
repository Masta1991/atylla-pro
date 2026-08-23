import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Alert } from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import { Ionicons } from '@expo/vector-icons';
import { SPACING } from '../assets/theme';
import { useTheme } from '../context/ThemeContext';
import AppLayout from '../components/AppLayout';
import * as api from '../services/api';

export default function MuscleExercisesScreen({ navigation }) {
  const { colors: C, themeColors } = useTheme();
  const styles = useMemo(() => makeStyles(C.accent, themeColors), [C.accent, themeColors]);
  
  const [muscleGroups, setMuscleGroups] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [newMG, setNewMG] = useState('');
  const [newEx, setNewEx] = useState('');
  const [newExUnit, setNewExUnit] = useState('KG');
  const [selectedMG, setSelectedMG] = useState('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [mg, ex] = await Promise.all([
        api.getMuscleGroups().catch(() => []),
        api.getExercisesGrouped().catch(() => ({})),
      ]);
      setMuscleGroups(mg || []);
      const flat = [];
      Object.entries(ex || {}).forEach(([part, exs]) => {
        exs.forEach(e => flat.push({ ...e, part }));
      });
      setExercises(flat);
    } catch (e) {
      console.log(e);
    }
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
      await api.createExercise({ muscle_group_id: selectedMG, name: newEx.trim(), unit: newExUnit });
      setNewEx('');
      setNewExUnit('KG');
      loadAll();
    } catch (e) { Alert.alert('Blad', e.message); }
  }
  async function deleteExercise(id) {
    try { await api.deleteExercise(id); loadAll(); } catch (e) { Alert.alert('Błąd', e.message); }
  }

  const groupedExercises = {};
  exercises.forEach(e => {
    (groupedExercises[e.part] = groupedExercises[e.part] || []).push(e);
  });

  async function moveExercise(part, index, direction) {
    const exs = groupedExercises[part];
    if ((direction === -1 && index === 0) || (direction === 1 && index === exs.length - 1)) return;
    
    const newExs = [...exs];
    const temp = newExs[index];
    newExs[index] = newExs[index + direction];
    newExs[index + direction] = temp;
    
    // Optymistyczna aktualizacja, żeby nie czekać na reload
    const newFlat = exercises.map(e => {
       if (e.part === part) {
          const newIdx = newExs.findIndex(nx => nx.id === e.id);
          return { ...e, sort_order: newIdx };
       }
       return e;
    }).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    setExercises(newFlat);

    try {
      await Promise.all(
        newExs.map((ex, idx) => api.updateExercise(ex.id, { sort_order: idx }))
      );
      loadAll();
    } catch (e) {
      Alert.alert('Błąd', e.message);
    }
  }

  return (
    <AppLayout navigation={navigation} title="Partie Mięśniowe" showBack>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.sectionTitle}>Partie mięśniowe</Text>
        <View style={styles.row}>
          <TextInput style={[styles.input, { flex: 1 }]} value={newMG} onChangeText={setNewMG} placeholder="Nowa partia..." placeholderTextColor={themeColors.textMuted} />
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: C.accent }]} onPress={addMuscleGroup}>
            <Text style={styles.addBtnText}>Dodaj</Text>
          </TouchableOpacity>
        </View>
        {muscleGroups.map(mg => (
          <View key={mg.id} style={styles.itemRow}>
            <Text style={styles.itemText}>{mg.name}</Text>
            <TouchableOpacity onPress={() => deleteMuscleGroup(mg.id)}>
              <Ionicons name="trash-outline" size={18} color={themeColors.danger} />
            </TouchableOpacity>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Ćwiczenia</Text>
        <DropdownPicker
          placeholder="— Wybierz partię —"
          selectedValue={selectedMG}
          onValueChange={setSelectedMG}
          style={styles.pickerWrap}
          dropdownIconColor={themeColors.textSecondary}
          items={[
            { label: "— Wybierz partię —", value: "", color: themeColors.textMuted },
            ...muscleGroups.map(mg => ({ label: mg.name, value: mg.id, color: themeColors.text }))
          ]}
        />
        {selectedMG !== '' && (
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1 }]} value={newEx} onChangeText={setNewEx} placeholder="Nowe cwiczenie..." placeholderTextColor={themeColors.textMuted} />
            <DropdownPicker
              selectedValue={newExUnit}
              onValueChange={setNewExUnit}
              style={[styles.pickerWrap, { width: 95, marginLeft: 8, marginBottom: 0 }]}
              dropdownIconColor={themeColors.textSecondary}
              items={[
                { label: "KG", value: "KG", color: themeColors.text },
                { label: "KM", value: "KM", color: themeColors.text },
                { label: "POW", value: "POW", color: themeColors.text },
                { label: "MIN", value: "MIN", color: themeColors.text },
                { label: "SEK", value: "SEK", color: themeColors.text }
              ]}
            />
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: C.accent }]} onPress={addExercise}>
              <Text style={styles.addBtnText}>Dodaj</Text>
            </TouchableOpacity>
          </View>
        )}

        {Object.entries(groupedExercises).map(([part, exs]) => (
          <View key={part} style={styles.exGroup}>
            <Text style={styles.exGroupTitle}>{part}</Text>
            {exs.map((ex, idx) => (
              <View key={ex.id} style={styles.itemRow}>
                <Text style={[styles.itemText, { flex: 1 }]}>{ex.name}</Text>
                <View style={{flexDirection: 'row', gap: 12, alignItems: 'center'}}>
                  <TouchableOpacity onPress={() => moveExercise(part, idx, -1)} disabled={idx === 0}>
                    <Ionicons name="arrow-up" size={18} color={idx === 0 ? themeColors.textMuted + '40' : themeColors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => moveExercise(part, idx, 1)} disabled={idx === exs.length - 1}>
                    <Ionicons name="arrow-down" size={18} color={idx === exs.length - 1 ? themeColors.textMuted + '40' : themeColors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteExercise(ex.id)} style={{marginLeft: 4}}>
                    <Ionicons name="trash-outline" size={18} color={themeColors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ))}

      </ScrollView>
    </AppLayout>
  );
}

function makeStyles(accent, TC) {
  return StyleSheet.create({
    scroll: { paddingHorizontal: SPACING.lg, paddingBottom: 100, paddingTop: 16 },
    sectionTitle: {
      color: accent, fontSize: 14, fontWeight: '700', marginTop: 24, marginBottom: 10,
      textTransform: 'uppercase', letterSpacing: 1,
    },
    row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    input: {
      backgroundColor: TC.surface, borderRadius: 10, padding: 12, fontSize: 14,
      color: TC.text, borderWidth: 1, borderColor: TC.border,
    },
    addBtn: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, justifyContent: 'center' },
    addBtnText: { color: TC.background, fontWeight: '700', fontSize: 13 },
    itemRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 10, paddingHorizontal: 12,
      backgroundColor: TC.surface, borderRadius: 10,
      marginBottom: 4, borderWidth: 1, borderColor: TC.border,
    },
    itemText: { color: TC.text, fontSize: 14 },
    pickerWrap: { backgroundColor: TC.surface, borderRadius: 10, borderWidth: 1, borderColor: TC.border, overflow: 'hidden', marginBottom: 8 },
    picker: { color: TC.text, height: 50, backgroundColor: TC.surface },
    exGroup: { marginTop: 8 },
    exGroupTitle: { color: accent, fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  });
}
