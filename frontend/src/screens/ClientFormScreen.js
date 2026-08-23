import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, Alert, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DropdownPicker from '../components/DropdownPicker';
import { Ionicons } from '@expo/vector-icons';
import { SPACING } from '../assets/theme';
import { useTheme } from '../context/ThemeContext';
import AppLayout from '../components/AppLayout';
import * as api from '../services/api';

const DAYS = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6);

export default function ClientFormScreen({ navigation, route }) {
  const { colors: C, themeColors } = useTheme();
  const styles = useMemo(() => makeStyles(C, themeColors), [C, themeColors]);
  const client = route.params?.client;
  const isEdit = !!client;

  const [name, setName] = useState(client?.name || '');
  const [phone, setPhone] = useState(client?.phone || '');
  const [joinDate, setJoinDate] = useState(client?.join_date || '');
  const [notes, setNotes] = useState(client?.notes || '');
  const [plans, setPlans] = useState([]);
  const [selectedType, setSelectedType] = useState(client?.default_plan_id || '');
  const [exercisesByGroup, setExercisesByGroup] = useState(global.cachedExercisesByGroup || {});
  const [strengthExercises, setStrengthExercises] = useState(client?.strength_progression || []);
  const [showStrength, setShowStrength] = useState(false);
  const [billingType, setBillingType] = useState(client?.billing_type || 'package');
  const [packageSize, setPackageSize] = useState(client?.package_size !== undefined ? String(client.package_size) : '10');
  const [packagePurchaseDate, setPackagePurchaseDate] = useState(client?.package_purchase_date || new Date().toISOString().split('T')[0]);

  const [schedule, setSchedule] = useState(client?.training_schedule || []);
  const [newSchDay, setNewSchDay] = useState(0);
  const [newSchHour, setNewSchHour] = useState(8);
  const [newSchType, setNewSchType] = useState('');

  useEffect(() => {
    async function init() {
      try {
        const storedPlans = await AsyncStorage.getItem('cached_plans');
        const storedExercisesByGroup = await AsyncStorage.getItem('cached_exercises_by_group');
        if (storedPlans && !global.cachedPlans) {
          const parsed = JSON.parse(storedPlans);
          setPlans(parsed);
          global.cachedPlans = parsed;
        }
        if (storedExercisesByGroup && !global.cachedExercisesByGroup) {
          const parsed = JSON.parse(storedExercisesByGroup);
          setExercisesByGroup(parsed);
          global.cachedExercisesByGroup = parsed;
        }
      } catch (e) {
        console.log(e);
      }

      api.getPlans().then(data => {
        const p = Array.isArray(data) ? data : [];
        setPlans(p);
        global.cachedPlans = p;
        AsyncStorage.setItem('cached_plans', JSON.stringify(data)).catch(() => {});
      }).catch(() => {});

      api.getExercisesGrouped().then(data => {
        const e = data || {};
        setExercisesByGroup(e);
        global.cachedExercisesByGroup = e;
        AsyncStorage.setItem('cached_exercises_by_group', JSON.stringify(data)).catch(() => {});
      }).catch(() => {});
    }

    init();
  }, []);

  function addScheduleEntry() {
    setSchedule(prev => [...prev, { day: newSchDay, hour: newSchHour, plan_id: newSchType || null }]);
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
    if (!name.trim()) { 
      if (Platform.OS === 'web') window.alert('Błąd: Podaj imię i nazwisko');
      else Alert.alert('Błąd', 'Podaj imię i nazwisko');
      return; 
    }
    try {
      const payload = {
        name, phone, join_date: joinDate || null, notes,
        default_plan_id: selectedType || null,
        strength_progression: strengthExercises,
        training_schedule: schedule,
        billing_type: billingType,
        package_size: billingType === 'package' ? (parseInt(packageSize, 10) || 10) : 0,
        package_purchase_date: packagePurchaseDate || null,
      };
      if (isEdit) {
        await api.updateClient(client.id, payload);
      } else {
        await api.createClient(payload);
      }
      navigation.goBack();
    } catch (e) {
      if (Platform.OS === 'web') {
        window.alert('Błąd zapisu: ' + (e.message || JSON.stringify(e)));
      } else {
        Alert.alert('Błąd', e.message);
      }
    }
  }

  return (
    <AppLayout navigation={navigation} title={isEdit ? 'Edytuj klienta' : 'Nowy klient'} showBack>
      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Imię i Nazwisko *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Jan Kowalski" placeholderTextColor={themeColors.textMuted} />

        <Text style={styles.label}>Numer Telefonu</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="np. +48 123 456 789" placeholderTextColor={themeColors.textMuted} keyboardType="phone-pad" />

        <Text style={styles.label}>Data dołączenia</Text>
        <TextInput style={styles.input} value={joinDate} onChangeText={setJoinDate} placeholder="YYYY-MM-DD" placeholderTextColor={themeColors.textMuted} />

        <Text style={styles.label}>Notatki</Text>
        <TextInput style={[styles.input, { minHeight: 80 }]} value={notes} onChangeText={setNotes} placeholder="Notatki o kliencie..." placeholderTextColor={themeColors.textMuted} multiline />

        <Text style={styles.label}>Podrodzaj treningu (Plan)</Text>
        <DropdownPicker
          placeholder="Wybierz"
          selectedValue={selectedType}
          onValueChange={setSelectedType}
          style={styles.pickerWrap}
          dropdownIconColor={themeColors.textSecondary}
          items={[
            { label: "Wybierz", value: "", color: themeColors.textMuted },
            ...(Array.isArray(plans) ? plans : []).map(pl => ({ label: pl.name, value: pl.id, color: themeColors.text }))
          ]}
        />

        <Text style={styles.label}>Forma płatności</Text>
        <DropdownPicker
          selectedValue={billingType}
          onValueChange={setBillingType}
          style={styles.pickerWrap}
          dropdownIconColor={themeColors.textSecondary}
          items={[
            { label: "Pakiet (np. 10 treningów)", value: "package", color: themeColors.text },
            { label: "Bez pakietu (pojedyncze treningi)", value: "single", color: themeColors.text }
          ]}
        />

        {billingType === 'package' && (
          <>
            <Text style={styles.label}>Wielkość pakietu (liczba treningów)</Text>
            <TextInput
              style={styles.input}
              value={packageSize}
              onChangeText={setPackageSize}
              placeholder="np. 10"
              placeholderTextColor={themeColors.textMuted}
              keyboardType="numeric"
            />
          </>
        )}

        <Text style={styles.label}>Data wykupienia / startu rozliczenia</Text>
        <TextInput
          style={styles.input}
          value={packagePurchaseDate}
          onChangeText={setPackagePurchaseDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={themeColors.textMuted}
        />

        <Text style={styles.label}>Harmonogram stałych treningów</Text>
        {schedule.map((sch, idx) => {
          const plObj = plans.find(p => p.id === sch.plan_id);
          return (
            <View key={idx} style={styles.schEntry}>
              <Text style={styles.schText}>{DAYS[sch.day]} {sch.hour}:00 — {plObj?.name || '—'}</Text>
              <TouchableOpacity onPress={() => removeScheduleEntry(idx)}>
                <Ionicons name="close-circle" size={20} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>
          );
        })}
        <View style={styles.schAddRow}>
          <DropdownPicker
            selectedValue={newSchDay}
            onValueChange={v => setNewSchDay(v)}
            style={[styles.pickerWrap, { flex: 1.3 }]}
            dropdownIconColor={themeColors.textSecondary}
            items={DAYS.map((d, i) => ({ label: d, value: i, color: themeColors.text }))}
          />
          <DropdownPicker
            selectedValue={newSchHour}
            onValueChange={v => setNewSchHour(v)}
            style={[styles.pickerWrap, { flex: 1 }]}
            dropdownIconColor={themeColors.textSecondary}
            items={HOURS.map(h => ({ label: `${h}:00`, value: h, color: themeColors.text }))}
          />
          <DropdownPicker
            placeholder="Typ"
            selectedValue={newSchType}
            onValueChange={setNewSchType}
            style={[styles.pickerWrap, { flex: 1.7 }]}
            dropdownIconColor={themeColors.textSecondary}
            items={[
              { label: "Typ", value: "", color: themeColors.textMuted },
              ...(Array.isArray(plans) ? plans : []).map(p => ({ label: p.name, value: p.id, color: themeColors.text }))
            ]}
          />
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
                    {sel && <Ionicons name="checkmark" size={14} color={themeColors.background} />}
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

function makeStyles(C, TC) { return StyleSheet.create({
  form: { paddingHorizontal: SPACING.lg, paddingBottom: 80 },
  label: { color: TC.textSecondary, fontSize: 13, fontWeight: '600', marginTop: SPACING.md, marginBottom: 6 },
  input: { backgroundColor: TC.surfaceLight, borderRadius: 12, padding: 14, fontSize: 15, color: TC.text, borderWidth: 1, borderColor: TC.border },
  pickerWrap: { backgroundColor: TC.surfaceLight, borderRadius: 12, borderWidth: 1, borderColor: TC.border, overflow: 'hidden' },
  picker: { color: TC.text, height: 50, backgroundColor: TC.surfaceLight },
  saveBtn: { backgroundColor: C.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: SPACING.xl },
  saveBtnText: { color: TC.background, fontWeight: '700', fontSize: 14 },
  sectionToggle: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: TC.surfaceLight, borderRadius: 12, padding: 14,
    marginTop: SPACING.md, borderWidth: 1, borderColor: TC.border,
  },
  sectionToggleText: { color: C.accent, fontSize: 13, fontWeight: '700' },
  exGroup: { marginTop: SPACING.md },
  exGroupTitle: { color: C.accent, fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  exItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 10, marginBottom: 4, gap: 10,
    backgroundColor: TC.surface, borderWidth: 1, borderColor: TC.border,
  },
  exItemSelected: { backgroundColor: C.accent + '15', borderColor: C.accent + '40' },
  exCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: TC.textMuted },
  exCheckSelected: { backgroundColor: C.accent, borderColor: C.accent },
  exName: { color: TC.text, fontSize: 13 },
  exNameSelected: { color: C.accent, fontWeight: '600' },
  schEntry: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: TC.surface, borderRadius: 10, padding: 12, marginBottom: 6,
    borderWidth: 1, borderColor: TC.border,
  },
  schText: { color: TC.text, fontSize: 13, fontWeight: '600' },
  schAddRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  schAddBtn: { paddingHorizontal: 4 },
}); }
