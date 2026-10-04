import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import useDailyFact from '../hooks/useDailyFact';
import DailyFactStrip from '../components/DailyFactStrip';

const MENU_ITEMS = [
  { label: 'Klienci', icon: 'people', screen: 'Clients' },
  { label: 'Rozliczenia', icon: 'card-outline', screen: 'Payments' },
  { label: 'Strefa Trenera', icon: 'trending-up', screen: 'Results' },
  { label: 'Podsumowanie tygodnia', icon: 'calendar-outline', screen: 'WeekSummary' },
  { label: 'Absencje', icon: 'calendar-clear-outline', screen: 'Absences' },
  { label: 'Pomiary', icon: 'body', screen: 'Measurements' },
  { label: 'Raporty', icon: 'bar-chart', screen: 'Reports' },
  { label: 'Menadżer', icon: 'copy', screen: 'Manager' },
  { label: 'Plany treningowe', icon: 'clipboard', screen: 'Plans' },
  { label: 'Generator ćwiczeń i planów', icon: 'create-outline', screen: 'WorkoutGenerator' },
  { label: 'Ustawienia', icon: 'settings', screen: 'Settings' },
];

export default function HamburgerMenu({ navigation }) {
  const { colors: C, themeColors } = useTheme();
  const { signOut, email } = useAuth();
  const styles = useMemo(() => makeStyles(C, themeColors), [C, themeColors]);
  const fact = useDailyFact();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [layout, setLayout] = useState({ width: window.width, height: window.height });
  const [requiredWidth, setRequiredWidth] = useState(0);
  const closeRef = useRef(null);
  const baselineWidth = Math.max(0, layout.width - 280);
  const stripWidth = fact
    ? Math.min(Math.max(baselineWidth, requiredWidth), Math.max(baselineWidth, layout.width * 0.4))
    : baselineWidth;
  const dismiss = useCallback(() => navigation.goBack(), [navigation]);

  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'web') return undefined;
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', keydown); };
  }, [dismiss]));

  return (
    <View testID="main-menu" style={styles.container} onLayout={event => setLayout(event.nativeEvent.layout)}>
      <View testID="daily-fact-strip" style={[styles.backArea, { width: stripWidth }]}>
        <TouchableOpacity ref={closeRef} testID="close-menu" accessibilityRole="button" accessibilityLabel="Zamknij menu"
          style={StyleSheet.absoluteFill} onPress={dismiss} />
        {fact && <DailyFactStrip text={fact.text} width={stripWidth} height={layout.height} insets={insets} onMeasure={setRequiredWidth} />}
      </View>
      <View testID="menu-items-panel" style={[styles.menu, { width: layout.width - stripWidth, paddingTop: Math.max(60, insets.top + 20), paddingRight: insets.right }]}>
        <View style={styles.header}>
          <Text style={[styles.logo, { color: C.accent }]}>ATYLLA PRO</Text>
        </View>
        <ScrollView testID="menu-items-scroll" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom }}>
          {MENU_ITEMS.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              style={styles.item}
              onPress={() => {
                // Replace the menu route directly: no intermediate Calendar focus
                // and two unnecessary weekly API reads before every destination.
                navigation.replace(item.screen);
              }}
            >
              <Ionicons name={item.icon} size={20} color={themeColors.textSecondary} />
              <Text style={styles.itemLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={themeColors.textMuted} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Wyloguj" style={[styles.item, styles.logoutItem]} onPress={signOut}>
            <Ionicons name="log-out" size={20} color={C.accent} />
            <Text style={[styles.itemLabel, { color: C.accent }]}>Wyloguj</Text>
          </TouchableOpacity>
          {email ? (
            <View style={styles.emailFooter}>
              <Ionicons name="person-circle-outline" size={16} color={themeColors.textMuted} />
              <Text style={styles.emailText}>{email}</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

function makeStyles(C, TC) {
  return StyleSheet.create({
    container: { flex: 1, flexDirection: 'row', minHeight: 0, overflow: 'hidden' },
    backArea: { backgroundColor: '#000000', overflow: 'hidden' },
    menu: { backgroundColor: TC.surface, minHeight: 0 },
    header: { paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderColor: TC.border },
    logo: { fontSize: 18, fontWeight: '800', letterSpacing: 2 },
    item: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingVertical: 16, paddingHorizontal: 20,
      borderBottomWidth: 1, borderColor: TC.border,
    },
    itemLabel: { color: TC.text, fontSize: 15, fontWeight: '600', flex: 1, minWidth: 0,
      ...(Platform.OS === 'web' ? { overflowWrap: 'anywhere' } : {}) },
    logoutItem: { marginTop: 20, borderTopWidth: 1, borderColor: TC.border },
    emailFooter: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 16, paddingHorizontal: 20, marginTop: 4,
    },
    emailText: { color: TC.textMuted, fontSize: 12, flexShrink: 1, minWidth: 0,
      ...(Platform.OS === 'web' ? { overflowWrap: 'anywhere' } : {}) },
  });
}
