import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../assets/theme';
import { useTheme } from '../context/ThemeContext';
import AppLayout from '../components/AppLayout';
import * as api from '../services/api';

export default function HistoryFilterScreen({ navigation, route }) {
  const { colors: C, themeColors } = useTheme();
  const styles = useMemo(() => makeStyles(C.accent, themeColors), [C.accent, themeColors]);

  const { clientId, clientName } = route.params || {};

  const [clients, setClients] = useState([]);
  const [muscleGroups, setMuscleGroups] = useState([]);
  const [selectedClient, setSelectedClient] = useState(clientId || '');
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [selectedPart, setSelectedPart] = useState('');
  
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Load clients and muscle groups on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const [cls, mgs] = await Promise.all([
          api.getClients().catch(() => []),
          api.getMuscleGroups().catch(() => []),
        ]);
        setClients(cls);
        setMuscleGroups(mgs);
        if (mgs.length > 0 && !selectedPart) {
          setSelectedPart(mgs[0].name);
        }
      } catch (err) {
        console.error('Error loading config:', err);
      } finally {
        setLoadingConfig(false);
      }
    }
    loadConfig();
  }, []);

  // Fetch history when selected client changes
  useEffect(() => {
    if (!selectedClient) {
      setLogs([]);
      return;
    }
    async function fetchHistory() {
      setLoadingLogs(true);
      try {
        const data = await api.getClientHistory(selectedClient);
        setLogs(data || []);
      } catch (err) {
        console.error('Error fetching client history:', err);
        setLogs([]);
      } finally {
        setLoadingLogs(false);
      }
    }
    fetchHistory();
  }, [selectedClient]);

  // Compute filtered logs
  const filteredGroupedLogs = useMemo(() => {
    if (!logs || logs.length === 0 || !selectedPart) return [];

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - selectedMonths);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    // Filter by date and muscle group
    const filtered = logs.filter(log => {
      const dateOk = log.session_date >= cutoffStr;
      const partName = log.exercises?.muscle_groups?.name || '';
      const partOk = partName.toLowerCase() === selectedPart.toLowerCase();
      return dateOk && partOk;
    });

    // Group by session date
    const groups = {};
    filtered.forEach(log => {
      const dateStr = log.session_date;
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(log);
    });

    const sortedDates = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));

    return sortedDates.map(dateStr => {
      const exercisesOnDate = {};
      groups[dateStr].forEach(log => {
        const exName = log.exercises?.name || 'Inne ćwiczenie';
        if (!exercisesOnDate[exName]) exercisesOnDate[exName] = [];
        exercisesOnDate[exName].push({
          weight: log.weight_kg,
          reps: log.reps
        });
      });
      return {
        date: dateStr,
        exercises: exercisesOnDate
      };
    });
  }, [logs, selectedMonths, selectedPart]);

  return (
    <AppLayout navigation={navigation} title="Szczegóły Historii" showBack>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Client Selection */}
        <Text style={styles.label}>Klient</Text>
        <DropdownPicker
          placeholder="Wybierz klienta"
          selectedValue={selectedClient}
          onValueChange={setSelectedClient}
          style={styles.pickerWrap}
          dropdownIconColor={themeColors.textSecondary}
          items={[
            { label: "Wybierz klienta", value: "", color: themeColors.textMuted },
            ...clients.map(c => ({ label: c.name, value: c.id, color: themeColors.text }))
          ]}
        />

        {/* Date Range Selector */}
        <Text style={styles.label}>Zakres czasu</Text>
        <View style={styles.segmentContainer}>
          {[
            { label: '1 miesiąc', val: 1 },
            { label: '2 miesiące', val: 2 },
            { label: '3 miesiące', val: 3 },
          ].map(opt => (
            <TouchableOpacity
              key={opt.val}
              style={[styles.segmentBtn, selectedMonths === opt.val && { backgroundColor: C.accent }]}
              onPress={() => setSelectedMonths(opt.val)}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentBtnText, selectedMonths === opt.val && { color: themeColors.background }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Muscle Group Selection */}
        <Text style={styles.label}>Partia mięśniowa</Text>
        <DropdownPicker
          selectedValue={selectedPart}
          onValueChange={setSelectedPart}
          style={styles.pickerWrap}
          dropdownIconColor={themeColors.textSecondary}
          items={muscleGroups.map(mg => ({ label: mg.name, value: mg.name, color: themeColors.text }))}
        />

        {/* Results list */}
        <Text style={styles.sectionTitle}>Wyniki Treningów</Text>

        {loadingConfig || loadingLogs ? (
          <ActivityIndicator size="large" color={C.accent} style={{ marginVertical: 40 }} />
        ) : !selectedClient ? (
          <Text style={styles.noData}>Wybierz klienta, aby zobaczyć historię</Text>
        ) : filteredGroupedLogs.length === 0 ? (
          <Text style={styles.noData}>Brak zapisów dla wybranej partii w tym okresie</Text>
        ) : (
          filteredGroupedLogs.map(session => {
            const formattedDate = new Date(session.date).toLocaleDateString('pl-PL', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            });
            return (
              <View key={session.date} style={styles.sessionCard}>
                <Text style={styles.sessionDate}>{formattedDate}</Text>
                <View style={styles.tableHeaderRow}>
                  <Text style={styles.headerExercise}>ĆWICZENIE</Text>
                  <Text style={styles.headerSets}>SERIE (KG x POWT.)</Text>
                </View>
                {Object.entries(session.exercises).map(([exName, sets]) => (
                  <View key={exName} style={styles.exerciseRow}>
                    <Text style={styles.exerciseName} numberOfLines={2}>{exName}</Text>
                    <Text style={styles.exerciseSets}>
                      {sets.map(s => `${s.weight}kg x ${s.reps}`).join('\n')}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    </AppLayout>
  );
}

function makeStyles(accent, TC) {
  return StyleSheet.create({
    scroll: { paddingHorizontal: SPACING.md, paddingBottom: 100 },
    label: { color: TC.textSecondary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SPACING.md, marginBottom: 8 },
    pickerWrap: { backgroundColor: TC.surface, borderRadius: 12, borderWidth: 1, borderColor: TC.border, overflow: 'hidden', marginBottom: SPACING.sm },
    picker: { color: TC.text, height: 50, backgroundColor: TC.surface },
    segmentContainer: { flexDirection: 'row', backgroundColor: TC.surface, borderRadius: 12, borderWidth: 1, borderColor: TC.border, padding: 4, gap: 4, marginBottom: SPACING.sm },
    segmentBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    segmentBtnText: { color: TC.textSecondary, fontSize: 13, fontWeight: '700' },
    sectionTitle: { color: TC.textSecondary, fontSize: 14, fontWeight: '700', marginTop: 24, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
    noData: { color: TC.textMuted, textAlign: 'center', marginVertical: 40, fontSize: 14, fontStyle: 'italic' },
    sessionCard: { marginBottom: 16, backgroundColor: TC.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: TC.border },
    sessionDate: { color: accent, fontSize: 14, fontWeight: '700', textTransform: 'capitalize', marginBottom: 10 },
    tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: TC.border, paddingBottom: 6, marginBottom: 8 },
    headerExercise: { flex: 2, color: TC.textSecondary, fontSize: 11, fontWeight: '700' },
    headerSets: { flex: 1, color: TC.textSecondary, fontSize: 11, fontWeight: '700', textAlign: 'right' },
    exerciseRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: TC.border + '30', paddingVertical: 8, alignItems: 'center' },
    exerciseName: { flex: 2, color: TC.text, fontSize: 13, fontWeight: '600' },
    exerciseSets: { flex: 1, color: TC.textSecondary, fontSize: 12, textAlign: 'right', lineHeight: 16 },
  });
}
