// Atylla Pro — "Zamknij dzień".
// Reguła: trening rozlicza się sam po minięciu slotu (8:00 -> po 9:00).
// Trener wieczorem przegląda propozycję i ZATWIERDZA dzień (obowiązkowe —
// dopiero wtedy salda w Rozliczeniach się spinają) albo koryguje pojedyncze
// pozycje (nie rozliczaj = wypada z pakietu, jak odwołanie w porę).

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AppLayout from '../components/AppLayout';
import { useTheme } from '../context/ThemeContext';
import * as api from '../services/api';

function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function shift(dayStr, delta) {
  const d = new Date(dayStr + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return fmt(d);
}

// Alert.alert nie pokazuje się na web — tam używamy window.alert.
function showAlert(title, msg) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
    window.alert(`${title}: ${msg}`);
  } else {
    Alert.alert(title, msg);
  }
}

const PROPOSAL_META = {
  settle: { label: 'Do rozliczenia', color: '#1dd1a1' },
  leave: { label: 'OK', color: '#888888' },
};

export default function DayCloseScreen({ navigation }) {
  const { colors: C, themeColors } = useTheme();
  const styles = useMemo(() => makeStyles(C, themeColors), [C, themeColors]);
  const [day, setDay] = useState(() => fmt(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // returns: { '<date>|<hour>': true } — odhaczone = NIE rozliczaj (wypada z pakietu)
  const [returns, setReturns] = useState({});
  // askCancel: key wiersza, dla którego pokazujemy wybór Z/BEZ rozliczenia
  const [askCancel, setAskCancel] = useState(null);

  const load = useCallback(async (forDay) => {
    setLoading(true);
    try {
      const res = await api.getDaySummary(forDay);
      setData(res);
      setReturns({});
    } catch (e) {
      showAlert('Błąd', e.message);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(day); }, [day, load]));

  const changeDay = (delta) => setDay((d) => shift(d, delta));

  const toggleReturn = (item) => {
    const key = `${item.event_date}|${item.event_hour}`;
    setReturns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Pełna swoboda regulacji zapisu w widoku dnia (jak szuflada w kalendarzu).
  const settleRow = async (item) => {
    try {
      await api.settleWorkout(item.event_date, item.event_hour);
      load(day);
    } catch (e) { showAlert('Błąd', e.message); }
  };

  const cancelRow = async (item, withSettle) => {
    try {
      if (withSettle) {
        try { await api.settleWorkout(item.event_date, item.event_hour); } catch (e) {}
      }
      await api.deleteCalendarEvent(item.event_date, item.event_hour);
      setAskCancel(null);
      load(day);
    } catch (e) { showAlert('Błąd', e.message); }
  };

  const approve = async () => {
    if (!data) return;
    const payload = [];
    for (const it of data.items) {
      const key = `${it.event_date}|${it.event_hour}`;
      if (it.proposal === 'settle') {
        payload.push({
          event_date: it.event_date,
          event_hour: it.event_hour,
          action: returns[key] ? 'return' : 'settle',
        });
      }
    }
    if (payload.length === 0) {
      showAlert('Info', 'Brak pozycji do zatwierdzenia — przyszłe sloty rozliczą się same po minięciu godziny, a ten dzień nie ma jeszcze nic do domknięcia.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.approveDay(day, payload);
      showAlert('Zatwierdzono', `Rozliczono: ${res.applied.filter(a => a.action === 'settle').length}, zwrócono: ${res.applied.filter(a => a.action === 'return').length}.`);
      load(day);
    } catch (e) {
      showAlert('Błąd', e.message);
    }
    setSaving(false);
  };

  const items = (data && data.items) || [];
  const counts = (data && data.counts) || { settle: 0, leave: 0 };

  return (
    <AppLayout navigation={navigation} title="Zamknij dzień" showBack>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.dayNav}>
          <TouchableOpacity style={styles.dayBtn} onPress={() => changeDay(-1)}>
            <Ionicons name="chevron-back" size={22} color={C.accent} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.dayText}>{day}</Text>
            {data?.approved && <Text style={styles.approvedText}>zatwierdzony ✓</Text>}
          </View>
          <TouchableOpacity style={styles.dayBtn} onPress={() => changeDay(1)}>
            <Ionicons name="chevron-forward" size={22} color={C.accent} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={C.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.counts}>
              <Text style={styles.countText}>Do rozliczenia: {counts.settle}</Text>
              <Text style={styles.countText}>OK: {counts.leave}</Text>
            </View>
            <Text style={styles.hint}>Treningi rozliczają się same po minięciu godziny. Odhacz te, których NIE rozliczasz (wypadną z pakietu), potem zatwierdź dzień.</Text>
            {items.length === 0 && <Text style={styles.muted}>Brak treningów tego dnia.</Text>}
            {items.map((it, idx) => {
              const meta = PROPOSAL_META[it.proposal] || PROPOSAL_META.leave;
              const key = `${it.event_date}|${it.event_hour}`;
              const ret = !!returns[key];
              const asking = askCancel === key;
              const canAct = it.client_id && !it.is_settled;
              return (
                <View key={idx} style={styles.card}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{it.event_hour}:00 — {it.client_name || '(pusty slot)'}{it.partner_name ? ` (z: ${it.partner_name})` : ''}</Text>
                    <Text style={styles.muted}>{it.reason}</Text>
                    {it.proposal === 'settle' && (
                      <TouchableOpacity
                        style={[styles.retBtn, ret && { backgroundColor: C.accent + '30', borderColor: C.accent }]}
                        onPress={() => toggleReturn(it)}
                      >
                        <Text style={styles.decText}>{ret ? '✓ Nie rozliczaj (wypadnie)' : 'Nie rozliczaj'}</Text>
                      </TouchableOpacity>
                    )}
                    {canAct && !asking && (
                      <View style={styles.rowBtns}>
                        <TouchableOpacity
                          style={[styles.miniBtn, { borderColor: themeColors.border }]}
                          onPress={() => navigation.navigate('Training', { date: it.event_date, hour: it.event_hour })}
                        >
                          <Text style={styles.miniText}>Otwórz</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.miniBtn, { backgroundColor: '#1dd1a1', borderColor: '#1dd1a1' }]}
                          onPress={() => settleRow(it)}
                        >
                          <Text style={[styles.miniText, { color: '#06281e' }]}>Rozlicz</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.miniBtn, { borderColor: themeColors.danger }]}
                          onPress={() => setAskCancel(key)}
                        >
                          <Text style={[styles.miniText, { color: themeColors.danger }]}>Odwołaj</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {canAct && asking && (
                      <View style={styles.rowBtns}>
                        <TouchableOpacity
                          style={[styles.miniBtn, { backgroundColor: themeColors.danger, borderColor: themeColors.danger }]}
                          onPress={() => cancelRow(it, true)}
                        >
                          <Text style={[styles.miniText, { color: '#fff' }]}>Z rozliczeniem</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.miniBtn, { borderColor: themeColors.border }]}
                          onPress={() => cancelRow(it, false)}
                        >
                          <Text style={styles.miniText}>Bez rozliczenia</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.miniBtn, { borderColor: themeColors.border }]}
                          onPress={() => setAskCancel(null)}
                        >
                          <Text style={[styles.miniText, { color: themeColors.textSecondary }]}>Powrót</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  <View style={[styles.badge, { backgroundColor: ret ? themeColors.danger : meta.color }]}>
                    <Text style={styles.badgeText}>{ret ? 'Zwrot' : meta.label}</Text>
                  </View>
                </View>
              );
            })}
            {items.length > 0 && (
              <TouchableOpacity style={[styles.approveBtn, saving && { opacity: 0.5 }]} onPress={approve} disabled={saving}>
                <Text style={styles.approveText}>{saving ? 'Zatwierdzanie…' : `Zatwierdź dzień (${counts.settle})`}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </AppLayout>
  );
}

