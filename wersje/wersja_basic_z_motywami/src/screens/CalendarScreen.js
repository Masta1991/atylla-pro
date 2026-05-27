import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, useWindowDimensions, Platform, Image } from 'react-native';
import { Svg, Path } from 'react-native-svg';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../assets/theme';
import * as api from '../services/api';
import { useTheme } from '../context/ThemeContext';

function getMonday(date) { const d = new Date(date); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); d.setDate(diff); d.setHours(0, 0, 0, 0); return d; }
function isSameWeek(d1, d2) { return getMonday(d1).getTime() === getMonday(d2).getTime(); }

const DAYS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob'];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6);
const MONTHS = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
const HOUR_W = 50;
const CELL_H = 56;
const LONG_PRESS_DELAY = 300;

function MonthPopup({ visible, onClose, currentMonday, onSelect, accent, styles }) {
  const mon = new Date(currentMonday);
  const [year, setYear] = useState(mon.getFullYear()); const [month, setMonth] = useState(mon.getMonth()); const today = new Date();
  const daysInMonth = new Date(year, month + 1, 0).getDate(); const firstDayOfWeek = (new Date(year, month, 0).getDay() + 1) % 7;
  const weeks = []; let day = 1;
  for (let w = 0; w < 6; w++) { const week = []; for (let d = 0; d < 7; d++) { if ((w === 0 && d < firstDayOfWeek) || day > daysInMonth) week.push(null); else week.push(day++); } if (week.some(d => d !== null)) weeks.push(week); }
  if (!visible) return null;
  return (<View style={styles.popupOverlay}><TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} /><View style={styles.popupCard}><View style={styles.popupNav}><TouchableOpacity onPress={() => month > 0 ? setMonth(month - 1) : (setMonth(11), setYear(year - 1))}><Ionicons name="chevron-back" size={18} color={accent} /></TouchableOpacity><Text style={[styles.popupMonth,{color:accent}]}>{MONTHS[month]} {year}</Text><TouchableOpacity onPress={() => month < 11 ? setMonth(month + 1) : (setMonth(0), setYear(year + 1))}><Ionicons name="chevron-forward" size={18} color={accent} /></TouchableOpacity></View><View style={styles.popupWeekdays}>{['Pn','Wt','Śr','Czw','Pt','Sob','Nd'].map(d => <Text key={d} style={styles.popupWd}>{d}</Text>)}</View>{weeks.map((week, wi) => (<View key={wi} style={styles.popupWeek}>{week.map((d, di) => { const isToday = d && year === today.getFullYear() && month === today.getMonth() && d === today.getDate(); const selMonday = d ? getMonday(new Date(year, month, d)) : null; const isSelected = selMonday && selMonday.getTime() === mon.getTime(); return (<TouchableOpacity key={di} style={[styles.popupDay, isToday && styles.popupToday, isSelected && styles.popupSelected]} onPress={() => d && (onSelect(getMonday(new Date(year, month, d))), onClose())} disabled={!d}>{d ? <Text style={[styles.popupDayText, isToday && styles.popupTodayText, isSelected && styles.popupSelectedText]}>{d}</Text> : <View />}</TouchableOpacity>); })}</View>))}</View></View>);
}

function CalendarSlot({ dateStr, hour, ev, dayW, editMode, navigation, onDelete, onMoveStart, onMoveTo, isMoving, isMoveTarget, accent, styles }) {
  const slotRef = useRef(null);
  const longPressTimer = useRef(null);
  const isPressed = useRef(false);

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
    if (!editMode) {
      navigation.navigate('Training', { date: dateStr, hour });
    }
  };

  const handleDeleteTap = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Czy na pewno chcesz usunąć dany zapis?')) {
        onDelete(dateStr, hour, ev);
      }
    } else {
      Alert.alert('Usuń zapis', 'Czy na pewno chcesz usunąć dany zapis?', [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Usuń', style: 'destructive', onPress: () => onDelete(dateStr, hour, ev) },
      ]);
    }
  };

  return (
    <View
      ref={slotRef}
      style={[
        styles.slot,
        ev && { backgroundColor: accent + '15', borderColor: accent + '30' },
        { width: dayW - 2 },
        isMoving && { opacity: 0.35, borderColor: accent, borderWidth: 2, borderStyle: 'dashed' },
      ]}
      dataSet={{ slotDate: dateStr, slotHour: String(hour) }}
    >
      {editMode && ev && !isMoveTarget && !isMoving && (
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDeleteTap}
          activeOpacity={0.6}
          hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
        >
          <Ionicons name="close" size={14} color={COLORS.textMuted} />
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}
        activeOpacity={0.7}
        onPress={handleSlotTap}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {ev ? <Text style={[styles.eventText,{color:accent}]} numberOfLines={3}>{ev.clients?.name || '—'}{ev.workout_types?.name ? '\n' + ev.workout_types.name : ''}</Text> : null}
      </TouchableOpacity>
    </View>
  );
}

