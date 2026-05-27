import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../assets/theme';
import { useTheme } from '../context/ThemeContext';
import AppLayout from '../components/AppLayout';
import * as api from '../services/api';

export default function PlansScreen({ navigation }) {
  const { colors: C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const [plans, setPlans] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [plansData, setPlansData] = useState({});
  const [selectedClient, setSelectedClient] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.getPlans().then(p => setPlans(p || [])).catch(() => {});
    api.getClients().then(c => setClients(c || [])).catch(() => {});
  }, []);

  async function addPlan(planId) {
    if (!planId || selectedIds.includes(planId)) return;
    try {
      const exs = await api.getPlanExercises(planId);
      setPlansData(prev => ({ ...prev, [planId]: exs || [] }));
      setSelectedIds(prev => [...prev, planId]);
    } catch (e) {}
  }

  function removePlan(planId) {
    setSelectedIds(prev => prev.filter(id => id !== planId));
    setPlansData(prev => { const n = { ...prev }; delete n[planId]; return n; });
  }

  async function handleSend() {
    const client = clients.find(c => c.id === selectedClient);
    if (!client) { Alert.alert('Błąd', 'Wybierz klienta'); return; }
    if (!client.email) { Alert.alert('Brak emaila', 'Klient nie ma przypisanego adresu email'); return; }
    if (selectedIds.length === 0) { Alert.alert('Błąd', 'Wybierz przynajmniej jeden plan'); return; }

    setSending(true);
    try {
      const planList = selectedIds.map(id => ({
        name: plans.find(p => p.id === id)?.name || '',
        exercises: (plansData[id] || []).map(e => e.exercises?.name || e.exercise_id),
      }));
      await api.sendPlanEmail({
        recipient: client.email,
        client_name: client.name,
        plans: planList,
      });
      Alert.alert('Wysłano', `Plan wysłany na ${client.email}`);
    } catch (e) {
      Alert.alert('Błąd', 'Nie udało się wysłać: ' + e.message);
    } finally {
      setSending(false);
    }
  }

  const availablePlans = plans.filter(p => !selectedIds.includes(p.id));

  return (
    <AppLayout navigation={navigation} title="Plany treningowe" showBack>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Wybierz plan treningowy</Text>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue=""
            onValueChange={v => addPlan(v)}
            style={styles.picker}
            dropdownIconColor={COLORS.textSecondary}
          >
            <Picker.Item label="— Wybierz plan —" value="" color={COLORS.textMuted} />
            {availablePlans.map(p => (
              <Picker.Item key={p.id} label={p.name} value={p.id} color={COLORS.text} />
            ))}
          </Picker>
        </View>

        {selectedIds.length === 0 && (
          <Text style={styles.empty}>Wybierz plan z listy powyżej</Text>
        )}

        {selectedIds.map(planId => {
          const plan = plans.find(p => p.id === planId);
          const exercises = plansData[planId] || [];
          return (
            <View key={planId} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{plan?.name || ''}</Text>
                <TouchableOpacity onPress={() => removePlan(planId)} style={styles.removeBtn}>
                  <Ionicons name="close-circle" size={22} color={C.accent} />
                </TouchableOpacity>
              </View>
              {exercises.map((ex, i) => (
                <View key={i} style={styles.exRow}>
                  <Ionicons name="barbell-outline" size={16} color={C.accent} />
                  <Text style={styles.exName}>{ex.exercises?.name || ex.exercise_id}</Text>
                </View>
              ))}
            </View>
          );
        })}

        {selectedIds.length > 0 && (
          <>
            <Text style={[styles.label, { marginTop: 24 }]}>Wyślij plan do klienta</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={selectedClient} onValueChange={setSelectedClient} style={styles.picker} dropdownIconColor={COLORS.textSecondary}>
                <Picker.Item label="— Wybierz klienta —" value="" color={COLORS.textMuted} />
                {clients.map(c => (
                  <Picker.Item key={c.id} label={c.name} value={c.id} color={COLORS.text} />
                ))}
              </Picker>
            </View>
            <TouchableOpacity style={[styles.sendBtn, sending && { opacity: 0.5 }]} onPress={handleSend} disabled={sending}>
              <Text style={styles.sendBtnText}>{sending ? 'Wysyłanie...' : 'Wyślij plan emailem'}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </AppLayout>
  );
}

function makeStyles(C) { return StyleSheet.create({
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: 100 },
  label: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', marginTop: SPACING.md, marginBottom: 6 },
  pickerWrap: { backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', marginBottom: SPACING.sm },
  picker: { color: COLORS.text, height: 50, backgroundColor: COLORS.surface },
  empty: { color: COLORS.textMuted, textAlign: 'center', marginTop: 40, fontSize: 15 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 18,
    marginTop: SPACING.lg, borderWidth: 1, borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { color: C.accent, fontSize: 16, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, flex: 1 },
  removeBtn: { padding: 4 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  exName: { color: COLORS.text, fontSize: 14, flex: 1 },
  sendBtn: { backgroundColor: C.accent, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: SPACING.md },
  sendBtnText: { color: COLORS.background, fontWeight: '700', fontSize: 14 },
}); }
