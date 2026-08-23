import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import { Ionicons } from '@expo/vector-icons';
import { SPACING } from '../assets/theme';
import { useTheme } from '../context/ThemeContext';
import AppLayout from '../components/AppLayout';
import * as api from '../services/api';

export default function AbsencesScreen({ navigation }) {
  const { colors: C, themeColors } = useTheme();
  const styles = useMemo(() => makeStyles(C, themeColors), [C, themeColors]);
  
  const [clients, setClients] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedDates, setSelectedDates] = useState([]);
  const [adding, setAdding] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  function toggleDate(value) {
    setSelectedDates(prev => {
      if (prev.includes(value)) {
        return prev.filter(v => v !== value);
      }
      return [...prev, value];
    });
  }

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [cls, abs] = await Promise.all([
        api.getClients(),
        api.getAbsences()
      ]);
      setClients(cls || []);
      setAbsences(abs || []);
    } catch (e) {
      console.log('Error loading absences:', e);
    }
    setLoading(false);
  }

  // Generate next 60 days of scheduled sessions based on client's training schedule
  const upcomingDates = useMemo(() => {
    if (!selectedClient) return [];
    const clientObj = clients.find(c => c.id === selectedClient);
    if (!clientObj || !clientObj.training_schedule || clientObj.training_schedule.length === 0) return [];

    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      
      const jsDay = d.getDay(); // 0=Sun, 1=Mon...
      const isoDay = jsDay === 0 ? 7 : jsDay; // 1=Mon...7=Sun
      
      // schedule.day is 0=Mon..5=Sat, isoDay is 1=Mon..7=Sun
      const matches = clientObj.training_schedule.filter(s => (Number(s.day) + 1) === isoDay);
      
      matches.forEach(match => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${day}`;
        const label = d.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' });
        
        dates.push({ 
          dateStr, 
          hour: match.hour || 8,
          label: `${label} - ${match.hour || 8}:00`,
          value: `${dateStr}|${match.hour || 8}`
        });
      });
      
      if (dates.length >= 30) break;
    }
    return dates;
  }, [selectedClient, clients]);

  async function handleAddAbsence() {
    if (!selectedClient || selectedDates.length === 0) {
      Alert.alert('Błąd', 'Wybierz klienta i przynajmniej jedną datę.');
      return;
    }
    
    const clientObj = clients.find(c => c.id === selectedClient);
    if (!clientObj?.training_schedule || clientObj.training_schedule.length === 0) {
      Alert.alert(
        'Brak harmonogramu',
        'Ten klient nie ma zdefiniowanego Harmonogramu stałych treningów w swoim profilu.\n\nFunkcja Absencji jest przeznaczona wyłącznie dla klientów o stałych godzinach.'
      );
      return;
    }

    setAdding(true);
    try {
      await Promise.all(selectedDates.map(async (val) => {
        const [d, h] = val.split('|');
        return api.createAbsence({
          client_id: selectedClient,
          absence_date: d,
          absence_hour: parseInt(h, 10)
        });
      }));

      setSelectedClient('');
      setSelectedDates([]);
      await loadData();
      Alert.alert('Sukces', `Zgłoszono absencje (${selectedDates.length}). Treningi zostały oznaczone jako odwołane.`);
    } catch (e) {
      Alert.alert('Błąd', e.message);
    }
    setAdding(false);
  }

  async function handleDeleteAbsence(id) {
    try {
      await api.deleteAbsence(id);
      loadData();
    } catch (e) {
      Alert.alert('Błąd', e.message);
    }
  }

  return (
    <AppLayout navigation={navigation} title="Absencje" showBack>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Zgłoś Absencję</Text>
          <Text style={styles.desc}>Wybierz klienta oraz datę, w której nie pojawi się na treningu. Menedżer tygodnia uwzględni tę informację przy kopiowaniu.</Text>
          
          <Text style={styles.label}>1. Wybierz Klienta (Tylko ze stałym grafikiem)</Text>
          <DropdownPicker
            placeholder="— Wybierz —"
            selectedValue={selectedClient}
            onValueChange={setSelectedClient}
            style={styles.pickerWrap}
            dropdownIconColor={themeColors.textSecondary}
            items={[
              { label: "— Wybierz —", value: "", color: themeColors.textMuted },
              ...clients.map(c => {
                const hasSchedule = c.training_schedule && c.training_schedule.length > 0;
                return {
                  label: hasSchedule ? c.name : `${c.name} (Brak stałych godzin)`,
                  value: c.id,
                  color: hasSchedule ? themeColors.text : themeColors.textMuted
                };
              })
            ]}
          />

          <Text style={styles.label}>2. Wybierz Datę</Text>
          <TouchableOpacity 
            style={styles.dropdownHeader} 
            onPress={() => setDropdownOpen(!dropdownOpen)}
            activeOpacity={0.7}
          >
            <Text style={{ color: selectedDates.length ? themeColors.text : themeColors.textMuted }}>
              {selectedDates.length === 0 ? '— Rozwiń listę dat —' : `Zaznaczono dat: ${selectedDates.length}`}
            </Text>
            <Ionicons name={dropdownOpen ? "chevron-up" : "chevron-down"} size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>

          {dropdownOpen && (
            <View style={styles.dropdownList}>
              {upcomingDates.length === 0 ? (
                <Text style={[styles.desc, { fontStyle: 'italic', padding: 16 }]}>
                  Wybierz najpierw klienta ze stałym grafikiem.
                </Text>
              ) : (
                upcomingDates.map(d => {
                  const isSelected = selectedDates.includes(d.value);
                  return (
                    <TouchableOpacity 
                      key={d.value} 
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

          <TouchableOpacity style={[styles.btn, { backgroundColor: C.accent }, adding && { opacity: 0.6 }]} onPress={handleAddAbsence} disabled={adding}>
            {adding ? <ActivityIndicator color={themeColors.background} size="small" /> : <Text style={styles.btnText}>Zapisz Absencję</Text>}
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Zgłoszone Absencje (do 30 dni wstecz)</Text>
        {loading ? (
          <ActivityIndicator color={C.accent} style={{ marginTop: 20 }} />
        ) : absences.length === 0 ? (
          <Text style={styles.empty}>Brak zgłoszonych absencji.</Text>
        ) : (
          absences.map(abs => {
            const absDate = new Date(abs.absence_date);
            const today = new Date(new Date().setHours(0,0,0,0));
            const diffTime = today - absDate;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays > 30) return null; // hide absences older than 30 days
            const isPast = diffDays > 0;

            return (
              <View key={abs.id} style={[styles.absRow, isPast && { opacity: 0.6 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.absClient}>{abs.clients?.name}</Text>
                  <Text style={styles.absDate}>
                    {new Date(abs.absence_date).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {abs.absence_hour != null ? ` - ${abs.absence_hour}:00` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteAbsence(abs.id)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
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

function makeStyles(C, TC) { return StyleSheet.create({
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: 100, paddingTop: 16 },
  card: { backgroundColor: TC.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: TC.border },
  sectionTitle: { color: TC.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  desc: { color: TC.textSecondary, fontSize: 13, marginBottom: 16, lineHeight: 18 },
  label: { color: TC.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' },
  pickerWrap: { backgroundColor: TC.surfaceLight, borderRadius: 10, borderWidth: 1, borderColor: TC.border, overflow: 'hidden', marginBottom: 16 },
  picker: { color: TC.text, height: 50, backgroundColor: TC.surfaceLight },
  btn: { borderRadius: 10, padding: 16, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: TC.background, fontWeight: '700', fontSize: 14 },
  
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
    color: TC.text, fontSize: 14
  },
  
  empty: { color: TC.textMuted, fontSize: 14, textAlign: 'center', marginTop: 20 },
  absRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: TC.surface, padding: 16, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: TC.border },
  absClient: { color: TC.text, fontSize: 15, fontWeight: '700' },
  absDate: { color: C.accent, fontSize: 13, fontWeight: '600', marginTop: 4, textTransform: 'capitalize' },
}); }
