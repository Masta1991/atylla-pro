import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING } from '../assets/theme';
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

function formatDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isEventInSchedule(ev, clientsSchedules) {
  if (ev.status === 'deleted') return false;
  const clientSched = clientsSchedules[ev.client_id];
  if (!clientSched || clientSched.length === 0) return false;
  const [y, m, d] = ev.event_date.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const jsDay = dateObj.getDay();
  const scheduleDay = jsDay === 0 ? 6 : jsDay - 1;
  return clientSched.some(s => parseInt(s.day, 10) === scheduleDay && parseInt(s.hour, 10) === ev.event_hour);
}

function buildScheduleItems(clientsSchedules, events, currentMonday, clientNames, absences) {
  const items = [];
  const monday = new Date(currentMonday);
  
  Object.entries(clientsSchedules).forEach(([clientId, schedule]) => {
    schedule.forEach(entry => {
      const day = parseInt(entry.day, 10);
      const hour = parseInt(entry.hour, 10);
      if (day < 0 || day > 5 || hour < 6 || hour > 21) return;
      
      const eventDate = new Date(monday);
      eventDate.setDate(monday.getDate() + day);
      const dateStr = formatDateString(eventDate);
      
      const existingEv = events.find(e => e.event_date === dateStr && e.event_hour === hour && e.client_id === clientId);
      const isAbsent = absences?.some(a => a.client_id === clientId && a.absence_date === dateStr && (a.absence_hour == null || a.absence_hour === hour));
      const status = isAbsent ? 'absent' : (existingEv ? existingEv.status : 'planned');
      
      items.push({
        clientId,
        clientName: existingEv?.clients?.name || clientNames[clientId] || `Klient ${clientId.slice(0, 6)}`,
        eventDate: dateStr,
        eventHour: hour,
        status,
        workout_type_id: existingEv?.workout_type_id || null,
        plan_id: existingEv?.plan_id || null,
      });
    });
  });
  
  return items.sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.eventHour - b.eventHour);
}