function CalendarScreen({ navigation }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C.accent), [C.accent]);
  const today = new Date();
  const [monday, setMonday] = useState(getMonday(today));
  const [events, setEvents] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [showMonth, setShowMonth] = useState(false);
  const [viewMode, setViewMode] = useState('week');
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const dayW = viewMode === 'week' ? (SCREEN_WIDTH - HOUR_W) / 3 : (SCREEN_WIDTH - HOUR_W);
  const headerScrollRef = useRef(null);
  const isCurrentWeek = isSameWeek(monday, today);
  const weekLabel = monday.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  const saturdayLabel = new Date(monday.getTime() + 5 * 86400000).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });

  const loadWeek = useCallback(async () => {
    try {
      const data = await api.getWeekEvents(monday.toISOString().slice(0, 10));
      setEvents(data || []);
    } catch (e) {}
  }, [monday]);

  useEffect(() => { loadWeek(); }, [loadWeek]);

  const nextWeek = () => setMonday(new Date(monday.getTime() + 7 * 86400000));
  const prevWeek = () => setMonday(new Date(monday.getTime() - 7 * 86400000));
  const goToday = () => setMonday(getMonday(today));

  const [movingSlot, setMovingSlot] = useState(null);
  const vScrollRef = useRef(null);
  const hGridRef = useRef(null);

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
    setEvents(prev => prev.filter(e => !(e.event_date === date && e.event_hour === hour)));
    try {
      await api.deleteCalendarEvent(date, hour);
    } catch (e) {
      loadWeek();
      Alert.alert('Błąd', 'Nie udało się usunąć: ' + e.message);
    }
  }, [loadWeek]);

  function getEvent(dayIdx, hour) {
    const date = new Date(monday.getTime() + dayIdx * 86400000);
    return events.find(e => e.event_date === date.toISOString().slice(0, 10) && e.event_hour === hour);
  }

  const todayDayIdx = Math.min(5, Math.floor((today.getTime() - monday.getTime()) / 86400000));
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

    <View style={styles.iosHeader}>
      <View style={{ alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ color: C.accent, fontSize: 16, fontWeight: '700', letterSpacing: 1 }}>ATYLLA PRO</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('MenuModal')}>
          <Ionicons name="menu" size={32} color={C.accent} />
        </TouchableOpacity>
        
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={prevWeek} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={24} color={C.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateLabel} onPress={() => isCurrentWeek ? setShowMonth(true) : goToday()}>
            <Text style={[styles.dateText, { fontSize: 16 }]}>{weekLabel}</Text>
            <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
          <TouchableOpacity onPress={nextWeek} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={24} color={C.accent} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.headerBtn} onPress={() => { if (viewMode === 'week') setMonday(getMonday(today)); setViewMode(viewMode === 'week' ? 'day' : 'week'); }}>
          <MaterialCommunityIcons name={viewMode === 'week' ? 'calendar-month-outline' : 'format-list-bulleted'} size={28} color={C.accent} />
        </TouchableOpacity>
      </View>
    </View>

    <View style={styles.headerRow}>
      <View style={[styles.hourCell, { borderBottomWidth: 0, backgroundColor: COLORS.surface }]} />
      <ScrollView horizontal ref={headerScrollRef} showsHorizontalScrollIndicator={false} scrollEnabled={false} style={{ flex: 1 }}>{DAYS.map((day, idx) => { 
        if (viewMode === 'day' && idx !== todayDayIdx) return null;
        const date = new Date(monday.getTime() + idx * 86400000); 
        const isToday = today.toDateString() === date.toDateString(); 
        return (<TouchableOpacity key={day} style={[styles.dayCell, isToday && styles.todayCell, { width: dayW }]} onPress={() => !editMode && navigation.navigate('Training', { date: date.toISOString().slice(0, 10) })}><Text style={[styles.dayText, isToday && styles.todayText]}>{day}</Text><Text style={[styles.dayNum, isToday && styles.todayText]}>{date.getDate()}</Text></TouchableOpacity>); 
      })}</ScrollView>
    </View>

    <ScrollView ref={vScrollRef} showsVerticalScrollIndicator={false} style={{ flex: 1, backgroundColor: COLORS.surface }} contentContainerStyle={{ paddingBottom: 130 }} scrollEventThrottle={16}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: HOUR_W }}>{HOURS.map(hour => (<View key={hour} style={styles.hourCell}><Text style={styles.hourText}>{hour}:00</Text></View>))}</View>
        <ScrollView ref={hGridRef} horizontal showsHorizontalScrollIndicator={false} onScroll={onHorizontalScroll} scrollEventThrottle={16} style={{ flex: 1 }}>
          <View>{HOURS.map(hour => (<View key={hour} style={styles.gridRow}>{DAYS.map((dayLabel, dayIdx) => { if (viewMode === 'day' && dayIdx !== todayDayIdx) return null; const ev = getEvent(dayIdx, hour); const date = new Date(monday.getTime() + dayIdx * 86400000); const dateStr = date.toISOString().slice(0, 10); const isSource = isMovingActive && movingSlot?.date === dateStr && movingSlot?.hour === hour; const isTarget = isMovingActive && !isSource; return (<CalendarSlot key={dayIdx+'-'+hour} hour={hour} ev={ev} dateStr={dateStr} dayW={dayW} editMode={editMode} navigation={navigation} onDelete={handleDelete} onMoveStart={handleMoveStart} onMoveTo={handleMoveTo} isMoving={isSource} isMoveTarget={isTarget} accent={C.accent} styles={styles} />); })}</View>))}</View>
        </ScrollView>
      </View>
    </ScrollView>

    <View style={styles.iosBottom}>
      {(() => {
        const w = SCREEN_WIDTH;
        const cx = w / 2;
        const fillD = `M -100,1 L ${cx - 50},1 C ${cx - 35},1 ${cx - 25},30 ${cx},30 C ${cx + 25},30 ${cx + 35},1 ${cx + 50},1 L ${w + 100},1 L ${w + 100},90 L -100,90 Z`;
        const lineD = `M -100,1 L ${cx - 50},1 C ${cx - 35},1 ${cx - 25},30 ${cx},30 C ${cx + 25},30 ${cx + 35},1 ${cx + 50},1 L ${w + 100},1`;
        return (
          <Svg width={w} height={90} style={[StyleSheet.absoluteFill, { overflow: 'visible' }]}>
            <Path d={fillD} fill={C.headerBg || COLORS.surface} />
            <Path d={lineD} fill="none" stroke={C.accent} strokeWidth={2} />
          </Svg>
        );
      })()}

      <TouchableOpacity style={[styles.bottomSideBtn, { left: SCREEN_WIDTH / 4 - 35 }]} onPress={() => navigation.navigate('Clients')} activeOpacity={0.6}>
        <MaterialCommunityIcons name="card-account-details" size={32} color={C.accent} />
        <Text style={[styles.bottomText, { color: C.accent }]}>KLIENCI</Text>
      </TouchableOpacity>

      <View style={[styles.homeButtonWrapper, { left: SCREEN_WIDTH / 2 - 40 }]}>
        <TouchableOpacity
          style={[styles.homeButton, { borderColor: C.accent, backgroundColor: C.headerBg || COLORS.surface }]}
          onPress={() => { setEditMode(false); setMovingSlot(null); }}
          activeOpacity={0.7}
        >
          <View style={{ width: 66, height: 66, borderRadius: 33, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
            <Image source={require('../../assets/dog-home-transparent2.png')} style={[styles.homeButtonImage, { tintColor: C.accent }]} />
          </View>
        </TouchableOpacity>
        <Text style={[styles.bottomText, { color: C.accent, marginTop: 9 }]}>GŁÓWNA</Text>
      </View>

      <TouchableOpacity style={[styles.bottomSideBtn, { right: SCREEN_WIDTH / 4 - 35 }]} onPress={() => { setEditMode(!editMode); setMovingSlot(null); }} activeOpacity={0.6}>
        <MaterialCommunityIcons name="square-edit-outline" size={32} color={editMode ? COLORS.text : C.accent} />
        <Text style={[styles.bottomText, { color: editMode ? COLORS.text : C.accent }]}>EDYCJA</Text>
      </TouchableOpacity>

      <View style={styles.versionBadge}><Text style={styles.versionText}>v1.0.15</Text></View>
    </View>

    <MonthPopup visible={showMonth} onClose={() => setShowMonth(false)} currentMonday={monday} onSelect={(newMonday) => setMonday(newMonday)} accent={C.accent} styles={styles} />
  </View>);
}

