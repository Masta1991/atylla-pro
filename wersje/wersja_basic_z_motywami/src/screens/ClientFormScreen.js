import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../assets/theme';
import { useTheme } from '../context/ThemeContext';
import AppLayout from '../components/AppLayout';
import * as api from '../services/api';

const DAYS = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6);

export default function ClientFormScreen({ navigation, route }) {
  const { colors: C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const client = route.params?.client;
  const isEdit = !!client;

  const [name, setName] = useState(client?.name || '');
  const [email, setEmail] = useState(client?.email || '');
  const [joinDate, setJoinDate] = useState(client?.join_date || '');
  const [notes, setNotes] = useState(client?.notes || '');
  const [workoutTypes, setWorkoutTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(client?.default_workout_type_id || '');
  const [exercisesByGroup, setExercisesByGroup] = useState({});
  const [strengthExercises, setStrengthExercises] = useState(client?.strength_progression || []);
  const [showStrength, setShowStrength] = useState(false);

  const [schedule, setSchedule] = useState(client?.training_schedule || []);
  const [newSchDay, setNewSchDay] = useState(0);
  const [newSchHour, setNewSchHour] = useState(8);
  const [newSchType, setNewSchType] = useState('');

  useEffect(() => {
    Promise.all([
      api.getWorkoutTypes().then(setWorkoutTypes).catch(() => {}),
      api.getExercisesGrouped().then(setExercisesByGroup).catch(() => {}),
    ]);
  }, []);

  function addScheduleEntry() {
    if (!newSchType) { Alert.alert('Błąd', 'Wybierz rodzaj treningu'); return; }
    setSchedule(prev => [...prev, { day: newSchDay, hour: newSchHour, workout_type_id: newSchType }]);
  }

  function removeScheduleEntry(idx) {
    setSchedule(prev => prev.filter((_, i) => i !== idx));
  }

  function toggleStrengthEx(id) {
    setStrengthExercises(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Błąd', 'Podaj imię i nazwisko'); return; }
    try {
      const payload = {
        name, email, join_date: joinDate || null, notes,
        default_workout_type_id: selectedType || null,
        strength_progression: strengthExercises,
        training_schedule: schedule,
      };
      if (isEdit) {
        await api.updateClient(client.id, payload);
      } else {
        await api.createClient(payload);
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Błąd', e.message);
    }
  }

  return (
    <AppLayout navigation={navigation} title={isEdit ? 'Edytuj klienta' : 'Nowy klient'} showBack>
      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Imię i Nazwisko *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Jan Kowalski" placeholderTextColor={COLORS.textMuted} />

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="jan@example.com" placeholderTextColor={COLORS.textMuted} keyboardType="email-address" autoCapitalize="none" />

        <Text style={styles.label}>Data dołączenia</Text>
        <TextInput style={styles.input} value={joinDate} onChangeText={setJoinDate} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMuted} />

        <Text style={styles.label}>Notatki</Text>
        <TextInput style={[styles.input, { minHeight: 80 }]} value={notes} onChangeText={setNotes} placeholder="Notatki o kliencie..." placeholderTextColor={COLORS.textMuted} multiline />

        <Text style={styles.label}>Rodzaj treningu</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={selectedType} onValueChange={setSelectedType} style={styles.picker} dropdownIconColor={COLORS.textSecondary}>
            <Picker.Item label="Wybierz" value="" color={COLORS.textMuted} />
            {workoutTypes.map(wt => <Picker.Item key={wt.id} label={wt.name} value={wt.id} color={COLORS.text} />)}
          </Picker>
        </View>

        <Text style={styles.label}>Harmonogram stałych treningów</Text>
        {schedule.map((entry, idx) => {
          const wt = workoutTypes.find(w => w.id === entry.workout_type_id);
          return (
            <View key={idx} style={styles.schEntry}>
              <Text style={styles.schText}>{DAYS[entry.day]} {entry.hour}:00 — {wt?.name || '—'}</Text>
              <TouchableOpacity onPress={() => removeScheduleEntry(idx)}>
                <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          );
        })}
        <View style={styles.schAddRow}>
          <View style={[styles.pickerWrap, { flex: 1.3 }]}>
            <Picker selectedValue={newSchDay} onValueChange={v => setNewSchDay(v)} style={styles.picker} dropdownIconColor={COLORS.textSecondary}>
              {DAYS.map((d, i) => <Picker.Item key={i} label={d} value={i} color={COLORS.text} />)}
            </Picker>
          </View>
          <View style={[styles.pickerWrap, { flex: 1 }]}>
            <Picker selectedValue={newSchHour} onValueChange={v => setNewSchHour(v)} style={styles.picker} dropdownIconColor={COLORS.textSecondary}>
              {HOURS.map(h => <Picker.Item key={h} label={`${h}:00`} value={h} color={COLORS.text} />)}
            </Picker>
          </View>
          <View style={[styles.pickerWrap, { flex: 1.7 }]}>
            <Picker selectedValue={newSchType} onValueChange={setNewSchType} style={styles.picker} dropdownIconColor={COLORS.textSecondary}>
              <Picker.Item label="Typ" value="" color={COLORS.textMuted} />
              {workoutTypes.map(wt => <Picker.Item key={wt.id} label={wt.name} value={wt.id} color={COLORS.text} />)}
            </Picker>
          </View>
          <TouchableOpacity style={styles.schAddBtn} onPress={addScheduleEntry}>
            <Ionicons name="add-circle" size={28} color={C.accent} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.sectionToggle} onPress={() => setShowStrength(!showStrength)}>
          <Text style={styles.sectionToggleText}>Ćwiczenia do wykresu progresji ({strengthExercises.length} wybranych)</Text>
          <Ionicons name={showStrength ? 'chevron-up' : 'chevron-down'} size={18} color={C.accent} />
        </TouchableOpacity>
        {showStrength && Object.entries(exercisesByGroup).map(([group, exs]) => (
          <View key={group} style={styles.exGroup}>
            <Text style={styles.exGroupTitle}>{group}</Text>
            {exs.map(ex => {
              const sel = strengthExercises.includes(ex.id);
              return (
                <TouchableOpacity
                  key={ex.id}
                  style={[styles.exItem, sel && styles.exItemSelected]}
                  onPress={() => toggleStrengthEx(ex.id)}
                >
                  <View style={[styles.exCheck, sel && styles.exCheckSelected]}>
                    {sel && <Ionicons name="checkmark" size={14} color="#0d1117" />}
                  </View>
                  <Text style={[styles.exName, sel && styles.exNameSelected]}>{ex.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{isEdit ? 'ZAPISZ ZMIANY' : 'DODAJ KLIENTA'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </AppLayout>
  );
}

function makeStyles(C) { return StyleSheet.create({
  form: { paddingHorizontal: SPACING.lg, paddingBottom: 80 },
  label: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', marginTop: SPACING.md, marginBottom: 6 },
  input: { backgroundColor: COLORS.surfaceLight, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  pickerWrap: { backgroundColor: COLORS.surfaceLight, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  picker: { color: COLORS.text, height: 50, backgroundColor: COLORS.surfaceLight },
  saveBtn: { backgroundColor: C.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: SPACING.xl },
  saveBtnText: { color: COLORS.background, fontWeight: '700', fontSize: 14 },
  sectionToggle: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surfaceLight, borderRadius: 12, padding: 14,
    marginTop: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  sectionToggleText: { color: C.accent, fontSize: 13, fontWeight: '700' },
  exGroup: { marginTop: SPACING.md },
  exGroupTitle: { color: C.accent, fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  exItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 10, marginBottom: 4, gap: 10,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  exItemSelected: { backgroundColor: C.accent + '15', borderColor: C.accent + '40' },
  exCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.textMuted },
  exCheckSelected: { backgroundColor: C.accent, borderColor: C.accent },
  exName: { color: COLORS.text, fontSize: 13 },
  exNameSelected: { color: C.accent, fontWeight: '600' },
  schEntry: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderRadius: 10, padding: 12, marginBottom: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  schText: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  schAddRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  schAddBtn: { paddingHorizontal: 4 },
}); }
