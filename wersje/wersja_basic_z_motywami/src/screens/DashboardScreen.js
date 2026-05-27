import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS } from '../assets/theme';
import AppLayout from '../components/AppLayout';

const TILES = [
  { label: 'KALENDARZ', title: 'Grafik', desc: 'Plan tygodniowy', icon: 'calendar', route: 'Kalendarz', tab: true },
  { label: 'TRENING', title: 'Rejestracja', desc: 'Zapisz trening', icon: 'barbell', route: 'Training' },
  { label: 'KLIENCI', title: 'Podopieczni', desc: 'Zarządzaj klientami', icon: 'people', route: 'Klienci', tab: true },
  { label: 'POMIARY', title: 'Pomiary', desc: 'Waga, tkanka', icon: 'body', route: 'Measurements' },
  { label: 'RAPORTY', title: 'Dokumentacja', desc: 'Wykresy, historia', icon: 'bar-chart', route: 'Reports' },
  { label: 'PLANY', title: 'Plany Treningowe', desc: 'Gotowe szablony', icon: 'clipboard', route: 'Plans' },
];

export default function DashboardScreen({ navigation }) {
  return (
    <AppLayout navigation={navigation} title="Dashboard" showBack>
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {TILES.map((tile, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.tile}
            onPress={() => tile.tab ? navigation.navigate(tile.route) : navigation.navigate(tile.route)}
            activeOpacity={0.8}
          >
            <Ionicons name={tile.icon} size={36} color={COLORS.accent} style={{ opacity: 0.6, position: 'absolute', right: 16, top: 16 }} />
            <Text style={styles.tileLabel}>{tile.label}</Text>
            <Text style={styles.tileTitle}>{tile.title}</Text>
            <Text style={styles.tileDesc}>{tile.desc}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.md, gap: SPACING.md, paddingBottom: 100 },
  tile: {
    width: '47%', aspectRatio: 1.1, backgroundColor: COLORS.surface,
    borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.border,
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  tileLabel: { fontSize: 10, fontWeight: '700', color: COLORS.accent, letterSpacing: 1.5, textTransform: 'uppercase' },
  tileTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: 4 },
  tileDesc: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
});
