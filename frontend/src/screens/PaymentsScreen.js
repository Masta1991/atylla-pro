import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Alert, ActivityIndicator, RefreshControl, Modal, FlatList, TextInput, Platform
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { Ionicons } from '@expo/vector-icons';
import { SPACING } from '../assets/theme';
import * as api from '../services/api';
import AppLayout from '../components/AppLayout';
import DropdownPicker from '../components/DropdownPicker';
import { useTheme } from '../context/ThemeContext';

export default function PaymentsScreen({ navigation, route }) {
  const { colors: C, themeColors } = useTheme();
  const styles = React.useMemo(() => makeStyles(C, themeColors), [C, themeColors]);
  
  const [clients, setClients] = useState(global.cachedClients || []);
  const [loading, setLoading] = useState(!global.cachedClients);
  const [refreshing, setRefreshing] = useState(false);
  
  // History modal states
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientEvents, setClientEvents] = useState([]);
  const [clientPackages, setClientPackages] = useState([]);
  const [clientAbsences, setClientAbsences] = useState([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [endCandidates, setEndCandidates] = useState([]);

  // Billing modals
  const [startBillingModalVisible, setStartBillingModalVisible] = useState(false);
  const [endBillingModalVisible, setEndBillingModalVisible] = useState(false);
  
  const [startEventId, setStartEventId] = useState('');
  const [endEventId, setEndEventId] = useState('');
  const [packageSize, setPackageSize] = useState('10');
  const [packageOffset, setPackageOffset] = useState('0');
  const [sharedEnabled, setSharedEnabled] = useState(false);
  const [sharedIds, setSharedIds] = useState([]);

  // Unia eventów klienta + członków wspólnej puli (do liczenia i pickerów).
  const fetchUnionEvents = async (client) => {
    const ids = [client.id, ...((client.shared_with || []).filter(id => id !== client.id))];
    const all = [];
    for (const id of ids) {
      try {
        const evs = await api.getCalendarEvents(null, null, id);
        all.push(...(evs || []));
      } catch (e) {}
    }
    const seen = new Set();
    return all.filter(e => (seen.has(e.id) ? false : (seen.add(e.id), true)));
  };

  const toggleSharedId = (id) => {
    setSharedIds((prev) => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  // Edit modal states
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [editArchivedAt, setEditArchivedAt] = useState(null);
  const [editCount, setEditCount] = useState('');
  const [editComment, setEditComment] = useState('');

  // Increase package modal
  const [increaseModalVisible, setIncreaseModalVisible] = useState(false);
  const [increaseClient, setIncreaseClient] = useState(null);
  const [increaseAmount, setIncreaseAmount] = useState('');
  const [increaseComment, setIncreaseComment] = useState('');

  const loadData = useCallback(async () => {
    try {
      const data = await api.getClients();
      const fetched = data || [];
      setClients(fetched);
      global.cachedClients = fetched;
    } catch (e) {
      console.log('Load payments data error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Deep-link z kalendarza (tryb PAKIET): otworz rozliczenia wskazanego klienta.
  const deepLinkHandled = useRef(null);
  const deepClientId = route?.params?.clientId;
  useEffect(() => {
    if (deepClientId && clients.length > 0 && deepLinkHandled.current !== deepClientId) {
      const target = clients.find(c => c.id === deepClientId);
      if (target) {
        deepLinkHandled.current = deepClientId;
        navigation.setParams({ clientId: null });
        openHistory(target);
      }
    }
  }, [deepClientId, clients]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleOpenStartBilling = async (client) => {
    if ((client.package_current_count || 0) > 0) {
      Alert.alert(
        'Uwaga 🐶', 
        'Ten podopieczny ma już aktywy pakiet. Nie możesz przypisać mu drugiego pakietu w tym samym czasie. Jeżeli w systemie jest błąd zamknij najpierw ten obecny.'
      );
      return;
    }
    try {
      const evs = await fetchUnionEvents(client);
      const sorted = (evs || []).sort((a,b) => {
          if (a.event_date === b.event_date) return b.event_hour - a.event_hour;
          return new Date(b.event_date) - new Date(a.event_date);
      });
      setClientEvents(sorted);
      setSelectedClient(client);
      setStartEventId(sorted.find(e => !e.is_settled)?.id || '');
      setPackageSize(String(client.package_size || 10));
      setPackageOffset('0');
      setSharedEnabled(false);
      setSharedIds([]);
      setStartBillingModalVisible(true);
    } catch(e) {
      Alert.alert('Błąd', 'Nie można pobrać wydarzeń klienta.');
    }
  };

  const executeStartBilling = async () => {
    if (!selectedClient) return;

    const isPackage = selectedClient.billing_type === 'package';
    if (isPackage && !startEventId) {
      if (Platform.OS === 'web') window.alert('Błąd: Dla pakietów SSOT musisz wskazać trening startowy.');
      else Alert.alert('Błąd', 'Dla pakietów SSOT musisz wskazać trening startowy.');
      return;
    }

    const startEv = startEventId ? clientEvents.find(e => e.id === startEventId) : null;
    if (startEv && startEv.is_settled) {
        if (Platform.OS === 'web') window.alert('Błąd: Nie możesz wybrać już rozliczonego treningu jako punkt startowy nowego pakietu.');
        else Alert.alert('Błąd', 'Nie możesz wybrać już rozliczonego treningu jako punkt startowy nowego pakietu.');
        return;
    }
    try {
      setStartBillingModalVisible(false);
      setLoading(true);

      if (isPackage) {
          await api.createClientPackage(selectedClient.id, {
            size: parseInt(packageSize, 10) || 10,
            start_training_id: startEventId,
            offset: parseInt(packageOffset, 10) || 0,
            shared_client_ids: sharedEnabled ? sharedIds : []
          });
      } else {
          await api.updateClient(selectedClient.id, {
              package_purchase_date: startEv?.event_date || new Date().toISOString().split('T')[0],
              shared_monthly_with: sharedEnabled ? sharedIds : []
          });
      }

      if (Platform.OS === 'web') window.alert('Sukces: Rozpoczęto nowe rozliczanie SSOT.');
      else Alert.alert('Sukces', 'Rozpoczęto nowe rozliczanie SSOT.');
      loadData();
    } catch (e) {
      if (Platform.OS === 'web') window.alert('Błąd: ' + e.message);
      else Alert.alert('Błąd', e.message);
      setLoading(false);
    }
  };

  const handleOpenEndBilling = async (client) => {
    try {
      const evs = await fetchUnionEvents(client);
      const sorted = (evs || []).sort((a,b) => {
          if (a.event_date === b.event_date) return b.event_hour - a.event_hour;
          return new Date(b.event_date) - new Date(a.event_date);
      });
      setClientEvents(sorted);
      setSelectedClient(client);
      // Końcem pakietu może być tylko trening z AKTUALNEGO cyklu:
      // po starcie aktywnego pakietu i nieużyty w innych pakietach.
      let candidates = sorted.filter(e => e.is_settled);
      if (client.billing_type === 'package') {
        try {
          const pkgs = await fetchUnionPackages(client);
          const active = (pkgs || []).find(p => !p.end_training_id) || {};
          const startEv = sorted.find(e => e.id === active.start_training_id);
          const used = new Set();
          (pkgs || []).forEach(p => {
            if (p.id !== active.id) { used.add(p.start_training_id); used.add(p.end_training_id); }
          });
          if (startEv) {
            candidates = candidates.filter(e =>
              (e.event_date > startEv.event_date ||
                (e.event_date === startEv.event_date && e.event_hour >= startEv.event_hour)) &&
              !used.has(e.id));
          }
        } catch (e) {}
      }
      setEndCandidates(candidates);
      setEndEventId(candidates[0]?.id || '');
      setEndBillingModalVisible(true);
    } catch(e) {
      Alert.alert('Błąd', 'Nie można pobrać wydarzeń klienta.');
    }
  };

  const executeEndBilling = async () => {
    if (!selectedClient) return;
    
    // Allow closing without selecting an event if there are NO settled events available
    const settledEvents = clientEvents.filter(e => e.is_settled);
    if (settledEvents.length > 0 && !endEventId) {
        if (Platform.OS === 'web') window.alert('Błąd: Masz w kalendarzu rozliczone treningi, musisz wskazać jeden z nich jako zamykający.');
        else Alert.alert('Błąd', 'Masz w kalendarzu rozliczone treningi, musisz wskazać jeden z nich jako zamykający.');
        return;
    }
    
    const isPackage = selectedClient.billing_type === 'package';
    if (isPackage && !selectedClient.active_package_id) {
        if (Platform.OS === 'web') window.alert('Błąd: Ten podopieczny nie ma obecnie aktywnego pakietu do zamknięcia.');
        else Alert.alert('Błąd', 'Ten podopieczny nie ma obecnie aktywnego pakietu do zamknięcia.');
        return;
    }
    if (!isPackage && !selectedClient.package_purchase_date) {
        if (Platform.OS === 'web') window.alert('Błąd: Ten podopieczny nie ma aktywnego cyklu rozliczeniowego.');
        else Alert.alert('Błąd', 'Ten podopieczny nie ma aktywnego cyklu rozliczeniowego.');
        return;
    }
    
    // Walidacja chronologii i statusu
    const endEv = clientEvents.find(e => e.id === endEventId);
    if (endEv && !endEv.is_settled) {
        if (Platform.OS === 'web') window.alert('Błąd: Nie możesz zamknąć pakietu na treningu, który nie został jeszcze rozliczony.');
        else Alert.alert('Błąd', 'Nie możesz zamknąć pakietu na treningu, który nie został jeszcze rozliczony.');
        return;
    }
    if (endEv && selectedClient.package_purchase_date) {
        if (new Date(endEv.event_date) < new Date(selectedClient.package_purchase_date)) {
            if (Platform.OS === 'web') window.alert('Błąd SSOT: Wskazany trening końcowy odbył się wcześniej niż punkt startowy tego pakietu.');
            else Alert.alert('Błąd SSOT 🐶', 'Wskazany trening końcowy odbył się wcześniej niż punkt startowy tego pakietu. Nie możesz zamknąć w przeszłość! Wybierz poprawny trening.');
            return;
        }
    }

    const commitArchiving = async () => {
        setEndBillingModalVisible(false);
        setLoading(true);
        try {
            if (isPackage) {
                if (endEventId) {
                    await api.endClientPackage(selectedClient.active_package_id, {
                        end_training_id: endEventId
                    });
                } else {
                    // Jeśli zamykamy pakiet bez żadnego odbytego treningu,
                    // backend i tak uważa end_training_id=null za pakiet aktywny.
                    // Dlatego w takiej sytuacji usuwamy pakiet całkowicie z historii.
                    await api.deleteClientPackage(selectedClient.active_package_id);
                }
            } else {
                const history = [...(selectedClient.payment_history || [])];
                history.push({
                    action: 'end',
                    end_date: endEv?.event_date || new Date().toISOString().split('T')[0],
                    purchase_date: selectedClient.package_purchase_date,
                    archived_at: new Date().toISOString(),
                    package_size: 0,
                    completed_count: selectedClient.package_current_count || 0
                });
                await api.updateClient(selectedClient.id, {
                    payment_history: history,
                    package_purchase_date: null
                });
            }
            if (Platform.OS === 'web') window.alert('Sukces: Pakiet został domknięty. Zarchiwizowano historię.');
            else Alert.alert('Sukces', 'Pakiet został domknięty. Zarchiwizowano historię.');
            loadData();
        } catch (e) {
            if (Platform.OS === 'web') window.alert('Błąd: ' + e.message);
            else Alert.alert('Błąd', e.message);
            setLoading(false);
        }
    };

    if (Platform.OS === 'web') {
        if (window.confirm('Czy na pewno chcesz zarchiwizować ten cykl? (Możesz to cofnąć usuwając go z Historii)')) {
            commitArchiving();
        }
    } else {
        Alert.alert(
            'Archiwizacja Pakietu 🐶',
            'Zamykanie pakietu służy do zarchiwizowania zakończonego cyklu w Historii. Czy na pewno zarchiwizować?',
            [
                { text: 'Anuluj', style: 'cancel' },
                { text: 'Tak, zarchiwizuj', style: 'destructive', onPress: commitArchiving }
            ]
        );
    }
  };

  // Unia pakietów klienta + członków wspólnej puli (ta sama historia u obojga).
  const fetchUnionPackages = async (client) => {
    const ids = [client.id, ...((client.shared_with || []).filter(id => id !== client.id))];
    const all = [];
    for (const id of ids) {
      try {
        const p = await api.getClientPackages(id);
        all.push(...(p || []));
      } catch (e) {}
    }
    const seen = new Set();
    return all.filter(p => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  };

  const openHistory = async (client) => {
    setLoading(true);
    try {
        const abs = await api.getAbsences().catch(() => []);
        setClientAbsences((abs || []).filter(a => a.client_id === client.id));
        setExpandedHistoryId(null);
        if (client.billing_type === 'package') {
            const pkgs = await fetchUnionPackages(client);
            const evs = await fetchUnionEvents(client);
            const sorted = (pkgs || []).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
            setClientPackages(sorted);
            setClientEvents(evs || []);
        } else {
            const evs = await fetchUnionEvents(client).catch(() => []);
            // Unia historii miesięcznych członków puli.
            const ownHist = client.payment_history || [];
            const othersHist = [];
            for (const mid of (client.shared_with || [])) {
              if (mid === client.id) continue;
              const mc = clients.find(c => c.id === mid);
              othersHist.push(...(((mc || {}).payment_history) || []));
            }
            setClientPackages([...ownHist, ...othersHist]);
            setClientEvents(evs || []);
        }
        setSelectedClient(client);
        setHistoryModalVisible(true);
    } catch(e) {
        Alert.alert('Błąd', 'Nie można pobrać historii.');
    }
    setLoading(false);
  };

  // Treningi pakietu/cyklu: daty odbytych, odwołanych rozliczonych i odwołanych bez rozliczenia.
  // Zakres wyznacza TYLKO pakiet/cykl (start..koniec) — bez odcięcia "do dziś",
  // żeby zaplanowane przyszłe treningi też się liczyły.
  function packageTrainings(item, isPackage) {
    const evs = (clientEvents || []).slice().sort((a, b) =>
      a.event_date === b.event_date ? a.event_hour - b.event_hour : (a.event_date < b.event_date ? -1 : 1));
    let from = '0000-00-00', to = null;
    if (isPackage) {
      const s = evs.find(e => e.id === item.start_training_id);
      const en = evs.find(e => e.id === item.end_training_id);
      if (s) from = s.event_date;
      if (en) to = en.event_date;
    } else {
      if (item.purchase_date) from = item.purchase_date;
      if (item.end_date) to = item.end_date;
    }
    const inRange = evs.filter(e => e.event_date >= from && (to === null || e.event_date <= to));
    const abs = (clientAbsences || []).filter(a => a.absence_date >= from && (to === null || a.absence_date <= to));
    const rows = inRange.map(e => ({
      key: e.id, date: e.event_date, hour: e.event_hour,
      partner: e.partner_name || null,
      state: e.status === 'cancelled' ? (e.is_settled ? 'cancel-settled' : 'cancel') : (e.is_settled ? 'done' : 'planned'),
    }));
    const evKeys = new Set(inRange.map(e => `${e.event_date}|${e.event_hour}`));
    abs.forEach((a, i) => {
      if (!evKeys.has(`${a.absence_date}|${a.absence_hour}`)) {
        rows.push({ key: `abs-${i}`, date: a.absence_date, hour: a.absence_hour, state: 'cancel-free' });
      }
    });
    rows.sort((a, b) => a.date === b.date ? a.hour - b.hour : (a.date < b.date ? -1 : 1));
    const done = rows.filter(r => r.state === 'done').length;
    const cSettled = rows.filter(r => r.state === 'cancel-settled').length;
    const cFree = rows.filter(r => r.state === 'cancel-free' || r.state === 'cancel').length;
    return { rows, done, cSettled, cFree, from, to };
  }

  const handleDeleteHistoryItem = (item) => {
      const executeDelete = async () => {
          setHistoryModalVisible(false);
          setLoading(true);
          try {
              if (selectedClient.billing_type === 'package') {
                  await api.deleteClientPackage(item.id);
              } else {
                  const history = [...(selectedClient.payment_history || [])];
                  const newHistory = history.filter(h => h.archived_at !== item.archived_at);
                  await api.updateClient(selectedClient.id, { payment_history: newHistory });
              }
              if (Platform.OS === 'web') alert('Sukces: Wpis z historii został usunięty.');
              else Alert.alert('Sukces', 'Wpis z historii został usunięty.');
              loadData();
          } catch(e) {
              if (Platform.OS === 'web') alert('Błąd: ' + e.message);
              else Alert.alert('Błąd', e.message);
              setLoading(false);
          }
      };

      if (Platform.OS === 'web') {
          if (window.confirm('Dzień 0 (Twarde Usuwanie) 🐶\n\nTa operacja całkowicie usunie ten wpis z historii SSOT. Czy jesteś absolutnie pewien, że chcesz go wyzerować?')) {
              executeDelete();
          }
      } else {
          Alert.alert(
              'Dzień 0 (Twarde Usuwanie) 🐶', 
              'Ta operacja całkowicie usunie ten wpis z historii SSOT. Czy jesteś absolutnie pewien, że chcesz go wyzerować?',
              [
                  { text: 'Anuluj', style: 'cancel' },
                  { text: 'Tak, skasuj', style: 'destructive', onPress: executeDelete }
              ]
          );
      }
  };

  const handleHardReset = async (client) => {
      const executeReset = async () => {
          setLoading(true);
          try {
              await api.hardResetClient(client.id);
              if (Platform.OS === 'web') alert('Sukces: Pakiety zostały bezpowrotnie zresetowane do zera.');
              else Alert.alert('Sukces', 'Pakiety zostały bezpowrotnie zresetowane do zera.');
              loadData();
          } catch(e) {
              if (Platform.OS === 'web') alert('Błąd: ' + e.message);
              else Alert.alert('Błąd', e.message);
              setLoading(false);
          }
      };

      if (Platform.OS === 'web') {
          if (window.confirm(`TWARDY RESET 🚨\n\nTa operacja wyzeruje absolutnie wszystkie powiązania pakietowe i daty startowe dla ${client.name}. Używaj tylko w sytuacjach awaryjnych! Kontynuować?`)) {
              executeReset();
          }
      } else {
          Alert.alert(
              'TWARDY RESET 🚨',
              `Ta operacja wyzeruje absolutnie wszystkie powiązania pakietowe i daty startowe dla ${client.name}. Używaj tylko w sytuacjach awaryjnych! Kontynuować?`,
              [
                  { text: 'Anuluj', style: 'cancel' },
                  { text: 'Tak, Zeruj', style: 'destructive', onPress: executeReset }
              ]
          );
      }
  };

  const openEditModal = (client) => {
    setEditClient(client);
    setEditArchivedAt(null);
    setEditCount(String(client.package_current_count || 0));
    setEditComment('');
    setEditModalVisible(true);
  };

  const openIncreaseModal = (client) => {
    setIncreaseClient(client);
    setIncreaseAmount('');
    setIncreaseComment('');
    setIncreaseModalVisible(true);
  };

  const handleIncreasePackage = async () => {
    if (!increaseClient) return;
    const amount = parseInt(increaseAmount, 10);
    if (!amount || amount <= 0) {
      Alert.alert('Błąd', 'Podaj liczbę treningów do dodania (min. 1).');
      return;
    }
    
    const isPackage = increaseClient.billing_type === 'package';
    if (!isPackage || !increaseClient.active_package_id) {
        Alert.alert('Błąd', 'Zwiększanie rozmiaru dotyczy tylko aktywnych pakietów.');
        return;
    }

    try {
      setLoading(true);
      setIncreaseModalVisible(false);
      
      const currentSize = increaseClient.package_size || 10;
      await api.endClientPackage(increaseClient.active_package_id, {
          size: currentSize + amount
      });
      
      Alert.alert('Sukces', `Pakiet powiększony z ${currentSize} do ${currentSize + amount}.`);
      loadData();
    } catch (e) {
      Alert.alert('Błąd', e.message);
      setLoading(false);
    }
  };

  const openHistoryEditModal = (client, historyItem) => {
    setEditClient(client);
    setEditArchivedAt(historyItem.archived_at);
    setEditCount(String(historyItem.completed_count || 0));
    setEditComment('');
    setHistoryModalVisible(false);
    setTimeout(() => {
      setEditModalVisible(true);
    }, 300);
  };

  const handleSaveEdit = async () => {
    if (!editClient) return;
    const newCount = parseInt(editCount, 10);
    if (isNaN(newCount) || newCount < 0) {
        Alert.alert('Błąd', 'Podaj poprawną liczbę odbytych treningów.');
        return;
    }
    
    try {
      setLoading(true);
      if (editArchivedAt) {
        // Historia - nadpisujemy JSON
        const history = [...(editClient.payment_history || [])];
        const idx = history.findIndex(h => h.archived_at === editArchivedAt);
        if (idx !== -1) {
            history[idx].completed_count = newCount;
            await api.updateClient(editClient.id, { payment_history: history });
        }
      } else {
        // Aktywny pakiet / cykl
        const currentCount = editClient.package_current_count || 0;
        const diff = newCount - currentCount;
        
        if (diff < 0) {
            Alert.alert('Błąd SSOT 🐶', 'Nie możesz ręcznie pomniejszyć licznika aktywnych treningów w nowej architekturze. Jeśli chcesz anulować przebyty trening, wejdź do Kalendarza i Odznacz go jako Odbyty lub usuń wydarzenie.');
            setLoading(false);
            return;
        } else if (diff > 0) {
            // Dodajemy sztuczne treningi "Korekta" z datą dzisiejszą, od godz 23 w dół
            const today = new Date().toISOString().split('T')[0];
            let hour = 23;
            for (let i = 0; i < diff; i++) {
                await api.createCalendarEvent({
                    client_id: editClient.id,
                    event_date: today,
                    event_hour: hour,
                    is_settled: true,
                    status: 'active',
                    note: editComment ? `[KOREKTA] ${editComment}` : '[KOREKTA] Ręczne dodanie treningów'
                });
                hour--;
                if (hour < 0) hour = 23; // fallback, in practice diff shouldn't be > 24
            }
        }
      }
      setEditModalVisible(false);
      Alert.alert('Sukces', 'Zaktualizowano dane.');
      loadData();
    } catch (e) {
      Alert.alert('Błąd', e.message);
      setLoading(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <AppLayout navigation={navigation} title="Rozliczenia" showBack>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: themeColors.background }}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout navigation={navigation} title="Rozliczenia" showBack>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accent} />}
      >
        <Text style={styles.title}>Status Płatności Podopiecznych</Text>
        <Text style={styles.subtitle}>Sprawdź statusy pakietów oraz rozliczenia miesięczne swoich klientów.</Text>
        
        {clients.map(client => {
          const isPackage = client.billing_type === 'package';
          const isSingle = client.billing_type === 'single' || (!client.billing_type && !isPackage);
          const size = client.package_size || 0;
          const current = client.package_current_count || 0;
          const isOverLimit = isPackage && current > size;
          
          return (
            <View key={client.id} style={[styles.card, isOverLimit && styles.cardWarning]}>
              <View style={styles.cardHeader}>
                <View style={styles.clientMeta}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{client.name?.charAt(0)?.toUpperCase() || '?'}</Text>
                  </View>
                  <View>
                    <Text style={styles.clientName}>{client.name}</Text>
                    <View style={[styles.badge, isPackage ? styles.badgePackage : styles.badgeSingle]}>
                      <Text style={[styles.badgeText, isSingle && { color: '#8b949e' }]}>
                        {isPackage ? 'PAKIET' : 'BEZ PAKIETU'}
                      </Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.counterSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.counterText, isOverLimit && styles.counterTextWarning]}>
                      {isSingle ? current : `${current}${isPackage ? ` / ${size}` : ''}`}
                    </Text>
                    {isPackage && (
                      <>
                        <TouchableOpacity onPress={() => openEditModal(client)} style={{ marginLeft: 6, padding: 4 }}>
                          <Ionicons name="pencil" size={16} color={C.accent} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => openIncreaseModal(client)} style={{ marginLeft: 2, padding: 4 }}>
                          <Ionicons name="add-circle-outline" size={18} color="#1dd1a1" />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                  <Text style={styles.counterLabel}>treningi</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={16} color={themeColors.textSecondary} />
                  <Text style={styles.infoText}>
                    Od: <Text style={styles.infoValue}>{client.package_purchase_date || 'brak daty'}</Text>
                  </Text>
                </View>

                {(client.shared_with || []).length > 0 && (
                  <View style={[styles.infoRow, { marginTop: 4 }]}>
                    <Ionicons name="people-outline" size={16} color={C.accent} />
                    <Text style={styles.infoText}>
                      Wspólny z: <Text style={[styles.infoValue, { color: C.accent }]}>{(client.shared_with || []).map(id => (clients.find(c => c.id === id) || {}).name).filter(Boolean).join(', ') || '…'}</Text>
                    </Text>
                  </View>
                )}

                {client.cancelled_settled_count > 0 && (
                  <View style={[styles.infoRow, { marginTop: 4 }]}>
                    <Ionicons name="information-circle-outline" size={16} color={themeColors.danger} />
                    <Text style={styles.infoText}>
                      Z tego odwołane i rozliczone: <Text style={[styles.infoValue, { color: themeColors.danger }]}>{client.cancelled_settled_count}</Text>
                    </Text>
                  </View>
                )}

                {client.cancelled_free_count > 0 && (
                  <View style={[styles.infoRow, { marginTop: 4 }]}>
                    <Ionicons name="information-circle-outline" size={16} color={themeColors.textSecondary} />
                    <Text style={styles.infoText}>
                      Odwołane bez rozliczenia: <Text style={styles.infoValue}>{client.cancelled_free_count}</Text>
                    </Text>
                  </View>
                )}
                
                {isOverLimit && (
                  <View style={styles.warningMessage}>
                    <Ionicons name="warning-outline" size={16} color="#FF9800" />
                    <Text style={styles.warningText}>{`Klient przekroczył pakiet o ${current - size} treningi!`}</Text>
                  </View>
                )}
              </View>

              <View style={[styles.cardActions, { flexWrap: 'wrap', gap: 8 }]}>
                {!client.package_purchase_date && (
                  <TouchableOpacity
                    style={[styles.btn, styles.btnPrimary, { flex: 1, minWidth: '48%' }]}
                    onPress={() => handleOpenStartBilling(client)}
                  >
                    <Ionicons name="play-circle-outline" size={18} color="#ffffff" />
                    <Text style={styles.btnPrimaryText}>
                      {isPackage ? 'Nowy Pakiet' : 'Nowe rozliczanie'}
                    </Text>
                  </TouchableOpacity>
                )}
                
                {client.package_purchase_date && (
                  <TouchableOpacity
                    style={[styles.btn, { flex: 1, minWidth: '48%', backgroundColor: themeColors.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 }]}
                    onPress={() => handleOpenEndBilling(client)}
                  >
                    <Ionicons name="stop-circle-outline" size={18} color="#ffffff" />
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
                      {isPackage ? 'Zakończ Pakiet' : 'Zakończ rozliczanie'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary, { flex: 1, minWidth: '100%' }]}
                  onPress={() => openHistory(client)}
                >
                  <Ionicons name="time-outline" size={18} color={C.accent} />
                  <Text style={styles.btnSecondaryText}>Historia</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, { flex: 1, minWidth: '100%', backgroundColor: 'transparent', borderColor: themeColors.danger, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6, marginTop: 4 }]}
                  onPress={() => handleHardReset(client)}
                >
                  <Ionicons name="warning-outline" size={16} color={themeColors.danger} />
                  <Text style={{ color: themeColors.danger, fontWeight: '600', fontSize: 13 }}>
                    Twardy Reset (Wyzeruj)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {clients.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={themeColors.textMuted} />
            <Text style={styles.emptyText}>Brak klientów do wyświetlenia.</Text>
          </View>
        )}
      </ScrollView>

      {/* History Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={historyModalVisible}
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Historia płatności</Text>
              <TouchableOpacity onPress={() => setHistoryModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Text style={[styles.modalSubtitle, { marginBottom: 0, lineHeight: 22 }]}>{selectedClient?.name}</Text>
              {selectedClient?.billing_type === 'package' ? (
                <View style={{ backgroundColor: C.accent, borderRadius: 11, paddingHorizontal: 10, height: 22, justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', lineHeight: 16 }}>
                    {selectedClient?.package_current_count ?? 0}/{selectedClient?.package_size || 10}
                  </Text>
                </View>
              ) : (selectedClient?.package_purchase_date ? (
                <View style={{ backgroundColor: C.accent, borderRadius: 11, paddingHorizontal: 10, height: 22, justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', lineHeight: 16 }}>
                    {selectedClient?.package_current_count ?? 0}
                  </Text>
                </View>
              ) : null)}
            </View>
            
            <FlatList
              data={clientPackages}
              keyExtractor={(item, index) => item.id || `h-${index}`}
              renderItem={({ item, index }) => {
                const isPkg = selectedClient?.billing_type === 'package';
                const hid = item.id || `h-${index}`;
                const expanded = expandedHistoryId === hid;
                const t = packageTrainings(item, isPkg);
                const startLabel = isPkg
                  ? ((clientEvents.find(e => e.id === item.start_training_id)?.event_date) || 'Brak danych')
                  : item.purchase_date;
                const endLabel = isPkg
                  ? ((clientEvents.find(e => e.id === item.end_training_id)?.event_date) || 'Pakiet otwarty')
                  : item.end_date;
                const stateStyle = (s) => s === 'done'
                  ? { color: '#1dd1a1' }
                  : (s === 'cancel-settled' ? { color: '#e67e22' } : { color: themeColors.danger });
                const stateLabel = (s) => s === 'done' ? 'odbyty'
                  : (s === 'cancel-settled' ? 'odwołany • rozliczony'
                  : (s === 'planned' ? 'nierozliczony' : 'odwołany • bez rozliczenia'));
                return (
                  <View style={styles.historyItem}>
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => setExpandedHistoryId(expanded ? null : hid)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.historyMeta}>
                        <View style={styles.infoRow}>
                          <Ionicons name={isPkg && item.end_training_id ? "archive-outline" : (isPkg ? "ellipse" : "archive-outline")} size={14} color={(isPkg && !item.end_training_id) ? "#28a745" : themeColors.textSecondary} />
                          <Text style={styles.historyDate}>
                            Start: <Text style={{ fontWeight: '600', color: themeColors.text }}>{startLabel}</Text>
                          </Text>
                        </View>
                        <View style={[styles.infoRow, { marginTop: 4 }]}>
                          <Ionicons name="stop-circle-outline" size={14} color={themeColors.textSecondary} />
                          <Text style={styles.historyDate}>
                            Koniec: <Text style={{ fontWeight: '600', color: themeColors.text }}>{endLabel}</Text>
                          </Text>
                        </View>
                        <Text style={[styles.historyDate, { marginTop: 6 }]}>
                          Treningi: {t.rows.length} • odbyte: {t.done} • odwołane rozl.: {t.cSettled} • odwołane bez: {t.cFree}
                        </Text>
                        {isPkg && (
                          <Text style={[styles.historyCountText, { fontSize: 12, color: themeColors.textMuted, marginTop: 2 }]}>
                            Pula: {item.size} • offset: {item.offset} {expanded ? '▲' : '▼'}
                          </Text>
                        )}
                        {!isPkg && (
                          <Text style={[styles.historyCountText, { fontSize: 12, color: themeColors.textMuted, marginTop: 2 }]}>
                            Rozliczono: {item.completed_count} • {item.archived_at ? new Date(item.archived_at).toLocaleDateString() : ''} {expanded ? '▲' : '▼'}
                          </Text>
                        )}
                      </View>
                      {expanded && (
                        <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: themeColors.border, paddingTop: 6 }}>
                          {t.rows.length === 0 && (
                            <Text style={{ color: themeColors.textMuted, fontSize: 12 }}>Brak treningów w tym okresie.</Text>
                          )}
                          {t.rows.map(r => (
                            <View key={r.key} style={[styles.infoRow, { paddingVertical: 3 }]}>
                              <Text style={{ color: themeColors.text, fontSize: 12, fontWeight: '600', width: 92 }}>
                                {r.date.slice(5).replace('-', '.')}{r.hour != null ? ` ${r.hour}:00` : ''}
                              </Text>
                              <Text style={[{ fontSize: 12 }, stateStyle(r.state)]}>{stateLabel(r.state)}{r.partner ? ` · z: ${r.partner}` : ''}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </TouchableOpacity>
                    <View style={[{ justifyContent: 'center' }]}>
                      <TouchableOpacity onPress={() => handleDeleteHistoryItem(item)} style={{ padding: 4 }}>
                        <Ionicons name="trash-outline" size={18} color={themeColors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={() => (
                <View style={styles.modalEmpty}>
                  <Ionicons name="receipt-outline" size={36} color={themeColors.textMuted} />
                  <Text style={styles.modalEmptyText}>Brak paczek dla tego klienta (Dzień 0).</Text>
                </View>
              )}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edytuj Licznik</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>{editClient?.name}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Zużyte treningi</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={editCount}
                onChangeText={setEditCount}
                placeholder="Np. 5"
                placeholderTextColor={themeColors.textMuted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Komentarz (powód zmiany)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={3}
                value={editComment}
                onChangeText={setEditComment}
                placeholder="Wpisz powód korekty..."
                placeholderTextColor={themeColors.textMuted}
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, { marginTop: 16 }]}
              onPress={handleSaveEdit}
            >
              <Text style={styles.btnPrimaryText}>Zapisz Zmiany</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Start Billing Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={startBillingModalVisible}
        onRequestClose={() => setStartBillingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: 'auto' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rozpocznij {selectedClient?.billing_type === 'package' ? 'Nowy Pakiet' : 'Nowe Rozliczanie'}</Text>
              <TouchableOpacity onPress={() => setStartBillingModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>{selectedClient?.name}</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>1. {selectedClient?.billing_type === 'package' ? 'Wskaż trening startowy' : 'Trening początkowy (opcjonalnie)'}</Text>
              <DropdownPicker
                  placeholder="Wybierz trening z kalendarza..."
                  selectedValue={startEventId}
                  onValueChange={setStartEventId}
                  style={styles.pickerWrap}
                  dropdownIconColor={themeColors.textSecondary}
                  items={clientEvents.filter(e => !e.is_settled).map(e => ({ label: `${e.event_date} ${e.event_hour}:00 | ${e.workout_types?.name || ''} (Nierozliczony)`, value: e.id, color: themeColors.text }))}
              />
            </View>

            {selectedClient?.billing_type === 'package' && (
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>2. Wielkość puli</Text>
                  <TextInput
                    style={styles.input}
                    value={packageSize}
                    onChangeText={setPackageSize}
                    keyboardType="numeric"
                    placeholder="Np. 10"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>3. Startuj od (Offset)</Text>
                  <TextInput
                    style={styles.input}
                    value={packageOffset}
                    onChangeText={setPackageOffset}
                    keyboardType="numeric"
                    placeholder="Domyślnie 0"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>
            </View>
            )}

            {/* Wspólna pula: treningi wybranych osób schodzą z tej puli */}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}
              onPress={() => { setSharedEnabled(!sharedEnabled); if (sharedEnabled) setSharedIds([]); }}
              activeOpacity={0.7}
            >
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: C.accent, alignItems: 'center', justifyContent: 'center', backgroundColor: sharedEnabled ? C.accent : 'transparent' }}>
                {sharedEnabled && <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>✓</Text>}
              </View>
              <Text style={[styles.label, { marginBottom: 0 }]}>Pakiet wspólny (wspólna pula)</Text>
            </TouchableOpacity>
            {sharedEnabled && (
              <View style={{ marginTop: 8, maxHeight: 160 }}>
                <Text style={[styles.label, { marginBottom: 4 }]}>Z kim dzielona pula:</Text>
                <ScrollView style={{ maxHeight: 140 }} nestedScrollEnabled>
                  {clients.filter(c => c.id !== selectedClient?.id).map(c => {
                    const on = sharedIds.includes(c.id);
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}
                        onPress={() => toggleSharedId(c.id)}
                        activeOpacity={0.7}
                      >
                        <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: on ? C.accent : themeColors.textMuted, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.accent : 'transparent' }}>
                          {on && <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>✓</Text>}
                        </View>
                        <Text style={{ color: themeColors.text, fontSize: 14 }}>{c.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <TouchableOpacity style={[styles.btn, styles.btnPrimary, { marginTop: 16 }]} onPress={executeStartBilling}>
              <Text style={styles.btnPrimaryText}>{selectedClient?.billing_type === 'package' ? 'Otwórz Pakiet (SSOT)' : 'Rozpocznij rozliczanie'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* End Billing Modal */}
      <Modal
        animationType="none"
        transparent={true}
        visible={endBillingModalVisible}
        onRequestClose={() => setEndBillingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: 'auto' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Zakończ {selectedClient?.billing_type === 'package' ? 'Pakiet' : 'Rozliczanie'}</Text>
              <TouchableOpacity onPress={() => setEndBillingModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>{selectedClient?.name}</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Zaznacz trening końcowy z kalendarza</Text>
              {endCandidates.filter(e => e.is_settled).length === 0 ? (
                <Text style={{ fontSize: 13, color: themeColors.textMuted, fontStyle: 'italic', paddingVertical: 10 }}>
                  Brak odbytych (rozliczonych) treningów do wyboru. Pakiet zostanie zamknięty z dzisiejszą datą.
                </Text>
              ) : (
                <DropdownPicker
                    placeholder="Wybierz trening kończący ten cykl..."
                    selectedValue={endEventId}
                    onValueChange={setEndEventId}
                    style={styles.pickerWrap}
                    dropdownIconColor={themeColors.textSecondary}
                    items={endCandidates.filter(e => e.is_settled).map(e => ({ label: `${e.event_date} ${e.event_hour}:00 | ${e.workout_types?.name || ''} (Rozliczony)`, value: e.id, color: themeColors.text }))}
                />
              )}
              <Text style={{ fontSize: 12, color: themeColors.textMuted, marginTop: 6 }}>
                Po wskazaniu ostatniego treningu paczka zostanie hermetycznie zamknięta (zarchiwizowana).
              </Text>
            </View>

            <TouchableOpacity style={[styles.btn, { backgroundColor: themeColors.danger, marginTop: 16, paddingVertical: 14, borderRadius: 10, alignItems: 'center' }]} onPress={executeEndBilling}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Zamknij i Zarchiwizuj Pakiet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Increase Package Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={increaseModalVisible}
        onRequestClose={() => setIncreaseModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: 'auto' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Zwiększ Pakiet</Text>
              <TouchableOpacity onPress={() => setIncreaseModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>{increaseClient?.name}</Text>
            
            <View style={[styles.infoRow, { marginBottom: 16, backgroundColor: themeColors.surfaceLight, padding: 12, borderRadius: 10 }]}>
              <Ionicons name="information-circle-outline" size={16} color={C.accent} />
              <Text style={{ color: themeColors.textSecondary, fontSize: 13, flex: 1 }}>
                Obecny pakiet: {increaseClient?.package_current_count || 0} / {increaseClient?.package_size || 0} treningów
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Liczba treningów do dodania</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={increaseAmount}
                onChangeText={setIncreaseAmount}
                placeholder="Np. 10"
                placeholderTextColor={themeColors.textMuted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Komentarz (wymagany)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={3}
                value={increaseComment}
                onChangeText={setIncreaseComment}
                placeholder="Np. Klient dokupił 10 treningów..."
                placeholderTextColor={themeColors.textMuted}
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, { marginTop: 16, backgroundColor: '#1dd1a1' }]}
              onPress={handleIncreasePackage}
            >
              <Ionicons name="add-circle-outline" size={18} color="#ffffff" />
              <Text style={styles.btnPrimaryText}>Dodaj do pakietu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </AppLayout>
  );
}

function makeStyles(C, TC) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.md,
      paddingBottom: 130,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: TC.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 13,
      color: TC.textSecondary,
      marginBottom: SPACING.lg,
    },
    card: {
      backgroundColor: TC.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: TC.border,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    cardWarning: {
      borderColor: '#FF9800',
      backgroundColor: TC.surface,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: TC.border,
      paddingBottom: 12,
      marginBottom: 12,
    },
    clientMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: C.accent + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      color: C.accent,
      fontSize: 18,
      fontWeight: '700',
    },
    clientName: {
      color: TC.text,
      fontSize: 15,
      fontWeight: '700',
    },
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      marginTop: 4,
    },
    badgePackage: {
      backgroundColor: C.accent + '15',
    },
    badgeSingle: {
      backgroundColor: TC.surfaceLight,
      borderWidth: 1,
      borderColor: TC.border,
    },
    badgeMonthly: {
      backgroundColor: '#2196F320',
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: C.accent,
    },
    counterSection: {
      alignItems: 'flex-end',
    },
    counterText: {
      fontSize: 22,
      fontWeight: '800',
      color: C.accent,
    },
    counterTextWarning: {
      color: '#FF9800',
    },
    counterLabel: {
      fontSize: 10,
      color: TC.textSecondary,
      textTransform: 'uppercase',
      fontWeight: '600',
    },
    cardBody: {
      marginBottom: 16,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    infoText: {
      fontSize: 13,
      color: TC.textSecondary,
    },
    infoValue: {
      color: TC.text,
      fontWeight: '600',
    },
    warningMessage: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#FF980015',
      padding: 8,
      borderRadius: 8,
      marginTop: 10,
    },
    warningText: {
      fontSize: 12,
      color: '#FF9800',
      fontWeight: '600',
    },
    cardActions: {
      flexDirection: 'row',
      gap: 10,
    },
    btn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 12,
      paddingVertical: 12,
    },
    btnPrimary: {
      backgroundColor: C.accent,
    },
    btnPrimaryText: {
      color: '#ffffff',
      fontWeight: '700',
      fontSize: 13,
    },
    btnSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: C.accent,
    },
    btnSecondaryText: {
      color: C.accent,
      fontWeight: '700',
      fontSize: 13,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      gap: 12,
    },
    emptyText: {
      color: TC.textSecondary,
      fontSize: 14,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: TC.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: SPACING.lg,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: TC.text,
    },
    modalSubtitle: {
      fontSize: 14,
      color: C.accent,
      fontWeight: '600',
      marginBottom: SPACING.md,
    },
    closeBtn: {
      padding: 4,
    },
    historyItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      backgroundColor: TC.surfaceLight,
      padding: SPACING.md,
      borderRadius: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: TC.border,
    },
    historyMeta: {
      gap: 4,
    },
    historyDate: {
      fontSize: 13,
      color: TC.textSecondary,
    },
    historyArchived: {
      fontSize: 10,
      color: TC.textMuted,
    },
    historyStats: {
      alignItems: 'flex-end',
    },
    historyCountText: {
      fontSize: 16,
      fontWeight: '700',
      color: TC.text,
    },
    historyLabel: {
      fontSize: 8,
      color: TC.textSecondary,
      textTransform: 'uppercase',
    },
    modalEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      gap: 8,
    },
    modalEmptyText: {
      color: TC.textSecondary,
      fontSize: 13,
    },
    inputGroup: {
      marginBottom: 16,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: TC.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: TC.surfaceLight,
      borderWidth: 1,
      borderColor: TC.border,
      borderRadius: 12,
      padding: 12,
      color: TC.text,
      fontSize: 15,
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
  });
}
