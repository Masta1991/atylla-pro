import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Alert, LayoutAnimation } from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import { Ionicons } from '@expo/vector-icons';
import { SPACING } from '../assets/theme';
import { useTheme } from '../context/ThemeContext';
import AppLayout from '../components/AppLayout';
import * as api from '../services/api';

export default function TypeExercisesScreen({ navigation }) {
  const { colors: C, themeColors } = useTheme();
  const styles = useMemo(() => makeStyles(C.accent, themeColors), [C.accent, themeColors]);
  
  const [workoutTypes, setWorkoutTypes] = useState([]);
  const [plans, setPlans] = useState([]);
  const [allExercises, setAllExercises] = useState([]);
  const [muscleGroups, setMuscleGroups] = useState([]);
  const [planExercisesMap, setPlanExercisesMap] = useState({});
  
  const [newWT, setNewWT] = useState('');
  const [newPlanName, setNewPlanName] = useState('');
  
  // UI State: Top Level Sections
  const [activeSection, setActiveSection] = useState(null); // 'types' | 'exercises'

  // UI State: Expanded Types
  const [expandedType, setExpandedType] = useState(null);
  
  // UI State: Selected Plan for Exercises
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedExToAdd, setSelectedExToAdd] = useState('');
  
  const [newExName, setNewExName] = useState('');
  const [newExUnit, setNewExUnit] = useState('KG');
  const [newExMG, setNewExMG] = useState('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [wt, pl, ex, mg] = await Promise.all([
        api.getWorkoutTypes().catch(() => []),
        api.getPlans().catch(() => []),
        api.getExercisesGrouped().catch(() => ({})),
        api.getMuscleGroups().catch(() => []),
      ]);
      setWorkoutTypes(wt || []);
      setPlans(pl || []);
      setMuscleGroups(mg || []);
      
      const flat = [];
      Object.entries(ex || {}).forEach(([part, exs]) => {
        exs.forEach(e => flat.push({ ...e, part }));
      });
      setAllExercises(flat.sort((a,b) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.log(e);
    }
  }

  async function loadExercisesForPlan(planId) {
    if (!planId) return;
    try {
      const data = await api.getPlanExercises(planId);
      setPlanExercisesMap(prev => ({ ...prev, [planId]: data }));
    } catch (e) {
      console.log('Error loading exercises for plan', e);
    }
  }

  useEffect(() => {
    if (selectedPlanId) {
      loadExercisesForPlan(selectedPlanId);
    }
  }, [selectedPlanId]);

  async function addWorkoutType() {
    if (!newWT.trim()) return;
    try { await api.createWorkoutType(newWT.trim()); setNewWT(''); loadAll(); } catch (e) { Alert.alert('Błąd', e.message); }
  }
  async function deleteWorkoutType(id) {
    try { await api.deleteWorkoutType(id); loadAll(); } catch (e) { Alert.alert('Błąd', e.message); }
  }

  async function addPlan(typeId) {
    if (!newPlanName.trim()) return;
    try { 
      await api.createPlan({ name: newPlanName.trim(), workout_type_id: typeId }); 
      setNewPlanName(''); 
      loadAll(); 
    } catch (e) { Alert.alert('Błąd', e.message); }
  }
  async function deletePlan(id) {
    try { 
      await api.deletePlan(id); 
      if (selectedPlanId === id) setSelectedPlanId('');
      loadAll(); 
    } catch (e) { Alert.alert('Błąd', e.message); }
  }

  async function addExerciseToPlan(planId) {
    if (!selectedExToAdd) return;
    try {
      await api.addExerciseToPlan(planId, { exercise_id: selectedExToAdd, sort_order: 0 });
      setSelectedExToAdd('');
      loadExercisesForPlan(planId);
    } catch (e) { Alert.alert('Błąd', e.message); }
  }
  
  async function removeExerciseFromPlan(planId, planExId) {
    try {
      await api.removeExerciseFromPlan(planExId);
      loadExercisesForPlan(planId);
    } catch (e) { Alert.alert('Błąd', e.message); }
  }

  async function createAndAssignExercise(planId) {
    let mgId = newExMG;
    if (!mgId && muscleGroups.length > 0) {
        mgId = muscleGroups[0].id; // Fallback to first available to satisfy DB NOT NULL
    }

    if (!newExName.trim() || !mgId) {
        Alert.alert('Błąd', 'Podaj nazwę ćwiczenia');
        return;
    }
    try {
        const created = await api.createExercise({ muscle_group_id: mgId, name: newExName.trim(), unit: newExUnit });
        await api.addExerciseToPlan(planId, { exercise_id: created.id, sort_order: 0 });
        setNewExName('');
        setNewExUnit('KG');
        setNewExMG('');
        loadExercisesForPlan(planId);
        loadAll(); // Odśwież listę wszystkich ćwiczeń
    } catch (e) { Alert.alert('Błąd', e.message); }
  }

  const toggleSection = (section) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveSection(activeSection === section ? null : section);
  };

  const toggleType = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedType(expandedType === id ? null : id);
  };

  return (
    <AppLayout navigation={navigation} title="Struktura Ćwiczeń" showBack>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* SECTION 1: RODZAJE I PODRODZAJE (LEVEL 1 & 2) */}
        <View style={styles.mainCard}>
          <TouchableOpacity style={styles.mainHeader} onPress={() => toggleSection('types')} activeOpacity={0.8}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
              <View style={[styles.iconBox, { backgroundColor: C.accent + '20' }]}>
                <Ionicons name="folder-open" size={24} color={C.accent} />
              </View>
              <View>
                <Text style={styles.mainTitle}>Rodzaje Treningów</Text>
                <Text style={styles.mainSubtitle}>Level 1 & 2 (Kategorie i Podrodzaje)</Text>
              </View>
            </View>
            <Ionicons name={activeSection === 'types' ? "chevron-up" : "chevron-down"} size={24} color={themeColors.textSecondary} />
          </TouchableOpacity>

          {activeSection === 'types' && (
            <View style={styles.mainContent}>
              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1 }]} value={newWT} onChangeText={setNewWT} placeholder="Nowy rodzaj (np. FBW)..." placeholderTextColor={themeColors.textMuted} />
                <TouchableOpacity style={[styles.addBtn, { backgroundColor: C.accent }]} onPress={addWorkoutType}>
                  <Text style={styles.addBtnText}>Dodaj</Text>
                </TouchableOpacity>
              </View>

              {workoutTypes.map(wt => {
                const isExpanded = expandedType === wt.id;
                const typePlans = plans.filter(p => p.workout_type_id === wt.id);

                return (
                  <View key={wt.id} style={styles.typeCard}>
                    <TouchableOpacity style={styles.typeHeader} onPress={() => toggleType(wt.id)} activeOpacity={0.7}>
                      <Text style={styles.typeHeaderText}>{wt.name}</Text>
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                        <TouchableOpacity onPress={() => deleteWorkoutType(wt.id)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                          <Ionicons name="trash-outline" size={20} color={themeColors.danger} />
                        </TouchableOpacity>
                        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={22} color={C.accent} />
                      </View>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.typeContent}>
                        <Text style={styles.subTitle}>Podrodzaje (Level 2)</Text>
                        
                        {typePlans.map(plan => (
                          <View key={plan.id} style={styles.planHeaderFlat}>
                            <Text style={styles.planHeaderText}>{plan.name}</Text>
                            <TouchableOpacity onPress={() => deletePlan(plan.id)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                              <Ionicons name="trash-outline" size={18} color={themeColors.danger} />
                            </TouchableOpacity>
                          </View>
                        ))}

                        <View style={[styles.row, { marginTop: 12, marginBottom: 0 }]}>
                          <TextInput style={[styles.input, { flex: 1 }]} value={newPlanName} onChangeText={setNewPlanName} placeholder="Dodaj podrodzaj..." placeholderTextColor={themeColors.textMuted} />
                          <TouchableOpacity style={[styles.addBtn, { backgroundColor: C.accent }]} onPress={() => addPlan(wt.id)}>
                            <Text style={styles.addBtnText}>Dodaj</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* SECTION 2: ĆWICZENIA W PODRODZAJU (LEVEL 3) */}
        <View style={styles.mainCard}>
          <TouchableOpacity style={styles.mainHeader} onPress={() => toggleSection('exercises')} activeOpacity={0.8}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
              <View style={[styles.iconBox, { backgroundColor: C.accent + '20' }]}>
                <Ionicons name="barbell" size={24} color={C.accent} />
              </View>
              <View>
                <Text style={styles.mainTitle}>Przypisz Ćwiczenia</Text>
                <Text style={styles.mainSubtitle}>Level 3 (Dodawanie ćwiczeń do podrodzajów)</Text>
              </View>
            </View>
            <Ionicons name={activeSection === 'exercises' ? "chevron-up" : "chevron-down"} size={24} color={themeColors.textSecondary} />
          </TouchableOpacity>

          {activeSection === 'exercises' && (
            <View style={styles.mainContent}>
              
              <Text style={styles.subTitle}>1. Wybierz Podrodzaj (Level 2)</Text>
              <DropdownPicker
                placeholder="— Wybierz podrodzaj —"
                selectedValue={selectedPlanId}
                onValueChange={setSelectedPlanId}
                style={styles.pickerWrap}
                dropdownIconColor={themeColors.textSecondary}
                items={[
                  { label: "— Wybierz podrodzaj —", value: "", color: themeColors.textMuted },
                  ...workoutTypes.flatMap(wt => {
                    const wtPlans = plans.filter(p => p.workout_type_id === wt.id);
                    if (wtPlans.length === 0) return [];
                    return wtPlans.map(pl => ({ label: `${wt.name} ➞ ${pl.name}`, value: pl.id, color: themeColors.text }));
                  })
                ]}
              />

              {selectedPlanId ? (
                <View style={{marginTop: 20}}>
                  <Text style={styles.subTitle}>2. Przypisane Ćwiczenia</Text>
                  
                  {!(planExercisesMap[selectedPlanId] && planExercisesMap[selectedPlanId].length > 0) && (
                    <Text style={{color: themeColors.textMuted, fontSize: 13, marginBottom: 12}}>Brak ćwiczeń w tym podrodzaju.</Text>
                  )}

                  {(planExercisesMap[selectedPlanId] || []).map(pex => (
                    <View key={pex.id} style={styles.itemRow}>
                      <Text style={styles.itemText}>{pex.exercises?.name}</Text>
                      <TouchableOpacity onPress={() => removeExerciseFromPlan(selectedPlanId, pex.id)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                        <Ionicons name="trash-outline" size={18} color={themeColors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}

                  <Text style={[styles.subTitle, {marginTop: 20}]}>Dodaj z bazy</Text>
                  <DropdownPicker
                    placeholder="— Wybierz z bazy —"
                    selectedValue={selectedExToAdd}
                    onValueChange={setSelectedExToAdd}
                    style={[styles.pickerWrap, { marginTop: 4 }]}
                    dropdownIconColor={themeColors.textSecondary}
                    items={[
                      { label: "— Wybierz z bazy —", value: "", color: themeColors.textMuted },
                      ...allExercises.map(ex => ({ label: `${ex.name} (${ex.part})`, value: ex.id, color: themeColors.text }))
                    ]}
                  />
                  <TouchableOpacity style={[styles.addBtn, { backgroundColor: C.accent, marginTop: 8, width: '100%', marginBottom: 16 }]} onPress={() => addExerciseToPlan(selectedPlanId)}>
                    <Text style={[styles.addBtnText, {textAlign: 'center'}]}>Przypisz do Podrodzaju</Text>
                  </TouchableOpacity>

                  <Text style={[styles.subTitle, {marginTop: 10}]}>LUB Stwórz nowe i przypisz</Text>

                  <View style={styles.row}>
                    <TextInput style={[styles.input, { flex: 1 }]} value={newExName} onChangeText={setNewExName} placeholder="Nazwa nowego ćwiczenia..." placeholderTextColor={themeColors.textMuted} />
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
                    <TouchableOpacity style={[styles.addBtn, { backgroundColor: C.accent }]} onPress={() => createAndAssignExercise(selectedPlanId)}>
                      <Text style={styles.addBtnText}>Utwórz</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

            </View>
          )}
        </View>

      </ScrollView>
    </AppLayout>
  );
}

function makeStyles(accent, TC) {
  return StyleSheet.create({
    scroll: { paddingHorizontal: SPACING.lg, paddingBottom: 100, paddingTop: 16 },
    
    mainCard: { backgroundColor: TC.surface, borderRadius: 16, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: TC.border },
    mainHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: TC.surfaceLight },
    iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    mainTitle: { color: TC.text, fontSize: 16, fontWeight: '800' },
    mainSubtitle: { color: TC.textSecondary, fontSize: 12, fontWeight: '500', marginTop: 2 },
    mainContent: { padding: 16, borderTopWidth: 1, borderTopColor: TC.border },

    subTitle: { color: TC.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 4, textTransform: 'uppercase' },
    row: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    input: { backgroundColor: TC.background, borderRadius: 10, padding: 12, fontSize: 14, color: TC.text, borderWidth: 1, borderColor: TC.border },
    addBtn: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, justifyContent: 'center' },
    addBtnText: { color: TC.background, fontWeight: '700', fontSize: 13 },
    
    typeCard: { backgroundColor: TC.background, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: TC.border, overflow: 'hidden' },
    typeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: TC.surface },
    typeHeaderText: { color: TC.text, fontSize: 15, fontWeight: '700' },
    typeContent: { padding: 12, borderTopWidth: 1, borderTopColor: TC.border },
    
    planHeaderFlat: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: TC.surfaceLight, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: TC.border },
    planHeaderText: { color: TC.text, fontSize: 14, fontWeight: '600' },
    
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: TC.surface, borderRadius: 10, marginBottom: 4, borderWidth: 1, borderColor: TC.border },
    itemText: { color: TC.text, fontSize: 14 },
    
    pickerWrap: { backgroundColor: TC.surfaceLight, borderRadius: 10, borderWidth: 1, borderColor: TC.border, overflow: 'hidden', marginBottom: 4 },
    picker: { color: TC.text, height: 50, backgroundColor: TC.surfaceLight },
  });
}
