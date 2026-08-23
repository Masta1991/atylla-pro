import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Alert, Linking, Platform } from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import { Ionicons } from '@expo/vector-icons';
import { SPACING } from '../assets/theme';
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
  const { colors: C, themeColors } = useTheme();
  const styles = useMemo(() => makeStyles(C, themeColors), [C, themeColors]);
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

  const clientExercises = useMemo(() => {
    const cl = clients.find(c => c.id === selectedClient);
    if (!cl?.strength_progression?.length) return [];
    return allExercises.filter(e => cl.strength_progression.includes(e.id));
  }, [clients, selectedClient, allExercises]);

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

    const allStrength = Object.entries(exerciseWeights)
      .map(([id, points]) => {
        const ex = allExercises.find(e => e.id === id);
        if (!clientExercises.find(e => e.id === id)) return null;
        const weights = points.map(p => p.weight).filter(w => w > 0);
        if (weights.length < 2) return null;
        const first = weights[0];
        const last = weights[weights.length - 1];
        const delta = last - first;
        return { name: ex?.name || 'N/A', first, last, delta, points };
      })
      .filter(Boolean)
      .sort((a, b) => b.delta - a.delta);

    const topStrength = allStrength.slice(0, 3);

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
      allStrength,
      bodyComp,
      weeklySessions,
      weeklyBodyParts,
    };
  }, [workoutData, measurements, allExercises, clientExercises]);

  const clientName = clients.find(c => c.id === selectedClient)?.name || '';
  const [sending, setSending] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  async function handleSendWhatsApp() {
    if (!stats) return;
    setSending(true);

    try {
      if (Platform.OS === 'web') {
        try {
          setIsCapturing(true);
          await new Promise(resolve => setTimeout(resolve, 300)); // wait for re-render

          const htmlToImage = require('html-to-image');
          const captureOpts = { backgroundColor: themeColors.background, pixelRatio: 2 };
          
          const files = [];
          
          const node1 = document.getElementById('report-part-1');
          if (node1) {
            const blob1 = await htmlToImage.toBlob(node1, captureOpts);
            if (blob1) files.push(new File([blob1], 'raport_podsumowanie.png', { type: 'image/png' }));
          }

          const node2 = document.getElementById('report-part-2');
          if (node2) {
            const blob2 = await htmlToImage.toBlob(node2, captureOpts);
            if (blob2) files.push(new File([blob2], 'raport_kalendarz.png', { type: 'image/png' }));
          }

          const node3 = document.getElementById('report-part-3');
          if (node3) {
            const blob3 = await htmlToImage.toBlob(node3, captureOpts);
            if (blob3) files.push(new File([blob3], 'raport_wykresy.png', { type: 'image/png' }));
          }

          if (files.length > 0 && navigator.canShare && navigator.canShare({ files })) {
            await navigator.share({
              files,
              title: 'Raport Treningowy',
              text: `Raport Treningowy - ${clientName}`
            });
            setIsCapturing(false);
            setSending(false);
            return;
          }
        } catch (imgErr) {
          console.error("Image capture error:", imgErr);
        }
        setIsCapturing(false);
      }

      // Fallback: tekst
      let message = `📊 *Twój Raport Treningowy - ${clientName}*\n`;
      message += `Okres: Ostatnie ${months} mies.\n\n`;
      
      message += `✅ *Podsumowanie:*\n`;
      message += `Liczba treningów: ${stats.totalSessions}\n`;
      
      if (stats.topBodyParts && stats.topBodyParts.length > 0) {
        message += `Ulubione partie: ${stats.topBodyParts.map(p => p[0]).join(', ')}\n`;
      }
      message += `\n`;

      if (stats.bodyComp) {
        message += `⚖️ *Skład Ciała:*\n`;
        message += `Waga: ${stats.bodyComp.weight.first} kg ➡️ ${stats.bodyComp.weight.last} kg\n`;
        if (stats.bodyComp.fat?.first && stats.bodyComp.fat?.last) {
          message += `Tkanka tłuszczowa: ${stats.bodyComp.fat.first}% ➡️ ${stats.bodyComp.fat.last}%\n`;
        }
        message += `\n`;
      }

      if (stats.topStrength && stats.topStrength.length > 0) {
        message += `💪 *Największy Progres Siłowy:*\n`;
        stats.topStrength.forEach(s => {
          const deltaSign = s.delta > 0 ? '+' : '';
          message += `- ${s.name}: ${s.first} kg ➡️ ${s.last} kg (${deltaSign}${s.delta.toFixed(1)} kg)\n`;
        });
        message += `\n`;
      }
      
      message += `Świetna robota, trenuj dalej! 🚀`;

      const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Błąd', 'Wystąpił błąd podczas otwierania okna wysyłania: ' + e.message);
    } finally {
      setIsCapturing(false);
      setSending(false);
    }
  }

  return (
    <AppLayout navigation={navigation} title="Raporty" showBack>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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

        <Text style={styles.label}>Zakres</Text>
        <DropdownPicker
          selectedValue={months}
          onValueChange={setMonths}
          style={styles.pickerWrap}
          dropdownIconColor={themeColors.textSecondary}
          items={MONTH_OPTIONS.map(m => ({ label: m === 1 ? 'Ostatni 1 miesiąc' : `Ostatnie ${m} mies.`, value: m, color: themeColors.text }))}
        />

        <TouchableOpacity style={styles.loadBtn} onPress={loadReport}>
          <Text style={styles.loadBtnText}>{loading ? 'Ładowanie...' : 'Generuj raport'}</Text>
        </TouchableOpacity>

        {stats && (
          <>
            <View nativeID="report-part-1" style={isCapturing ? { width: 540, padding: 24, backgroundColor: themeColors.background } : null}>
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
              
              {stats.bodyComp && (
                  <View style={[styles.tile, styles.tileFull]}>
                    <Text style={styles.tileLabel}>Skład ciała</Text>
                    <MetricRow label="Waga" v1={stats.bodyComp.weight.first} v2={stats.bodyComp.weight.last} unit="kg" down styles={styles} />
                    <MetricRow label="Tłuszcz" v1={stats.bodyComp.fat.first} v2={stats.bodyComp.fat.last} unit="%" down styles={styles} />
                    <MetricRow label="Mięśnie" v1={stats.bodyComp.muscle.first} v2={stats.bodyComp.muscle.last} unit="%" styles={styles} />
                  </View>
              )}

              {stats.topStrength && stats.topStrength.length > 0 && (
                  <View style={[styles.tile, styles.tileFull]}>
                    <Text style={styles.tileLabel}>Top 3 siła</Text>
                    {stats.topStrength.map((s, i) => (
                      <View key={i} style={styles.strengthRow}>
                        <Text style={styles.strengthName} numberOfLines={1}>{s.name}</Text>
                        <Text style={styles.strengthVal}>{s.first}→{s.last}kg <Text style={[styles.strengthDelta, s.delta >= 0 ? styles.pos : styles.neg]}>{s.delta > 0 ? '+' : ''}{s.delta.toFixed(1)}kg</Text></Text>
                      </View>
                    ))}
                  </View>
              )}
              </View>
            </View>

            <View nativeID="report-part-2" style={isCapturing ? { width: 540, padding: 24, backgroundColor: themeColors.background } : null}>
              <Text style={styles.sectionTitle}>Kalendarz Treningów</Text>
              <BodyPartsTable data={stats.weeklyBodyParts} styles={styles} isCapturing={isCapturing} />
            </View>

            <View nativeID="report-part-3" style={isCapturing ? { width: 540, padding: 24, backgroundColor: themeColors.background } : null}>
            {Object.keys(stats.weeklySessions).length > 0 && (() => {
              const wkLabels = Object.keys(stats.weeklySessions).sort();
              const wkValues = wkLabels.map(w => stats.weeklySessions[w]);
              const avg = (wkValues.reduce((a, b) => a + b, 0) / wkValues.length).toFixed(1);
              const max = Math.max(...wkValues);
              const maxLabel = wkLabels[wkValues.indexOf(max)];

              return (
                <>
                  <Text style={styles.sectionTitle}>Podsumowanie Aktywności</Text>
                  <View style={styles.tileGrid}>
                    <View style={styles.tile}>
                      <Text style={styles.tileLabel}>Średnia</Text>
                      <Text style={styles.tileValue}>{avg}</Text>
                      <Text style={styles.tileSub}>treningów / tydz.</Text>
                    </View>
                    <View style={styles.tile}>
                      <Text style={styles.tileLabel}>Rekord</Text>
                      <Text style={styles.tileValue}>{max}</Text>
                      <Text style={styles.tileSub}>treningów w tyg. ({maxLabel})</Text>
                    </View>
                  </View>
                </>
              );
            })()}

            {stats.allStrength && stats.allStrength.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Progresja siłowa (Kafelki)</Text>
                  <View style={styles.tileGrid}>
                    {stats.allStrength.map((s, i) => (
                      <View key={i} style={styles.tile}>
                        <Text style={styles.tileLabel} numberOfLines={2}>{s.name}</Text>
                        <Text style={styles.tileValue}>{s.last} kg</Text>
                        <Text style={[styles.tileSub, { color: s.delta >= 0 ? '#1dd1a1' : '#ff6b6b', fontWeight: '700', fontSize: 13, marginTop: 4 }]}>
                          {s.delta >= 0 ? '+' : ''}{s.delta.toFixed(1)} kg <Text style={{ color: themeColors.textMuted, fontWeight: '400', fontSize: 11 }}>(od {s.first} kg)</Text>
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
            )}
            </View>
          </>
        )}

        {stats && (
          <View style={styles.emailSection}>
            <TouchableOpacity
              style={[styles.sendBtn, sending && { opacity: 0.5 }, { backgroundColor: '#25D366', flexDirection: 'row', justifyContent: 'center', gap: 8 }]}
              onPress={handleSendWhatsApp}
              disabled={sending}
            >
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              <Text style={styles.sendBtnText}>{sending ? 'Przygotowywanie...' : 'Wyślij raport przez WhatsApp'}</Text>
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

function BodyPartsTable({ data, styles, isCapturing }) {
  const weeks = Object.keys(data || {}).sort();
  const DAYS = ['PON', 'WT', 'ŚR', 'CZW', 'PT', 'SOB'];
  if (weeks.length === 0) return <Text style={styles.noData}>Brak danych</Text>;

  const content = (
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
  );

  if (isCapturing) {
    return <View style={{ minWidth: 420 }}>{content}</View>;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {content}
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

function makeStyles(C, TC) { return StyleSheet.create({
  scroll: { paddingHorizontal: SPACING.md, paddingBottom: 100 },
  label: { color: TC.textSecondary, fontSize: 13, fontWeight: '600', marginTop: SPACING.md, marginBottom: 6 },
  pickerWrap: { backgroundColor: TC.surface, borderRadius: 12, borderWidth: 1, borderColor: TC.border, overflow: 'hidden', marginBottom: SPACING.sm },
  picker: { color: TC.text, height: 50, backgroundColor: TC.surface },
  loadBtn: { backgroundColor: C.accent, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg },
  loadBtnText: { color: TC.background, fontWeight: '700', fontSize: 14 },

  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  tile: {
    width: '48%', backgroundColor: TC.surface,
    borderRadius: 20, borderWidth: 1, borderColor: TC.border,
    padding: 16, marginBottom: 12,
  },
  tileFull: { width: '100%' },
  tileLabel: { color: TC.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  tileValue: { color: C.accent, fontSize: 36, fontWeight: '800' },
  tileSub: { color: TC.textMuted, fontSize: 13, marginTop: 4 },
  partRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  partText: { color: TC.text, fontSize: 14, flex: 1, fontWeight: '600' },
  partCount: { color: TC.textSecondary, fontSize: 14, fontWeight: '700' },
  noData: { color: TC.textMuted, fontSize: 14, fontStyle: 'italic' },
  metricRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  metricLabel: { color: TC.textSecondary, fontSize: 12, fontWeight: '700', width: 50 },
  metricVal: { color: TC.text, fontSize: 13, flexShrink: 1, fontWeight: '600' },
  metricDelta: { fontSize: 13, fontWeight: '800' },
  pos: { color: '#1dd1a1' },
  neg: { color: '#ff6b6b' },
  strengthRow: { marginBottom: 8 },
  strengthName: { color: TC.text, fontSize: 13, fontWeight: '700' },
  strengthVal: { color: TC.textSecondary, fontSize: 13, marginTop: 2 },
  strengthDelta: { fontSize: 14, fontWeight: '800', marginTop: 2 },

  sectionTitle: { color: TC.textSecondary, fontSize: 14, fontWeight: '700', marginTop: 24, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },

  tableRow: { flexDirection: 'row' },
  tableRowAlt: { backgroundColor: TC.surfaceLight + '40' },
  tableCorner: { width: 80, paddingVertical: 8, paddingHorizontal: 6, borderWidth: 0.5, borderColor: TC.border, justifyContent: 'center' },
  tableCornerText: { color: TC.textSecondary, fontSize: 9, fontWeight: '600' },
  tableCell: { width: 55, paddingVertical: 6, paddingHorizontal: 3, borderWidth: 0.5, borderColor: TC.border, alignItems: 'center' },
  tableHeader: { color: C.accent, fontSize: 9, fontWeight: '700', textAlign: 'center' },
  tableBodyText: { color: TC.text, fontSize: 8, textAlign: 'center' },

  chart: { marginVertical: 8, borderRadius: 16 },
  emailSection: {
    backgroundColor: TC.surface, borderRadius: 16, padding: 18,
    marginTop: 24, borderWidth: 1, borderColor: TC.border,
  },
  emailLabel: { color: C.accent, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  sendBtn: { backgroundColor: C.accent, borderRadius: 12, padding: 14, alignItems: 'center' },
  sendBtnText: { color: TC.background, fontWeight: '700', fontSize: 14 },
}); }
