import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../assets/theme';
import { useTheme } from '../context/ThemeContext';
import AppLayout from '../components/AppLayout';
import * as api from '../services/api';

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function ManagerScreen({ navigation }) {
  const { colors: C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const [currentMonday, setCurrentMonday] = useState(getMonday(new Date()));
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    loadEvents();
  }, [currentMonday]);

  async function loadEvents() {
    try {
      const data = await api.getWeekEvents(currentMonday.toISOString().slice(0, 10));
      setEvents(data || []);
      setSelected(new Set());
    } catch (e) {
      setEvents([]);
    }
  }

  function toggleSelect(idx) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === events.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(events.map((_, i) => i)));
    }
  }

  async function copyToNextWeek() {
    const toCopy = events.filter((_, i) => selected.has(i));
    if (toCopy.length === 0) {
      Alert.alert('Brak zaznaczonych', 'Zaznacz treningi do skopiowania.');
      return;
    }
    const nextMonday = new Date(currentMonday.getTime() + 7 * 86400000);
    const nextMondayStr = nextMonday.toISOString().slice(0, 10);

    Alert.alert(
      'Kopiuj tydzień',
      `Skopiować ${toCopy.length} treningów z ${currentMonday.toLocaleDateString('pl-PL')} na ${nextMonday.toLocaleDateString('pl-PL')}?`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Kopiuj',
          onPress: async () => {
            setCopying(true);
            let copied = 0;
            let errors = [];
            for (const ev of toCopy) {
              try {
                const evDate = new Date(ev.event_date);
                const targetDate = new Date(evDate.getTime() + 7 * 86400000).toISOString().slice(0, 10);

                await api.createCalendarEvent({
                  event_date: targetDate,
                  event_hour: ev.event_hour,
                  client_id: ev.client_id,
                  workout_type_id: ev.workout_type_id,
                  status: 'active',
                });
                copied++;
              } catch (e) {
                errors.push(e.message);
              }
            }
            setCopying(false);
            if (errors.length > 0) {
              Alert.alert('Błędy', `Skopiowano ${copied}, nieudane: ${errors.length}\n${errors.slice(0, 3).join('\n')}`);
            } else {
              setCurrentMonday(nextMonday);
            }
          },
        },
      ]
    );
  }

  const weekLabel = currentMonday.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  const satLabel = new Date(currentMonday.getTime() + 5 * 86400000).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  const allSelected = events.length > 0 && selected.size === events.length;

  return (
    <AppLayout navigation={navigation} title="Menadżer" showBack>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Aktualny tydzień</Text>
        <View style={styles.weekRow}>
          <TouchableOpacity onPress={() => setCurrentMonday(new Date(currentMonday.getTime() - 7 * 86400000))}>
            <Ionicons name="chevron-back" size={22} color={C.accent} />
          </TouchableOpacity>
          <Text style={styles.weekText}>{weekLabel} — {satLabel}</Text>
          <TouchableOpacity onPress={() => setCurrentMonday(new Date(currentMonday.getTime() + 7 * 86400000))}>
            <Ionicons name="chevron-forward" size={22} color={C.accent} />
          </TouchableOpacity>
        </View>

        <View style={styles.selectBar}>
          <Text style={styles.summary}>{events.length} treningów</Text>
          <TouchableOpacity onPress={selectAll} style={styles.selectAllBtn}>
            <Text style={[styles.selectAllText, { color: C.accent }]}>
              {allSelected ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
            </Text>
          </TouchableOpacity>
        </View>

        {events.map((ev, i) => (
          <TouchableOpacity key={i} style={[styles.eventRow, selected.has(i) && { borderColor: C.accent, backgroundColor: C.accent + '10' }]} onPress={() => toggleSelect(i)}>
            <View style={[styles.check, selected.has(i) && { backgroundColor: C.accent, borderColor: C.accent }]}>
              {selected.has(i) && <Ionicons name="checkmark" size={14} color={COLORS.background} />}
            </View>
            <Text style={styles.eventDate}>
              {new Date(ev.event_date).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })}
            </Text>
            <Text style={styles.eventHour}>{ev.event_hour}:00</Text>
            <Text style={styles.eventClient} numberOfLines={1}>{ev.clients?.name || '—'}</Text>
          </TouchableOpacity>
        ))}

        {events.length === 0 && (
          <Text style={styles.empty}>Brak treningów w tym tygodniu</Text>
        )}

        <TouchableOpacity
          style={[styles.copyBtn, { backgroundColor: C.accent }, copying && { opacity: 0.5 }]}
          onPress={copyToNextWeek}
          disabled={copying || selected.size === 0}
        >
          <Ionicons name="copy-outline" size={20} color={COLORS.background} />
          <Text style={styles.copyBtnText}>
            {copying ? 'Kopiowanie...' : `Kopiuj zaznaczone (${selected.size}) na następny tydzień`}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </AppLayout>
  );
}

function makeStyles(C) { return StyleSheet.create({
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: 100 },
  sectionTitle: { color: C.accent, fontSize: 14, fontWeight: '700', marginTop: SPACING.md, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  weekRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 8 },
  weekText: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  selectBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  summary: { color: COLORS.textSecondary, fontSize: 13 },
  selectAllBtn: { padding: 4 },
  selectAllText: { fontSize: 12, fontWeight: '600' },
  eventRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: COLORS.surface, borderRadius: 10, marginBottom: 4,
    borderWidth: 1, borderColor: COLORS.border, gap: 10,
  },
  check: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.textMuted, justifyContent: 'center', alignItems: 'center' },
  eventDate: { color: C.accent, fontSize: 12, fontWeight: '600', width: 85 },
  eventHour: { color: COLORS.textMuted, fontSize: 12, width: 35 },
  eventClient: { color: COLORS.text, fontSize: 13, flex: 1 },
  empty: { color: COLORS.textMuted, textAlign: 'center', marginTop: 32, fontSize: 14 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, padding: 16, marginTop: 24 },
  copyBtnText: { color: COLORS.background, fontWeight: '700', fontSize: 14 },
}); }
