import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import { Ionicons } from '@expo/vector-icons';
import { SPACING } from '../assets/theme';
import { useTheme } from '../context/ThemeContext';
import AppLayout from '../components/AppLayout';
import * as api from '../services/api';
import { AppAlert as Alert, askConfirmation } from '../services/confirm';

export default function AbsencesScreen({ navigation }) {
  const { colors: C, themeColors, mode } = useTheme();
  const styles = useMemo(() => makeStyles(C, themeColors, mode), [C, themeColors, mode]);

  const [clients, setClients] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [selectedClient, setSelectedClient] = useState('');
  const [selectedDates, setSelectedDates] = useState([]);
  const [adding, setAdding] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const optionsRequest = useRef(0);
  const reviewedOptions = useRef([]);
  const mutationBusy = useRef(false);
  const datesToggleRef = useRef(null);
  // Billing and the 60-day options use Warsaw calendar dates on every device.
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const cutoff = new Date(todayStr + 'T12:00:00Z');
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const visibleAbsences = absences.filter(abs => abs.absence_date >= cutoff.toISOString().slice(0, 10));

  function toggleDate(value) {
    if (mutationBusy.current) return;
    setSelectedDates(prev => {
      if (prev.includes(value)) {
        return prev.filter(v => v !== value);
      }
      return prev.length < 30 ? [...prev, value] : prev;
    });
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadOptions(selectedClient);
    return () => { optionsRequest.current += 1; };
  }, [selectedClient]);

  async function loadOptions(clientId) {
    const revision = ++optionsRequest.current;
    const previous = reviewedOptions.current;
    setOptions([]);
    setOptionsError('');
    if (!clientId) { reviewedOptions.current = []; setOptionsLoading(false); return true; }
    setOptionsLoading(true);
    try {
      const rows = await api.getAbsenceOptions(clientId);
      if (revision !== optionsRequest.current) return false;
      if (!Array.isArray(rows)) throw new Error('Nieprawidłowa lista terminów. Odśwież aplikację.');
      setOptions(rows || []);
      reviewedOptions.current = rows || [];
      // A refreshed slot must never silently turn a free scheduling block into
      // a paid cancellation, or carry consent over to an edited/replaced event.
      const available = new Set((rows || []).filter(row => previous.some(old =>
        old.date === row.date && old.hour === row.hour && old.kind === row.kind &&
        old.event_id === row.event_id && old.updated_at === row.updated_at && old.paired === row.paired
      )).map(row => `${row.date}|${row.hour}`));
      setSelectedDates(prev => prev.filter(key => available.has(key)));
      return true;
    } catch (e) {
      if (revision === optionsRequest.current) { setOptionsError(e.message || 'Nie udało się pobrać terminów.'); setSelectedDates([]); }
      return false;
    } finally {
      if (revision === optionsRequest.current) setOptionsLoading(false);
    }
  }

  async function loadData() {
    setLoading(true);
    setLoadError('');
    try {
      const [cls, abs] = await Promise.all([
        api.getClients(),
        api.getAbsences()
      ]);
      setClients(cls || []);
      setAbsences(abs || []);
      return true;
    } catch (e) {
      setLoadError(e.message || 'Nie udało się pobrać absencji.');
      return false;
    } finally {
      setLoading(false);
    }
  }

  const upcomingDates = options.map(row => ({ ...row, dateStr: row.date,
    label: `${new Date(row.date + 'T12:00:00Z').toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Warsaw' })} - ${row.hour}:00`,
    value: `${row.date}|${row.hour}` }));

  async function handleAddAbsence() {
    if (mutationBusy.current || loading || optionsLoading || loadError || optionsError) return;
    if (!selectedClient || selectedDates.length === 0) {
      Alert.alert('Błąd', 'Wybierz klienta i przynajmniej jedną datę.');
      return;
    }

    mutationBusy.current = true;
    setAdding(true);
    try {
      const pending = upcomingDates.filter(row => selectedDates.includes(row.value));
      if (pending.length !== selectedDates.length) throw new Error('Lista terminów zmieniła się. Wybierz terminy ponownie.');
      const result = await api.createAbsences(pending.map(row => ({client_id: selectedClient,
        absence_date: row.date, absence_hour: row.hour, paid: row.kind === 'event', mode: row.kind === 'event' ? 'cancel' : 'schedule',
        expected_event_id: row.event_id, expected_updated_at: row.updated_at})));
      if (!Array.isArray(result) || result.length !== pending.length) throw new Error('Brak pełnego potwierdzenia zapisu. Odśwież listę przed ponowieniem.');
      setSelectedDates([]);
      const refreshed = await Promise.all([loadData(), loadOptions(selectedClient)]);
      const cancelled = pending.filter(row => row.kind === 'event').length;
      const scheduled = pending.length - cancelled;
      Alert.alert('Zapisano absencje', `Zapisano: ${pending.length}.${scheduled ? ` Absencje ze stałego grafiku: ${scheduled}. Kopiowanie tygodnia pominie te terminy; pakiet pozostaje bez zmian.` : ''}${cancelled ? ` Płatne odwołania istniejących treningów: ${cancelled}.` : ''}${refreshed.every(Boolean) ? '' : ' Nie udało się odświeżyć wszystkich danych. Użyj przycisku ponowienia.'}`);
    } catch (e) {
      await Promise.all([loadData(), loadOptions(selectedClient)]);
      Alert.alert('Błąd', e.message);
    } finally {
      mutationBusy.current = false;
      setAdding(false);
    }
  }

  async function handleDeleteAbsence(id) {
    if (mutationBusy.current) return;
    mutationBusy.current = true;
    let removed = false;
    try {
      const confirmed = await askConfirmation('Usuń oznaczenie absencji',
        'Usunąć oznaczenie nieobecności? Odwołany trening i jego rozliczenie pozostaną bez zmian. Usunięcie oznaczenia pozwala ponownie zaplanować ten termin.', 'Usuń oznaczenie');
      if (!confirmed) return;
      setDeleting(id);
      await api.deleteAbsence(id);
      await Promise.all([loadData(), loadOptions(selectedClient)]);
      removed = true;
    } catch (e) {
      await Promise.all([loadData(), loadOptions(selectedClient)]);
      Alert.alert('Błąd', e.message);
    } finally {
      mutationBusy.current = false;
      setDeleting(null);
      if (removed) requestAnimationFrame(() => datesToggleRef.current?.focus?.());
    }
  }

  return (
    <AppLayout navigation={navigation} title="Absencje" showBack>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Zgłoś Absencję</Text>
          <Text style={styles.desc}>Wybierz klienta oraz termin. Możesz zgłosić absencję ze stałego grafiku przed skopiowaniem tygodnia — bez naliczania treningu. Odwołanie treningu już wpisanego do kalendarza jest płatne. Możesz zaznaczyć do 30 dat.</Text>

          <Text style={styles.label}>1. Wybierz Klienta</Text>
          <DropdownPicker
            disabled={adding || deleting !== null || loading}
            placeholder="Wybierz klienta"
            selectedValue={selectedClient}
            onValueChange={value => { if (mutationBusy.current) return; setSelectedClient(value); setSelectedDates([]); setDropdownOpen(false); }}
            style={styles.pickerWrap}
            dropdownIconColor={themeColors.textSecondary}
            items={[
              { label: "— Wybierz —", value: "", color: themeColors.textMuted },
              ...clients.map(c => ({ label: c.name, value: c.id, color: themeColors.text }))
            ]}
          />

          <Text style={styles.label}>2. Wybierz Datę</Text>
          <TouchableOpacity
            ref={datesToggleRef}
            accessibilityRole="button" accessibilityState={{ expanded: dropdownOpen, disabled: adding || deleting !== null }} aria-expanded={dropdownOpen}
            accessibilityLabel={selectedDates.length === 0 ? '— Rozwiń listę dat —' : `Zaznaczono dat: ${selectedDates.length}`}
            disabled={adding || deleting !== null}
            style={styles.dropdownHeader}
            onPress={() => setDropdownOpen(!dropdownOpen)}
            activeOpacity={0.7}
          >
            <Text style={{ color: themeColors.text }}>
              {selectedDates.length === 0 ? '— Rozwiń listę dat —' : `Zaznaczono dat: ${selectedDates.length}`}
            </Text>
            <Ionicons name={dropdownOpen ? "chevron-up" : "chevron-down"} size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>

          {dropdownOpen && (
            <View style={styles.dropdownList}>
              {optionsLoading ? <ActivityIndicator accessibilityLabel="Wczytywanie terminów" color={C.accent} style={{ padding: 16 }} /> : optionsError ? (
                <View style={{ padding: 16 }}><Text accessibilityRole="alert" style={[styles.desc, { color: themeColors.text }]}>{optionsError}</Text>
                  <TouchableOpacity accessibilityRole="button" onPress={() => loadOptions(selectedClient)} style={styles.btn}><Text style={styles.absDate}>Ponów odczyt terminów</Text></TouchableOpacity></View>
              ) : upcomingDates.length === 0 ? (
                <Text style={[styles.desc, { fontStyle: 'italic', padding: 16 }]}>
                  {selectedClient ? 'Brak dostępnych terminów w najbliższych 60 dniach.' : 'Wybierz najpierw klienta.'}
                </Text>
              ) : (
                upcomingDates.map(d => {
                  const isSelected = selectedDates.includes(d.value);
                  const disabled = adding || deleting !== null || (!isSelected && selectedDates.length >= 30);
                  return (
                    <TouchableOpacity
                      key={d.value}
                      accessibilityRole="button" aria-pressed={isSelected} accessibilityState={{ disabled, selected: isSelected }} disabled={disabled}
                      style={styles.dropdownItem}
                      onPress={() => toggleDate(d.value)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, isSelected && { backgroundColor: C.accent, borderColor: C.accent }]}>
                        {isSelected && <Ionicons name="checkmark" size={14} color={themeColors.background} />}
                      </View>
                      <Text style={styles.dropdownItemText}>
                        {d.label} ({d.dateStr})
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: adding || deleting !== null || loading || optionsLoading || !!loadError || !!optionsError || !selectedDates.length }} style={[styles.btn, { backgroundColor: C.accent }, (adding || loading || !!loadError || !selectedDates.length) && { opacity: 0.6 }]} onPress={handleAddAbsence} disabled={adding || deleting !== null || loading || optionsLoading || !!loadError || !!optionsError || !selectedDates.length}>
            {adding ? <ActivityIndicator color={themeColors.background} size="small" /> : <Text style={styles.btnText}>Zapisz Absencję</Text>}
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Zgłoszone Absencje (do 30 dni wstecz)</Text>
        {loading ? (
          <ActivityIndicator color={C.accent} style={{ marginTop: 20 }} />
        ) : loadError ? (
          <View><Text accessibilityRole="alert" style={styles.empty}>{loadError}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={loadData} style={styles.btn}><Text style={styles.absDate}>Spróbuj ponownie</Text></TouchableOpacity></View>
        ) : visibleAbsences.length === 0 ? (
          <Text style={styles.empty}>Brak zgłoszonych absencji w wyświetlanym okresie.</Text>
        ) : (
          visibleAbsences.map(abs => {
            const isPast = abs.absence_date < todayStr;

            return (
              <View key={abs.id} style={[styles.absRow, isPast && { opacity: 0.6 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.absClient}>{abs.clients?.name}</Text>
                  <Text style={styles.absDate}>
                    {new Date(abs.absence_date + 'T12:00:00').toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {abs.absence_hour != null ? ` - ${abs.absence_hour}:00` : ''}
                  </Text>
                </View>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Usuń absencję: ${abs.clients?.name}, ${abs.absence_date}`} accessibilityState={{ disabled: adding || deleting !== null }} disabled={adding || deleting !== null} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}} onPress={() => handleDeleteAbsence(abs.id)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                  <Ionicons name="trash-outline" size={20} color={themeColors.danger} />
                </TouchableOpacity>
              </View>
            );
          })
        )}

      </ScrollView>
    </AppLayout>
  );
}

function makeStyles(C, TC, mode) { return StyleSheet.create({
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: 100, paddingTop: 16 },
  card: { backgroundColor: TC.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: TC.border },
  sectionTitle: { color: TC.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  desc: { color: TC.textSecondary, fontSize: 13, marginBottom: 16, lineHeight: 18 },
  label: { color: TC.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' },
  pickerWrap: { backgroundColor: TC.surfaceLight, borderRadius: 10, borderWidth: 1, borderColor: TC.border, overflow: 'hidden', marginBottom: 16 },
  picker: { color: TC.text, height: 50, backgroundColor: TC.surfaceLight },
  btn: { borderRadius: 10, padding: 16, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#0d1117', fontWeight: '700', fontSize: 14 },

  dropdownHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: TC.surfaceLight, borderRadius: 10, borderWidth: 1, borderColor: TC.border,
    paddingHorizontal: 16, height: 50, marginBottom: 16
  },
  dropdownList: {
    backgroundColor: TC.surfaceLight, borderRadius: 10, borderWidth: 1, borderColor: TC.border,
    marginBottom: 16, overflow: 'hidden'
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderBottomWidth: 1, borderBottomColor: TC.border
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: TC.textSecondary,
    marginRight: 12, alignItems: 'center', justifyContent: 'center'
  },
  dropdownItemText: {
    color: TC.text, fontSize: 14, flex: 1, flexShrink: 1
  },

  empty: { color: TC.text, fontSize: 14, textAlign: 'center', marginTop: 20 },
  absRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: TC.surface, padding: 16, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: TC.border },
  absClient: { color: TC.text, fontSize: 15, fontWeight: '700' },
  absDate: { color: mode === 'light' ? TC.text : C.accent, fontSize: 13, fontWeight: '600', marginTop: 4, textTransform: 'capitalize' },
}); }
