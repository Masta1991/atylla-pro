import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import AppLayout from '../components/AppLayout';
import * as api from '../services/api';
import { LoadState } from '../components/TrainerPanels';

// 2.0: podsumowanie tygodnia (Strefa Trenera) — WSZYSTKIE treningi pon–nd:
// odbyte, planowane, odwolane oplacone i bez platnosci. Odpowiedz na
// "32 treningi, a w kalendarzu widac 30".
function mondayOf(d) {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  x.setHours(0, 0, 0, 0);
  return x;
}
function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function slotPassed(dateStr, hour) {
  const end = new Date(dateStr + 'T00:00:00');
  end.setHours(Number(hour) + 1, 0, 0, 0);
  return Date.now() > end.getTime();
}
const DOW = ['PON', 'WT', 'ŚR', 'CZW', 'PT', 'SOB', 'ND'];

function evState(ev) {
  if (ev.status === 'removed') return 'removed';
  if (ev.status === 'cancelled') return ev.is_settled ? 'paid' : 'cancel';
  if (ev.status === 'deleted') return 'free';
  return slotPassed(ev.event_date, ev.event_hour) ? 'done' : 'planned';
}
const STATE_META = {
  done: { label: 'odbyty', color: '#1dd1a1' },
  planned: { label: 'planowany', color: '#f1c40f' },
  paid: { label: 'odwołany • opłacony', color: '#e67e22' },
  cancel: { label: 'odwołany', color: '#ff6b6b' },
  free: { label: 'odwołany • bez płatności', color: '#ff6b6b' },
  removed: { label: 'Usunięty', color: '#8b949e' },
  unknown: { label: 'Brak danych o rozliczeniu', color: '#8b949e' },
};

