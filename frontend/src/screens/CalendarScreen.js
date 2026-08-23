import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, useWindowDimensions, Platform, Image, ActivityIndicator } from 'react-native';
import { Svg, Path, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../assets/theme';
import * as api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { APP_VERSION } from '../version';

function getMonday(date) { const d = new Date(date); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); d.setDate(diff); d.setHours(0, 0, 0, 0); return d; }
function isSameWeek(d1, d2) { return getMonday(d1).getTime() === getMonday(d2).getTime(); }
function formatDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DAYS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob'];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6);
const MONTHS = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
const HOUR_W = 50;
const CELL_H = 56;
const LONG_PRESS_DELAY = 300;

function MonthPopup({ visible, onClose, currentMonday, onSelect, accent, styles }) {
  const mon = new Date(currentMonday);
  const [year, setYear] = useState(mon.getFullYear()); const [month, setMonth] = useState(mon.getMonth()); const today = new Date();
  const daysInMonth = new Date(year, month + 1, 0).getDate(); const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7;
  const weeks = []; let day = 1;
  for (let w = 0; w < 6; w++) { const week = []; for (let d = 0; d < 7; d++) { if ((w === 0 && d < firstDayOfWeek) || day > daysInMonth) week.push(null); else week.push(day++); } if (week.some(d => d !== null)) weeks.push(week); }
  if (!visible) return null;
  return (<View style={styles.popupOverlay}><TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} /><View style={styles.popupCard}><View style={styles.popupNav}><TouchableOpacity onPress={() => month > 0 ? setMonth(month - 1) : (setMonth(11), setYear(year - 1))}><Ionicons name="chevron-back" size={18} color={accent} /></TouchableOpacity><Text style={[styles.popupMonth,{color:accent}]}>{MONTHS[month]} {year}</Text><TouchableOpacity onPress={() => month < 11 ? setMonth(month + 1) : (setMonth(0), setYear(year + 1))}><Ionicons name="chevron-forward" size={18} color={accent} /></TouchableOpacity></View><View style={styles.popupWeekdays}>{['Pn','Wt','Śr','Czw','Pt','Sob','Nd'].map(d => <Text key={d} style={styles.popupWd}>{d}</Text>)}</View>{weeks.map((week, wi) => (<View key={wi} style={styles.popupWeek}>{week.map((d, di) => { const isToday = d && year === today.getFullYear() && month === today.getMonth() && d === today.getDate(); const selMonday = d ? getMonday(new Date(year, month, d)) : null; const isSelected = selMonday && selMonday.getTime() === mon.getTime(); return (<TouchableOpacity key={di} style={[styles.popupDay, isToday && styles.popupToday, isSelected && styles.popupSelected]} onPress={() => d && (onSelect(getMonday(new Date(year, month, d))), onClose())} disabled={!d}>{d ? <Text style={[styles.popupDayText, isToday && styles.popupTodayText, isSelected && styles.popupSelectedText]}>{d}</Text> : <View />}</TouchableOpacity>); })}</View>))}</View></View>);
}

