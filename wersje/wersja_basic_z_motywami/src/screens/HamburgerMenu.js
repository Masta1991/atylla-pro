import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING } from '../assets/theme';
import { useTheme } from '../context/ThemeContext';

const MENU_ITEMS = [
  { label: 'Klienci', icon: 'people', screen: 'Clients' },
  { label: 'Pomiary', icon: 'body', screen: 'Measurements' },
  { label: 'Raporty', icon: 'bar-chart', screen: 'Reports' },
  { label: 'Plany treningowe', icon: 'clipboard', screen: 'Plans' },
  { label: 'Menadżer', icon: 'copy', screen: 'Manager' },
  { label: 'Ustawienia', icon: 'settings', screen: 'Settings' },
];

export default function HamburgerMenu({ navigation }) {
  const { colors: C } = useTheme();
  const { signOut } = useAuth();

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
              <Ionicons name={item.icon} size={20} color={COLORS.textSecondary} />
              <Text style={styles.itemLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.item, styles.logoutItem]} onPress={signOut}>
            <Ionicons name="log-out" size={20} color={C.accent} />
            <Text style={[styles.itemLabel, { color: C.accent }]}>Wyloguj</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row' },
  backArea: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  menu: { width: 280, backgroundColor: COLORS.surface, paddingTop: 60 },
  header: { paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderColor: COLORS.border },
  logo: { color: COLORS.accent, fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderColor: COLORS.border,
  },
  itemLabel: { color: COLORS.text, fontSize: 15, fontWeight: '600', flex: 1 },
  logoutItem: { marginTop: 20, borderTopWidth: 1, borderColor: COLORS.border },
});
