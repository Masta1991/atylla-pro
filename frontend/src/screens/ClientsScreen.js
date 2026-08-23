import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Alert, ActivityIndicator, RefreshControl, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { SPACING } from '../assets/theme';
import * as api from '../services/api';
import AppLayout from '../components/AppLayout';
import { useTheme } from '../context/ThemeContext';

// Shared global cache — readable by TrainingScreen, PaymentsScreen etc.
if (!global.cachedClients) global.cachedClients = null;
if (!global.cachedWorkoutTypesMap) global.cachedWorkoutTypesMap = null;

export default function ClientsScreen({ navigation }) {
  const { colors: C, themeColors } = useTheme();
  const styles = React.useMemo(() => makeStyles(C, themeColors), [C, themeColors]);
  const [clients, setClients] = useState(global.cachedClients || []);
  const [workoutTypes, setWorkoutTypes] = useState(global.cachedWorkoutTypesMap || {});
  const [loading, setLoading] = useState(!global.cachedClients);

  useEffect(() => {
    async function loadCachedData() {
      try {
        const storedClients = await AsyncStorage.getItem('cached_clients');
        const storedWorkoutTypes = await AsyncStorage.getItem('cached_workout_types_map');
        if (storedClients && !global.cachedClients) {
          const parsed = JSON.parse(storedClients);
          setClients(parsed);
          global.cachedClients = parsed;
          setLoading(false);
        }
        if (storedWorkoutTypes && !global.cachedWorkoutTypesMap) {
          const parsed = JSON.parse(storedWorkoutTypes);
          setWorkoutTypes(parsed);
          global.cachedWorkoutTypesMap = parsed;
        }
      } catch (e) {
        console.log('Error loading cache from storage', e);
      }
    }
    loadCachedData();
  }, []);

  const loadClients = useCallback(async () => {
    try {
      const [data, wt] = await Promise.all([
        api.getClients(),
        api.getWorkoutTypes(),
      ]);
      const fetchedClients = data || [];
      setClients(fetchedClients);
      global.cachedClients = fetchedClients;
      AsyncStorage.setItem('cached_clients', JSON.stringify(fetchedClients)).catch(() => {});

      const map = {};
      (wt || []).forEach(t => { map[t.id] = t.name; });
      setWorkoutTypes(map);
      global.cachedWorkoutTypesMap = map;
      AsyncStorage.setItem('cached_workout_types_map', JSON.stringify(map)).catch(() => {});
    } catch (e) {
      console.log('Load clients error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadClients(); }, [loadClients]));

  async function handleDelete(id, name) {
    if (Platform.OS === 'web') {
      if (window.confirm(`Usunąć ${name}?`)) {
        await api.deleteClient(id);
        loadClients();
      }
    } else {
      Alert.alert('Usuń klienta', `Usunąć ${name}?`, [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Usuń', style: 'destructive', onPress: async () => { await api.deleteClient(id); loadClients(); } },
      ]);
    }
  }

  if (loading) {
    return (
      <AppLayout navigation={navigation} title="Klienci" showBack>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: themeColors.background }}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout navigation={navigation} title="Klienci" showBack>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('ClientForm')}>
          <Text style={styles.addBtnText}>+ Dodaj</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadClients} tintColor={C.accent} />}
      >
        {clients.map(c => (
          <View key={c.id} style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{c.name?.charAt(0)?.toUpperCase() || '?'}</Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{c.name}</Text>
              {c.default_workout_type_id && workoutTypes[c.default_workout_type_id] ? (
                <Text style={styles.cardDetail}>Rodzaj: {workoutTypes[c.default_workout_type_id]}</Text>
              ) : null}
              {c.email ? <Text style={styles.cardDetail}>{c.email}</Text> : null}
              {c.join_date ? <Text style={styles.cardDetail}>Od: {c.join_date}</Text> : null}
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => navigation.navigate('ClientForm', { client: c })} style={styles.editBtn}>
                <Text style={styles.editBtnText}>Edytuj</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(c.id, c.name)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>Usuń</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Measurements', { clientId: c.id, clientName: c.name })}>
                <Text style={styles.measureBtn}>Pomiary →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {clients.length === 0 && (
          <Text style={styles.empty}>Brak klientów</Text>
        )}
      </ScrollView>
    </AppLayout>
  );
}

function makeStyles(C, TC) { return StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  addBtn: { backgroundColor: C.accent, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  addBtnText: { color: TC.background, fontWeight: '700', fontSize: 13 },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: 100 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: TC.surface, borderRadius: 16, padding: 16, marginBottom: SPACING.sm, borderWidth: 1, borderColor: TC.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.accent + '30', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: C.accent, fontSize: 18, fontWeight: '700' },
  cardInfo: { flex: 1 },
  cardName: { color: TC.text, fontSize: 16, fontWeight: '700' },
  cardDetail: { color: TC.textSecondary, fontSize: 12, marginTop: 2 },
  measureBtn: { color: C.accent, fontSize: 13, fontWeight: '600' },
  cardActions: { alignItems: 'flex-end', gap: 6 },
  editBtn: { backgroundColor: C.accent + '20', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  editBtnText: { color: C.accent, fontSize: 12, fontWeight: '700' },
  deleteBtn: { backgroundColor: TC.danger + '20', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  deleteBtnText: { color: TC.danger, fontSize: 12, fontWeight: '700' },
  empty: { color: TC.textMuted, textAlign: 'center', marginTop: 40, fontSize: 16 },
}); }
