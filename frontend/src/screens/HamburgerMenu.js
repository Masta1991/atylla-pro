import React, { useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const MENU_ITEMS = [
  { label: 'Klienci', icon: 'people', screen: 'Clients' },
  { label: 'Rozliczenia', icon: 'card-outline', screen: 'Payments' },
  { label: 'Zamknij dzień', icon: 'checkmark-done-outline', screen: 'DayClose' },
  { label: 'Strefa Trenera', icon: 'trending-up', screen: 'Results' },
  { label: 'Absencje', icon: 'calendar-clear-outline', screen: 'Absences' },
  { label: 'Pomiary', icon: 'body', screen: 'Measurements' },
  { label: 'Raporty', icon: 'bar-chart', screen: 'Reports' },
  { label: 'Menadżer', icon: 'copy', screen: 'Manager' },
  { label: 'Plany treningowe', icon: 'clipboard', screen: 'Plans' },
  { label: 'Ustawienia', icon: 'settings', screen: 'Settings' },
];

export default function HamburgerMenu({ navigation }) {
  const { colors: C, themeColors } = useTheme();
  const { signOut, email } = useAuth();
  const styles = useMemo(() => makeStyles(C, themeColors), [C, themeColors]);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backArea} onPress={() => navigation.goBack()} />
      <View style={styles.menu}>
        <View style={styles.header}>
          <Text style={[styles.logo, { color: C.accent }]}>ATYLLA PRO</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          {MENU_ITEMS.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.item}
              onPress={() => {
                navigation.goBack();
                setTimeout(() => navigation.navigate(item.screen), 100);
              }}
            >
              <Ionicons name={item.icon} size={20} color={themeColors.textSecondary} />
              <Text style={styles.itemLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={themeColors.textMuted} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.item, styles.logoutItem]} onPress={signOut}>
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
    container: { flex: 1, flexDirection: 'row' },
    backArea: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    menu: { width: 280, backgroundColor: TC.surface, paddingTop: 60 },
    header: { paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderColor: TC.border },
    logo: { fontSize: 18, fontWeight: '800', letterSpacing: 2 },
    item: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingVertical: 16, paddingHorizontal: 20,
      borderBottomWidth: 1, borderColor: TC.border,
    },
    itemLabel: { color: TC.text, fontSize: 15, fontWeight: '600', flex: 1 },
    logoutItem: { marginTop: 20, borderTopWidth: 1, borderColor: TC.border },
    emailFooter: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 16, paddingHorizontal: 20, marginTop: 4,
    },
    emailText: { color: TC.textMuted, fontSize: 12 },
  });
}