function HistoryPopup({ visible, onClose, clientId, clientName, logs, loading, accent, themeColors, styles, navigation }) {
  if (!visible) return null;

  const grouped = useMemo(() => {
    if (!logs || logs.length === 0) return [];
    const groups = {};
    logs.forEach(log => {
      const dateStr = log.session_date;
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(log);
    });

    const sortedDates = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));
    const top3Dates = sortedDates.slice(0, 3);

    return top3Dates.map(dateStr => {
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
  }, [logs]);

  return (
    <View style={styles.popupOverlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      <View style={[styles.popupCard, { width: '92%', maxWidth: 450, alignSelf: 'center', top: '15%', maxHeight: '70%', paddingBottom: 20 }]}>
        <View style={[styles.popupNav, { borderBottomWidth: 1, borderBottomColor: themeColors.border, paddingBottom: 10, marginBottom: 10, alignItems: 'center' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 }}>
            <Text style={[styles.popupMonth, { color: accent, fontSize: 16, flexShrink: 1 }]} numberOfLines={1}>
              Historia: {clientName}
            </Text>
            <TouchableOpacity
              onPress={() => {
                onClose();
                navigation.navigate('HistoryFilter', { clientId, clientName });
              }}
              style={{ padding: 4 }}
            >
              <Ionicons name="settings-outline" size={20} color={accent} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <Ionicons name="close" size={24} color={accent} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={accent} style={{ marginVertical: 40 }} />
        ) : grouped.length === 0 ? (
          <Text style={{ color: themeColors.textMuted, textAlign: 'center', marginVertical: 40, fontSize: 14 }}>
            Brak zapisanej historii treningów
          </Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 6 }}>
            {grouped.map((session) => {
              const formattedDate = new Date(session.date).toLocaleDateString('pl-PL', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
              });
              return (
                <View key={session.date} style={{ marginBottom: 16, backgroundColor: themeColors.surfaceLight, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: themeColors.border }}>
                  <Text style={{ color: accent, fontSize: 13, fontWeight: '700', textTransform: 'capitalize', marginBottom: 8 }}>
                    {formattedDate}
                  </Text>
                  
                  <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: themeColors.border, paddingBottom: 4, marginBottom: 6 }}>
                    <Text style={{ flex: 2, color: themeColors.textSecondary, fontSize: 11, fontWeight: '700' }}>ĆWICZENIE</Text>
                    <Text style={{ flex: 1, color: themeColors.textSecondary, fontSize: 11, fontWeight: '700', textAlign: 'right' }}>SERIE (KG x POWT.)</Text>
                  </View>

                  {Object.entries(session.exercises).map(([exName, sets]) => (
                    <View key={exName} style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: themeColors.border + '30', paddingVertical: 6, alignItems: 'center' }}>
                      <Text style={{ flex: 2, color: themeColors.text, fontSize: 13, fontWeight: '600' }} numberOfLines={2}>
                        {exName}
                      </Text>
                      <Text style={{ flex: 1, color: themeColors.textSecondary, fontSize: 12, textAlign: 'right' }}>
                        {sets.map(s => `${s.weight}kg x ${s.reps}`).join('\n')}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

function CalendarSlot({ dateStr, hour, ev, absences, dayW, editMode, historyMode, onShowHistory, navigation, onDelete, onMoveStart, onMoveTo, isMoving, isMoveTarget, accent, styles }) {
  const { themeColors } = useTheme();
  const slotRef = useRef(null);
  const longPressTimer = useRef(null);
  const isPressed = useRef(false);

  // Find any absence for this date+hour (not just matching current event's client)
  const slotAbsences = absences?.filter(a =>
    a.absence_date === dateStr &&
    (a.absence_hour == null || a.absence_hour === hour)
  );
  const isAbsent = slotAbsences?.length > 0;
  const absentClientName = slotAbsences?.[0]?.clients?.name;
  const absentTooltip = isAbsent ? `Trening odwołany: ${absentClientName || '—'}` : null;

  const clearTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePressIn = () => {
    if (!editMode || !ev || isMoveTarget) return;
    isPressed.current = true;
    longPressTimer.current = setTimeout(() => {
      if (isPressed.current) {
        onMoveStart(dateStr, hour, ev);
      }
    }, LONG_PRESS_DELAY);
  };

  const handlePressOut = () => {
    isPressed.current = false;
    clearTimer();
  };

  const handleSlotTap = () => {
    if (isMoveTarget) {
      onMoveTo(dateStr, hour);
      return;
    }
    if (historyMode) {
      if (ev && ev.client_id) {
        onShowHistory(ev.client_id, ev.clients?.name);
      }
      return;
    }
    if (!editMode) {
      if (isAbsent && !ev) {
        const replaceId = slotAbsences?.[0]?.client_id;
        if (Platform.OS === 'web') {
          if (window.confirm('Planowany trening z harmonogramu został usunięty (absencja klienta).\n\nCzy chcesz dodać jednorazowe zastępstwo na ten termin?')) {
            navigation.navigate('Training', { date: dateStr, hour, replaceClientId: replaceId });
          }
        } else {
          Alert.alert(
            'Trening Usunięty',
            'Planowany trening z harmonogramu został usunięty (absencja klienta).\n\nCzy chcesz dodać na jego miejsce jednorazowe zastępstwo?',
            [
              { text: 'Rozumiem', style: 'cancel' },
              { text: 'Dodaj zastępstwo', onPress: () => navigation.navigate('Training', { date: dateStr, hour, replaceClientId: replaceId }) }
            ]
          );
        }
      } else {
        navigation.navigate('Training', { date: dateStr, hour });
      }
    }
  };

  const handleDeleteTap = () => {
    const clientName = ev?.clients?.name || '';
    
    if (ev?.is_start_of_package) {
      if (Platform.OS === 'web') {
        window.alert('Punkt Startowy 🐶\n\nTen trening rozpoczyna pakiet. Wskaż nowy start lub usuń pakiet w zakładce Rozliczenia zanim go usuniesz.');
      } else {
        Alert.alert(
          'Punkt Startowy 🐶',
          'Ten trening rozpoczyna pakiet. Wskaż nowy start lub usuń pakiet w zakładce Rozliczenia zanim go usuniesz.'
        );
      }
      return;
    }

    if (Platform.OS === 'web') {
      if (!window.confirm(`Czy na pewno chcesz usunąć zapis treningu?\n\nKlient: ${clientName}`)) return;
      const settle = window.confirm(`Czy chcesz ROZLICZYĆ ten trening?\n\nKlient: ${clientName}\n\nKliknij OK aby rozliczyć (doliczy się do pakietu),\nlub Anuluj aby tylko usunąć bez rozliczania.`);
      if (settle) {
        api.settleWorkout(dateStr, hour).catch(() => {});
        Alert.alert('Rozliczono', `Trening ${clientName} został rozliczony i usunięty.`);
      }
      onDelete(dateStr, hour, ev);
    } else {
      Alert.alert('Usuń zapis', `Klient: ${clientName}\n\nCzy chcesz usunąć ten zapis?`, [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Usuń i rozlicz', style: 'destructive', onPress: () => {
          api.settleWorkout(dateStr, hour).catch(() => {});
          onDelete(dateStr, hour, ev);
        }},
        { text: 'Tylko usuń', onPress: () => onDelete(dateStr, hour, ev) },
      ]);
    }
  };

  let billingLabel = null;
  if (ev && ev.note) {
    if (ev.note.includes('[BILLING:KONIEC_PAKIETU]')) billingLabel = 'Koniec Pakietu';
    else if (ev.note.includes('[BILLING:ROZLICZONO]')) billingLabel = 'Rozliczono';
    else if (ev.note.includes('[BILLING:ROZPOCZETO_NOWY_PAKIET]')) billingLabel = 'Rozpoczęto nowy pakiet';
    else if (ev.note.includes('[BILLING:ROZPOCZETO_NOWE_ROZLICZANIE]')) billingLabel = 'Rozpoczęto nowe rozliczanie';
  }

  const showEv = ev && ev.status !== 'cancelled';

  return (
    <View
      ref={slotRef}
      style={[
        styles.slot,
        showEv && !isAbsent && { backgroundColor: accent + '15', borderColor: accent + '30' },
        { width: dayW - 2 },
        isMoving && { opacity: 0.35, borderColor: accent, borderWidth: 2, borderStyle: 'dashed' },
      ]}
      dataSet={{ slotDate: dateStr, slotHour: String(hour) }}
    >
      {/* Red triangle indicator for cancelled slots WITHOUT replacement */}
      {(isAbsent || (ev && ev.status === 'cancelled')) && !showEv && (
        <View
          style={[styles.absenceIndicator, { borderTopColor: themeColors.danger }]}
          {...(Platform.OS === 'web' && absentTooltip ? { title: absentTooltip } : {})}
        />
      )}

      {editMode && showEv && !isMoveTarget && !isMoving && (
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDeleteTap}
          activeOpacity={0.6}
          hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
        >
          <Ionicons name="close" size={14} color={themeColors.textMuted} />
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}
        activeOpacity={0.7}
        onPress={handleSlotTap}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {showEv ? (
          <View style={{ alignItems: 'center', width: '100%', paddingHorizontal: 2 }}>
            <Text style={[styles.eventText, { color: accent }]} numberOfLines={billingLabel ? 1 : 2}>
              {(ev.clients?.name ? `${ev.clients.name}${ev.clients.has_active_billing_or_history ? ` [${ev.clients.package_current_count || 0}${ev.clients.billing_type === 'package' ? '/' + (ev.clients.package_size || 10) : ''}]` : ''}` : '—')}
              {!billingLabel && (ev.training_plans?.name || ev.workout_types?.name) ? '\n' + (ev.training_plans?.name || ev.workout_types?.name) : ''}
            </Text>
            {billingLabel && (
              <Text style={{ fontSize: 9, fontWeight: '700', color: (billingLabel.startsWith('Rozpoczęto') || billingLabel === 'Rozliczono') ? themeColors.success || '#28a745' : themeColors.textMuted, marginTop: 1, textAlign: 'center' }} numberOfLines={1}>
                {billingLabel}
              </Text>
            )}
          </View>
        ) : null}
      </TouchableOpacity>
      {showEv && ev.is_settled && !isAbsent && (
        <View style={{ position: 'absolute', bottom: 3, right: 4 }}>
          <Ionicons name="logo-usd" size={10} color={accent} />
        </View>
      )}
    </View>
  );
}

function CalendarScreen({ navigation, route }) {
  const { colors: C, barStyle, themeColors, mode } = useTheme();
  const insets = useSafeAreaInsets();

  const uniqueId = useMemo(() => Math.random().toString(36).substring(2, 9), []);
  const headerGradId = `headerGlass_${uniqueId}_${mode}`;
  const headerGradIdGrey = `headerGrad_${uniqueId}_${mode}`;
  const bottomGradId = `bottomGrad_${uniqueId}_${mode}`;
  const glassGradBottomId = `glassGradBottom_${uniqueId}_${mode}`;

  const barBg = useMemo(() => {
    if (barStyle === 'pianoWhite') return '#FFFFFF';
    if (barStyle === 'pianoGrey') return '#2C2F36';
    if (barStyle === 'beige') return '#EADEC9';
    if (barStyle === 'greyGradient' || barStyle === 'glossyGlass') return 'transparent';
    return '#000000'; // pianoBlack (default)
  }, [barStyle]);

  const styles = useMemo(() => makeStyles(C.accent, barBg, themeColors, insets), [C.accent, barBg, themeColors, insets]);

  const headerBgSvg = useMemo(() => {
    if (barStyle === 'greyGradient') return (
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id={headerGradIdGrey} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#3A3D46" />
            <Stop offset="100%" stopColor="#1E2024" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${headerGradIdGrey})`} />
      </Svg>
    );
    if (barStyle === 'glossyGlass') {
      const gradStops = mode === 'light' 
        ? <><Stop offset="0%" stopColor="rgba(255,253,245,0.92)" /><Stop offset="50%" stopColor="rgba(245,235,218,0.7)" /><Stop offset="100%" stopColor="rgba(235,222,198,0.8)" /></>
        : <><Stop offset="0%" stopColor="rgba(255,255,255,0.25)" /><Stop offset="30%" stopColor="rgba(80,80,90,0.6)" /><Stop offset="100%" stopColor="rgba(30,30,35,0.85)" /></>;
      return (
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, Platform.OS === 'web' && { backdropFilter: 'blur(20px)' }]}>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id={headerGradId} x1="1" y1="0" x2="0" y2="1">
                {gradStops}
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${headerGradId})`} />
          </Svg>
        </View>
      );
    }
    return null;
  }, [barStyle, mode, headerGradId, headerGradIdGrey]);

  const isLightBar = barStyle === 'pianoWhite' || barStyle === 'beige';
  const headerIconColor = mode === 'light' ? C.accent : (isLightBar ? '#000000' : C.accent);
  const headerTextColor = isLightBar ? '#555555' : themeColors.textSecondary;
  const dateLabelBg = barStyle === 'pianoWhite' ? '#E1E4EA' : (barStyle === 'beige' ? '#DCCEB7' : (barStyle === 'glossyGlass' ? (mode === 'light' ? 'rgba(180,165,135,0.15)' : 'rgba(255,255,255,0.15)') : themeColors.surfaceLight));
  const dateLabelText = mode === 'light' ? C.accent : (isLightBar ? '#000000' : C.accent);
  const appTitleColor = mode === 'light' ? C.accent : (isLightBar ? '#000000' : C.accent);

  const bottomIconColor = mode === 'light' ? C.accent : (isLightBar ? '#000000' : C.accent);
  const bottomTextColor = mode === 'light' ? C.accent : (isLightBar ? '#555555' : C.accent);
  const bottomVersionColor = isLightBar ? '#555555' : themeColors.textMuted;

  const today = new Date();
  const [monday, setMonday] = useState(getMonday(today));
  const [events, setEvents] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [showMonth, setShowMonth] = useState(false);
  const [viewMode, setViewMode] = useState('week');
  const [historyMode, setHistoryMode] = useState(false);
  const [historyClientId, setHistoryClientId] = useState('');
  const [historyClientName, setHistoryClientName] = useState('');
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistoryPopup, setShowHistoryPopup] = useState(false);

  useEffect(() => {
    if (route?.params?.activateHistory) {
      setHistoryMode(true);
      setEditMode(false);
      navigation.setParams({ activateHistory: undefined });
    }
  }, [route?.params?.activateHistory]);

  const handleShowHistory = useCallback(async (clientId, clientName) => {
    setHistoryClientId(clientId || '');
    setHistoryClientName(clientName || '');
    setLoadingHistory(true);
    setShowHistoryPopup(true);
    try {
      const data = await api.getClientHistory(clientId);
      setHistoryLogs(data || []);
    } catch (e) {
      setHistoryLogs([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const dayW = viewMode === 'week' ? (SCREEN_WIDTH - HOUR_W) / 3 : (SCREEN_WIDTH - HOUR_W);
  const headerScrollRef = useRef(null);
  const isCurrentWeek = isSameWeek(monday, today);
  const getDisplayDateLabel = () => {
    if (isCurrentWeek) return today.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    if (monday.getMonth() === sunday.getMonth()) {
      return `${monday.getDate()} - ${sunday.getDate()} ${MONTHS[monday.getMonth()]}`;
    }
    return `${monday.getDate()} ${MONTHS[monday.getMonth()].substring(0,3)} - ${sunday.getDate()} ${MONTHS[sunday.getMonth()].substring(0,3)}`;
  };
  const displayDateLabel = getDisplayDateLabel();

  const loadWeek = useCallback(async () => {
    try {
      const [evData, absData] = await Promise.all([
        api.getWeekEvents(formatDateString(monday)),
        api.getAbsences(formatDateString(monday))
      ]);
      setEvents((evData || []).filter(e => e.status !== 'deleted'));
      setAbsences(absData || []);
    } catch (e) {}
  }, [monday]);

  useFocusEffect(
    useCallback(() => {
      loadWeek();
    }, [loadWeek])
  );

  useEffect(() => {
    // Prefetch dictionaries in background for faster navigation
    api.getClients().catch(() => {});
    api.getWorkoutTypes().catch(() => {});
    api.getMuscleGroups().catch(() => {});
    api.getExercisesGrouped().catch(() => {});
  }, []);

  const nextWeek = () => setMonday(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7));
  const prevWeek = () => setMonday(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7));
  const goToday = () => setMonday(getMonday(today));

  const [movingSlot, setMovingSlot] = useState(null);
  const vScrollRef = useRef(null);
  const hGridRef = useRef(null);

  useEffect(() => {
    if (viewMode === 'week' && isCurrentWeek && hGridRef.current && headerScrollRef.current) {
      let offsetIdx = 0;
      const d = new Date().getDay();
      if (d === 3) offsetIdx = 1; // Środa
      else if (d === 4) offsetIdx = 2; // Czwartek
      else if (d === 5 || d === 6 || d === 0) offsetIdx = 3; // Piątek, Sobota, Niedziela

      setTimeout(() => {
        const x = offsetIdx * dayW;
        hGridRef.current?.scrollTo({ x, animated: false });
        headerScrollRef.current?.scrollTo({ x, animated: false });
      }, 100);
    }
  }, [viewMode, isCurrentWeek, dayW]);

  const handleMoveStart = useCallback((date, hour, ev) => {
    setMovingSlot({ date, hour, ev });
  }, []);

  const handleMoveTo = useCallback(async (targetDate, targetHour) => {
    if (!movingSlot) return;
    if (movingSlot.date === targetDate && movingSlot.hour === targetHour) {
      setMovingSlot(null);
      return;
    }

    const sourceKey = movingSlot.date + '|' + movingSlot.hour;
    const targetKey = targetDate + '|' + targetHour;

    setEvents(prev => {
      const next = prev.map(e => {
        const key = e.event_date + '|' + e.event_hour;
        if (key === sourceKey) {
          return { ...e, event_date: targetDate, event_hour: targetHour };
        }
        if (key === targetKey) {
          return { ...e, event_date: movingSlot.date, event_hour: movingSlot.hour };
        }
        return e;
      });

      const hasTarget = prev.some(e => e.event_date === targetDate && e.event_hour === targetHour);
      if (!hasTarget) {
        return next.filter(e => !(e.event_date === movingSlot.date && e.event_hour === movingSlot.hour));
      }
      return next;
    });

    setMovingSlot(null);

    try {
      await api.swapEvents({
        date1: movingSlot.date,
        hour1: movingSlot.hour,
        date2: targetDate,
        hour2: targetHour,
      });
    } catch (err) {
      loadWeek();
      Alert.alert('Błąd', 'Nie udało się przenieść: ' + err.message);
    }
  }, [movingSlot, loadWeek]);

  const handleDelete = useCallback(async (date, hour, ev) => {
    const eventHour = Number(hour);
    setEvents(prev => prev.filter(e => !(e.event_date === date && e.event_hour === eventHour)));
    try {
      const result = await api.deleteCalendarEvent(date, eventHour);
      console.log('Delete result:', result);
      // Force re-fetch to confirm server state and fetch absences
      loadWeek();
    } catch (e) {
      console.error('Delete error:', e);
      loadWeek();
      Alert.alert('Błąd', 'Nie udało się usunąć: ' + e.message);
    }
  }, [loadWeek]);

  function getEvent(dayIdx, hour) {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + dayIdx);
    return events.find(e => e.event_date === formatDateString(date) && e.event_hour === hour);
  }

  const todayDayIdx = Math.min(5, Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate())) / 86400000));
  function onHorizontalScroll(e) { const x = e.nativeEvent.contentOffset.x; headerScrollRef.current?.scrollTo?.({ x, animated: false }); }

  const isMovingActive = movingSlot !== null;

  return (<View style={styles.container}>
    {isMovingActive && (
      <View style={styles.moveBanner}>
        <Text style={styles.moveBannerText}>Przenoszenie: {movingSlot.ev?.clients?.name || ''} — kliknij docelowy slot lub anuluj</Text>
        <TouchableOpacity style={styles.moveCancelBtn} onPress={() => setMovingSlot(null)}>
          <Text style={styles.moveCancelText}>Anuluj</Text>
        </TouchableOpacity>
      </View>
    )}

    <View style={[
      styles.iosHeader, 
      barStyle === 'glossyGlass' && { 
        borderBottomWidth: 1,
        borderBottomColor: mode === 'light' ? 'rgba(210,195,165,0.5)' : 'rgba(255,255,255,0.2)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 6,
      }
    ]}>
      {headerBgSvg}
      <View style={{ alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ color: appTitleColor, fontSize: 16, fontWeight: '700', letterSpacing: 1 }}>ATYLLA PRO</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('MenuModal')}>
          <Ionicons name="menu" size={32} color={headerIconColor} />
        </TouchableOpacity>
        
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={prevWeek} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={24} color={headerIconColor} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dateLabel, { backgroundColor: dateLabelBg, flexDirection: 'column', alignItems: 'center' }]} onPress={() => isCurrentWeek ? setShowMonth(true) : goToday()}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.dateText, { fontSize: 16, color: dateLabelText }]}>{displayDateLabel}</Text>
              <Ionicons name="chevron-down" size={16} color={dateLabelText} style={{ marginLeft: 6 }} />
            </View>
            {(() => {
              const validEvents = events.filter(e => e.status === 'active' || (e.status === 'cancelled' && e.is_settled));
              let count = 0;
              if (viewMode === 'week') {
                count = validEvents.length;
              } else if (todayDayIdx >= 0 && todayDayIdx <= 5) {
                const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + todayDayIdx);
                const dateStr = formatDateString(date);
                count = validEvents.filter(e => e.event_date === dateStr).length;
              }
              return (
                <Text style={{ fontSize: 11, color: headerIconColor, marginTop: 2, fontWeight: '600' }}>
                  Treningi: {count}
                </Text>
              );
            })()}
          </TouchableOpacity>
          <TouchableOpacity onPress={nextWeek} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={24} color={headerIconColor} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.headerBtn} onPress={() => { if (viewMode === 'week') setMonday(getMonday(today)); setViewMode(viewMode === 'week' ? 'day' : 'week'); }}>
          <MaterialCommunityIcons name={viewMode === 'week' ? 'calendar-month-outline' : 'format-list-bulleted'} size={28} color={headerIconColor} />
        </TouchableOpacity>
      </View>
    </View>

    <View style={styles.headerRow}>
      <View style={[styles.hourCell, { borderBottomWidth: 0, backgroundColor: themeColors.background }]} />
      <ScrollView horizontal ref={headerScrollRef} showsHorizontalScrollIndicator={false} scrollEnabled={false} style={{ flex: 1 }}>{DAYS.map((day, idx) => { 
        if (viewMode === 'day' && idx !== todayDayIdx) return null;
        const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx); 
        const isToday = today.toDateString() === date.toDateString(); 
        return (<TouchableOpacity key={day} style={[styles.dayCell, isToday && styles.todayCell, { width: dayW }]} onPress={() => !editMode && navigation.navigate('Training', { date: formatDateString(date) })}><Text style={[styles.dayText, isToday && styles.todayText]}>{day}</Text><Text style={[styles.dayNum, isToday && styles.todayText]}>{date.getDate()}</Text></TouchableOpacity>); 
      })}</ScrollView>
    </View>

    <ScrollView ref={vScrollRef} showsVerticalScrollIndicator={false} style={{ flex: 1, backgroundColor: themeColors.surface }} contentContainerStyle={{ paddingBottom: 130 }} scrollEventThrottle={16}>
      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: themeColors.border }}>
        <View style={{ width: HOUR_W }}>{HOURS.map(hour => (<View key={hour} style={styles.hourCell}><Text style={styles.hourText}>{hour}:00</Text></View>))}</View>
        <ScrollView ref={hGridRef} horizontal showsHorizontalScrollIndicator={false} onScroll={onHorizontalScroll} scrollEventThrottle={16} style={{ flex: 1 }}>
          <View>{HOURS.map(hour => (<View key={hour} style={styles.gridRow}>{DAYS.map((dayLabel, dayIdx) => { if (viewMode === 'day' && dayIdx !== todayDayIdx) return null; const ev = getEvent(dayIdx, hour); const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + dayIdx); const dateStr = formatDateString(date); const isSource = isMovingActive && movingSlot?.date === dateStr && movingSlot?.hour === hour; const isTarget = isMovingActive && !isSource; return (<CalendarSlot key={dayIdx+'-'+hour} hour={hour} ev={ev} absences={absences} dateStr={dateStr} dayW={dayW} editMode={editMode} historyMode={historyMode} onShowHistory={handleShowHistory} navigation={navigation} onDelete={handleDelete} onMoveStart={handleMoveStart} onMoveTo={handleMoveTo} isMoving={isSource} isMoveTarget={isTarget} accent={C.accent} styles={styles} />); })}</View>))}</View>
        </ScrollView>
      </View>
    </ScrollView>

    <View style={styles.iosBottom}>
      {(() => {
        const w = SCREEN_WIDTH;
        const cx = w / 2;
        const fillD = `M -100,1 L ${cx - 50},1 C ${cx - 35},1 ${cx - 25},30 ${cx},30 C ${cx + 25},30 ${cx + 35},1 ${cx + 50},1 L ${w + 100},1 L ${w + 100},90 L -100,90 Z`;
        const lineD = `M -100,1 L ${cx - 50},1 C ${cx - 35},1 ${cx - 25},30 ${cx},30 C ${cx + 25},30 ${cx + 35},1 ${cx + 50},1 L ${w + 100},1`;
        
        const fillValue = barStyle === 'greyGradient' ? `url(#${bottomGradId})` : (barStyle === 'glossyGlass' ? `url(#${glassGradBottomId})` : barBg);
        const strokeValue = barStyle === 'glossyGlass' ? (mode === 'light' ? 'rgba(210,195,165,0.5)' : 'rgba(255,255,255,0.15)') : C.accent;
        const strokeWidth = barStyle === 'glossyGlass' ? 1 : 2;
        
        return (
          <Svg width={w} height={90} style={[StyleSheet.absoluteFill, { overflow: 'visible' }]}>
            {barStyle === 'greyGradient' && (
              <Defs>
                <LinearGradient id={bottomGradId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#3A3D46" />
                  <Stop offset="100%" stopColor="#1E2024" />
                </LinearGradient>
              </Defs>
            )}
            {barStyle === 'glossyGlass' && (
              <Defs>
                <LinearGradient id={glassGradBottomId} x1="0" y1="0" x2="0" y2="1">
                  {mode === 'light' ? (
                    <>
                      <Stop offset="0%" stopColor="rgba(255,253,245,0.9)" />
                      <Stop offset="100%" stopColor="rgba(240,228,205,0.85)" />
                    </>
                  ) : (
                    <>
                      <Stop offset="0%" stopColor="rgba(45,45,50,0.85)" />
                      <Stop offset="100%" stopColor="rgba(15,15,20,0.95)" />
                    </>
                  )}
                </LinearGradient>
              </Defs>
            )}
            <Path d={fillD} fill={fillValue} />
            <Path d={lineD} fill="none" stroke={strokeValue} strokeWidth={strokeWidth} />
          </Svg>
        );
      })()}

      <TouchableOpacity 
        style={[styles.bottomSideBtn, { left: SCREEN_WIDTH / 4 - 35 }]} 
        onPress={() => {
          setHistoryMode(!historyMode);
          setEditMode(false);
        }} 
        activeOpacity={0.6}
      >
        <MaterialCommunityIcons 
          name="history" 
          size={32} 
          color={historyMode ? (barStyle === 'pianoWhite' ? '#000000' : themeColors.text) : bottomIconColor} 
        />
        <Text 
          style={[
            styles.bottomText, 
            { color: historyMode ? (barStyle === 'pianoWhite' ? '#000000' : themeColors.text) : bottomTextColor }
          ]}
        >
          HISTORIA
        </Text>
      </TouchableOpacity>

      <View style={[styles.homeButtonWrapper, { left: SCREEN_WIDTH / 2 - 40 }]}>
        <TouchableOpacity
          style={[styles.homeButton, { borderColor: C.accent, backgroundColor: mode === 'light' ? '#FFFDF8' : '#1A1510' }]}
          onPress={() => { setEditMode(false); setHistoryMode(false); setMovingSlot(null); }}
          activeOpacity={0.7}
        >
          <View style={{ width: 66, height: 66, borderRadius: 33, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: mode === 'light' ? '#FFFDF8' : '#1A1510' }}>
            <Image source={require('../../assets/dog-home-transparent2.png')} style={[styles.homeButtonImage, { tintColor: mode === 'light' ? '#3D3225' : C.accent }]} />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 33, ...(Platform.OS === 'web' ? { boxShadow: mode === 'light' ? 'inset 0 0 14px 4px rgba(0,0,0,0.12)' : 'inset 0 0 18px 6px rgba(0,0,0,0.45)' } : {}) }} pointerEvents="none" />
          </View>
        </TouchableOpacity>
        <Text style={[styles.bottomText, { color: bottomTextColor, marginTop: 9 }]}>GŁÓWNA</Text>
      </View>

      <TouchableOpacity style={[styles.bottomSideBtn, { right: SCREEN_WIDTH / 4 - 35 }]} onPress={() => { setEditMode(!editMode); setHistoryMode(false); setMovingSlot(null); }} activeOpacity={0.6}>
        <MaterialCommunityIcons name="square-edit-outline" size={32} color={editMode ? (barStyle === 'pianoWhite' ? '#000000' : themeColors.text) : bottomIconColor} />
        <Text style={[styles.bottomText, { color: editMode ? (barStyle === 'pianoWhite' ? '#000000' : themeColors.text) : bottomTextColor }]}>EDYCJA</Text>
      </TouchableOpacity>

      <View style={styles.versionBadge}><Text style={[styles.versionText, { color: bottomVersionColor }]}>v{APP_VERSION}</Text></View>
    </View>

    <MonthPopup visible={showMonth} onClose={() => setShowMonth(false)} currentMonday={monday} onSelect={(newMonday) => setMonday(newMonday)} accent={C.accent} styles={styles} />
    <HistoryPopup visible={showHistoryPopup} onClose={() => setShowHistoryPopup(false)} clientId={historyClientId} clientName={historyClientName} logs={historyLogs} loading={loadingHistory} accent={C.accent} themeColors={themeColors} styles={styles} navigation={navigation} />
  </View>);
}

