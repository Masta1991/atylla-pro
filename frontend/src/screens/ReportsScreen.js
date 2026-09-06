import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Alert, Linking, Platform, Image } from 'react-native';
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

// Lokalna paczka gifów (assets/exercise-gifs) — fallback: emoji.
const EXERCISE_GIFS = {
  squat: require('../../assets/exercise-gifs/squat.gif'),
  sumo: require('../../assets/exercise-gifs/sumo-squat.gif'),
  deadlift: require('../../assets/exercise-gifs/deadlift.gif'),
  push: require('../../assets/exercise-gifs/push-up.gif'),
  curl: require('../../assets/exercise-gifs/curl-db.gif'),
};

function exerciseGif(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('bułgar')) return EXERCISE_GIFS.sumo;
  if (n.includes('przysiad') || n.includes('squat')) return EXERCISE_GIFS.squat;
  if (n.includes('martwy') || n.includes('rdl') || n.includes('rumu') || n.includes('deadlift')) return EXERCISE_GIFS.deadlift;
  if (n.includes('pompk') || n.includes('push')) return EXERCISE_GIFS.push;
  if (n.includes('uginanie przedramion') || n.includes('biceps') || n.includes('curl')) return EXERCISE_GIFS.curl;
  return null;
}

// Jeden gif na partię mięśniową (sekcje raportu).
function groupGif(part) {
  const p = (part || '').toLowerCase();
  if (p.includes('nog')) return EXERCISE_GIFS.squat;
  if (p.includes('poślad') || p.includes('poslad') || p.includes('glute')) return EXERCISE_GIFS.deadlift;
  if (p.includes('plec') || p.includes('back')) return EXERCISE_GIFS.deadlift;
  if (p.includes('klatk') || p.includes('chest') || p.includes('piersi')) return EXERCISE_GIFS.push;
  if (p.includes('rami') || p.includes('biceps') || p.includes('triceps') || p.includes(' arm')) return EXERCISE_GIFS.curl;
  return null;
}

// Wesoła ikonka ćwiczenia — żeby klient poznał ruch bez czytania nazwy.
function exerciseEmoji(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('hip thrust') || n.includes('poślad') || n.includes('glute')) return '🍑';
  if (n.includes('przysiad') || n.includes('squat') || n.includes('wykrok') || n.includes('lunge') || n.includes('prostowanie nóg') || n.includes('uginanie nóg') || n.includes('leg press') || n.includes('suwnic')) return '🦵';
  if (n.includes('martwy') || n.includes('deadlift') || n.includes('rdl') || n.includes('rumu')) return '🏋️';
  if (n.includes('wyciskanie') || n.includes('bench') || n.includes('rozpi') || n.includes('pompk') || n.includes('push')) return '💪';
  if (n.includes('wiosło') || n.includes('podciąg') || n.includes('ściąganie') || n.includes('pull') || n.includes('row')) return '🚣';
  if (n.includes('bark') || n.includes('ohp') || n.includes('arnold') || n.includes('unoszenie') || n.includes('shoulder') || n.includes('press')) return '🎖️';
  if (n.includes('biceps') || n.includes('uginanie przedramion') || n.includes('triceps') || n.includes('curl') || n.includes('dip')) return '💪';
  if (n.includes('brzuch') || n.includes('plank') || n.includes('deska') || n.includes('abs') || n.includes('core') || n.includes('skłon') || n.includes('crunch')) return '🧘';
  if (n.includes('cardio') || n.includes('bieg') || n.includes('rower') || n.includes('orbitrek') || n.includes('skip')) return '🏃';
  if (n.includes('rozciąg') || n.includes('mobil') || n.includes('stretch') || n.includes('joga')) return '🤸';
  return '🏋️';
}

