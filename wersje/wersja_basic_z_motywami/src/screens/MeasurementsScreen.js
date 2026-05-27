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

export default function MeasurementsScreen({ navigation, route }) {
  const { colors: C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const clientId = route.params?.clientId;
  const clientName = route.params?.clientName;
  
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(clientId || '');
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState('');
  const [fat, setFat] = useState('');
  const [muscle, setMuscle] = useState('');

  useEffect(() => {
    api.getClients().then(data => setClients(data || [])).catch(() => {});
    if (clientId) loadData(clientId);
    else setLoading(false);
  }, []);

  async function loadData(id) {
    const cid = id || selectedClient;
    if (!cid) return;
    setLoading(true);
    try {
      const data = await api.getMeasurements(cid);
      setMeasurements(data || []);
    } catch (e) { console.log(e); }
    finally { setLoading(false); }
  }

  function handleClientChange(val) {
    setSelectedClient(val);
    if (val) loadData(val);
  }

  async function handleAdd() {
    const cid = selectedClient || clientId;
    if (!cid) { Alert.alert('Błąd', 'Wybierz klienta'); return; }
    if (!weight) { Alert.alert('Błąd', 'Podaj wagę'); return; }
    try {
      await api.createMeasurement({
        client_id: cid,
        measure_date: date,
        weight_kg: parseFloat(weight) || 0,
        body_fat_pct: parseFloat(fat) || null,
        muscle_mass_pct: parseFloat(muscle) || null,
      });
      setWeight(''); setFat(''); setMuscle('');
      loadData(cid);
    } catch (e) { Alert.alert('Błąd', e.message); }
  }

  async function handleDelete(id) {
    Alert.alert('Usuń', 'Usunąć ten pomiar?', [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: async () => { await api.deleteMeasurement(id); loadData(selectedClient || clientId); } },
    ]);
  }

  if (loading && selectedClient) {
    return <AppLayout navigation={navigation} title="Pomiary" showBack><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={C.accent} /></View></AppLayout>;
  }

  return (
    <AppLayout navigation={navigation} title={clientName ? `Pomiary: ${clientName}` : 'Pomiary'} showBack>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Klient</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={selectedClient} onValueChange={handleClientChange} style={styles.picker} dropdownIconColor={COLORS.textSecondary}>
            <Picker.Item label="Wybierz klienta" value="" color={COLORS.textMuted} />
            {clients.map(c => <Picker.Item key={c.id} label={c.name} value={c.id} color={COLORS.text} />)}
          </Picker>
        </View>

        {selectedClient ? (
          <>
            <View style={styles.addCard}>
              <Text style={styles.label}>Data</Text>
              <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMuted} />
              <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Waga (kg)</Text>
                  <TextInput style={styles.input} value={weight} onChangeText={setWeight} placeholder="80.5" placeholderTextColor={COLORS.textMuted} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Tłuszcz %</Text>
                  <TextInput style={styles.input} value={fat} onChangeText={setFat} placeholder="15.0" placeholderTextColor={COLORS.textMuted} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Mięśnie %</Text>
                  <TextInput style={styles.input} value={muscle} onChangeText={setMuscle} placeholder="40.0" placeholderTextColor={COLORS.textMuted} keyboardType="numeric" />
                </View>
              </View>
              <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
                <Text style={styles.addBtnText}>+ Dodaj pomiar</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Historia pomiarów</Text>
            {measurements.map(m => (
              <View key={m.id} style={styles.measureCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.measureDate}>{m.measure_date}</Text>
                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
                    <Text style={styles.measureVal}>Waga: {m.weight_kg} kg</Text>
                    {m.body_fat_pct != null && <Text style={styles.measureVal}>Tł: {m.body_fat_pct}%</Text>}
                    {m.muscle_mass_pct != null && <Text style={styles.measureVal}>Mię: {m.muscle_mass_pct}%</Text>}
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDelete(m.id)}>
                  <Text style={styles.deleteBtn}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        ) : (
          !clientId && <Text style={{ color: COLORS.textMuted, textAlign: 'center', marginTop: 40, fontSize: 15 }}>Wybierz klienta aby zobaczyć pomiary</Text>
        )}
      </ScrollView>
    </AppLayout>
  );
}

function makeStyles(C) { return StyleSheet.create({
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: 100 },
  pickerWrap: { backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', marginBottom: SPACING.md },
  picker: { color: COLORS.text, height: 50, backgroundColor: COLORS.surface },
  addCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.lg },
  label: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: COLORS.surfaceLight, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  addBtn: { backgroundColor: C.accent, borderRadius: 12, padding: 12, alignItems: 'center', marginTop: SPACING.md },
  addBtnText: { color: COLORS.background, fontWeight: '700', fontSize: 13 },
  sectionTitle: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: SPACING.sm, textTransform: 'uppercase', letterSpacing: 1 },
  measureCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  measureDate: { color: C.accent, fontSize: 13, fontWeight: '700' },
  measureVal: { color: COLORS.textSecondary, fontSize: 12 },
  deleteBtn: { color: C.accent, fontSize: 16, fontWeight: '700', paddingLeft: 12 },
}); }
