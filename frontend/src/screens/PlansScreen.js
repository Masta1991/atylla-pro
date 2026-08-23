import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Linking, Platform
} from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import { Ionicons } from '@expo/vector-icons';
import { SPACING } from '../assets/theme';
import { useTheme } from '../context/ThemeContext';
import AppLayout from '../components/AppLayout';
import * as api from '../services/api';

export default function PlansScreen({ navigation }) {
  const { colors: C, themeColors } = useTheme();
  const styles = useMemo(() => makeStyles(C, themeColors), [C, themeColors]);
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
    if (selectedIds.length === 0) { Alert.alert('Błąd', 'Wybierz przynajmniej jeden plan'); return; }

    setSending(true);
    try {
      if (Platform.OS === 'web') {
        try {
          const htmlToImage = require('html-to-image');
          const captureOpts = { backgroundColor: themeColors.background, pixelRatio: 2, style: { padding: 30 } };
          const node = document.getElementById('plan-capture-area');
          if (node) {
            // Tymczasowo ukrywamy przyciski usuwania
            const removeBtns = node.querySelectorAll('.remove-btn-marker');
            removeBtns.forEach(btn => btn.style.display = 'none');
            
            const blob = await htmlToImage.toBlob(node, captureOpts);
            
            // Przywracamy przyciski
            removeBtns.forEach(btn => btn.style.display = 'flex');

            if (blob) {
              const file = new File([blob], 'plan_treningowy.png', { type: 'image/png' });
              if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                  files: [file],
                  title: 'Plan Treningowy',
                  text: `Twój Plan Treningowy`
                });
                return; // Sukces udostępnienia grafiki
              }
            }
          }
        } catch (imgErr) {
          console.error("Image capture error:", imgErr);
        }
      }

      // Fallback: tekst
      let message = `💪 *Twój Plan Treningowy*\n\n`;
      selectedIds.forEach(id => {
        const planName = plans.find(p => p.id === id)?.name || '';
        message += `🔥 *${planName}*\n`;
        const exercises = plansData[id] || [];
        exercises.forEach((e, i) => {
          message += `${i + 1}. ${e.exercises?.name || e.exercise_id}\n`;
          if (Array.isArray(e.sets_data) && e.sets_data.length > 0) {
            e.sets_data.forEach((s, sIdx) => {
              message += `   - Seria ${sIdx + 1}: ${s.reps || '-'} powt. x ${s.weight || '-'} kg\n`;
            });
          }
        });
        message += `\n`;
      });
      message += `Powodzenia na treningu!`;

      const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Błąd', 'Wystąpił błąd podczas otwierania okna wysyłania: ' + e.message);
    } finally {
      setSending(false);
    }
  }

  const availablePlans = plans.filter(p => !selectedIds.includes(p.id));

  return (
    <AppLayout navigation={navigation} title="Plany treningowe" showBack>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Wybierz plan treningowy</Text>
          <DropdownPicker
            placeholder="— Wybierz plan —"
            selectedValue=""
            onValueChange={v => addPlan(v)}
            style={styles.pickerWrap}
            dropdownIconColor={themeColors.textSecondary}
            items={[
              { label: "— Wybierz plan —", value: "", color: themeColors.textMuted },
              ...availablePlans.map(p => ({ label: p.name, value: p.id, color: themeColors.text }))
            ]}
          />

        {selectedIds.length === 0 && (
          <Text style={styles.empty}>Wybierz plan z listy powyżej</Text>
        )}

        <View nativeID="plan-capture-area" style={{ backgroundColor: themeColors.background }}>
        {selectedIds.map(planId => {
          const plan = plans.find(p => p.id === planId);
          const exercises = plansData[planId] || [];
          return (
            <View key={planId} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{plan?.name || ''}</Text>
                <TouchableOpacity onPress={() => removePlan(planId)} style={[styles.removeBtn]} nativeID={`remove-btn-${planId}`}>
                  <View className="remove-btn-marker">
                    <Ionicons name="close-circle" size={22} color={C.accent} />
                  </View>
                </TouchableOpacity>
              </View>
              {exercises.map((ex, i) => (
                <View key={i} style={styles.exRowWrapper}>
                  <View style={styles.exRow}>
                    <Ionicons name="barbell-outline" size={16} color={C.accent} />
                    <Text style={styles.exName}>{ex.exercises?.name || ex.exercise_id}</Text>
                  </View>
                  {Array.isArray(ex.sets_data) && ex.sets_data.length > 0 && (
                    <View style={styles.setsList}>
                      {ex.sets_data.map((set, setIdx) => (
                        <Text key={setIdx} style={styles.setLine}>
                          Seria {setIdx + 1}:  {set.reps || '-'} powt.  x  {set.weight || '-'} kg
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          );
        })}
        </View>

        {selectedIds.length > 0 && (
          <>
            <TouchableOpacity style={[styles.sendBtn, sending && { opacity: 0.5 }, { backgroundColor: '#25D366', flexDirection: 'row', justifyContent: 'center', gap: 8 }]} onPress={handleSend} disabled={sending}>
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              <Text style={styles.sendBtnText}>{sending ? 'Przygotowywanie...' : 'Wyślij plan przez WhatsApp'}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </AppLayout>
  );
}

function makeStyles(C, TC) { return StyleSheet.create({
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: 100 },
  label: { color: TC.textSecondary, fontSize: 13, fontWeight: '600', marginTop: SPACING.md, marginBottom: 6 },
  pickerWrap: { backgroundColor: TC.surface, borderRadius: 12, borderWidth: 1, borderColor: TC.border, overflow: 'hidden', marginBottom: SPACING.sm },
  picker: { color: TC.text, height: 50, backgroundColor: TC.surface },
  empty: { color: TC.textMuted, textAlign: 'center', marginTop: 40, fontSize: 15 },
  card: {
    backgroundColor: TC.surface, borderRadius: 16, padding: 18,
    marginTop: SPACING.lg, borderWidth: 1, borderColor: TC.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { color: C.accent, fontSize: 16, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, flex: 1 },
  removeBtn: { padding: 4 },
  exRowWrapper: { borderBottomWidth: 1, borderBottomColor: TC.border, paddingVertical: 8 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  setsList: { paddingLeft: 26, marginTop: 4 },
  setLine: { color: TC.textSecondary, fontSize: 13, marginBottom: 2 },
  exName: { color: TC.text, fontSize: 14, flex: 1 },
  sendBtn: { backgroundColor: C.accent, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: SPACING.md },
  sendBtnText: { color: TC.background, fontWeight: '700', fontSize: 14 },
}); }
