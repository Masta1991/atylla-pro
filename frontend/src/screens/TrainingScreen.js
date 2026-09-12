import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../assets/theme';
import { useTheme } from '../context/ThemeContext';
import AppLayout from '../components/AppLayout';
import * as api from '../services/api';
import { showMessage, showError } from '../services/confirm';

export default function TrainingScreen({ navigation, route }) {
  const { colors: C, themeColors } = useTheme();
  const styles = useMemo(() => makeStyles(C.accent, themeColors), [C.accent, themeColors]);
  const { date: passedDate, hour, replaceClientId } = route.params || {};
  const originalDate = passedDate || '';
  const originalHour = hour != null ? String(hour) : '';

  const passedHourMatches = (ev, h) => {
    if (!ev) return false;
    const evHour = ev.event_hour != null ? String(ev.event_hour) : '';
    const hStr = h != null ? String(h) : '';
    return ev.event_date === passedDate && evHour === hStr;
  };

  const [clients, setClients] = useState([]);
  const [plans, setPlans] = useState([]);
  const [muscleGroups, setMuscleGroups] = useState([]);
  const [exercisesByGroup, setExercisesByGroup] = useState({});
  const [loading, setLoading] = useState(true);

  const [selectedClient, setSelectedClient] = useState('');
  const [partnerClient, setPartnerClient] = useState('');
  const [selectedDate, setSelectedDate] = useState(passedDate || (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })());
  const [selectedHour, setSelectedHour] = useState(hour?.toString() || '');
  const [selectedType, setSelectedType] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedMainGroup, setSelectedMainGroup] = useState('');
  const [addedParts, setAddedParts] = useState([]);
  const [exerciseWeights, setExerciseWeights] = useState({});
  const [note, setNote] = useState('');
  const [dictating, setDictating] = useState(false);
  const [recognition, setRecognition] = useState(null);
  // 2.0: brak stanu rozliczenia — paid (is_settled) tylko z zaladowanego eventu.
  const [isReadyToSave, setIsReadyToSave] = useState(false);
  // Event zaladowany na wejscie (do blokady zmiany daty startu pakietu).
  const [loadedEvent, setLoadedEvent] = useState(null);
  const skipNextAutosaveRef = useRef(false);
  // T8: klucze stanu ćwiczeń po ID (nazwy z '_' łamały split) — separator
  // nielegalny w nazwach/ID. Stare klucze part_name nie występują (stan świeży).
  const exKey = (part, exId) => `${part}|||${exId}`;
  const parseExKey = (key) => {
    const i = String(key).lastIndexOf('|||');
    if (i < 0) return null;
    return { part: String(key).slice(0, i), exId: String(key).slice(i + 3) };
  };
  const findExerciseById = (groups, exId) => {
    for (const [part, list] of Object.entries(groups || {})) {
      const ex = (list || []).find(e => String(e.id) === String(exId));
      if (ex) return { part, ex };
    }
    return null;
  };
  // T7: mutex zapisów — autosave nie wchodzi w trakcie ręcznego zapisu i odwrotnie.
  const isSavingRef = useRef(false);
  const [supersetMode, setSupersetMode] = useState({});
  const [supersetSelection, setSupersetSelection] = useState({});

  async function loadClientWorkoutLogs(clientId, dateStr, groupedExercises) {
    if (!clientId || !dateStr) return;
    try {
      const logs = await api.getClientWorkouts(clientId, dateStr);
      mapLogsToState(logs, groupedExercises);
    } catch (e) {
      console.error('Error loading workout logs:', e);
    }
  }

  // Czyste mapowanie logow na stan (bez fetch) — do rownoleglego init().
  function mapLogsToState(logs, groupedExercises) {
    if (logs && logs.length > 0) {
      const newWeights = {};
      const newAddedParts = [];

      logs.forEach(log => {
        let foundPart = null;
        let foundExName = null;
        // Sort entries: plan-based parts ("Plan: ...") first, so plan exercises take priority over muscle group duplicates
        const sortedEntries = Object.entries(groupedExercises || {}).sort(([a], [b]) => {
          const aPlan = a.startsWith('Plan: ') ? 0 : 1;
          const bPlan = b.startsWith('Plan: ') ? 0 : 1;
          return aPlan - bPlan;
        });
        for (const [part, list] of sortedEntries) {
          const ex = list.find(e => e.id === log.exercise_id);
          if (ex) {
            foundPart = part;
            foundExName = ex.name;
            break;
          }
        }
        if (foundPart && foundExName) {
          const key = exKey(foundPart, log.exercise_id);
          newWeights[key] = {
            weight: log.weight_kg !== null ? log.weight_kg.toString() : '0',
            reps: log.reps !== null ? log.reps.toString() : '',
          };
          if (!newAddedParts.includes(foundPart)) {
            newAddedParts.push(foundPart);
          }
        }
      });

      setExerciseWeights(newWeights);
      if (newAddedParts.length > 0) {
        setSelectedMainGroup(current => current || newAddedParts[0] || '');
        setAddedParts(current => {
          if (current && current.length > 0) return current;
          const main = newAddedParts[0];
          return newAddedParts.filter(p => p !== main);
        });
      }
    } else {
      setExerciseWeights({});
    }
  }

  const handleClientChange = (val) => {
    setIsReadyToSave(false);
    setSelectedClient(val);
    const cl = clients.find(c => c.id === val);
    if (cl?.default_workout_type_id) {
      setSelectedType(cl.default_workout_type_id);
    }
    if (cl?.default_plan_id) {
      setSelectedPlan(cl.default_plan_id);
    }
    loadClientWorkoutLogs(val, selectedDate, exercisesByGroup).finally(() => setIsReadyToSave(true));
  };

  const handleDateChange = (val) => {
    setIsReadyToSave(false);
    setSelectedDate(val);
    loadClientWorkoutLogs(selectedClient, val, exercisesByGroup).finally(() => setIsReadyToSave(true));
  };

  const handlePlanChange = (val) => {
    setIsReadyToSave(false);
    setSelectedPlan(val);
    if (val) {
      loadPlanExercises(val);
    }
    setTimeout(() => setIsReadyToSave(true), 100);
  };

  const handleMainGroupChange = (val) => {
    setIsReadyToSave(false);
    setSelectedMainGroup(val);
    if (val && !addedParts.includes(val)) {
      setAddedParts(prev => [...prev, val]);
    }
    setTimeout(() => setIsReadyToSave(true), 100);
  };

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const { ev: passedEv } = route.params || {};
      const [cl, wt, mg, ex] = await Promise.all([
        api.getClients().catch(() => []),
        api.getPlans().catch(() => []),
        api.getMuscleGroups().catch(() => []),
        api.getExercisesGrouped().catch(() => ({})),
      ]);
      if (cancelled) return;

      setClients(cl || []);
      setPlans(wt || []);
      setMuscleGroups(mg || []);
      setExercisesByGroup(ex || {});

      const finalCl = cl || [];
      const finalEx = ex || {};

      const { client: pClient } = route.params || {};
      let activeClient = pClient || '';
      let activeType = '';
      let activePlan = '';

      // Fast path: slot z kalendarza ma już cały event (prefetch przy szufladzie).
      let existingEvent = passedEv && passedDate && passedHourMatches(passedEv, hour) ? passedEv : null;
      if (passedDate && hour && !existingEvent) {
        try {
          existingEvent = await api.getCalendarEvent(passedDate, parseInt(hour));
        } catch (err) {
          console.log('No existing calendar event:', err.message);
        }
      }
      if (existingEvent) {
        activeClient = existingEvent.client_id || '';
        activeType = existingEvent.workout_type_id || '';
        activePlan = existingEvent.plan_id || '';
        if (!cancelled) setLoadedEvent(existingEvent);
        // 2.0: flaga paid zostaje na evencie (do zachowania przy zapisie).
        setPartnerClient(existingEvent.partner_client_id || '');
        if (existingEvent.note) setNote(existingEvent.note);
        if (existingEvent.main_group) setSelectedMainGroup(existingEvent.main_group);
        if (existingEvent.added_groups) setAddedParts(existingEvent.added_groups);
      }

      if (activeClient) {
        setSelectedClient(activeClient);
        if (activeType) {
          setSelectedType(activeType);
        } else {
          const clObj = (finalCl || []).find(c => c.id === activeClient);
          if (clObj?.default_workout_type_id) setSelectedType(clObj.default_workout_type_id);
        }
        if (activePlan) {
          setSelectedPlan(activePlan);
        } else {
          const clObj = (finalCl || []).find(c => c.id === activeClient);
          if (clObj?.default_plan_id) setSelectedPlan(clObj.default_plan_id);
        }
      }

      // Render natychmiast z tego co mamy (słowniki + event), resztę w tle.
      if (!cancelled) setLoading(false);

      // Plan i logi rownolegle (wczesniej wodospad: plan -> logi = 2x RTT po sobie).
      const planObj = activePlan ? (wt || []).find(p => p.id === activePlan) : null;
      const [planExList, logsRaw] = await Promise.all([
        planObj ? api.getPlanExercises(activePlan).catch(() => []) : Promise.resolve(null),
        activeClient ? api.getClientWorkouts(activeClient, passedDate || selectedDate).catch(() => []) : Promise.resolve(null),
      ]);
      if (cancelled) return;

      // If this training has a plan, load its exercises into exercisesByGroup
      let loadedExByGroup = finalEx;
      if (planObj && planExList) {
        const planPartName = `Plan: ${planObj.name}`;
        const mapped = (planExList || []).map(pe => ({
          id: pe.exercise_id,
          name: pe.exercises?.name || 'Nieznane',
          unit: pe.exercises?.unit || 'KG',
          superset_id: pe.superset_id || null
        }));
        loadedExByGroup = { ...finalEx, [planPartName]: mapped };
        setExercisesByGroup(loadedExByGroup);
        setAddedParts(prev => prev.includes(planPartName) ? prev : [...prev, planPartName]);
      }

      if (activeClient) {
        skipNextAutosaveRef.current = true;
        mapLogsToState(logsRaw, loadedExByGroup);
        if (!cancelled) setIsReadyToSave(true);
      } else {
        skipNextAutosaveRef.current = true;
        setIsReadyToSave(true);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const removePart = (partName) => {
    if (partName === selectedMainGroup) {
      setSelectedMainGroup('');
    } else {
      setAddedParts(prev => prev.filter(p => p !== partName));
    }
    setExerciseWeights(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(key => {
        if (key.startsWith(`${partName}_`)) {
          delete copy[key];
        }
      });
      return copy;
    });
  };


  const loadPlanExercises = async (planId) => {
    try {
      const plan = plans.find(p => p.id === planId);
      if (!plan) return;
      const exList = await api.getPlanExercises(planId);
      const planPartName = `Plan: ${plan.name}`;
      
      const mappedExList = exList.map(pe => ({
        id: pe.exercise_id,
        name: pe.exercises?.name || 'Nieznane',
        unit: pe.exercises?.unit || 'KG',
        superset_id: pe.superset_id || null
      }));
      
      setExercisesByGroup(prev => ({
        ...prev,
        [planPartName]: mappedExList
      }));
      
      if (!addedParts.includes(planPartName)) {
        setAddedParts(prev => [...prev, planPartName]);
      }
    } catch (e) {
      Alert.alert('Błąd', 'Nie udało się wczytać ćwiczeń dla planu.');
    }
  };



  async function moveExerciseInDict(part, index, direction) {
    const exs = exercisesByGroup[part] || [];
    if ((direction === -1 && index === 0) || (direction === 1 && index === exs.length - 1)) return;
    
    const newExs = [...exs];
    const temp = newExs[index];
    newExs[index] = newExs[index + direction];
    newExs[index + direction] = temp;
    
    setExercisesByGroup(prev => ({ ...prev, [part]: newExs }));
    try {
      await Promise.all(
        newExs.map((ex, idx) => api.updateExercise(ex.id, { sort_order: idx }))
      );
    } catch(e) { console.log(e); }
  }

  const handleToggleSupersetMode = (part) => {
    setSupersetMode(prev => {
      const isCurrentlyActive = prev[part];
      if (isCurrentlyActive) {
        const selection = supersetSelection[part] || [];
        if (selection.length > 0) {
          setExercisesByGroup(prevGroup => {
            const copy = [...(prevGroup[part] || [])];
            const firstId = copy[selection[0]].superset_id;
            const allShareSame = firstId && selection.every(i => copy[i].superset_id === firstId);

            if (allShareSame) {
              for(let i of selection) {
                copy[i].superset_id = null;
              }
              return { ...prevGroup, [part]: copy };
            } else {
              let sid = generateUUID();
              for(let i of selection) {
                 copy[i].superset_id = sid;
              }
              const sortedIndices = [...selection].sort((a,b) => a-b);
              const extracted = sortedIndices.map(i => copy[i]);
              const remaining = copy.filter((_, idx) => !selection.includes(idx));
              remaining.splice(sortedIndices[0], 0, ...extracted);
              return { ...prevGroup, [part]: remaining };
            }
          });
        }
        setSupersetSelection(s => ({ ...s, [part]: [] }));
        return { ...prev, [part]: false };
      } else {
        setSupersetSelection(s => ({ ...s, [part]: [] }));
        return { ...prev, [part]: true };
      }
    });
  };

  const handleSelectForSuperset = (part, exIdx) => {
    setSupersetSelection(prev => {
      const sel = prev[part] || [];
      if (sel.includes(exIdx)) {
        return { ...prev, [part]: sel.filter(i => i !== exIdx) };
      } else {
        return { ...prev, [part]: [...sel, exIdx] };
      }
    });
  };

  const toggleExercise = (part, exId) => {
    const key = exKey(part, exId);
    setExerciseWeights(prev => {
      const copy = { ...prev };
      if (copy[key]) {
        delete copy[key];
      } else {
        copy[key] = { weight: '0', reps: '0' };
      }
      return copy;
    });
  };

  const changeWeight = (part, exId, diff) => {
    const key = exKey(part, exId);
    setExerciseWeights(prev => {
      const current = prev[key] || { weight: '0', reps: '0' };
      let w = parseFloat(current.weight) || 0;
      w = Math.max(0, w + diff);
      return {
        ...prev,
        [key]: { ...current, weight: w.toString() },
      };
    });
  };

  const updateWeight = (part, exId, field, val) => {
    const key = exKey(part, exId);
    setExerciseWeights(prev => {
      const current = prev[key] || { weight: '0', reps: '0' };
      return {
        ...prev,
        [key]: { ...current, [field]: val },
      };
    });
  };

  // T8: wspólne budowanie listy ćwiczeń z kluczy ID — bez dzielenia nazw.
  // Nierozpoznany wpis BLOKUJE zapis (zwraca unknown>0), nigdy nie znika po cichu.
  const buildExercisesFromState = () => {
    const exercises = [];
    let unknown = 0;
    Object.entries(exerciseWeights).forEach(([key, val]) => {
      const parsed = parseExKey(key);
      const hit = parsed ? findExerciseById(exercisesByGroup, parsed.exId) : null;
      if (hit) {
        exercises.push({
          exercise_id: hit.ex.id,
          weight_kg: parseFloat(val.weight) || 0,
          reps: parseInt(val.reps) || 0,
        });
      } else {
        unknown += 1;
      }
    });
    return { exercises, unknown };
  };

  const toggleDictation = () => {
    if (dictating) {
      try {
        recognition?.stop();
      } catch (err) {
        console.log('Stop error:', err);
      }
      setDictating(false);
      return;
    }
    if (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
      try {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        const rec = new SR();
        rec.lang = 'pl-PL';
        rec.interimResults = false;
        rec.continuous = false;
        rec.onresult = (e) => {
          try {
            if (e.results && e.results[0] && e.results[0][0]) {
              const transcript = e.results[0][0].transcript;
              setNote(prev => (prev ? prev + ' ' : '') + transcript);
            }
          } catch (err) {
            console.log('Parse error:', err);
          }
          setDictating(false);
        };
        rec.onerror = (e) => {
          console.log('Speech error:', e.error);
          setDictating(false);
        };
        rec.onend = () => setDictating(false);
        rec.start();
        setRecognition(rec);
        setDictating(true);
      } catch (err) {
        console.log('Start error:', err);
        Alert.alert('Błąd', 'Nie można uruchomić mikrofonu. Sprawdź uprawnienia.');
        setDictating(false);
      }
    } else {
      Alert.alert('Niedostępne', 'Dyktowanie nie jest wspierane w tej przeglądarce. Użyj Chrome.');
    }
  };

  // 2.0: brak recznego rozliczania (handleSettle usuniety) — treningi licza
  // sie pozycyjnie; is_settled znaczy wylacznie "oplacone" przy odwolanym.

  async function handleSave() {
    if (!selectedClient) {
      Alert.alert('Błąd', 'Wybierz podopiecznego.');
      return;
    }
    // Startu pakietu nie przenosimy z ekranu Treningu (DELETE+CREATE gubilby
    // kotwice pakietu). Do przenoszenia sluzy przycisk Przenies w kalendarzu.
    if (loadedEvent?.is_start_of_package && originalDate && originalHour
        && (originalDate !== selectedDate || originalHour !== String(selectedHour))) {
      Alert.alert(
        'Punkt Startowy 🐶',
        'Ten trening rozpoczyna pakiet. Daty startu nie zmienisz tutaj — użyj przycisku Przenieś w kalendarzu albo wskaż nowy start w Rozliczeniach.'
      );
      return;
    }

    const payload = {
      client_id: selectedClient,
      partner_client_id: partnerClient || null,
      workout_type_id: selectedType || null,
      plan_id: selectedPlan || null,
      event_date: selectedDate,
      event_hour: parseInt(selectedHour) || 12,
      note: note,
      // 2.0: paid zachowane z treningu (odwolany-oplacony), nowe zawsze false.
      is_settled: !!loadedEvent?.is_settled,
      main_group: selectedMainGroup,
      added_groups: addedParts,
      exercises: [],
      is_replacement: !!replaceClientId,
      replaced_client_id: replaceClientId || null,
    };

    // T8: nierozpoznane ćwiczenie blokuje zapis (nie czyści logów pustym batchem).
    const built = buildExercisesFromState();
    if (built.unknown > 0) {
      Alert.alert(
        'Błąd',
        'Nie rozpoznano części ćwiczeń — zapis zablokowany, aby nie usunąć danych. Odśwież słowniki i spróbuj ponownie.'
      );
      return;
    }
    // Pusty trening (nie wybrano ćwiczeń — np. pusta Główna partia): po polsku,
    // bez wołania backendu. Czyszczenie dnia robi się przyciskiem Usuń.
    if (built.exercises.length === 0) {
      showMessage(
        'Pusty trening',
        'Nie zaznaczono żadnych ćwiczeń — wybierz Główną partię i zaznacz ćwiczenia, potem zapisz.'
      );
      return;
    }
    payload.exercises = built.exercises;

    if (isSavingRef.current) return;
    isSavingRef.current = true;
    try {
      // If date or hour changed, remove the old calendar entry
      if (originalDate && originalHour && (originalDate !== selectedDate || originalHour !== selectedHour)) {
        try {
          await api.deleteCalendarEvent(originalDate, parseInt(originalHour, 10));
        } catch (e) {
          Alert.alert('Błąd', 'Nie udało się przenieść treningu: ' + e.message);
          return;
        }
      }
      await api.saveCalendarWorkout(payload);
      showMessage('Sukces', 'Trening został zapisany.');
      navigation.goBack();
    } catch (e) {
      showError(e.message);
    } finally {
      isSavingRef.current = false;
    }
  }

  // Real-time autosave
  useEffect(() => {
    if (!isReadyToSave || !selectedClient) return;


    const performAutoSave = async () => {
      const payload = {
        client_id: selectedClient,
        partner_client_id: partnerClient || null,
        workout_type_id: selectedType || null,
        plan_id: selectedPlan || null,
        event_date: selectedDate,
        event_hour: parseInt(selectedHour) || 12,
        note: note,
        // 2.0: paid zachowane z treningu, nowe zawsze false.
        is_settled: !!loadedEvent?.is_settled,
        main_group: selectedMainGroup,
        added_groups: addedParts,
        exercises: [],
        is_replacement: !!replaceClientId,
        replaced_client_id: replaceClientId || null,
      };


      // T8: autosave nigdy nie wysyła pustego/niekompletnego batcha (nie czyści logów).
      const built = buildExercisesFromState();
      if (built.unknown > 0) {
        if (__DEV__) console.error('Autosave skipped: unknown exercises.');
        return;
      }
      if (Object.keys(exerciseWeights).length > 0 && built.exercises.length === 0) {
        if (__DEV__) console.error('Autosave skipped: empty exercise payload.');
        return;
      }
      payload.exercises = built.exercises;

      // Start pakietu: autosave nie rusza daty (jak handleSave — tylko Przenies).
      const startMoved = loadedEvent?.is_start_of_package && originalDate && originalHour
        && (originalDate !== selectedDate || originalHour !== String(selectedHour));
      if (isSavingRef.current) return;
      isSavingRef.current = true;
      try {
        // If date or hour changed, remove the old calendar entry
        if (!startMoved && originalDate && originalHour && (originalDate !== selectedDate || originalHour !== selectedHour)) {
          try {
            await api.deleteCalendarEvent(originalDate, parseInt(originalHour, 10));
          } catch (e) {
            if (__DEV__) console.error('Autosave move failed:', e.message);
            return;
          }
        }
        if (!startMoved) {
          await api.saveCalendarWorkout(payload);
        }
        if (__DEV__) console.log('Real-time workout autosave successful.');
      } catch (err) {
        if (__DEV__) console.error('Real-time workout autosave error:', err.message);
      } finally {
        isSavingRef.current = false;
      }
    };

    const timer = setTimeout(() => {
      if (skipNextAutosaveRef.current) {
        skipNextAutosaveRef.current = false;
        return;
      }
      performAutoSave();
    }, 1200);

    return () => clearTimeout(timer);
  }, [
    selectedClient,
    selectedDate,
    selectedHour,
    selectedType,
    selectedPlan,
    selectedMainGroup,
    addedParts,
    exerciseWeights,
    note,
    isReadyToSave,
    exercisesByGroup
  ]);

  if (loading) {
    return <AppLayout navigation={navigation} title="Rejestracja treningu" showBack><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={C.accent} /></View></AppLayout>;
  }

  const allParts = [...new Set([selectedMainGroup, ...addedParts].filter(Boolean))];

  return (
    <AppLayout navigation={navigation} title="Rejestracja treningu" showBack>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Client & Date & Hour in one row */}
        <View style={{ flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' }}>
          <View style={{ flex: 2 }}>
            <Text style={styles.label}>Podopieczny</Text>
            <DropdownPicker
              placeholder="Wybierz"
              selectedValue={selectedClient}
              onValueChange={handleClientChange}
              style={styles.pickerWrap}
              dropdownIconColor={themeColors.textSecondary}
              items={[
                { label: "Wybierz", value: "", color: themeColors.textMuted },
                ...clients.map(c => ({ label: c.name, value: c.id, color: themeColors.text }))
              ]}
            />
          </View>
          <View style={{ flex: 1.5 }}>
            <Text style={styles.label}>Data</Text>
            <View style={styles.pickerWrap}>
              <TextInput style={[styles.input, { height: 50, borderWidth: 0 }]} value={selectedDate} onChangeText={handleDateChange} placeholder="YYYY-MM-DD" placeholderTextColor={themeColors.textMuted} />
            </View>
          </View>
          <View style={{ flex: 0.8 }}>
            <Text style={styles.label}>Godz.</Text>
            <View style={styles.pickerWrap}>
              <TextInput style={[styles.input, { height: 50, borderWidth: 0 }]} value={selectedHour} onChangeText={setSelectedHour} placeholder="6-21" placeholderTextColor={themeColors.textMuted} keyboardType="numeric" />
            </View>
          </View>
        </View>

        {/* Wspólny trening: druga osoba na tym slocie (tylko info, bez zniżki) */}
        <View style={{ marginTop: 4 }}>
          <Text style={styles.label}>Współćwiczący (opcjonalnie)</Text>
          <DropdownPicker
            placeholder="Trening indywidualny"
            selectedValue={partnerClient}
            onValueChange={setPartnerClient}
            style={styles.pickerWrap}
            dropdownIconColor={themeColors.textSecondary}
            items={[
              { label: "Trening indywidualny", value: "", color: themeColors.textMuted },
              ...clients.filter(c => c.id !== selectedClient).map(c => ({ label: c.name, value: c.id, color: themeColors.text }))
            ]}
          />
        </View>

        {/* Workout Type & Main Group in one row */}
        <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: 4 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Plan Treningowy</Text>
            <DropdownPicker
              placeholder="Dowolny"
              selectedValue={selectedPlan}
              onValueChange={handlePlanChange}
              style={styles.pickerWrap}
              dropdownIconColor={themeColors.textSecondary}
              items={[
                { label: "Dowolny", value: "", color: themeColors.textMuted },
                ...plans.map(p => ({ label: p.name, value: p.id, color: themeColors.text }))
              ]}
            />
          </View>
          
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Główna partia</Text>
            <DropdownPicker
              placeholder="Brak"
              selectedValue={selectedMainGroup}
              onValueChange={handleMainGroupChange}
              style={styles.pickerWrap}
              dropdownIconColor={themeColors.textSecondary}
              items={[
                { label: "Brak", value: "", color: themeColors.textMuted },
                ...muscleGroups.map(g => ({ label: g.name, value: g.name, color: themeColors.text }))
              ]}
            />
          </View>
        </View>

        {/* Exercise selection for each part */}

        {allParts.map(part => (
          <View key={part} style={styles.partSection}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.partTitle}>{part}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity onPress={() => handleToggleSupersetMode(part)} style={[{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: themeColors.danger }, supersetMode[part] && { backgroundColor: themeColors.danger }]}>
                  <Text style={{ fontSize: 12, color: supersetMode[part] ? '#fff' : themeColors.danger, fontWeight: 'bold' }}>{supersetMode[part] ? 'Zatwierdź Superserię' : 'Superseria'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removePart(part)} style={{ padding: 4 }} activeOpacity={0.6}>
                  <Ionicons name="close-circle-outline" size={24} color={C.accent} />
                </TouchableOpacity>
              </View>
            </View>
            {(exercisesByGroup[part] || []).map((ex, exIdx) => {
              const key = exKey(part, ex.id);
              const selected = !!exerciseWeights[key];
              const isLinkedToNext = ex.superset_id && exercisesByGroup[part][exIdx + 1] && exercisesByGroup[part][exIdx + 1].superset_id === ex.superset_id;
              const isLinkedToPrev = ex.superset_id && exIdx > 0 && exercisesByGroup[part][exIdx - 1].superset_id === ex.superset_id;

              return (
                <View key={ex.name}>
                  {!isLinkedToPrev && ex.superset_id && (
                    <View style={{ backgroundColor: themeColors.danger, paddingHorizontal: 10, paddingVertical: 3, borderTopLeftRadius: 8, borderTopRightRadius: 8, alignSelf: 'flex-start', marginLeft: 8, marginTop: 8 }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>Superseria</Text>
                    </View>
                  )}
                  {selected ? (
                    <View style={[
                      styles.exerciseRow, 
                      styles.exerciseSelected,
                      ex.superset_id && { 
                        borderColor: themeColors.danger, 
                        borderWidth: 2, 
                        borderTopWidth: isLinkedToPrev ? 0 : 2, 
                        borderBottomWidth: isLinkedToNext ? 0 : 2, 
                        borderTopLeftRadius: isLinkedToPrev ? 0 : 8, 
                        borderTopRightRadius: isLinkedToPrev ? 0 : 8, 
                        borderBottomLeftRadius: isLinkedToNext ? 0 : 8, 
                        borderBottomRightRadius: isLinkedToNext ? 0 : 8, 
                        marginBottom: isLinkedToNext ? 0 : 8,
                        marginTop: isLinkedToPrev ? 0 : 0
                      }
                    ]}>
                      <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                        <TouchableOpacity onPress={() => moveExerciseInDict(part, exIdx, -1)} style={{marginRight: 6}} disabled={exIdx === 0}>
                          <Ionicons name="arrow-up" size={18} color={exIdx === 0 ? 'transparent' : themeColors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.leftCol}
                          onPress={() => supersetMode[part] ? handleSelectForSuperset(part, exIdx) : toggleExercise(part, ex.id)}
                          activeOpacity={0.7}
                        >
                        {supersetMode[part] ? (
                          <View style={[styles.checkbox, (supersetSelection[part] || []).includes(exIdx) && { backgroundColor: themeColors.danger, borderColor: themeColors.danger }]} />
                        ) : (
                          <View style={[styles.checkbox, styles.checkboxChecked]} />
                        )}
                        <Text
                          style={[styles.exerciseName, styles.exerciseNameSelected]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {ex.name}
                        </Text>
                      </TouchableOpacity>
                      </View>
                      
                      <View style={styles.rightCol}>
                        <View style={styles.stepperContainer}>
                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => changeWeight(part, ex.id, -2.5)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.stepperBtnText}>-</Text>
                          </TouchableOpacity>
                          
                          <View style={styles.stepperDisplay}>
                            <TextInput
                              style={styles.stepperInput}
                              value={exerciseWeights[key]?.weight || '0'}
                              onChangeText={v => updateWeight(part, ex.id, 'weight', v)}
                              keyboardType="decimal-pad"
                            />
                            <Text style={[styles.stepperUnit, { pointerEvents: 'none' }]}>{ex.unit || 'KG'}</Text>
                          </View>

                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => changeWeight(part, ex.id, 2.5)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.stepperBtnText}>+</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ marginLeft: 6, padding: 4 }}
                            onPress={() => toggleExercise(part, ex.id)}
                          >
                            <Ionicons name="close-circle" size={20} color={themeColors.textMuted} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => moveExerciseInDict(part, exIdx, 1)} style={{marginLeft: 6}} disabled={exIdx === (exercisesByGroup[part]?.length - 1)}>
                            <Ionicons name="arrow-down" size={18} color={exIdx === (exercisesByGroup[part]?.length - 1) ? 'transparent' : themeColors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={[
                      styles.exerciseRow,
                      ex.superset_id && { 
                        borderColor: themeColors.danger + '80', 
                        borderWidth: 1, 
                        borderTopWidth: isLinkedToPrev ? 0 : 1, 
                        borderBottomWidth: isLinkedToNext ? 0 : 1, 
                        borderTopLeftRadius: isLinkedToPrev ? 0 : 8, 
                        borderTopRightRadius: isLinkedToPrev ? 0 : 8, 
                        borderBottomLeftRadius: isLinkedToNext ? 0 : 8, 
                        borderBottomRightRadius: isLinkedToNext ? 0 : 8, 
                        marginBottom: isLinkedToNext ? 0 : 8,
                        marginTop: isLinkedToPrev ? 0 : 0
                      }
                    ]}>
                      <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                        <TouchableOpacity onPress={() => moveExerciseInDict(part, exIdx, -1)} style={{marginRight: 6}} disabled={exIdx === 0}>
                          <Ionicons name="arrow-up" size={18} color={exIdx === 0 ? 'transparent' : themeColors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.leftCol}
                          onPress={() => supersetMode[part] ? handleSelectForSuperset(part, exIdx) : toggleExercise(part, ex.id)}
                          activeOpacity={0.7}
                        >
                          {supersetMode[part] ? (
                            <View style={[styles.checkbox, (supersetSelection[part] || []).includes(exIdx) && { backgroundColor: themeColors.danger, borderColor: themeColors.danger }]} />
                          ) : (
                            <View style={styles.checkbox} />
                          )}
                        <Text style={styles.exerciseName} numberOfLines={1} ellipsizeMode="tail">
                          {ex.name}
                        </Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity onPress={() => moveExerciseInDict(part, exIdx, 1)} style={{marginLeft: 10}} disabled={exIdx === (exercisesByGroup[part]?.length - 1)}>
                        <Ionicons name="arrow-down" size={18} color={exIdx === (exercisesByGroup[part]?.length - 1) ? 'transparent' : themeColors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}

        {/* Note */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.label}>Notatka</Text>
          <TouchableOpacity
            onPress={toggleDictation}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: dictating ? themeColors.danger : C.accent + '20',
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
            }}
          >
            <Ionicons name="mic" size={16} color={dictating ? '#fff' : C.accent} />
            <Text style={{ color: dictating ? '#fff' : C.accent, fontSize: 11, fontWeight: '700' }}>
              {dictating ? 'Nagrywanie...' : 'Dyktuj'}
            </Text>
          </TouchableOpacity>
        </View>
        <TextInput style={[styles.input, { minHeight: 60 }]} value={note} onChangeText={setNote} placeholder="Opcjonalna notatka..." placeholderTextColor={themeColors.textMuted} multiline />

        {/* 2.0: brak przycisku rozliczania. Oplacone odwolanie widac w historii. */}

        {/* Save */}
        <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg }}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelBtnText}>POWRÓT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>ZAPISZ TRENING</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AppLayout>
  );
}

function makeStyles(accent, TC) {
  return StyleSheet.create({
    scroll: { paddingHorizontal: SPACING.lg, paddingBottom: 100 },
    label: { color: TC.textSecondary, fontSize: 13, fontWeight: '600', marginTop: SPACING.md, marginBottom: 6 },
    input: { backgroundColor: TC.surface, borderRadius: 12, padding: 14, fontSize: 15, color: TC.text, borderWidth: 1, borderColor: TC.border },
    pickerWrap: { backgroundColor: TC.surface, borderRadius: 12, borderWidth: 1, borderColor: TC.border, overflow: 'hidden' },
    picker: { color: TC.text, height: 50, backgroundColor: TC.surface },
    addPartBtn: { backgroundColor: accent + '20', borderRadius: 12, padding: 12, alignItems: 'center', marginTop: SPACING.md },
    addPartBtnText: { color: accent, fontWeight: '700', fontSize: 14 },
    partSection: { marginTop: SPACING.md },
    partTitle: { color: accent, fontSize: 14, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
    exerciseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 14,
      marginBottom: 8,
      backgroundColor: TC.surface,
      borderWidth: 1,
      borderColor: TC.border,
    },
    exerciseSelected: {
      borderColor: accent,
      backgroundColor: TC.surface,
    },
    leftCol: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    rightCol: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: TC.textMuted,
      backgroundColor: 'transparent',
    },
    checkboxChecked: {
      backgroundColor: accent,
      borderColor: accent,
      shadowColor: accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 4,
      elevation: 3,
    },
    exerciseName: {
      color: TC.textSecondary,
      fontSize: 14,
      fontWeight: '500',
      flex: 1,
    },
    exerciseNameSelected: {
      color: TC.text,
      fontWeight: '600',
    },
    stepperContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: TC.surfaceLight,
      borderWidth: 1,
      borderColor: TC.border,
      borderRadius: 20,
      paddingHorizontal: 4,
      height: 38,
    },
    stepperBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepperBtnText: {
      color: accent,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 18,
      textAlign: 'center',
    },
    stepperDisplay: {
      width: 65,
      height: 38,
      position: 'relative',
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepperInput: {
      color: TC.text,
      fontSize: 14,
      fontWeight: '700',
      width: '100%',
      height: '100%',
      textAlign: 'center',
      paddingTop: 4,
      paddingBottom: 10,
    },
    stepperUnit: {
      position: 'absolute',
      bottom: 2,
      color: TC.textSecondary,
      fontSize: 8,
      fontWeight: '600',
    },
    cancelBtn: { flex: 1, backgroundColor: TC.surface, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: TC.border },
    cancelBtnText: { color: TC.textSecondary, fontWeight: '700', fontSize: 13 },
    saveBtn: { flex: 2, backgroundColor: accent, borderRadius: 12, padding: 16, alignItems: 'center' },
    saveBtnText: { color: TC.background, fontWeight: '700', fontSize: 13 },
  });
}
