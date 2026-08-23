import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING } from '../assets/theme';
import { useTheme } from '../context/ThemeContext';
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
  const { colors: C, themeColors } = useTheme();
  const styles = useMemo(() => makeStyles(C.accent, themeColors), [C.accent, themeColors]);

  return (
    <AppLayout navigation={navigation} title="Dashboard" showBack>
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {TILES.map((tile, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.tile}
            onPress={() => navigation.navigate(tile.route)}
            activeOpacity={0.8}
          >
            <Ionicons name={tile.icon} size={36} color={C.accent} style={{ opacity: 0.6, position: 'absolute', right: 16, top: 16 }} />
            <Text style={styles.tileLabel}>{tile.label}</Text>
            <Text style={styles.tileTitle}>{tile.title}</Text>
            <Text style={styles.tileDesc}>{tile.desc}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </AppLayout>
  );
}

function makeStyles(accent, TC) {
  return StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.md, gap: SPACING.md, paddingBottom: 100 },
    tile: {
      width: '47%', aspectRatio: 1.1, backgroundColor: TC.surface,
      borderRadius: 20, padding: 20, borderWidth: 1, borderColor: TC.border,
      justifyContent: 'flex-end', overflow: 'hidden',
    },
    tileLabel: { fontSize: 10, fontWeight: '700', color: accent, letterSpacing: 1.5, textTransform: 'uppercase' },
    tileTitle: { fontSize: 18, fontWeight: '700', color: TC.text, marginTop: 4 },
    tileDesc: { fontSize: 11, color: TC.textSecondary, marginTop: 2 },
  });
}
