import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Alert, LayoutAnimation } from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import { Ionicons } from '@expo/vector-icons';
import { SPACING } from '../assets/theme';
import { useTheme } from '../context/ThemeContext';
import AppLayout from '../components/AppLayout';
import * as api from '../services/api';

export default function PlanManagerScreen({ navigation }) {
  const { colors: C, themeColors } = useTheme();
  const styles = useMemo(() => makeStyles(C.accent, themeColors), [C.accent, themeColors]);
  
  const [plans, setPlans] = useState([]);
  const [allExercises, setAllExercises] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [planExercises, setPlanExercises] = useState([]);
  
  const [newPlanName, setNewPlanName] = useState('');
  const [selectedExToAdd, setSelectedExToAdd] = useState('');
  
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [pl, ex] = await Promise.all([
        api.getPlans().catch(() => []),
        api.getExercisesGrouped().catch(() => ({})),
      ]);
      setPlans(pl || []);
      
      const flat = [];
      Object.entries(ex || {}).forEach(([part, exs]) => {
        exs.forEach(e => flat.push({ ...e, part }));
      });
      setAllExercises(flat.sort((a,b) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.log(e);
    }
  }

  useEffect(() => {
    if (selectedPlanId) loadPlanDetails(selectedPlanId);
    else setPlanExercises([]);
  }, [selectedPlanId]);

  async function loadPlanDetails(id) {
    try {
      const data = await api.getPlanExercises(id);
      const mapped = (data || []).map(item => ({
        ...item,
        sets_data: Array.isArray(item.sets_data) ? item.sets_data : []
      }));
      setPlanExercises(mapped);
    } catch (e) { console.log(e); }
  }

  async function handleCreatePlan() {
    if (!newPlanName.trim()) return;
    try {
      const p = await api.createPlan({ name: newPlanName.trim() });
      setNewPlanName('');
      await loadAll();
      setSelectedPlanId(p.id);
    } catch (e) { Alert.alert('Błąd', e.message); }
  }

  async function handleDeletePlan() {
    if (!selectedPlanId) return;
    try {
      await api.deletePlan(selectedPlanId);
      setSelectedPlanId('');
      loadAll();
    } catch (e) { Alert.alert('Błąd', e.message); }
  }

  async function addExerciseToPlan() {
    if (!selectedExToAdd || !selectedPlanId) return;
    try {
      await api.addExerciseToPlan(selectedPlanId, { exercise_id: selectedExToAdd, sort_order: planExercises.length, sets_data: [] });
      setSelectedExToAdd('');
      loadPlanDetails(selectedPlanId);
    } catch (e) { Alert.alert('Błąd', e.message); }
  }
  
  async function removeExerciseFromPlan(planExId) {
    try {
      await api.removeExerciseFromPlan(planExId);
      loadPlanDetails(selectedPlanId);
    } catch (e) { Alert.alert('Błąd', e.message); }
  }

  function addSet(exIndex) {
    const updated = [...planExercises];
    updated[exIndex].sets_data.push({ reps: '10', weight: '50' });
    setPlanExercises(updated);
  }

  function updateSet(exIndex, setIndex, field, value) {
    const updated = [...planExercises];
    updated[exIndex].sets_data[setIndex][field] = value;
    setPlanExercises(updated);
  }

  function removeSet(exIndex, setIndex) {
    const updated = [...planExercises];
    updated[exIndex].sets_data.splice(setIndex, 1);
    setPlanExercises(updated);
  }

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const toggleSuperset = async (exIdx) => {
    try {
      const currentEx = planExercises[exIdx];
      const nextEx = planExercises[exIdx + 1];
      if (!nextEx) return;

      const isLinked = currentEx.superset_id && currentEx.superset_id === nextEx.superset_id;

      if (isLinked) {
        await api.updatePlanExercise(nextEx.id, { superset_id: null });
        setPlanExercises(prev => {
          const copy = [...prev];
          copy[exIdx + 1].superset_id = null;
          return copy;
        });
      } else {
        const sid = currentEx.superset_id || generateUUID();
        const updates = [];
        if (!currentEx.superset_id) {
          updates.push(api.updatePlanExercise(currentEx.id, { superset_id: sid }));
        }
        updates.push(api.updatePlanExercise(nextEx.id, { superset_id: sid }));
        await Promise.all(updates);
        setPlanExercises(prev => {
          const copy = [...prev];
          copy[exIdx].superset_id = sid;
          copy[exIdx + 1].superset_id = sid;
          return copy;
        });
      }
    } catch (e) {
      Alert.alert('Błąd', 'Nie udało się zaktualizować superserii.');
    }
  };

  function movePlanExercise(exIndex, direction) {
    if ((direction === -1 && exIndex === 0) || (direction === 1 && exIndex === planExercises.length - 1)) return;
    const updated = [...planExercises];
    const temp = updated[exIndex];
    updated[exIndex] = updated[exIndex + direction];
    updated[exIndex + direction] = temp;
    setPlanExercises(updated);
  }

  async function savePlan() {
    if (!selectedPlanId) return;
    setSaving(true);
    try {
      await Promise.all(
        planExercises.map((ex, idx) => 
          api.updatePlanExercise(ex.id, { sets_data: ex.sets_data, sort_order: idx })
        )
      );
      Alert.alert('Sukces', 'Plan został zapisany!');
    } catch (e) {
      Alert.alert('Błąd', e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout navigation={navigation} title="Edytor Planów" showBack>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.label}>Wybierz plan do edycji</Text>
        <DropdownPicker
          placeholder="— Wybierz plan —"
          selectedValue={selectedPlanId}
          onValueChange={setSelectedPlanId}
          style={styles.pickerWrap}
          dropdownIconColor={themeColors.textSecondary}
          items={[
            { label: "— Wybierz plan —", value: "", color: themeColors.textMuted },
            ...plans.map(p => ({ label: p.name, value: p.id, color: themeColors.text }))
          ]}
        />

        <View style={styles.row}>
          <TextInput style={[styles.input, { flex: 1 }]} value={newPlanName} onChangeText={setNewPlanName} placeholder="Lub utwórz nowy plan..." placeholderTextColor={themeColors.textMuted} />
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: C.accent }]} onPress={handleCreatePlan}>
            <Text style={styles.addBtnText}>Utwórz</Text>
          </TouchableOpacity>
        </View>

        {selectedPlanId ? (
          <View style={styles.planContainer}>
            <View style={styles.planHeaderRow}>
              <Text style={styles.planTitle}>Edytujesz: {plans.find(p=>p.id===selectedPlanId)?.name}</Text>
              <TouchableOpacity onPress={handleDeletePlan} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                <Ionicons name="trash-outline" size={22} color={themeColors.danger} />
              </TouchableOpacity>
            </View>

            {planExercises.map((ex, exIdx) => {
              const isLinkedToNext = ex.superset_id && planExercises[exIdx + 1] && planExercises[exIdx + 1].superset_id === ex.superset_id;
              const isLinkedToPrev = ex.superset_id && exIdx > 0 && planExercises[exIdx - 1].superset_id === ex.superset_id;

              return (
                <View key={ex.id} style={[styles.exerciseCard, isLinkedToPrev && { marginTop: -8, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTopWidth: 0 }]}>
                  {isLinkedToPrev && (
                    <View style={styles.supersetLinkBadge}>
                      <Ionicons name="link" size={14} color="#fff" />
                      <Text style={styles.supersetLinkText}>Superseria</Text>
                    </View>
                  )}
                  <View style={styles.exHeader}>
                    <Text style={styles.exTitle}>{ex.exercises?.name}</Text>
                    <View style={{flexDirection: 'row', gap: 12, alignItems: 'center'}}>
                    <TouchableOpacity onPress={() => movePlanExercise(exIdx, -1)} disabled={exIdx === 0}>
                      <Ionicons name="arrow-up" size={20} color={exIdx === 0 ? themeColors.textMuted + '40' : themeColors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => movePlanExercise(exIdx, 1)} disabled={exIdx === planExercises.length - 1}>
                      <Ionicons name="arrow-down" size={20} color={exIdx === planExercises.length - 1 ? themeColors.textMuted + '40' : themeColors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeExerciseFromPlan(ex.id)} style={{marginLeft: 8}}>
                      <Ionicons name="close-circle" size={24} color={themeColors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>

                {ex.sets_data.map((set, setIdx) => (
                  <View key={setIdx} style={styles.setRow}>
                    <Text style={styles.setLabel}>Seria {setIdx + 1}:</Text>
                    <TextInput 
                      style={styles.setInput} 
                      value={String(set.reps)} 
                      onChangeText={(v) => updateSet(exIdx, setIdx, 'reps', v)} 
                      keyboardType="numeric"
                      placeholder="Powt."
                      placeholderTextColor={themeColors.textMuted}
                    />
                    <Text style={styles.setLabelX}>x</Text>
                    <TextInput 
                      style={styles.setInput} 
                      value={String(set.weight)} 
                      onChangeText={(v) => updateSet(exIdx, setIdx, 'weight', v)} 
                      keyboardType="numeric"
                      placeholder="Ciężar (kg)"
                      placeholderTextColor={themeColors.textMuted}
                    />
                    <Text style={styles.setLabelX}>kg</Text>
                    <TouchableOpacity onPress={() => removeSet(exIdx, setIdx)} style={{marginLeft: 'auto'}}>
                      <Ionicons name="trash-outline" size={18} color={themeColors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(exIdx)}>
                  <Ionicons name="add" size={16} color={C.accent} />
                  <Text style={styles.addSetText}>Dodaj serię</Text>
                </TouchableOpacity>

                {exIdx < planExercises.length - 1 && (
                  <TouchableOpacity 
                    style={[styles.supersetBtn, isLinkedToNext && styles.supersetBtnActive]} 
                    onPress={() => toggleSuperset(exIdx)}
                  >
                    <Ionicons name={isLinkedToNext ? "unlink" : "link"} size={16} color={isLinkedToNext ? themeColors.danger : C.accent} />
                    <Text style={[styles.supersetBtnText, isLinkedToNext && { color: themeColors.danger }]}>
                      {isLinkedToNext ? "Odłącz od superserii" : "Połącz z następnym w superserię"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )})}

            <DropdownPicker
              placeholder="— Dodaj nowe ćwiczenie —"
              selectedValue={selectedExToAdd}
              onValueChange={setSelectedExToAdd}
              style={[styles.pickerWrap, {marginTop: 16}]}
              dropdownIconColor={themeColors.textSecondary}
              items={[
                { label: "— Dodaj nowe ćwiczenie —", value: "", color: themeColors.textMuted },
                ...allExercises.map(ex => ({ label: `${ex.name} (${ex.part})`, value: ex.id, color: themeColors.text }))
              ]}
            />
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: themeColors.surfaceLight, marginTop: 4, width: '100%', borderWidth: 1, borderColor: C.accent }]} onPress={addExerciseToPlan}>
              <Text style={[styles.addBtnText, {textAlign: 'center', color: C.accent}]}>Dodaj Ćwiczenie do Planu</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: C.accent }]} onPress={savePlan} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Zapisywanie...' : 'Zapisz Plan'}</Text>
            </TouchableOpacity>

          </View>
        ) : null}

      </ScrollView>
    </AppLayout>
  );
}