export default function WeekSummaryScreen({ navigation, route }) {
  const { colors: C, themeColors } = useTheme();
  const styles = useMemo(() => makeStyles(C.accent, themeColors), [C, themeColors]);
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const [events, setEvents] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classified, setClassified] = useState(null);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  useEffect(() => {
    if (route?.params?.weekOf) {
      const day = new Date(route.params.weekOf + 'T12:00:00');
      if (!Number.isNaN(day.getTime())) setMonday(mondayOf(day));
      navigation.setParams({weekOf:undefined});
    }
  }, [route?.params?.weekOf]);

  const load = useCallback(async () => {
    const seq = ++sequence.current;
    setLoading(true);
    setError('');
    try {
      const res = await api.getWeekSummary(iso(monday));
      if (seq !== sequence.current) return;
      setEvents(res?.events || []);
      setAbsences(res?.absences || []);
      setClassified(res?.session_rows || null);
    } catch(e) {
      if (seq === sequence.current) setError(e.message);
    } finally { if (seq === sequence.current) setLoading(false); }
  }, [monday]);

  useFocusEffect(useCallback(() => { load(); return () => { sequence.current++; }; }, [load]));

  const days = useMemo(() => {
    const evKeys = new Set(events.map(e => `${e.event_date}|${e.event_hour}|${e.client_id}`));
    const extraAbs = (absences || []).filter(a => !evKeys.has(`${a.absence_date}|${a.absence_hour}|${a.client_id}`));
    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(d.getDate() + i);
      const key = iso(d);
      let devs = events.filter(e => e.event_date === key)
        .map(e => {
          const num = e.tile_number != null
            ? (e.clients?.billing_type === 'package' && e.clients?.package_size
              ? `${e.tile_number}/${e.clients.package_size}` : `${e.tile_number}`)
            : null;
          return {
            key: e.id, hour: e.event_hour,
            name: e.clients?.name || '—',
            what: e.training_plans?.name || e.workout_types?.name || '',
            state: evState(e),
            num,
          };
        });
      if (classified) {
        devs = [...devs.filter(r => r.state === 'removed'), ...classified.filter(r => r.date === key).map(r => ({
          key:r.id,hour:r.hour,name:r.name,state:r.state,what:r.detail,
          num:events.find(e => e.id === r.event_id)?.tile_number,
        }))];
      }
      (!classified ? extraAbs : []).filter(a => a.absence_date === key).forEach(a => {
        devs.push({
          key: `abs-${a.id}`, hour: a.absence_hour,
          name: a.clients?.name || '—', what: '',
          state: 'free',
        });
      });
      devs.sort((a, b) => (a.hour ?? 99) - (b.hour ?? 99));
      out.push({ key, label: DOW[i], num: d.getDate(), rows: devs });
    }
    return out;
  }, [monday, events, absences, classified]);

  const totals = useMemo(() => {
    const t = { all: 0, done: 0, planned: 0, paid: 0, free: 0, cancel: 0 };
    days.forEach(d => d.rows.forEach(r => {
      if (['done','planned','paid','free','cancel'].includes(r.state)) t.all++;
      t[r.state] = (t[r.state] || 0) + 1;
    }));
    return t;
  }, [days]);

  return (
    <AppLayout navigation={navigation} title="Podsumowanie tygodnia" showBack>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.weekNav}>
          <TouchableOpacity onPress={() => setMonday(m => { const n = new Date(m); n.setDate(n.getDate() - 7); return n; })} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={22} color={C.accent} />
          </TouchableOpacity>
          <Text style={styles.weekLabel}>Tydzień od {iso(monday)}</Text>
          <TouchableOpacity onPress={() => setMonday(m => { const n = new Date(m); n.setDate(n.getDate() + 7); return n; })} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={22} color={C.accent} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.todayBtn} onPress={() => setMonday(mondayOf(new Date()))}>
          <Text style={styles.todayText}>Bieżący tydzień</Text>
        </TouchableOpacity>

        {!loading && !error && <View style={styles.totals}>
          <Text style={styles.totalMain}>{totals.all} treningów</Text>
          <Text style={styles.totalSub}>
            odbyte: {totals.done} • opłacone odwołania: {totals.paid} • planowane: {totals.planned} • bez płatności: {totals.free + totals.cancel}
          </Text>
        </View>}

        <LoadState loading={loading} error={error} retry={load}/>
        {!loading && !error && days.map(day => (
          <View key={day.key} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayLabel}>{day.label} {day.num}</Text>
              <Text style={styles.dayDate}>{day.key}</Text>
            </View>
            {day.rows.length === 0 && <Text style={styles.empty}>Brak zapisów.</Text>}
            {day.rows.map(r => {
              const meta = STATE_META[r.state] || STATE_META.planned;
              return (
                <View key={r.key} style={styles.row}>
                  <Text style={styles.hour}>{r.hour != null ? `${r.hour}:00` : '—'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={1}>{r.name}{r.num ? ` [${r.num}]` : ''}{r.what ? ` • ${r.what}` : ''}</Text>
                    <Text style={{ color: meta.color, fontSize: 12, fontWeight: '700' }}>{meta.label}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </AppLayout>
  );
}

function makeStyles(accent, TC) { return StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: 120 },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  navBtn: { padding: 10 },
  weekLabel: { color: TC.text, fontSize: 14, fontWeight: '800' },
  todayBtn: { alignItems: 'center', marginVertical: 8 },
  todayText: { color: accent, fontSize: 13, fontWeight: '700' },
  totals: { backgroundColor: TC.surface, borderRadius: 14, borderWidth: 1, borderColor: TC.border, padding: 14, marginBottom: 10 },
  totalMain: { color: TC.text, fontSize: 18, fontWeight: '800' },
  totalSub: { color: TC.textSecondary, fontSize: 12, marginTop: 4 },
  dayCard: { backgroundColor: TC.surface, borderRadius: 14, borderWidth: 1, borderColor: TC.border, padding: 12, marginBottom: 10 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  dayLabel: { color: TC.text, fontSize: 15, fontWeight: '800' },
  dayDate: { color: TC.textMuted, fontSize: 12 },
  empty: { color: TC.textMuted, fontSize: 13, fontStyle: 'italic' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: TC.border + '40' },
  hour: { color: TC.text, fontSize: 13, fontWeight: '800', width: 44 },
  rowName: { color: TC.text, fontSize: 13, fontWeight: '600' },
}); }
