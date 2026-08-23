import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../assets/theme';
import { useTheme, THEMES, BAR_STYLES } from '../context/ThemeContext';
import AppLayout from '../components/AppLayout';
import * as api from '../services/api';
import { APP_VERSION } from '../version';

const API_BASE = 'https://atylla-pro-production.up.railway.app';

export default function SettingsScreen({ navigation }) {
  const { theme, colors: C, setTheme, barStyle, setBarStyle, mode, setMode, themeColors } = useTheme();
  const styles = useMemo(() => makeStyles(C.accent, themeColors), [C.accent, themeColors]);
  const [checking, setChecking] = useState(false);
  const [updateMsg, setUpdateMsg] = useState(null);

  const isNewerVersion = (serverV, localV) => {
    const s = serverV.split('.').map(Number);
    const l = localV.split('.').map(Number);
    for (let i = 0; i < Math.max(s.length, l.length); i++) {
      const sv = s[i] || 0;
      const lv = l[i] || 0;
      if (sv > lv) return true;
      if (sv < lv) return false;
    }
    return false;
  };

  const checkUpdate = async () => {
    setChecking(true);
    setUpdateMsg(null);
    try {
      const r = await fetch(`${API_BASE}/version`);
      const data = await r.json();
      if (data.version && isNewerVersion(data.version, APP_VERSION)) {
        setUpdateMsg({ available: true, serverVersion: data.version });
      } else {
        setUpdateMsg({ available: false });
      }
    } catch (e) {
      setUpdateMsg({ available: false, error: true });
    }
    setChecking(false);
  };

  const doUpdate = () => {
    if (typeof window !== 'undefined') {
      const reloadUrl = API_BASE + '/?v=' + new Date().getTime();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (let registration of registrations) {
            registration.unregister();
          }
          window.location.href = reloadUrl;
        }).catch(() => {
          window.location.href = reloadUrl;
        });
      } else {
        window.location.href = reloadUrl;
      }
    }
  };
  return (
    <AppLayout navigation={navigation} title="Ustawienia" showBack>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Text style={styles.sectionTitle}>Tryb (Mode)</Text>
        <View style={styles.themeRow}>
          <TouchableOpacity
            style={[styles.themeBtn, { borderColor: C.accent }, mode === 'dark' && { backgroundColor: C.accent + '25' }]}
            onPress={() => setMode('dark')}
          >
            <Ionicons name="moon-outline" size={16} color={mode === 'dark' ? C.accent : themeColors.textSecondary} />
            <Text style={[styles.themeName, mode === 'dark' && { color: C.accent }]}>Ciemny (Dark)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.themeBtn, { borderColor: C.accent }, mode === 'light' && { backgroundColor: C.accent + '25' }]}
            onPress={() => setMode('light')}
          >
            <Ionicons name="sunny-outline" size={16} color={mode === 'light' ? C.accent : themeColors.textSecondary} />
            <Text style={[styles.themeName, mode === 'light' && { color: C.accent }]}>Jasny (Light)</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Motyw kolorystyczny</Text>
        <View style={styles.themeRow}>
          {Object.entries(THEMES)
            .filter(([key]) => mode === 'light' ? (key === 'copper' || key === 'white') : true)
            .map(([key, t]) => {
              const displayName = (mode === 'light' && key === 'white') ? 'Czarny' : t.name;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.themeBtn, { borderColor: t.accent }, theme === key && { backgroundColor: t.accent + '25' }]}
                  onPress={() => setTheme(key)}
                >
                  <View style={[styles.themeDot, { backgroundColor: t.accent }]} />
                  <Text style={[styles.themeName, theme === key && { color: t.accent }]}>{displayName}</Text>
                </TouchableOpacity>
              );
          })}
        </View>



        <Text style={styles.sectionTitle}>Zarządzanie Treningami</Text>
        <TouchableOpacity 
          style={styles.navButton} 
          onPress={() => navigation.navigate('MuscleExercises')}
          activeOpacity={0.7}
        >
          <View style={styles.navButtonIcon}>
            <Ionicons name="barbell-outline" size={24} color={C.accent} />
          </View>
          <Text style={styles.navButtonText}>Ćwiczenia z podziałem na partie mięśniowe</Text>
          <Ionicons name="chevron-forward" size={20} color={themeColors.textMuted} />
        </TouchableOpacity>


        <TouchableOpacity 
          style={styles.navButton} 
          onPress={() => navigation.navigate('PlanManager')}
          activeOpacity={0.7}
        >
          <View style={styles.navButtonIcon}>
            <Ionicons name="create-outline" size={24} color={C.accent} />
          </View>
          <Text style={styles.navButtonText}>Edytor planów treningowych</Text>
          <Ionicons name="chevron-forward" size={20} color={themeColors.textMuted} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Aktualizacja</Text>
        <View style={[styles.navButton, { flexDirection: 'column', alignItems: 'stretch', padding: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={styles.navButtonIcon}>
                <Ionicons name="cloud-download-outline" size={24} color={C.accent} />
              </View>
              <View>
                <Text style={styles.navButtonText}>Wersja aplikacji</Text>
                <Text style={{ color: themeColors.textMuted, fontSize: 12 }}>Zainstalowana: v{APP_VERSION}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.updateBtn, checking && { opacity: 0.5 }]}
              onPress={checkUpdate}
              disabled={checking}
            >
              {checking ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.updateBtnText}>Sprawdź</Text>
              )}
            </TouchableOpacity>
          </View>
          {updateMsg && (
            <View style={[styles.updateMsgBox, updateMsg.available ? styles.updateMsgAvailable : null, { marginTop: 12 }]}>
              {updateMsg.error ? (
                <Text style={{ color: themeColors.textMuted, fontSize: 13 }}>Nie można sprawdzić. Spróbuj później.</Text>
              ) : updateMsg.available ? (
                <>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
                    Dostępna nowa wersja: v{updateMsg.serverVersion}
                  </Text>
                  <TouchableOpacity style={styles.updateRefreshBtn} onPress={doUpdate}>
                    <Ionicons name="refresh-outline" size={16} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>ODŚWIEŻ APLIKACJĘ</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={{ color: '#1dd1a1', fontSize: 13, fontWeight: '600' }}>
                  Aplikacja jest aktualna
                </Text>
              )}
            </View>
          )}
        </View>

      </ScrollView>
    </AppLayout>
  );
}