function makeStyles(C, TC) {
  return StyleSheet.create({
    scroll: { paddingHorizontal: 16, paddingBottom: 100 },
    dayNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 4 },
    dayBtn: { padding: 10 },
    dayText: { color: TC.text, fontSize: 17, fontWeight: '700' },
    approvedText: { color: '#1dd1a1', fontSize: 12, fontWeight: '700' },
    counts: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 10 },
    countText: { color: TC.textSecondary, fontSize: 12, fontWeight: '600' },
    hint: { color: TC.textMuted, fontSize: 12, marginBottom: 10, lineHeight: 17 },
    muted: { color: TC.textMuted, fontSize: 13 },
    card: {
      flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
      backgroundColor: TC.surface, borderRadius: 12, marginBottom: 10,
      borderWidth: 1, borderColor: TC.border,
    },
    cardTitle: { color: TC.text, fontSize: 15, fontWeight: '600' },
    badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    retBtn: { borderWidth: 1, borderColor: TC.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6, marginTop: 8, alignSelf: 'flex-start' },
    rowBtns: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
    miniBtn: { borderWidth: 1, borderColor: TC.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
    miniText: { color: TC.text, fontSize: 12, fontWeight: '700' },
    decText: { color: TC.text, fontSize: 13, fontWeight: '600' },
    approveBtn: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
    approveText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  });
}