export default function ManagerScreen({ navigation }) {
  const { colors: C, themeColors } = useTheme();
  const styles = useMemo(() => makeStyles(C, themeColors), [C, themeColors]);
  const [currentMonday, setCurrentMonday] = useState(getMonday(new Date()));
  const [events, setEvents] = useState([]);
  const [scheduleItems, setScheduleItems] = useState([]);
  const [clientsSchedules, setClientsSchedules] = useState({});
  const [absences, setAbsences] = useState([]);
  const [clientNames, setClientNames] = useState({});
  const [existingNextWeekEvents, setExistingNextWeekEvents] = useState([]);
  const [existingNextMonthEvents, setExistingNextMonthEvents] = useState([]);
  const [scheduleSelected, setScheduleSelected] = useState(new Set());
  const [otherSelected, setOtherSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentMonday]);

  async function loadData() {
    setLoading(true);
    try {
      const nextMondayDate = new Date(currentMonday);
      nextMondayDate.setDate(nextMondayDate.getDate() + 7);
      const nextMondayStr = formatDateString(nextMondayDate);
      const nextMonthDate = new Date(currentMonday);
      nextMonthDate.setDate(nextMonthDate.getDate() + 28);
      const nextMonthStr = formatDateString(nextMonthDate);
      const currMondayStr = formatDateString(currentMonday);

      const [evData, absData, nextWeekData, nextMonthData, clientsData] = await Promise.all([
        api.getWeekEvents(currMondayStr).catch(() => []),
        api.getAbsences(nextMondayStr).catch(() => []),
        api.getWeekEvents(nextMondayStr).catch(() => []),
        api.getWeekEvents(nextMonthStr).catch(() => []),
        api.getClients().catch(() => []),
      ]);
      setEvents(evData || []);
      setAbsences(absData || []);
      setExistingNextWeekEvents(nextWeekData || []);
      setExistingNextMonthEvents(nextMonthData || []);

      const schedMap = {};
      const nameMap = {};
      (clientsData || []).forEach(c => {
        nameMap[c.id] = c.name;
        if (c.training_schedule && c.training_schedule.length > 0) {
          schedMap[c.id] = c.training_schedule;
        }
      });
      setClientsSchedules(schedMap);
      setClientNames(nameMap);

      // Build schedule items directly from client schedules
      const sItems = buildScheduleItems(schedMap, evData || [], currentMonday, nameMap, absData || []);
      setScheduleItems(sItems);

      setScheduleSelected(new Set());
      setOtherSelected(new Set());
    } catch (e) {
      setEvents([]);
      setScheduleItems([]);
      setClientsSchedules({});
    }
    setLoading(false);
  }

  // Other events: calendar events NOT in any schedule
  const otherEvents = useMemo(() => {
    return events.filter(ev => ev.status !== 'deleted' && !isEventInSchedule(ev, clientsSchedules));
  }, [events, clientsSchedules]);

  const activeScheduleItems = useMemo(() => {
    return scheduleItems.filter(item => item.status !== 'deleted');
  }, [scheduleItems]);

  function toggleSelect(idx, isSchedule) {
    const setter = isSchedule ? setScheduleSelected : setOtherSelected;
    setter(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function selectAll(list, isSchedule) {
    const setter = isSchedule ? setScheduleSelected : setOtherSelected;
    const currentSel = isSchedule ? scheduleSelected : otherSelected;
    if (currentSel.size === list.length && list.length > 0) {
      setter(new Set());
    } else {
      setter(new Set(list.map((_, i) => i)));
    }
  }

  function checkNextWeekCollisionSchedule(item) {
    const clientId = item.clientId;
    const dateParts = item.eventDate.split('-').map(Number);
    const evDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    evDate.setDate(evDate.getDate() + 7);
    const targetDate = formatDateString(evDate);
    const isAbsent = absences.some(a => a.client_id === clientId && a.absence_date === targetDate &&
      (a.absence_hour == null || a.absence_hour === item.eventHour));
    const existingEv = existingNextWeekEvents.find(e => e.event_date === targetDate && e.event_hour === item.eventHour);
    const hasReplacement = existingEv ? true : false;
    const replacementClientName = existingEv?.clients?.name || null;
    return { isAbsent, hasReplacement, replacementClientName, targetDate, clientId };
  }

  function checkNextWeekCollisionEvent(ev) {
    const targetClientId = ev.is_replacement && ev.replaced_client_id ? ev.replaced_client_id : ev.client_id;
    const [year, month, day] = ev.event_date.split('-').map(Number);
    const evDate = new Date(year, month - 1, day);
    evDate.setDate(evDate.getDate() + 7);
    const targetDate = formatDateString(evDate);
    const isAbsent = absences.some(a => a.client_id === targetClientId && a.absence_date === targetDate);
    const existingEv = existingNextWeekEvents.find(e => e.event_date === targetDate && e.event_hour === ev.event_hour);
    const hasReplacement = existingEv ? true : false;
    const replacementClientName = existingEv?.clients?.name || null;
    return { isAbsent, hasReplacement, replacementClientName, targetClientId, targetDate };
  }

  function checkNextMonthCollisionSchedule(item) {
    const clientId = item.clientId;
    const dateParts = item.eventDate.split('-').map(Number);
    const evDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    evDate.setDate(evDate.getDate() + 28);
    const targetDate = formatDateString(evDate);
    const isAbsent = absences.some(a => a.client_id === clientId && a.absence_date === targetDate &&
      (a.absence_hour == null || a.absence_hour === item.eventHour));
    const existingEv = existingNextMonthEvents.find(e => e.event_date === targetDate && e.event_hour === item.eventHour);
    const hasReplacement = existingEv ? true : false;
    const replacementClientName = existingEv?.clients?.name || null;
    return { isAbsent, hasReplacement, replacementClientName, targetDate, clientId };
  }

  function checkNextMonthCollisionEvent(ev) {
    const targetClientId = ev.is_replacement && ev.replaced_client_id ? ev.replaced_client_id : ev.client_id;
    const [year, month, day] = ev.event_date.split('-').map(Number);
    const evDate = new Date(year, month - 1, day);
    evDate.setDate(evDate.getDate() + 28);
    const targetDate = formatDateString(evDate);
    const isAbsent = absences.some(a => a.client_id === targetClientId && a.absence_date === targetDate);
    const existingEv = existingNextMonthEvents.find(e => e.event_date === targetDate && e.event_hour === ev.event_hour);
    const hasReplacement = existingEv ? true : false;
    const replacementClientName = existingEv?.clients?.name || null;
    return { isAbsent, hasReplacement, replacementClientName, targetClientId, targetDate };
  }

  // Copy schedule items → create calendar events from schedule
  async function copyScheduleToNextWeek() {
    const toCopy = activeScheduleItems.filter((_, i) => scheduleSelected.has(i));
    if (toCopy.length === 0) {
      Alert.alert('Brak zaznaczonych', 'Zaznacz treningi do skopiowania.');
      return;
    }

    const warnings = [];
    for (const item of toCopy) {
      const collision = checkNextWeekCollisionSchedule(item);
      if (collision.isAbsent && collision.hasReplacement) {
        warnings.push(`Trening odwołany przez klienta, a masz już zastępstwo (${collision.replacementClientName}) w tym terminie (${collision.targetDate} ${item.eventHour}:00). Zostanie pominięty.`);
      }
    }

    if (warnings.length > 0) {
      Alert.alert(
        'Konflikty Absencji',
        warnings.join('\n\n') + '\n\nCzy chcesz kontynuować? Konfliktowe treningi nie zostaną skopiowane.',
        [
          { text: 'Anuluj', style: 'cancel' },
          { text: 'Kopiuj resztę', style: 'destructive', onPress: () => performScheduleCopy(toCopy) }
        ]
      );
    } else {
      performScheduleCopy(toCopy);
    }
  }

  async function performScheduleCopy(toCopy) {
    setCopying(true);
    try {
      const nextMondayDate = new Date(currentMonday);
      nextMondayDate.setDate(nextMondayDate.getDate() + 7);
      const targetMondayStr = formatDateString(nextMondayDate);

      const newEvents = [];
      let skippedAbsences = 0;

      for (const item of toCopy) {
        const collision = checkNextWeekCollisionSchedule(item);
        // If absence, skip completely (leaves an empty slot with a red triangle)
        if (collision.isAbsent) {
          skippedAbsences++;
          continue;
        }

        newEvents.push({
          event_date: collision.targetDate,
          event_hour: item.eventHour,
          client_id: item.clientId,
          workout_type_id: item.workout_type_id,
          plan_id: item.plan_id,
          status: 'active',
          is_replacement: false,
          replaced_client_id: null
        });
      }

      await api.replaceWeekEvents({
        monday_date: targetMondayStr,
        events: newEvents
      });

      Alert.alert('Sukces', `Wygenerowano przyszły tydzień (wstawiono ${newEvents.length} treningów, pominięto ${skippedAbsences} absencji).`);
      setCurrentMonday(new Date(currentMonday.getTime() + 7 * 86400000));
    } catch (e) {
      Alert.alert('Błąd', `Wystąpił błąd podczas nadpisywania tygodnia: ${e.message}`);
    }
    setCopying(false);
    setCopying(false);
  }

  // Copy other events
  async function copyOtherToNextWeek() {
    const toCopy = otherEvents.filter((_, i) => otherSelected.has(i));
    if (toCopy.length === 0) {
      Alert.alert('Brak zaznaczonych', 'Zaznacz treningi do skopiowania.');
      return;
    }

    const warnings = [];
    for (const ev of toCopy) {
      const collision = checkNextWeekCollisionEvent(ev);
      if (collision.isAbsent && collision.hasReplacement) {
        warnings.push(`Trening odwołany przez klienta, a masz już zastępstwo (${collision.replacementClientName}) w tym terminie (${collision.targetDate} ${ev.event_hour}:00). Zostanie pominięty.`);
      }
    }

    if (warnings.length > 0) {
      Alert.alert(
        'Konflikty Absencji',
        warnings.join('\n\n') + '\n\nCzy chcesz kontynuować? Konfliktowe treningi nie zostaną skopiowane.',
        [
          { text: 'Anuluj', style: 'cancel' },
          { text: 'Kopiuj resztę', style: 'destructive', onPress: () => performOtherCopy(toCopy) }
        ]
      );
    } else {
      performOtherCopy(toCopy);
    }
  }

  async function performOtherCopy(toCopy) {
    setCopying(true);
    let copied = 0;
    const errors = [];

    for (const ev of toCopy) {
      try {
        const collision = checkNextWeekCollisionEvent(ev);
        if (collision.isAbsent && collision.hasReplacement) continue;
        const finalClientId = collision.targetClientId;
        const finalStatus = collision.isAbsent ? 'cancelled' : 'active';
        await api.createCalendarEvent({
          event_date: collision.targetDate,
          event_hour: ev.event_hour,
          client_id: finalClientId,
          workout_type_id: ev.workout_type_id,
          plan_id: ev.plan_id,
          status: finalStatus,
          is_replacement: false,
          replaced_client_id: null
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
      Alert.alert('Sukces', `Skopiowano ${copied} treningów na następny tydzień.`);
      setCurrentMonday(new Date(currentMonday.getTime() + 7 * 86400000));
    }
  }

  // Copy schedule items → next month (+28 days)
  async function copyScheduleToNextMonth() {
    const toCopy = activeScheduleItems.filter((_, i) => scheduleSelected.has(i));
    if (toCopy.length === 0) {
      Alert.alert('Brak zaznaczonych', 'Zaznacz treningi do skopiowania.');
      return;
    }
    const warnings = [];
    for (const item of toCopy) {
      const collision = checkNextMonthCollisionSchedule(item);
      if (collision.isAbsent && collision.hasReplacement) {
        warnings.push(`Trening odwołany, a masz już zastępstwo (${collision.replacementClientName}) w terminie (${collision.targetDate} ${item.eventHour}:00).`);
      }
    }
    if (warnings.length > 0) {
      Alert.alert('Konflikty Absencji', warnings.join('\n\n') + '\n\nKontynuować? Konfliktowe treningi zostaną pominięte.', [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Kopiuj resztę', style: 'destructive', onPress: () => performScheduleCopyMonth(toCopy) }
      ]);
    } else {
      performScheduleCopyMonth(toCopy);
    }
  }

  async function performScheduleCopyMonth(toCopy) {
    setCopying(true);
    try {
      const nextMonthDate = new Date(currentMonday);
      nextMonthDate.setDate(nextMonthDate.getDate() + 28);
      const targetMonthStr = formatDateString(nextMonthDate);

      const newEvents = [];
      let skippedAbsences = 0;

      for (const item of toCopy) {
        const collision = checkNextMonthCollisionSchedule(item);
        if (collision.isAbsent) {
          skippedAbsences++;
          continue;
        }
        
        newEvents.push({
          event_date: collision.targetDate,
          event_hour: item.eventHour,
          client_id: item.clientId,
          workout_type_id: item.workout_type_id,
          plan_id: item.plan_id,
          status: 'active',
          is_replacement: false,
          replaced_client_id: null
        });
      }

      await api.replaceWeekEvents({
        monday_date: targetMonthStr,
        events: newEvents
      });

      Alert.alert('Sukces', `Wygenerowano przyszły miesiąc (wstawiono ${newEvents.length} treningów, pominięto ${skippedAbsences} absencji).`);
      setCurrentMonday(new Date(currentMonday.getTime() + 28 * 86400000));
    } catch (e) {
      Alert.alert('Błąd', `Wystąpił błąd podczas nadpisywania tygodnia w przyszłym miesiącu: ${e.message}`);
    }
    setCopying(false);
  }

  async function copyOtherToNextMonth() {
    const toCopy = otherEvents.filter((_, i) => otherSelected.has(i));
    if (toCopy.length === 0) {
      Alert.alert('Brak zaznaczonych', 'Zaznacz treningi do skopiowania.');
      return;
    }
    const warnings = [];
    for (const ev of toCopy) {
      const collision = checkNextMonthCollisionEvent(ev);
      if (collision.isAbsent && collision.hasReplacement) {
        warnings.push(`Trening odwołany, a masz już zastępstwo (${collision.replacementClientName}) w terminie (${collision.targetDate} ${ev.event_hour}:00).`);
      }
    }
    if (warnings.length > 0) {
      Alert.alert('Konflikty Absencji', warnings.join('\n\n') + '\n\nKontynuować? Konfliktowe treningi zostaną pominięte.', [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Kopiuj resztę', style: 'destructive', onPress: () => performOtherCopyMonth(toCopy) }
      ]);
    } else {
      performOtherCopyMonth(toCopy);
    }
  }

  async function performOtherCopyMonth(toCopy) {
    setCopying(true); let copied = 0; const errors = [];
    for (const ev of toCopy) {
      try {
        const collision = checkNextMonthCollisionEvent(ev);
        if (collision.isAbsent && collision.hasReplacement) continue;
        const finalStatus = collision.isAbsent ? 'cancelled' : 'active';
        await api.createCalendarEvent({
          event_date: collision.targetDate, event_hour: ev.event_hour,
          client_id: collision.targetClientId, workout_type_id: ev.workout_type_id,
          plan_id: ev.plan_id, status: finalStatus, is_replacement: false, replaced_client_id: null
        });
        copied++;
      } catch (e) { errors.push(e.message); }
    }
    setCopying(false);
    if (errors.length > 0) {
      Alert.alert('Błędy', `Skopiowano ${copied}, nieudane: ${errors.length}\n${errors.slice(0, 3).join('\n')}`);
    } else {
      Alert.alert('Sukces', `Skopiowano ${copied} treningów na następny miesiąc.`);
      setCurrentMonday(new Date(currentMonday.getTime() + 28 * 86400000));
    }
  }

  function getClientName(clientId) {
    const ev = events.find(e => e.client_id === clientId);
    return ev?.clients?.name || null;
  }

  function handleClearWeek() {
    setShowClearModal(true);
  }

  async function performClearWeek() {
    setShowClearModal(false);
    setCopying(true);
    try {
      const targetMondayStr = formatDateString(currentMonday);
      const newEvents = [];
      
      // Aby treningi z harmonogramu (szablony) zniknęły i się nie odtwarzały, 
      // musimy wstawić dla nich rekordy ze statusem 'deleted'.
      for (const item of scheduleItems) {
        newEvents.push({
          event_date: item.eventDate,
          event_hour: item.eventHour,
          client_id: item.clientId,
          workout_type_id: item.workout_type_id,
          plan_id: item.plan_id,
          status: 'deleted',
          is_replacement: false,
          replaced_client_id: null
        });
      }

      await api.replaceWeekEvents({
        monday_date: targetMondayStr,
        events: newEvents
      });

      Alert.alert('Sukces', 'Tydzień został całkowicie wyczyszczony.');
      loadData();
    } catch (e) {
      Alert.alert('Błąd', 'Nie udało się wyczyścić tygodnia: ' + e.message);
    }
    setCopying(false);
  }

  const weekLabel = currentMonday.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  const satLabel = new Date(currentMonday.getTime() + 5 * 86400000).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  const todayMonday = getMonday(new Date());
  const isCurrentWeek = currentMonday.getTime() === todayMonday.getTime();
  const headerDate = isCurrentWeek
    ? new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })
    : currentMonday.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <AppLayout navigation={navigation} title="Menadżer" showBack>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Aktualny tydzień</Text>
        <View style={styles.weekRow}>
          <TouchableOpacity onPress={() => setCurrentMonday(new Date(currentMonday.getTime() - 7 * 86400000))}>
            <Ionicons name="chevron-back" size={22} color={C.accent} />
          </TouchableOpacity>
          <Text style={styles.weekText}>{headerDate}</Text>
          <TouchableOpacity onPress={() => setCurrentMonday(new Date(currentMonday.getTime() + 7 * 86400000))}>
            <Ionicons name="chevron-forward" size={22} color={C.accent} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.clearWeekBtn, copying && { opacity: 0.5 }]} 
          onPress={handleClearWeek}
          disabled={copying || loading}
        >
          <Ionicons name="trash-outline" size={18} color={themeColors.danger} />
          <Text style={[styles.clearWeekBtnText, { color: themeColors.danger }]}>Wyczyść ten tydzień</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* === SECTION 1: Treningi z Harmonogramu === */}
            <View>
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Treningi z Harmonogramu</Text>
              <View style={styles.selectBar}>
                <Text style={styles.summary}>{activeScheduleItems.length} treningów</Text>
                <TouchableOpacity onPress={() => selectAll(activeScheduleItems, true)} style={styles.selectAllBtn} disabled={loading}>
                  <Text style={[styles.selectAllText, { color: C.accent }]}>
                    {scheduleSelected.size === activeScheduleItems.length && activeScheduleItems.length > 0 ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
                  </Text>
                </TouchableOpacity>
              </View>

              {activeScheduleItems.map((item, i) => {
                const collision = checkNextWeekCollisionSchedule(item);
                const sel = scheduleSelected.has(i);
                const clientName = getClientName(item.clientId) || item.clientName;
                const isAbsent = item.status === 'absent';
                const isCancelled = item.status === 'cancelled';

                return (
                  <TouchableOpacity key={i} style={[
                    styles.eventRow,
                    sel && { borderColor: C.accent, backgroundColor: C.accent + '10' },
                    isAbsent && { borderColor: themeColors.textMuted + '80', backgroundColor: themeColors.textMuted + '10' },
                    isCancelled && { borderColor: themeColors.danger + '80', backgroundColor: themeColors.danger + '10' },
                    collision.isAbsent && { borderColor: themeColors.danger + '80', backgroundColor: themeColors.danger + '10' }
                  ]} onPress={() => toggleSelect(i, true)}>
                    <View style={[styles.check, sel && { backgroundColor: C.accent, borderColor: C.accent }]}>
                      {sel && <Ionicons name="checkmark" size={14} color={themeColors.background} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.eventDate}>
                        {new Date(item.eventDate).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })} {item.eventHour}:00
                      </Text>
                      <Text style={[styles.eventClient, isAbsent && { color: themeColors.textMuted, textDecorationLine: 'line-through' }, isCancelled && { color: themeColors.danger, textDecorationLine: 'line-through' }]} numberOfLines={1}>
                        {clientName}
                        {isAbsent ? ' (TRENING USUNIĘTY)' : isCancelled ? ' (ODWOŁANY)' : ''}
                      </Text>
                      {isAbsent && (
                        <Text style={{ color: themeColors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                          Klient zgłosił absencję — trening usunięty
                        </Text>
                      )}
                      {collision.isAbsent && (
                        <Text style={{ color: themeColors.danger, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                          Następny tydzień: {collision.hasReplacement ? 'ODWOŁANY (MASZ ZASTĘPSTWO)' : 'ODWOŁANY PRZEZ KLIENTA'}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {activeScheduleItems.length === 0 && (
                <Text style={styles.empty}>Brak klientów z harmonogramem</Text>
              )}

              <TouchableOpacity
                style={[styles.copyBtn, { backgroundColor: C.accent }, copying && { opacity: 0.5 }]}
                onPress={copyScheduleToNextWeek}
                disabled={copying || scheduleSelected.size === 0 || loading}
              >
                {copying ? (
                  <ActivityIndicator color={themeColors.background} size="small" />
                ) : (
                  <Ionicons name="copy-outline" size={20} color={themeColors.background} />
                )}
                <Text style={styles.copyBtnText}>
                  {copying ? 'Kopiowanie...' : `Kopiuj zaznaczone (${scheduleSelected.size}) na następny tydzień`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.copyBtn, { backgroundColor: C.accent + 'cc', marginTop: 8 }, copying && { opacity: 0.5 }]}
                onPress={copyScheduleToNextMonth}
                disabled={copying || scheduleSelected.size === 0 || loading}
              >
                <Ionicons name="calendar-outline" size={20} color={themeColors.background} />
                <Text style={styles.copyBtnText}>
                  Kopiuj zaznaczone ({(scheduleSelected.size)}) na następny miesiąc
                </Text>
              </TouchableOpacity>
            </View>

            {/* === SECTION 2: Pozostałe Treningi === */}
            <View>
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Pozostałe Treningi</Text>
              <View style={styles.selectBar}>
                <Text style={styles.summary}>{otherEvents.length} treningów</Text>
                <TouchableOpacity onPress={() => selectAll(otherEvents, false)} style={styles.selectAllBtn} disabled={loading}>
                  <Text style={[styles.selectAllText, { color: C.accent }]}>
                    {otherSelected.size === otherEvents.length && otherEvents.length > 0 ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
                  </Text>
                </TouchableOpacity>
              </View>

              {otherEvents.map((ev, i) => {
                const collision = checkNextWeekCollisionEvent(ev);
                const isReplacement = ev.is_replacement && ev.replaced_client_id;
                const replacedName = isReplacement ? (clientNames[ev.replaced_client_id] || '—') : null;
                const sel = otherSelected.has(i);

                return (
                  <TouchableOpacity key={i} style={[
                    styles.eventRow,
                    sel && { borderColor: C.accent, backgroundColor: C.accent + '10' },
                    collision.isAbsent && { borderColor: themeColors.danger + '80', backgroundColor: themeColors.danger + '10' }
                  ]} onPress={() => toggleSelect(i, false)}>
                    <View style={[styles.check, sel && { backgroundColor: C.accent, borderColor: C.accent }]}>
                      {sel && <Ionicons name="checkmark" size={14} color={themeColors.background} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={styles.eventDate}>
                          {new Date(ev.event_date).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })} {ev.event_hour}:00
                        </Text>
                        {isReplacement && (
                          <View style={{ backgroundColor: C.accent + '30', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ color: C.accent, fontSize: 10, fontWeight: '700' }}>
                              ZASTĘPSTWO ZA {replacedName.toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.eventClient, collision.isAbsent && { color: themeColors.danger }]} numberOfLines={1}>
                        {ev.clients?.name || '—'}
                      </Text>
                      {collision.isAbsent && (
                        <Text style={{ color: themeColors.danger, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                          Następny tydzień: {collision.hasReplacement ? 'ODWOŁANY (MASZ ZASTĘPSTWO)' : 'ODWOŁANY PRZEZ KLIENTA'}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {otherEvents.length === 0 && (
                <Text style={styles.empty}>Brak pozostałych treningów</Text>
              )}

              <TouchableOpacity
                style={[styles.copyBtn, { backgroundColor: C.accent }, copying && { opacity: 0.5 }]}
                onPress={copyOtherToNextWeek}
                disabled={copying || otherSelected.size === 0 || loading}
              >
                {copying ? (
                  <ActivityIndicator color={themeColors.background} size="small" />
                ) : (
                  <Ionicons name="copy-outline" size={20} color={themeColors.background} />
                )}
                <Text style={styles.copyBtnText}>
                  {copying ? 'Kopiowanie...' : `Kopiuj zaznaczone (${otherSelected.size}) na następny tydzień`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.copyBtn, { backgroundColor: C.accent + 'cc', marginTop: 8 }, copying && { opacity: 0.5 }]}
                onPress={copyOtherToNextMonth}
                disabled={copying || otherSelected.size === 0 || loading}
              >
                <Ionicons name="calendar-outline" size={20} color={themeColors.background} />
                <Text style={styles.copyBtnText}>
                  Kopiuj zaznaczone ({(otherSelected.size)}) na następny miesiąc
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {!loading && events.length === 0 && scheduleItems.length === 0 && (
          <Text style={styles.empty}>Brak treningów w tym tygodniu</Text>
        )}
      </ScrollView>

      <Modal
        animationType="fade"
        transparent={true}
        visible={showClearModal}
        onRequestClose={() => setShowClearModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: themeColors.surface, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: themeColors.text }}>Czyszczenie tygodnia</Text>
              <TouchableOpacity onPress={() => setShowClearModal(false)}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={{ fontSize: 15, color: themeColors.textSecondary, marginBottom: 24, lineHeight: 22 }}>
              Czy na pewno chcesz bezpowrotnie usunąć WSZYSTKIE treningi z tygodnia od <Text style={{ fontWeight: '700', color: themeColors.text }}>{formatDateString(currentMonday)}</Text>?
            </Text>
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity 
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: themeColors.border, alignItems: 'center' }} 
                onPress={() => setShowClearModal(false)}
              >
                <Text style={{ color: themeColors.text, fontWeight: '600', fontSize: 15 }}>Anuluj</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: themeColors.danger, alignItems: 'center' }} 
                onPress={performClearWeek}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Usuń wszystko</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AppLayout>
  );
}

function makeStyles(C, TC) { return StyleSheet.create({
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: 100 },
  sectionTitle: { color: C.accent, fontSize: 14, fontWeight: '700', marginTop: SPACING.md, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  weekRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 8 },
  weekText: { color: TC.text, fontSize: 16, fontWeight: '700' },
  selectBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  summary: { color: TC.textSecondary, fontSize: 13 },
  selectAllBtn: { padding: 4 },
  selectAllText: { fontSize: 12, fontWeight: '600' },
  eventRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12,
    backgroundColor: TC.surface, borderRadius: 10, marginBottom: 6,
    borderWidth: 1, borderColor: TC.border, gap: 12,
  },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: TC.textMuted, justifyContent: 'center', alignItems: 'center' },
  eventDate: { color: TC.textSecondary, fontSize: 12, fontWeight: '600' },
  eventClient: { color: TC.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
  empty: { color: TC.textMuted, textAlign: 'center', marginTop: 32, fontSize: 14 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, padding: 16, marginTop: 24 },
  copyBtnText: { color: TC.background, fontWeight: '700', fontSize: 14 },
  clearWeekBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: TC.danger + '40', backgroundColor: TC.danger + '10' },
  clearWeekBtnText: { fontSize: 13, fontWeight: '700' },
}); }