function makeStyles(accent, TC) {
  return StyleSheet.create({
    scroll: { paddingHorizontal: SPACING.lg, paddingBottom: 100 },
    sectionTitle: {
      color: accent, fontSize: 14, fontWeight: '700', marginTop: 24, marginBottom: 10,
      textTransform: 'uppercase', letterSpacing: 1,
    },
    themeRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 8 },
    themeBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
      borderWidth: 2, backgroundColor: TC.surface,
    },
    themeDot: { width: 16, height: 16, borderRadius: 8 },
    themeName: { color: TC.text, fontSize: 13, fontWeight: '600' },
    navButton: {
      flexDirection: 'row', alignItems: 'center', padding: 16,
      backgroundColor: TC.surface, borderRadius: 12, marginBottom: 12,
      borderWidth: 1, borderColor: TC.border,
    },
    navButtonIcon: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: TC.surfaceLight,
      justifyContent: 'center', alignItems: 'center', marginRight: 16,
    },
    navButtonText: { color: TC.text, fontSize: 15, fontWeight: '600', flex: 1 },
    updateBtn: { backgroundColor: accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
    updateBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    updateMsgBox: { padding: 10, borderRadius: 8, backgroundColor: TC.surfaceLight, alignItems: 'center' },
    updateMsgAvailable: { backgroundColor: accent },
    updateRefreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  });
}
