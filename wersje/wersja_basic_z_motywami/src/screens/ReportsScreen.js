import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { BarChart, LineChart } from 'react-native-chart-kit';
import { COLORS, SPACING } from '../assets/theme';
import { useTheme } from '../context/ThemeContext';
import AppLayout from '../components/AppLayout';
import * as api from '../services/api';

const SCREEN_W = Dimensions.get('window').width - 32;

const MONTH_OPTIONS = [1, 2, 3, 6, 12];

function getWeekLabel(d) {
  const date = new Date(d);
  const start = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - start) / 86400000);
  const week = Math.ceil((days + start.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getDayLabel(d) {
  const days = ['PON', 'WT', 'ŚR', 'CZW', 'PT', 'SOB'];
  const day = new Date(d).getDay();
  return days[day === 0 ? 5 : day - 1] || '';
}

export default function ReportsScreen({ navigation }) {
  const { colors: C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const [clients, setClients] = useState([]);
  const [allExercises, setAllExercises] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [months, setMonths] = useState(3);
  const [loading, setLoading] = useState(false);
  const [workoutData, setWorkoutData] = useState(null);
  const [measurements, setMeasurements] = useState([]);

  useEffect(() => {
    api.getClients().then(setClients).catch(() => {});
    api.getExercisesGrouped().then(g => {
      const flat = [];
      Object.entries(g || {}).forEach(([part, exs]) => {
        exs.forEach(e => { flat.push({ ...e, part }); });
      });
      setAllExercises(flat);
    }).catch(() => {});
  }, []);

  async function loadReport() {
    if (!selectedClient) return;
    setLoading(true);
    try {
      const [history, meas] = await Promise.all([
        api.getClientHistory(selectedClient),
        api.getMeasurements(selectedClient),
      ]);
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months);
      const cutoffStr = cutoff.toISOString().slice(0, 10);

      const filtered = (history || []).filter(
        w => w.session_date >= cutoffStr
      );

      const filteredMeas = (meas || []).filter(
        m => m.measure_date >= cutoffStr
      ).sort((a, b) => a.measure_date.localeCompare(b.measure_date));

      setWorkoutData(filtered);
      setMeasurements(filteredMeas);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    if (!workoutData) return null;

    const sessionsByDate = {};
    const bodyPartCount = {};
    const exerciseWeights = {};
    const weeklySessions = {};
    const weeklyBodyParts = {};

    workoutData.forEach(w => {
      const d = w.session_date;
      sessionsByDate[d] = (sessionsByDate[d] || 0) + 1;

      const part = w.exercises?.muscle_groups?.name;
      if (part) {
        bodyPartCount[part] = (bodyPartCount[part] || 0) + 1;
        const wk = getWeekLabel(d);
        const day = getDayLabel(d);
        if (!weeklyBodyParts[wk]) weeklyBodyParts[wk] = {};
        if (!weeklyBodyParts[wk][day]) weeklyBodyParts[wk][day] = new Set();
        weeklyBodyParts[wk][day].add(part);
      }

      const exId = w.exercise_id;
      const wkg = parseFloat(w.weight_kg) || 0;
      if (!exerciseWeights[exId]) exerciseWeights[exId] = [];
      exerciseWeights[exId].push({ date: d, weight: wkg });
    });

    Object.keys(sessionsByDate).forEach(d => {
      const wk = getWeekLabel(d);
      weeklySessions[wk] = (weeklySessions[wk] || 0) + 1;
    });

    const topBodyParts = Object.entries(bodyPartCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const totalSessions = new Set(workoutData.map(w => w.session_date)).size;

    const topStrength = Object.entries(exerciseWeights)
      .map(([id, points]) => {
        const ex = allExercises.find(e => e.id === id);
        const weights = points.map(p => p.weight).filter(w => w > 0);
        if (weights.length < 2) return null;
        const first = weights[0];
        const last = weights[weights.length - 1];
        const delta = last - first;
        return { name: ex?.name || 'N/A', first, last, delta, points };
      })
      .filter(Boolean)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 3);

    // Body composition
    let bodyComp = null;
    if (measurements.length > 0) {
      const first = measurements[0];
      const last = measurements[measurements.length - 1];
      bodyComp = {
        weight: { first: first.weight_kg, last: last.weight_kg },
        fat: { first: first.body_fat_pct, last: last.body_fat_pct },
        muscle: { first: first.muscle_mass_pct, last: last.muscle_mass_pct },
      };
    }

    return {
      totalSessions,
      topBodyParts,
      topStrength,
      bodyComp,
      weeklySessions,
      weeklyBodyParts,
    };
  }, [workoutData, measurements, allExercises]);

  // Client's strength progression exercises
  const clientExercises = useMemo(() => {
    const cl = clients.find(c => c.id === selectedClient);
    if (!cl?.strength_progression?.length) return [];
    return allExercises.filter(e => cl.strength_progression.includes(e.id));
  }, [clients, selectedClient, allExercises]);

  // Build strength progression chart data
  const strengthData = useMemo(() => {
    if (!workoutData || clientExercises.length === 0) return null;

    const weekMap = {};
    workoutData.forEach(w => {
      const wk = getWeekLabel(w.session_date);
      const exId = w.exercise_id;
      const ex = clientExercises.find(e => e.id === exId);
      if (!ex) return;
      const key = `${wk}|${ex.name}`;
      const wkg = parseFloat(w.weight_kg) || 0;
      if (!weekMap[key] || wkg > weekMap[key]) weekMap[key] = wkg;
    });

    const allWeeks = Object.keys(stats?.weeklySessions || {}).sort();
    if (allWeeks.length === 0) return null;

    return {
      labels: allWeeks,
      datasets: clientExercises.map((ex, i) => ({
        data: allWeeks.map(wk => weekMap[`${wk}|${ex.name}`] || 0),
        strokeWidth: 2,
      })),
      legend: clientExercises.map(e => e.name),
    };
  }, [workoutData, clientExercises, stats]);

  const clientName = clients.find(c => c.id === selectedClient)?.name || '';
  const clientEmail = clients.find(c => c.id === selectedClient)?.email || '';
  const [sending, setSending] = useState(false);

  async function handleSendEmail() {
    if (!clientEmail) { Alert.alert('Brak emaila', 'Klient nie ma przypisanego adresu email.'); return; }
    if (!stats) return;
    setSending(true);

    // Build weekly sessions data for chart
    const wkSorted = Object.keys(stats.weeklySessions || {}).sort();
    const weeklySessionsData = wkSorted.map(wk => ({
      week: wk,
      count: stats.weeklySessions[wk],
    }));

    // Build strength progression data for chart
    const strengthChartData = [];
    if (workoutData && clientExercises.length > 0) {
      const weekExMap = {};
      workoutData.forEach(w => {
        const wk = getWeekLabel(w.session_date);
        const exId = w.exercise_id;
        const ex = clientExercises.find(e => e.id === exId);
        if (!ex) return;
        const key = `${wk}|${ex.name}`;
        const wkg = parseFloat(w.weight_kg) || 0;
        if (!weekExMap[key] || wkg > weekExMap[key]) weekExMap[key] = wkg;
      });
      Object.entries(weekExMap).forEach(([key, weight]) => {
        const [week, exercise] = key.split('|');
        if (weight > 0) strengthChartData.push({ week, exercise, weight });
      });
    }

    try {
      await api.sendReportEmail({
        recipient: clientEmail,
        client_name: clientName,
        months,
        sessions: stats.totalSessions || 0,
        top_body_parts: (stats.topBodyParts || []).map(([p]) => p),
        weight_start: stats.bodyComp?.weight?.first,
        weight_end: stats.bodyComp?.weight?.last,
        fat_start: stats.bodyComp?.fat?.first,
        fat_end: stats.bodyComp?.fat?.last,
        muscle_start: stats.bodyComp?.muscle?.first,
        muscle_end: stats.bodyComp?.muscle?.last,
        top_strength: (stats.topStrength || []).map(s => ({ name: s.name, first: s.first, last: s.last, delta: s.delta })),
        weekly_sessions: weeklySessionsData,
        strength_data: strengthChartData,
      });
      Alert.alert('Wysłano', `Raport wysłany na ${clientEmail}`);
    } catch (e) {
      Alert.alert('Błąd', 'Nie udało się wysłać: ' + e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <AppLayout navigation={navigation} title="Raporty" showBack>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Klient</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={selectedClient} onValueChange={setSelectedClient} style={styles.picker} dropdownIconColor={COLORS.textSecondary}>
            <Picker.Item label="Wybierz klienta" value="" color={COLORS.textMuted} />
            {clients.map(c => <Picker.Item key={c.id} label={c.name} value={c.id} color={COLORS.text} />)}
          </Picker>
        </View>

        <Text style={styles.label}>Zakres</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={months} onValueChange={setMonths} style={styles.picker} dropdownIconColor={COLORS.textSecondary}>
            {MONTH_OPTIONS.map(m => (
              <Picker.Item key={m} label={m === 1 ? 'Ostatni 1 miesiąc' : `Ostatnie ${m} mies.`} value={m} color={COLORS.text} />
            ))}
          </Picker>
        </View>

        <TouchableOpacity style={styles.loadBtn} onPress={loadReport}>
          <Text style={styles.loadBtnText}>{loading ? 'Ładowanie...' : 'Generuj raport'}</Text>
        </TouchableOpacity>

        {stats && (
          <>
            {/* KPI Tiles */}
            <View style={styles.tileGrid}>
              <View style={styles.tile}>
                <Text style={styles.tileLabel}>Sesje treningowe</Text>
                <Text style={styles.tileValue}>{stats.totalSessions}</Text>
                <Text style={styles.tileSub}>w wybranym okresie</Text>
              </View>
              <View style={styles.tile}>
                <Text style={styles.tileLabel}>Top 3 partie</Text>
                {stats.topBodyParts.map(([part, count], i) => (
                  <View key={part} style={styles.partRow}>
                    <View style={[styles.dot, { backgroundColor: [C.accent, '#2196F3', '#1a7090'][i] }]} />
                    <Text style={styles.partText} numberOfLines={1}>{part}</Text>
                    <Text style={styles.partCount}>{count}x</Text>
                  </View>
                ))}
              </View>
              <View style={styles.tile}>
                <Text style={styles.tileLabel}>Skład ciała</Text>
                {stats.bodyComp ? (
                  <>
                    <MetricRow label="Waga" v1={stats.bodyComp.weight.first} v2={stats.bodyComp.weight.last} unit=" kg" styles={styles} />
                    <MetricRow label="Tłuszcz" v1={stats.bodyComp.fat.first} v2={stats.bodyComp.fat.last} unit="%" down styles={styles} />
                    <MetricRow label="Mięśnie" v1={stats.bodyComp.muscle.first} v2={stats.bodyComp.muscle.last} unit="%" styles={styles} />
                  </>
                ) : (
                  <Text style={styles.noData}>Brak pomiarów</Text>
                )}
              </View>
              <View style={styles.tile}>
                <Text style={styles.tileLabel}>Top 3 siła</Text>
                {stats.topStrength.length > 0 ? stats.topStrength.map((s, i) => (
                  <View key={i} style={styles.strengthRow}>
                    <Text style={styles.strengthName} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.strengthVal}>{s.first}→{s.last}</Text>
                    <Text style={[styles.strengthDelta, s.delta >= 0 ? styles.pos : styles.neg]}>
                      {s.delta >= 0 ? '+' : ''}{s.delta.toFixed(1)} kg
                    </Text>
                  </View>
                )) : <Text style={styles.noData}>Za mało danych</Text>}
              </View>
            </View>

            {/* Weekly body parts table */}
            <Text style={styles.sectionTitle}>Partie w tygodniach</Text>
            <BodyPartsTable data={stats.weeklyBodyParts} styles={styles} />

            {/* Sessions per week bar chart */}
            {Object.keys(stats.weeklySessions).length > 0 && (() => {
              const wkLabels = Object.keys(stats.weeklySessions).sort();
              const wkValues = wkLabels.map(w => stats.weeklySessions[w]);
              const maxVal = Math.max(...wkValues, 1);
              const barW = Math.max(SCREEN_W, wkLabels.length * 44);
              const chartH = 200;
              const chartArea = chartH - 34;

              return (
                <>
                  <Text style={styles.sectionTitle}>Treningi tygodniowo</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    <View>
                      <BarChart
                        data={{
                          labels: wkLabels,
                          datasets: [{ data: wkValues }],
                        }}
                        width={barW}
                        height={chartH}
                        yAxisSuffix=""
                        yAxisLabel=""
                        fromZero
                        segments={Math.max(2, maxVal)}
                        chartConfig={{
                          backgroundColor: COLORS.background,
                          backgroundGradientFrom: COLORS.background,
                          backgroundGradientTo: COLORS.background,
                          decimalCount: 0,
                          color: (opacity = 1) => `rgba(49,213,242,${opacity})`,
                          labelColor: () => COLORS.textSecondary,
                          barPercentage: 0.5,
                          propsForLabels: { fontSize: 9 },
                        }}
                        withInnerLines={false}
                        style={styles.chart}
                      />
                      {wkValues.map((v, i) => (
                        <Text
                          key={i}
                          style={{
                            position: 'absolute',
                            top: Math.max(2, 157 - (v / maxVal) * 155),
                            left: 34 + (i + 0.5) * ((barW - 34) / wkValues.length) - 14,
                            color: '#0d1117',
                            fontSize: 11,
                            fontWeight: '800',
                            width: 28,
                            textAlign: 'center',
                            zIndex: 10,
                          }}
                        >
                          {v}
                        </Text>
                      ))}
                    </View>
                  </ScrollView>
                </>
              );
            })()}

            {/* Strength progression line chart */}
            {strengthData && strengthData.datasets.length > 0 && (() => {
              const colors = ['#31d5f2', '#2196F3', '#1dd1a1', '#ff6b6b', '#d29922', '#8b5cf6', '#f59e0b', '#ec4899'];
              const dataWithColors = {
                labels: strengthData.labels,
                datasets: strengthData.datasets.map((ds, i) => ({
                  data: ds.data,
                  strokeWidth: 2,
                  color: () => colors[i % colors.length],
                })),
              };
              const chartW = Math.max(SCREEN_W - 10, (strengthData.labels?.length || 4) * 50);
              return (
                <>
                  <Text style={styles.sectionTitle}>Progresja siłowa</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <LineChart
                      data={dataWithColors}
                      width={chartW}
                      height={260}
                      chartConfig={{
                        backgroundColor: COLORS.background,
                        backgroundGradientFrom: COLORS.background,
                        backgroundGradientTo: COLORS.background,
                        decimalCount: 1,
                        color: (opacity = 1, index = 0) => {
                          const hex = colors[index % colors.length];
                          const r = parseInt(hex.slice(1,3), 16);
                          const g = parseInt(hex.slice(3,5), 16);
                          const b = parseInt(hex.slice(5,7), 16);
                          return `rgba(${r},${g},${b},${opacity})`;
                        },
                        labelColor: () => COLORS.textSecondary,
                        propsForLabels: { fontSize: 9 },
                      }}
                      bezier
                      withDots={false}
                      withShadow={false}
                      style={styles.chart}
                    />
                  </ScrollView>
                  {/* Custom legend */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8, paddingHorizontal: 4 }}>
                    {strengthData.legend.map((name, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 12, height: 3, borderRadius: 2, backgroundColor: colors[i % colors.length] }} />
                        <Text style={{ color: COLORS.textSecondary, fontSize: 11 }} numberOfLines={1}>{name}</Text>
                      </View>
                    ))}
                  </View>
                </>
              );
            })()}
          </>
        )}

        {stats && (
          <View style={styles.emailSection}>
            <Text style={styles.emailLabel}>Wyślij raport emailem</Text>
            {clientEmail ? (
              <Text style={styles.emailAddr}>{clientEmail}</Text>
            ) : (
              <Text style={styles.emailWarn}>Klient nie ma przypisanego adresu email. Dodaj go w zakładce Klienci.</Text>
            )}
            <TouchableOpacity
              style={[styles.sendBtn, (!clientEmail || sending) && { opacity: 0.5 }]}
              onPress={handleSendEmail}
              disabled={!clientEmail || sending}
            >
              <Text style={styles.sendBtnText}>{sending ? 'Wysyłanie...' : 'Wyślij raport emailem'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </AppLayout>
  );
}

function MetricRow({ label, v1, v2, unit, down, styles }) {
  const delta = v1 != null && v2 != null ? (v2 - v1).toFixed(1) : null;
  const good = down ? (v1 != null && v2 != null && v2 < v1) : (v1 != null && v2 != null && v2 > v1);
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricVal}>{v1 != null ? v1 : '-'}→{v2 != null ? v2 : '-'}{unit}</Text>
      {delta && (
        <Text style={[styles.metricDelta, good ? styles.pos : styles.neg]}>
          {delta > 0 ? '+' : ''}{delta}{unit}
        </Text>
      )}
    </View>
  );
}

function BodyPartsTable({ data, styles }) {
  const weeks = Object.keys(data || {}).sort();
  const DAYS = ['PON', 'WT', 'ŚR', 'CZW', 'PT', 'SOB'];
  if (weeks.length === 0) return <Text style={styles.noData}>Brak danych</Text>;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={styles.tableRow}>
          <View style={styles.tableCorner}><Text style={styles.tableHeader}>Tydzień</Text></View>
          {DAYS.map(d => (
            <View key={d} style={styles.tableCell}><Text style={styles.tableHeader}>{d}</Text></View>
          ))}
        </View>
        {weeks.map(wk => (
          <View key={wk} style={[styles.tableRow, weeks.indexOf(wk) % 2 === 0 && styles.tableRowAlt]}>
            <View style={styles.tableCorner}><Text style={styles.tableCornerText}>{wk}</Text></View>
            {DAYS.map(d => (
              <View key={d} style={styles.tableCell}>
                {(data[wk]?.[d] ? [...data[wk][d]].slice(0, 3) : []).map((p, i) => (
                  <Text key={i} style={styles.tableBodyText} numberOfLines={1}>{partShort(p)}</Text>
                ))}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function partShort(name) {
  const m = {
    'KLATKA PIERSIOWA': 'KLATKA', 'PLECY': 'PLECY', 'BARKI': 'BARKI',
    'BICEPS': 'BICEPS', 'TRICEPS': 'TRICEPS', 'PRZEDRAMIONA': 'PRZEDR',
    'NOGI': 'NOGI', 'ŁYDKI': 'ŁYDKI', 'BRZUCH': 'BRZUCH', 'CARDIO': 'CARDIO',
  };
  return m[name] || name?.slice(0, 6) || '';
}

function makeStyles(C) { return StyleSheet.create({
  scroll: { paddingHorizontal: SPACING.md, paddingBottom: 100 },
  label: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', marginTop: SPACING.md, marginBottom: 6 },
  pickerWrap: { backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', marginBottom: SPACING.sm },
  picker: { color: COLORS.text, height: 50, backgroundColor: COLORS.surface },
  loadBtn: { backgroundColor: C.accent, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg },
  loadBtnText: { color: COLORS.background, fontWeight: '700', fontSize: 14 },

  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  tile: {
    width: '48%', backgroundColor: COLORS.surface,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginBottom: 10,
  },
  tileLabel: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  tileValue: { color: C.accent, fontSize: 32, fontWeight: '800' },
  tileSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  partRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  partText: { color: COLORS.text, fontSize: 12, flex: 1 },
  partCount: { color: COLORS.textSecondary, fontSize: 11 },
  noData: { color: COLORS.textMuted, fontSize: 12, fontStyle: 'italic' },
  metricRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 4 },
  metricLabel: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '600', width: 44 },
  metricVal: { color: COLORS.text, fontSize: 11, flexShrink: 1 },
  metricDelta: { fontSize: 11, fontWeight: '700' },
  pos: { color: '#1dd1a1' },
  neg: { color: '#ff6b6b' },
  strengthRow: { marginBottom: 6 },
  strengthName: { color: COLORS.text, fontSize: 11, fontWeight: '600' },
  strengthVal: { color: COLORS.textSecondary, fontSize: 11 },
  strengthDelta: { fontSize: 12, fontWeight: '700' },

  sectionTitle: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700', marginTop: 24, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },

  tableRow: { flexDirection: 'row' },
  tableRowAlt: { backgroundColor: COLORS.surfaceLight + '40' },
  tableCorner: { width: 80, paddingVertical: 8, paddingHorizontal: 6, borderWidth: 0.5, borderColor: COLORS.border, justifyContent: 'center' },
  tableCornerText: { color: COLORS.textSecondary, fontSize: 9, fontWeight: '600' },
  tableCell: { width: 55, paddingVertical: 6, paddingHorizontal: 3, borderWidth: 0.5, borderColor: COLORS.border, alignItems: 'center' },
  tableHeader: { color: C.accent, fontSize: 9, fontWeight: '700', textAlign: 'center' },
  tableBodyText: { color: COLORS.text, fontSize: 8, textAlign: 'center' },

  chart: { marginVertical: 8, borderRadius: 16 },
  emailSection: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 18,
    marginTop: 24, borderWidth: 1, borderColor: COLORS.border,
  },
  emailLabel: { color: C.accent, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  emailAddr: { color: COLORS.text, fontSize: 13, marginBottom: 12 },
  emailWarn: { color: COLORS.textMuted, fontSize: 12, marginBottom: 12, fontStyle: 'italic' },
  sendBtn: { backgroundColor: C.accent, borderRadius: 12, padding: 14, alignItems: 'center' },
  sendBtnText: { color: COLORS.background, fontWeight: '700', fontSize: 14 },
}); }