function makeStyles(accent, TC) {
  return StyleSheet.create({
    scroll: { paddingHorizontal: SPACING.lg, paddingBottom: 100, paddingTop: 16 },
    label: { color: TC.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 },
    pickerWrap: { backgroundColor: TC.surface, borderRadius: 12, borderWidth: 1, borderColor: TC.border, overflow: 'hidden', marginBottom: 12 },
    picker: { color: TC.text, height: 50, backgroundColor: TC.surface },
    row: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    input: { backgroundColor: TC.surface, borderRadius: 10, padding: 12, fontSize: 14, color: TC.text, borderWidth: 1, borderColor: TC.border },
    addBtn: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, justifyContent: 'center' },
    addBtnText: { color: TC.background, fontWeight: '700', fontSize: 13 },
    
    planContainer: { marginTop: 12, borderTopWidth: 1, borderTopColor: TC.border, paddingTop: 16 },
    planHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    planTitle: { color: TC.text, fontSize: 18, fontWeight: '800' },
    
    exerciseCard: { backgroundColor: TC.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: TC.border },
    exHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    exTitle: { color: TC.text, fontSize: 15, fontWeight: '700', flex: 1 },
    
    setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: TC.surfaceLight },
    setLabel: { color: TC.textSecondary, fontSize: 13, width: 55 },
    setInput: { backgroundColor: TC.background, color: TC.text, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, width: 60, textAlign: 'center', borderWidth: 1, borderColor: TC.border },
    setLabelX: { color: TC.textMuted, fontSize: 13, marginHorizontal: 8 },
    
    addSetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginTop: 4, borderRadius: 8, backgroundColor: TC.surfaceLight },
    addSetText: { color: accent, fontSize: 13, fontWeight: '600', marginLeft: 4 },
    
    saveBtn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 32 },
    saveBtnText: { color: TC.background, fontWeight: '700', fontSize: 16 },
    supersetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginTop: 12, backgroundColor: TC.surfaceLight, borderRadius: 8, borderWidth: 1, borderColor: TC.border },
    supersetBtnActive: { borderColor: TC.danger + '50', backgroundColor: TC.danger + '10' },
    supersetBtnText: { color: accent, fontSize: 13, fontWeight: '600' },
    supersetLinkBadge: { position: 'absolute', top: -14, left: 16, backgroundColor: accent, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, gap: 4, zIndex: 10 },
    supersetLinkText: { color: '#fff', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  });
}