function makeStyles(accent, barBg, TC, insets) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: TC.background },
  moveBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: accent + '30', paddingHorizontal: 12, paddingVertical: 8, zIndex: 300 },
  moveBannerText: { flex: 1, color: TC.text, fontSize: 12, fontWeight: '600', marginRight: 8 },
  moveCancelBtn: { backgroundColor: accent, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  moveCancelText: { color: TC.background, fontSize: 12, fontWeight: '700' },
  iosHeader: { backgroundColor: barBg, paddingHorizontal: 16, paddingTop: Math.max(insets.top + 5, 45), paddingBottom: 12, borderBottomWidth: 2, borderColor: accent, borderBottomLeftRadius: 22, borderBottomRightRadius: 22, overflow: 'hidden' },
  headerBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  dateNav: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  dateLabel: { flexDirection: 'row', alignItems: 'center', backgroundColor: TC.surfaceLight, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  dateText: { color: TC.text, fontSize: 14, fontWeight: '700' },
  headerRow: { flexDirection: 'row', height: CELL_H, backgroundColor: TC.background, borderBottomWidth: 2, borderColor: TC.border },
  dayCell: { height: CELL_H, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderColor: TC.border },
  todayCell: { backgroundColor: accent + '1a' },
  dayText: { color: TC.textSecondary, fontSize: 11, fontWeight: '600' },
  dayNum: { color: TC.textSecondary, fontSize: 14, fontWeight: '700', marginTop: 2 },
  todayText: { color: accent },
  hourCell: { width: HOUR_W, height: CELL_H, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderBottomWidth: 1, borderColor: TC.border, backgroundColor: TC.background },
  hourText: { color: TC.textSecondary, fontSize: 10 },
  gridRow: { flexDirection: 'row', height: CELL_H },
  slot: { height: CELL_H - 4, justifyContent: 'center', alignItems: 'center', marginVertical: 2, marginHorizontal: 1, borderRadius: 10, backgroundColor: TC.surface, borderWidth: 1, borderColor: TC.border },
  deleteBtn: { position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: TC.surface, borderWidth: 1, borderColor: TC.border, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  absenceIndicator: { position: 'absolute', top: -1, right: -1, width: 0, height: 0, borderLeftWidth: 12, borderLeftColor: 'transparent', borderBottomWidth: 12, borderBottomColor: 'transparent', borderTopWidth: 12, borderTopColor: TC.danger, borderRightWidth: 12, borderRightColor: TC.danger, borderTopRightRadius: 6, zIndex: 9 },
  absenceIndicatorText: { position: 'absolute', top: 1, right: 1, color: '#fff', fontSize: 7, fontWeight: '900', zIndex: 11 },
  eventText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  iosBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 90, backgroundColor: 'transparent', zIndex: 100, overflow: 'visible' },
  bottomSideBtn: { position: 'absolute', top: 12, width: 70, alignItems: 'center' },
  homeButtonWrapper: { position: 'absolute', top: -25, width: 80, alignItems: 'center', zIndex: 102 },
  homeButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#000000', borderWidth: 2, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 10 },
  homeButtonImage: { width: 90, height: 90 },
  bottomText: { fontSize: 10, fontWeight: '700', color: TC.textMuted, letterSpacing: 0.5, marginTop: 4 },
  versionBadge: { position: 'absolute', right: 16, bottom: 28 },
  versionText: { color: TC.textMuted, fontSize: 9, fontWeight: '600' },
  popupOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200 },
  popupCard: { position: 'absolute', top: 100, left: 8, backgroundColor: TC.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: TC.border, width: 280, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10 },
  popupNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  popupMonth: { fontSize: 14, fontWeight: '700' },
  popupWeekdays: { flexDirection: 'row', marginBottom: 2 },
  popupWd: { width: 36, textAlign: 'center', color: TC.textMuted, fontSize: 10, fontWeight: '600' },
  popupWeek: { flexDirection: 'row', marginBottom: 2 },
  popupDay: { width: 36, height: 30, justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
  popupToday: { backgroundColor: accent + '25' },
  popupSelected: { backgroundColor: accent },
  popupDayText: { color: TC.text, fontSize: 12 },
  popupTodayText: { color: accent, fontWeight: '700' },
  popupSelectedText: { color: '#fff', fontWeight: '700' },
}); }

function CalendarScreenWrapper(props) {
  return <CalendarScreen {...props} />;
}
export default CalendarScreenWrapper;