function makeStyles(accent) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  moveBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: accent + '30', paddingHorizontal: 12, paddingVertical: 8, zIndex: 300 },
  moveBannerText: { flex: 1, color: COLORS.text, fontSize: 12, fontWeight: '600', marginRight: 8 },
  moveCancelBtn: { backgroundColor: accent, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  moveCancelText: { color: '#0d1117', fontSize: 12, fontWeight: '700' },
  iosHeader: { backgroundColor: COLORS.surface, paddingHorizontal: 16, paddingTop: 40, paddingBottom: 12, borderBottomWidth: 1.5, borderColor: '#c28b71' },
  headerBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  dateNav: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  dateLabel: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceLight, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  dateText: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  headerRow: { flexDirection: 'row', height: CELL_H, backgroundColor: COLORS.surface, borderBottomWidth: 2, borderColor: COLORS.border },
  dayCell: { height: CELL_H, alignItems: 'center', justifyContent: 'center' },
  todayCell: { backgroundColor: accent + '1a' },
  dayText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },
  dayNum: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginTop: 2 },
  todayText: { color: accent },
  hourCell: { width: HOUR_W, height: CELL_H, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background },
  hourText: { color: COLORS.textMuted, fontSize: 10 },
  gridRow: { flexDirection: 'row', height: CELL_H },
  slot: { height: CELL_H - 4, justifyContent: 'center', alignItems: 'center', marginVertical: 2, marginHorizontal: 1, borderRadius: 10, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  deleteBtn: { position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  eventText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  iosBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 90, backgroundColor: 'transparent', zIndex: 100, overflow: 'visible' },
  bottomSideBtn: { position: 'absolute', top: 12, width: 70, alignItems: 'center' },
  homeButtonWrapper: { position: 'absolute', top: -25, width: 80, alignItems: 'center', zIndex: 102 },
  homeButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: COLORS.surface, borderWidth: 2, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 10 },
  homeButtonImage: { width: 90, height: 90 },
  bottomText: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5, marginTop: 4 },
  versionBadge: { position: 'absolute', right: 16, bottom: 12 },
  versionText: { color: COLORS.textMuted, fontSize: 9, fontWeight: '600' },
  popupOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200 },
  popupCard: { position: 'absolute', top: 100, left: 8, backgroundColor: COLORS.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.border, width: 280, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10 },
  popupNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  popupMonth: { fontSize: 14, fontWeight: '700' },
  popupWeekdays: { flexDirection: 'row', marginBottom: 2 },
  popupWd: { width: 36, textAlign: 'center', color: COLORS.textMuted, fontSize: 10, fontWeight: '600' },
  popupWeek: { flexDirection: 'row', marginBottom: 2 },
  popupDay: { width: 36, height: 30, justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
  popupToday: { backgroundColor: accent + '25' },
  popupSelected: { backgroundColor: accent },
  popupDayText: { color: COLORS.text, fontSize: 12 },
  popupTodayText: { color: accent, fontWeight: '700' },
  popupSelectedText: { color: '#fff', fontWeight: '700' },
}); }

function CalendarScreenWrapper(props) {
  return <CalendarScreen {...props} />;
}
export default CalendarScreenWrapper;