export default function ReportsScreen({ navigation }) {
  const { colors: C, themeColors } = useTheme();
  const styles = useMemo(() => makeStyles(C, themeColors), [C, themeColors]);
  const [clients, setClients] = useState([]);
  const [allExercises, setAllExercises] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [months, setMonths] = useState(3);
  const [calOffset, setCalOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [workoutData, setWorkoutData] = useState(null);
  const [fullHistory, setFullHistory] = useState([]);
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
      setFullHistory(history || []);
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

    // Serie tygodniowe z PEŁNEJ historii (nie tylko okres raportu).
    const mondayOf = (dateStr) => {
      const d = new Date(dateStr + 'T12:00:00');
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const shiftWeek = (mondayStr, n) => {
      const d = new Date(mondayStr + 'T12:00:00');
      d.setDate(d.getDate() + n * 7);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const allDays = new Set((fullHistory || []).map(w => w.session_date));
    const weekSet = new Set([...allDays].map(mondayOf));
    const today = new Date();
    const thisMon = mondayOf(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
    let cursor = weekSet.has(thisMon) ? thisMon : (weekSet.has(shiftWeek(thisMon, -1)) ? shiftWeek(thisMon, -1) : null);
    let streak = 0;
    while (cursor && weekSet.has(cursor)) {
      streak += 1;
      cursor = shiftWeek(cursor, -1);
    }
    const sortedWeeks = [...weekSet].sort();
    let bestStreak = 0, run = 0, prev = null;
    for (const wk of sortedWeeks) {
      run = (prev && shiftWeek(prev, 1) === wk) ? run + 1 : 1;
      prev = wk;
      if (run > bestStreak) bestStreak = run;
    }
    const totalAll = allDays.size;

    // Frekwencja: ostatnie 8 tygodni jako słupki z liczbami (czytelne dla każdego).
    // Liczy DNI treningowe (unikalne daty), nie logi ćwiczeń.
    const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const trainedDaySet = new Set((fullHistory || []).map(w => w.session_date));
    const nowD = new Date();
    const monD = new Date(nowD);
    monD.setDate(monD.getDate() - ((monD.getDay() + 6) % 7));
    const freqWeeks = [];
    for (let k = 7; k >= 0; k--) {
      const start = new Date(monD);
      start.setDate(start.getDate() - k * 7);
      let cnt = 0;
      for (let d = 0; d < 7; d++) {
        const dt = new Date(start);
        dt.setDate(dt.getDate() + d);
        if (trainedDaySet.has(isoOf(dt))) cnt += 1;
      }
      freqWeeks.push({ label: `${String(start.getDate()).padStart(2, '0')}.${String(start.getMonth() + 1).padStart(2, '0')}`, count: cnt });
    }
    const freqMax = Math.max(1, ...freqWeeks.map(w => w.count));
    const freqAvg = (freqWeeks.reduce((a, w) => a + w.count, 0) / freqWeeks.length).toFixed(1);

    const badges = [];
    const topStreak = streak >= 10 ? 10 : streak >= 5 ? 5 : streak >= 3 ? 3 : 0;
    if (topStreak) badges.push({ icon: '🔥', label: `${topStreak} tyg. z rzędu` });
    const topTotal = totalAll >= 50 ? 50 : totalAll >= 25 ? 25 : totalAll >= 10 ? 10 : 0;
    if (topTotal) badges.push({ icon: '🏋️', label: `${topTotal} treningów` });

    const allStrength = Object.entries(exerciseWeights)
      .map(([id, points]) => {
        const ex = allExercises.find(e => e.id === id);
        if (!clientExercises.find(e => e.id === id)) return null;
        const weights = points.map(p => p.weight).filter(w => w > 0);
        if (weights.length < 2) return null;
        const first = weights[0];
        const last = weights[weights.length - 1];
        const delta = last - first;
        return { id, name: ex?.name || 'N/A', part: ex?.part || '', first, last, delta, points };
      })
      .filter(Boolean)
      .sort((a, b) => b.delta - a.delta);

    const topStrength = allStrength.slice(0, 3);

    if (allStrength.some(s => s.delta > 0)) badges.push({ icon: '📈', label: 'Rekord siły' });

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
      streak,
      bestStreak,
      totalAll,
      badges,
      freqWeeks,
      freqMax,
      freqAvg,
      trainedDays: [...allDays],
    };
  }, [workoutData, fullHistory, measurements, allExercises, clientExercises]);

  const clientName = clients.find(c => c.id === selectedClient)?.name || '';
  const calBase = new Date();
  calBase.setDate(1);
  calBase.setMonth(calBase.getMonth() + calOffset);
  const calYear = calBase.getFullYear();
  const calMonth = calBase.getMonth();
  const [sending, setSending] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  async function handleSendWhatsApp() {
    if (!stats) return;
    setSending(true);

    try {
      if (Platform.OS === 'web') {
        try {
          setIsCapturing(true);
          await new Promise(resolve => setTimeout(resolve, 800)); // wait for re-render

          const htmlToImage = require('html-to-image');
          const captureOpts = { backgroundColor: themeColors.background, pixelRatio: 2 };

          // Telefon wolniej dociąga gify — czekamy aż wszystkie <img> w raporcie będą gotowe.
          const awaitImages = async (node) => {
            if (!node || !node.querySelectorAll) return;
            const imgs = [...node.querySelectorAll('img')];
            await Promise.all(imgs.map(im => (im.decode ? im.decode().catch(() => {}) : Promise.resolve())));
          };

          const files = [];

          const node1 = document.getElementById('report-part-1');
          if (node1) {
            await awaitImages(node1);
            const blob1 = await htmlToImage.toBlob(node1, captureOpts);
            if (blob1) files.push(new File([blob1], 'raport_podsumowanie.png', { type: 'image/png' }));
          }

          const node2 = document.getElementById('report-part-2');
          if (node2) {
            await awaitImages(node2);
            const blob2 = await htmlToImage.toBlob(node2, captureOpts);
            if (blob2) files.push(new File([blob2], 'raport_kalendarz.png', { type: 'image/png' }));
          }

          const node3 = document.getElementById('report-part-3');
          if (node3) {
            await awaitImages(node3);
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

      // Fallback: tekst (gdy share plikow niedostepny)
      let message = `Raport Treningowy - ${clientName}\n`;
      message += `Okres: ostatnie ${months} mies.\n\n`;

      message += `Seria: ${stats.streak} tyg. (najlepsza: ${stats.bestStreak})\n`;
      message += `Treningi: ${stats.totalSessions} (sr. ${stats.freqAvg}/tydz.)\n`;

      if (stats.badges && stats.badges.length > 0) {
        message += `Odznaki: ${stats.badges.map(b => `${b.icon} ${b.label}`).join(', ')}\n`;
      }
      message += `\n`;

      if (stats.topBodyParts && stats.topBodyParts.length > 0) {
        message += `Top partie: ${stats.topBodyParts.map(p => p[0]).join(', ')}\n\n`;
      }

      if (stats.bodyComp) {
        const w = stats.bodyComp.weight;
        if (w.first != null && w.last != null) {
          const d = (w.last - w.first).toFixed(1);
          message += `Waga: ${w.first} kg -> ${w.last} kg (${d > 0 ? '+' : ''}${d} kg)\n`;
        }
        message += `\n`;
      }

      if (stats.allStrength && stats.allStrength.length > 0) {
        message += `Progres silowy:\n`;
        stats.allStrength.slice(0, 5).forEach(s => {
          const sign = s.delta > 0 ? '+' : '';
          message += `- ${s.name}: ${s.first} kg -> ${s.last} kg (${sign}${s.delta.toFixed(1)} kg)\n`;
        });
        message += `\n`;
      }

      message += `Swietna robota, trenuj dalej!`;

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
              <View style={[styles.tile, styles.tileFull]}>
                <Text style={styles.tileLabel}>Seria treningowa</Text>
                <Text style={styles.tileValue}>🔥 {stats.streak} {stats.streak === 1 ? 'tydzień' : (stats.streak >= 2 && stats.streak <= 4 ? 'tygodnie' : 'tygodni')}</Text>
                <Text style={styles.tileSub}>najlepsza: {stats.bestStreak} tyg. • łącznie {stats.totalAll} treningów</Text>
                {stats.badges.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {stats.badges.map((b, i) => (
                      <View key={i} style={{ backgroundColor: C.accent + '20', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text style={{ color: C.accent, fontSize: 12, fontWeight: '700' }}>{b.icon} {b.label}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              <View style={[styles.tile, styles.tileFull, { marginTop: 10 }]}>
                <Text style={styles.tileLabel}>Treningi w tygodniu — ostatnie 8 tyg.</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 8, height: 120 }}>
                  {stats.freqWeeks.map((w, i) => (
                    <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                      <Text style={{ color: w.count > 0 ? C.accent : themeColors.textMuted, fontSize: 13, fontWeight: '800', marginBottom: 4 }}>{w.count}</Text>
                      <View style={{ width: '100%', maxWidth: 34, height: Math.max(6, (w.count / stats.freqMax) * 88), borderRadius: 6, backgroundColor: w.count > 0 ? C.accent : themeColors.border + '40' }} />
                      <Text style={{ color: themeColors.textMuted, fontSize: 9, marginTop: 4 }}>{w.label}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[styles.tileSub, { marginTop: 6 }]}>średnio {stats.freqAvg} treningu na tydzień</Text>
              </View>
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
                    <Text style={styles.tileLabel}>Ciało w liczbach</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {[
                        { label: 'Waga', unit: 'kg', down: true, ...stats.bodyComp.weight },
                        { label: 'Tłuszcz', unit: '%', down: true, ...stats.bodyComp.fat },
                        { label: 'Mięśnie', unit: '%', down: false, ...stats.bodyComp.muscle },
                      ].map((m, mi) => {
                        const has = m.first != null && m.last != null;
                        const d = has ? (m.last - m.first) : null;
                        const good = has && (m.down ? d < 0 : d > 0);
                        return (
                          <View key={mi} style={{ flex: 1, alignItems: 'center', backgroundColor: themeColors.surfaceLight + '60', borderRadius: 10, paddingVertical: 10 }}>
                            <Text style={{ color: themeColors.textSecondary, fontSize: 11, fontWeight: '700' }}>{m.label}</Text>
                            <Text style={{ color: themeColors.text, fontSize: 20, fontWeight: '800' }}>{m.last != null ? `${m.last}${m.unit}` : '–'}</Text>
                            {has && (
                              <Text style={{ color: good ? '#1dd1a1' : '#ff6b6b', fontSize: 13, fontWeight: '800' }}>{d > 0 ? '+' : ''}{d.toFixed(1)}{m.unit}</Text>
                            )}
                            <Text style={{ color: themeColors.textMuted, fontSize: 10 }}>było {m.first != null ? `${m.first}${m.unit}` : '–'}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
              )}
              {Object.keys(stats.weeklySessions).length > 0 && (() => {
                const wkLabels = Object.keys(stats.weeklySessions).sort();
                const wkValues = wkLabels.map(w => stats.weeklySessions[w]);
                const avg = (wkValues.reduce((a, b) => a + b, 0) / wkValues.length).toFixed(1);
                const max = Math.max(...wkValues);
                const maxLabel = wkLabels[wkValues.indexOf(max)];
                return (
                  <>
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
                  </>
                );
              })()}
              </View>
            </View>

            <View nativeID="report-part-2" style={isCapturing ? { width: 540, padding: 24, backgroundColor: themeColors.background } : null}>
              <Text style={styles.sectionTitle}>Kalendarz Treningów</Text>
              <MonthCalendar
                trained={stats.trainedDays}
                year={calYear}
                month={calMonth}
                onPrev={() => setCalOffset((o) => o - 1)}
                onNext={() => setCalOffset((o) => Math.min(0, o + 1))}
                accent={C.accent}
                themeColors={themeColors}
              />
            </View>

            <View nativeID="report-part-3" style={isCapturing ? { width: 540, padding: 24, backgroundColor: themeColors.background } : null}>
            {stats.allStrength && stats.allStrength.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Progresja siłowa</Text>
                  <View style={styles.tileGrid}>
                  {stats.allStrength.map((s, i) => {
                    const pct = s.first > 0 ? Math.round((s.delta / s.first) * 100) : 0;
                    const startW = s.last > 0 ? Math.max(4, Math.round((s.first / s.last) * 100)) : 0;
                    return (
                      <View key={`ch-${i}`} style={[styles.tile, { marginTop: 0 }]}>
                        {(groupGif(s.part) || exerciseGif(s.name)) ? (
                          <Image source={groupGif(s.part) || exerciseGif(s.name)} style={{ width: 96, height: 96, borderRadius: 12 }} resizeMode="contain" />
                        ) : (
                          <Text style={{ fontSize: 34 }} numberOfLines={1}>{exerciseEmoji(s.name)}</Text>
                        )}
                        <Text style={styles.tileLabel} numberOfLines={1}>{s.name}</Text>
                        <Text style={[styles.tileValue, { fontSize: 30, color: '#1dd1a1' }]}>
                          +{s.delta.toFixed(1)} kg<Text style={{ fontSize: 16 }}> ({pct}%)</Text>
                        </Text>
                        <View style={{ marginTop: 10, gap: 8 }}>
                          <View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                              <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>Start</Text>
                              <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '700' }}>{s.first} kg</Text>
                            </View>
                            <View style={{ height: 10, borderRadius: 5, backgroundColor: themeColors.border + '40' }}>
                              <View style={{ height: 10, borderRadius: 5, width: `${startW}%`, backgroundColor: themeColors.textMuted }} />
                            </View>
                          </View>
                          <View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                              <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>Teraz 🏆</Text>
                              <Text style={{ color: C.accent, fontSize: 12, fontWeight: '800' }}>{s.last} kg</Text>
                            </View>
                            <View style={{ height: 14, borderRadius: 7, backgroundColor: themeColors.border + '40' }}>
                              <View style={{ height: 14, borderRadius: 7, width: '100%', backgroundColor: C.accent }} />
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}
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

const CAL_MONTHS = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
const CAL_DOW = ['P', 'W', 'Ś', 'C', 'P', 'S', 'N'];

function MonthCalendar({ trained, year, month, onPrev, onNext, accent, themeColors }) {
  const set = new Set(trained || []);
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const iso = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <TouchableOpacity onPress={onPrev} style={{ padding: 8 }}>
          <Text style={{ color: accent, fontSize: 22, fontWeight: '800' }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ color: themeColors.text, fontSize: 15, fontWeight: '800' }}>{CAL_MONTHS[month]} {year}</Text>
        <TouchableOpacity onPress={onNext} style={{ padding: 8 }}>
          <Text style={{ color: accent, fontSize: 22, fontWeight: '800' }}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', marginBottom: 2 }}>
        {CAL_DOW.map((d, i) => (
          <View key={i} style={{ width: '14.28%', alignItems: 'center' }}>
            <Text style={{ color: themeColors.textMuted, fontSize: 10, fontWeight: '700' }}>{d}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          const has = d && set.has(iso(d));
          const isToday = d && iso(d) === todayStr;
          return (
            <View key={i} style={{ width: '14.28%', alignItems: 'center', paddingVertical: 5 }}>
              {d ? (
                <>
                  <Text style={{ color: has ? accent : themeColors.textSecondary, fontSize: 14, fontWeight: has || isToday ? '800' : '400' }}>{d}</Text>
                  <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 2, backgroundColor: has ? accent : 'transparent', borderWidth: isToday && !has ? 1 : 0, borderColor: accent }} />
                </>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
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
