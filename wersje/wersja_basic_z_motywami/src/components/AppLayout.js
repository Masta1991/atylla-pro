import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Svg, Path } from 'react-native-svg';
import { COLORS } from '../assets/theme';
import { useTheme } from '../context/ThemeContext';

function AppLayout({ navigation, title, children, hideBottom, showBack }) {
  const { colors: C } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(C.accent), [C.accent]);

  const notchSvg = useMemo(() => {
    const w = screenWidth;
    const cx = w / 2;
    const fillD = `M -100,1 L ${cx - 50},1 C ${cx - 35},1 ${cx - 25},30 ${cx},30 C ${cx + 25},30 ${cx + 35},1 ${cx + 50},1 L ${w + 100},1 L ${w + 100},90 L -100,90 Z`;
    const lineD = `M -100,1 L ${cx - 50},1 C ${cx - 35},1 ${cx - 25},30 ${cx},30 C ${cx + 25},30 ${cx + 35},1 ${cx + 50},1 L ${w + 100},1`;
    return (
      <Svg width={w} height={90} style={[StyleSheet.absoluteFill, { overflow: 'visible' }]}>
        <Path d={fillD} fill={C.headerBg || COLORS.surface} />
        <Path d={lineD} fill="none" stroke={C.accent} strokeWidth={2} />
      </Svg>
    );
  }, [screenWidth, C.accent, C.headerBg]);

  return (
    <View style={styles.container}>
      <View style={styles.iosHeader}>
        <View style={styles.headerTopRow}><Text style={styles.appTitle}>ATYLLA PRO</Text></View>
        <View style={styles.headerBottomRow}>
          {showBack ? (
            <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={26} color={C.accent} /></TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => navigation.navigate('MenuModal')}><Ionicons name="menu" size={32} color={C.accent} /></TouchableOpacity>
          )}
          <View style={styles.headerCenter}>{title ? <Text style={styles.screenTitle}>{title}</Text> : null}</View>
          <View style={{ width: 32 }} />
        </View>
      </View>

      <View style={styles.content}>
        {children}
      </View>

      {!hideBottom && (
        <View style={styles.iosBottom}>
          {notchSvg}

          <TouchableOpacity
            style={[styles.bottomSideBtn, { left: screenWidth / 4 - 35 }]}
            onPress={() => navigation.navigate('Clients')}
            activeOpacity={0.6}
          >
            <MaterialCommunityIcons name="card-account-details" size={32} color={C.accent} />
            <Text style={[styles.bottomText, { color: C.accent }]}>KLIENCI</Text>
          </TouchableOpacity>

          <View style={[styles.homeButtonWrapper, { left: screenWidth / 2 - 40 }]}>
            <TouchableOpacity
              style={[styles.homeButton, { borderColor: C.accent, backgroundColor: C.headerBg || COLORS.surface }]}
              onPress={() => navigation.navigate('Calendar')}
              activeOpacity={0.7}
            >
              <View style={{ width: 66, height: 66, borderRadius: 33, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
                <Image source={require('../../assets/dog-home-transparent2.png')} style={[styles.homeButtonImage, { tintColor: C.accent }]} />
              </View>
            </TouchableOpacity>
            <Text style={[styles.bottomText, { color: C.accent, marginTop: 9 }]}>GŁÓWNA</Text>
          </View>

          <TouchableOpacity
            style={[styles.bottomSideBtn, { right: screenWidth / 4 - 35 }]}
            onPress={() => navigation.navigate('Training', { date: new Date().toISOString().slice(0, 10) })}
            activeOpacity={0.6}
          >
            <MaterialCommunityIcons name="square-edit-outline" size={32} color={C.accent} />
            <Text style={[styles.bottomText, { color: C.accent }]}>EDYCJA</Text>
          </TouchableOpacity>

          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>v1.0.15</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function makeStyles(accent) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  iosHeader: { backgroundColor: COLORS.surface, paddingTop: 40, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: accent },
  headerTopRow: { alignItems: 'center', marginBottom: 4 },
  appTitle: { color: accent, fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  headerBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  screenTitle: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '600' },
  content: { flex: 1, paddingBottom: 80 },
  iosBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 90,
    backgroundColor: 'transparent', zIndex: 100, overflow: 'visible',
  },
  bottomSideBtn: { position: 'absolute', top: 12, width: 70, alignItems: 'center' },
  homeButtonWrapper: { position: 'absolute', top: -25, width: 80, alignItems: 'center', zIndex: 102 },
  homeButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: COLORS.surface, borderWidth: 2, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 10 },
  homeButtonImage: { width: 90, height: 90 },
  bottomText: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5, marginTop: 4 },
  versionBadge: { position: 'absolute', right: 16, bottom: 12 },
  versionText: { color: COLORS.textMuted, fontSize: 9, fontWeight: '600' },
});
}



export default AppLayout;