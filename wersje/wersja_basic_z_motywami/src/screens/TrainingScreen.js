import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { COLORS, SPACING } from '../assets/theme';
import { useTheme } from '../context/ThemeContext';
import AppLayout from '../components/AppLayout';
import * as api from '../services/api';

export default function TrainingScreen({ navigation, route }) {
  const { colors: C } = useTheme();
  const { date: passedDate, hour } = route.params || {};
  const [clients, setClients] = useState([]);
  const [workoutTypes, setWorkoutTypes] = useState([]);
  const [muscleGroups, setMuscleGroups] = useState([]);
  const [exercisesByGroup, setExercisesByGroup] = useState({});
  const [loading, setLoading] = useState(true);

  const [selectedClient, setSelectedClient] = useState('');
  const [selectedDate, setSelectedDate] = useState(passedDate || new Date().toISOString().slice(0, 10));
  const [selectedHour, setSelectedHour] = useState(hour?.toString() || '');
  const [selectedType, setSelectedType] = useState('');
  const [selectedMainGroup, setSelectedMainGroup] = useState('');
  const [addedParts, setAddedParts] = useState([]);
  const [exerciseWeights, setExerciseWeights] = useState({});
  const [note, setNote] = useState('');

  async function loadClientWorkoutLogs(clientId, dateStr, groupedExercises) {
    if (!clientId || !dateStr) return;
    try {
      const logs = await api.getClientWorkouts(clientId, dateStr);
      if (logs && logs.length > 0) {
        const newWeights = {};
        const newAddedParts = [];
        
        logs.forEach(log => {
          let foundPart = null;
          let foundExName = null;
          for (const [part, list] of Object.entries(groupedExercises || {})) {
            const ex = list.find(e => e.id === log.exercise_id);
            if (ex) {
              foundPart = part;
              foundExName = ex.name;
              break;
            }
          }
          if (foundPart && foundExName) {
            const key = `${foundPart}_${foundExName}`;
            newWeights[key] = {
              weight: log.weight_kg !== null ? log.weight_kg.toString() : '0',
              reps: log.reps !== null ? log.reps.toString() : '',
            };
            if (!newAddedParts.includes(foundPart)) {
              newAddedParts.push(foundPart);
            }
          }
        });
        
        setExerciseWeights(newWeights);
        if (newAddedParts.length > 0) {
          const mainGroup = newAddedParts[0];
          setSelectedMainGroup(mainGroup);
          
          setAddedParts(prev => {
            const combined = [...prev];
            newAddedParts.forEach(p => {
              if (p !== mainGroup && !combined.includes(p)) {
                combined.push(p);
              }
            });
            return combined;
          });
        }
      } else {
        setExerciseWeights({});
      }
    } catch (e) {
      console.error('Error loading workout logs:', e);
    }
  }

  const handleClientChange = (val) => {
    setSelectedClient(val);
    const cl = clients.find(c => c.id === val);
    if (cl?.default_workout_type_id) {
      setSelectedType(cl.default_workout_type_id);
    }
    loadClientWorkoutLogs(val, selectedDate, exercisesByGroup);
  };

  const handleDateChange = (val) => {
    setSelectedDate(val);
    loadClientWorkoutLogs(selectedClient, val, exercisesByGroup);
  };

  useEffect(() => {
    async function init() {
      try {
        const [c, wt, grouped] = await Promise.all([
          api.getClients(), api.getWorkoutTypes(), api.getExercisesGrouped(),
        ]);
        setClients(c || []);
        setWorkoutTypes(wt || []);
        setExercisesByGroup(grouped || {});
        setMuscleGroups(Object.keys(grouped || {}));

        // Load existing calendar event if we came from calendar slot
        if (passedDate && hour) {
          try {
            const ev = await api.getCalendarEvent(passedDate, parseInt(hour));
            if (ev && ev.client_id) {
              setSelectedClient(ev.client_id);
              if (ev.workout_type_id) {
                setSelectedType(ev.workout_type_id);
              }
              // Fetch workout logs for this client and date
              await loadClientWorkoutLogs(ev.client_id, passedDate, grouped);
            }
          } catch (err) {
            // Event not found or other API error, ignore as it might be a new slot
            console.log('No calendar event found for slot:', passedDate, hour);
          }
        }
      } catch (e) {
        Alert.alert('Błąd', 'Nie można załadować danych');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  function addPart() {
    if (selectedMainGroup && !addedParts.includes(selectedMainGroup)) {
      setAddedParts([...addedParts, selectedMainGroup]);
    }
  }

  function toggleExercise(part, exName) {
    const key = `${part}_${exName}`;
    setExerciseWeights(prev => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = { weight: '0', reps: '' };
      }
      return next;
    });
  }

  function changeWeight(part, exName, amount) {
    const key = `${part}_${exName}`;
    setExerciseWeights(prev => {
      const current = prev[key] || { weight: '0', reps: '' };
      const currentVal = parseFloat(current.weight) || 0;
      const newVal = Math.max(0, currentVal + amount);
      const formattedVal = Number(newVal.toFixed(2)).toString();
      return {
        ...prev,
        [key]: { ...current, weight: formattedVal },
      };
    });
  }

  function updateWeight(part, exName, field, value) {
    const key = `${part}_${exName}`;
    setExerciseWeights(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }

  async function handleSave() {
    if (!selectedClient) { Alert.alert('Błąd', 'Wybierz klienta'); return; }
    if (!selectedDate) { Alert.alert('Błąd', 'Ustaw datę'); return; }

    try {
      const weekNum = Math.ceil(
        (new Date(selectedDate).getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 86400000)
      );

      const logs = [];
      for (const [key, data] of Object.entries(exerciseWeights)) {
        const [part, exName] = key.split('_', 2);
        const exFound = (exercisesByGroup[part] || []).find(e => e.name === exName);
        if (exFound) {
          logs.push({
            client_id: selectedClient,
            exercise_id: exFound.id,
            weight_kg: parseFloat(data.weight) || 0,
            reps: null,
            week_number: weekNum,
            session_date: selectedDate,
          });
        }
      }

      await api.saveWorkoutBatch({
        client_id: selectedClient,
        session_date: selectedDate,
        week_number: weekNum,
        logs,
      });

      if (selectedHour) {
        await api.createCalendarEvent({
          event_date: selectedDate,
          event_hour: parseInt(selectedHour),
          client_id: selectedClient,
          workout_type_id: selectedType || null,
          status: 'active',
        });
      }

      Alert.alert('Zapisano', 'Trening został zapisany');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Błąd', e.message);
    }
  }

  if (loading) {
    return <AppLayout navigation={navigation} title="Rejestracja treningu" showBack><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={C.accent} /></View></AppLayout>;
  }

  const allParts = [selectedMainGroup, ...addedParts].filter(Boolean);

  return (
    <AppLayout navigation={navigation} title="Rejestracja treningu" showBack>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Client */}
        <Text style={styles.label}>Podopieczny</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={selectedClient} onValueChange={handleClientChange} style={styles.picker} dropdownIconColor={COLORS.textSecondary}>
            <Picker.Item label="Wybierz" value="" color={COLORS.textMuted} />
            {clients.map(c => <Picker.Item key={c.id} label={c.name} value={c.id} color={COLORS.text} />)}
          </Picker>
        </View>

        {/* Date & Hour */}
        <View style={{ flexDirection: 'row', gap: SPACING.md }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Data</Text>
            <TextInput style={styles.input} value={selectedDate} onChangeText={handleDateChange} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Godzina</Text>
            <TextInput style={styles.input} value={selectedHour} onChangeText={setSelectedHour} placeholder="6-21" placeholderTextColor={COLORS.textMuted} keyboardType="numeric" />
          </View>
        </View>

        {/* Workout Type */}
        <Text style={styles.label}>Rodzaj treningu</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={selectedType} onValueChange={setSelectedType} style={styles.picker} dropdownIconColor={COLORS.textSecondary}>
            <Picker.Item label="Wybierz" value="" color={COLORS.textMuted} />
            {workoutTypes.map(wt => <Picker.Item key={wt.id} label={wt.name} value={wt.id} color={COLORS.text} />)}
          </Picker>
        </View>

        {/* Main muscle group */}
        <Text style={styles.label}>Główna partia</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={selectedMainGroup} onValueChange={setSelectedMainGroup} style={styles.picker} dropdownIconColor={COLORS.textSecondary}>
            <Picker.Item label="Wybierz" value="" color={COLORS.textMuted} />
            {muscleGroups.map(mg => <Picker.Item key={mg} label={mg} value={mg} color={COLORS.text} />)}
          </Picker>
        </View>

        <TouchableOpacity style={styles.addPartBtn} onPress={addPart}>
          <Text style={styles.addPartBtnText}>+ Dodaj Partię</Text>
        </TouchableOpacity>

        {/* Exercise selection for each part */}
        {allParts.map(part => (
          <View key={part} style={styles.partSection}>
            <Text style={styles.partTitle}>{part}</Text>
            {(exercisesByGroup[part] || []).map(ex => {
              const key = `${part}_${ex.name}`;
              const selected = !!exerciseWeights[key];
              return (
                <View key={ex.name}>
                  {selected ? (
                    <View style={[styles.exerciseRow, styles.exerciseSelected]}>
                      <TouchableOpacity
                        style={styles.leftCol}
                        onPress={() => toggleExercise(part, ex.name)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkbox, styles.checkboxChecked]} />
                        <Text
                          style={[styles.exerciseName, styles.exerciseNameSelected]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {ex.name}
                        </Text>
                      </TouchableOpacity>
                      
                      <View style={styles.rightCol}>
                        {/* Weight Stepper Capsule */}
                        <View style={styles.stepperContainer}>
                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => changeWeight(part, ex.name, -2.5)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.stepperBtnText}>-</Text>
                          </TouchableOpacity>
                          
                          <View style={styles.stepperDisplay}>
                            <TextInput
                              style={styles.stepperInput}
                              value={exerciseWeights[key]?.weight || '0'}
                              onChangeText={v => updateWeight(part, ex.name, 'weight', v)}
                              keyboardType="decimal-pad"
                            />
                            <Text style={[styles.stepperUnit, { pointerEvents: 'none' }]}>KG</Text>
                          </View>

                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => changeWeight(part, ex.name, 2.5)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.stepperBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.exerciseRow}
                      onPress={() => toggleExercise(part, ex.name)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.leftCol}>
                        <View style={styles.checkbox} />
                        <Text style={styles.exerciseName} numberOfLines={1} ellipsizeMode="tail">
                          {ex.name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        ))}

        {/* Note */}
        <Text style={styles.label}>Notatka</Text>
        <TextInput style={[styles.input, { minHeight: 60 }]} value={note} onChangeText={setNote} placeholder="Opcjonalna notatka..." placeholderTextColor={COLORS.textMuted} multiline />

        {/* Save */}
        <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg }}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelBtnText}>POWRÓT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>ZAPISZ TRENING</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: 100 },
  label: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', marginTop: SPACING.md, marginBottom: 6 },
  input: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  pickerWrap: { backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  picker: { color: COLORS.text, height: 50, backgroundColor: COLORS.surface },
  addPartBtn: { backgroundColor: COLORS.accent + '20', borderRadius: 12, padding: 12, alignItems: 'center', marginTop: SPACING.md },
  addPartBtnText: { color: COLORS.accent, fontWeight: '700', fontSize: 14 },
  partSection: { marginTop: SPACING.md },
  partTitle: { color: COLORS.accent, fontSize: 14, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exerciseSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.surface,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.textMuted,
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  exerciseName: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  exerciseNameSelected: {
    color: COLORS.white,
    fontWeight: '600',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 4,
    height: 38,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnText: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
  stepperDisplay: {
    width: 65,
    height: 38,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperInput: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
    width: '100%',
    height: '100%',
    textAlign: 'center',
    paddingTop: 4,
    paddingBottom: 10,
  },
  stepperUnit: {
    position: 'absolute',
    bottom: 2,
    color: COLORS.textSecondary,
    fontSize: 8,
    fontWeight: '600',
  },
  cancelBtn: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 13 },
  saveBtn: { flex: 2, backgroundColor: COLORS.accent, borderRadius: 12, padding: 16, alignItems: 'center' },
  saveBtnText: { color: COLORS.background, fontWeight: '700', fontSize: 13 },
});
