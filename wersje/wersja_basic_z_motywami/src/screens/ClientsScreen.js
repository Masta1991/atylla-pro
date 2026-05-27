import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING } from '../assets/theme';
import * as api from '../services/api';
import AppLayout from '../components/AppLayout';
import { useTheme } from '../context/ThemeContext';

export default function ClientsScreen({ navigation }) {
  const { colors: C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const [clients, setClients] = useState([]);
  const [workoutTypes, setWorkoutTypes] = useState({});
  const [loading, setLoading] = useState(true);

  const loadClients = useCallback(async () => {
    try {
      const [data, wt] = await Promise.all([
        api.getClients(),
        api.getWorkoutTypes(),
      ]);
      setClients(data || []);
      const map = {};
      (wt || []).forEach(t => { map[t.id] = t.name; });
      setWorkoutTypes(map);
    } catch (e) {
      console.log('Load clients error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadClients(); }, [loadClients]));

  async function handleDelete(id, name) {
    Alert.alert('Usuń klienta', `Usunąć ${name}?`, [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: async () => { await api.deleteClient(id); loadClients(); } },
    ]);
  }

  if (loading) {
    return (
      <AppLayout navigation={navigation} title="Klienci" showBack>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
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

function makeStyles(C) { return StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  addBtn: { backgroundColor: C.accent, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  addBtnText: { color: COLORS.background, fontWeight: '700', fontSize: 13 },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: 100 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.accent + '30', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: C.accent, fontSize: 18, fontWeight: '700' },
  cardInfo: { flex: 1 },
  cardName: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  cardDetail: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  measureBtn: { color: C.accent, fontSize: 13, fontWeight: '600' },
  cardActions: { alignItems: 'flex-end', gap: 6 },
  editBtn: { backgroundColor: C.accent + '20', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  editBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  deleteBtn: { backgroundColor: C.accent + '20', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  deleteBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  empty: { color: COLORS.textMuted, textAlign: 'center', marginTop: 40, fontSize: 16 },
}); }
