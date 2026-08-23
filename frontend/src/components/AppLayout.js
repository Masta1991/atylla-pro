import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Image, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Svg, Path, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { COLORS } from '../assets/theme';
import { useTheme } from '../context/ThemeContext';
import { APP_VERSION } from '../version';

function AppLayout({ navigation, title, children, hideBottom, showBack }) {
  const { colors: C, barStyle, themeColors, mode } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const barBg = useMemo(() => {
    if (barStyle === 'pianoWhite') return '#FFFFFF';
    if (barStyle === 'pianoGrey') return '#2C2F36';
    if (barStyle === 'beige') return '#EADEC9';
    if (barStyle === 'greyGradient' || barStyle === 'glossyGlass') return 'transparent';
    return mode === 'light' ? '#FFFFFF' : '#000000'; // Force white bar in light mode if default
  }, [barStyle, mode]);

  const uniqueId = useMemo(() => Math.random().toString(36).substring(2, 9), []);
  const headerGradId = `headerGlassApp_${uniqueId}_${mode}`;
  const headerGradIdGrey = `headerGradApp_${uniqueId}_${mode}`;
  const bottomGradId = `bottomGradApp_${uniqueId}_${mode}`;
  const glassGradBottomId = `glassGradBottomApp_${uniqueId}_${mode}`;

  const styles = useMemo(() => makeStyles(C.accent, barBg, themeColors, insets), [C.accent, barBg, themeColors, insets]);

  const headerBgSvg = useMemo(() => {
    if (barStyle === 'greyGradient') return (
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id={headerGradIdGrey} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#3A3D46" />
            <Stop offset="100%" stopColor="#1E2024" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${headerGradIdGrey})`} />
      </Svg>
    );
    if (barStyle === 'glossyGlass') {
      const gradStops = mode === 'light' 
        ? <><Stop offset="0%" stopColor="rgba(255,253,245,0.92)" /><Stop offset="50%" stopColor="rgba(245,235,218,0.7)" /><Stop offset="100%" stopColor="rgba(235,222,198,0.8)" /></>
        : <><Stop offset="0%" stopColor="rgba(255,255,255,0.25)" /><Stop offset="30%" stopColor="rgba(80,80,90,0.6)" /><Stop offset="100%" stopColor="rgba(30,30,35,0.85)" /></>;
      return (
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, Platform.OS === 'web' && { backdropFilter: 'blur(20px)' }]}>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id={headerGradId} x1="1" y1="0" x2="0" y2="1">
                {gradStops}
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${headerGradId})`} />
          </Svg>
        </View>
      );
    }
    return null;
  }, [barStyle, mode, headerGradId, headerGradIdGrey]);

  const isLightBar = barStyle === 'pianoWhite' || barStyle === 'beige';
  const headerIconColor = mode === 'light' ? C.accent : (isLightBar ? '#000000' : C.accent);
  const headerTextColor = isLightBar ? '#555555' : themeColors.textSecondary;
  const appTitleColor = mode === 'light' ? C.accent : (isLightBar ? '#000000' : C.accent);

  const bottomIconColor = mode === 'light' ? C.accent : (isLightBar ? '#000000' : C.accent);
  const bottomTextColor = mode === 'light' ? C.accent : (isLightBar ? '#555555' : C.accent);
  const bottomVersionColor = isLightBar ? '#555555' : themeColors.textMuted;

  const notchSvg = useMemo(() => {
    const w = screenWidth;
    const cx = w / 2;
    const fillD = `M -100,1 L ${cx - 50},1 C ${cx - 35},1 ${cx - 25},30 ${cx},30 C ${cx + 25},30 ${cx + 35},1 ${cx + 50},1 L ${w + 100},1 L ${w + 100},90 L -100,90 Z`;
    const lineD = `M -100,1 L ${cx - 50},1 C ${cx - 35},1 ${cx - 25},30 ${cx},30 C ${cx + 25},30 ${cx + 35},1 ${cx + 50},1 L ${w + 100},1`;
    
    const fillValue = barStyle === 'greyGradient' ? `url(#${bottomGradId})` : (barStyle === 'glossyGlass' ? `url(#${glassGradBottomId})` : barBg);
    const strokeValue = barStyle === 'glossyGlass' ? (mode === 'light' ? 'rgba(210,195,165,0.5)' : 'rgba(255,255,255,0.15)') : C.accent;
    const strokeWidth = barStyle === 'glossyGlass' ? 1 : 2;
    
    return (
      <Svg width={w} height={90} style={[StyleSheet.absoluteFill, { overflow: 'visible' }]}>
        {barStyle === 'greyGradient' && (
          <Defs>
            <LinearGradient id={bottomGradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#3A3D46" />
              <Stop offset="100%" stopColor="#1E2024" />
            </LinearGradient>
          </Defs>
        )}
        {barStyle === 'glossyGlass' && (
          <Defs>
            <LinearGradient id={glassGradBottomId} x1="0" y1="0" x2="0" y2="1">
              {mode === 'light' ? (
                <>
                  <Stop offset="0%" stopColor="rgba(255,253,245,0.9)" />
                  <Stop offset="100%" stopColor="rgba(240,228,205,0.85)" />
                </>
              ) : (
                <>
                  <Stop offset="0%" stopColor="rgba(45,45,50,0.85)" />
                  <Stop offset="100%" stopColor="rgba(15,15,20,0.95)" />
                </>
              )}
            </LinearGradient>
          </Defs>
        )}
        <Path d={fillD} fill={fillValue} />
        <Path d={lineD} fill="none" stroke={strokeValue} strokeWidth={strokeWidth} />
      </Svg>
    );
  }, [screenWidth, C.accent, barBg, barStyle, mode, bottomGradId, glassGradBottomId]);

  return (
    <View style={styles.container}>
      <View style={[
        styles.iosHeader, 
        barStyle === 'glossyGlass' && { 
          borderBottomWidth: 1,
          borderBottomColor: mode === 'light' ? 'rgba(210,195,165,0.5)' : 'rgba(255,255,255,0.2)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          elevation: 6,
        }
      ]}>
        {headerBgSvg}
        <View style={styles.headerTopRow}><Text style={[styles.appTitle, { color: appTitleColor }]}>ATYLLA PRO</Text></View>
        <View style={styles.headerBottomRow}>
          {showBack ? (
            <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={26} color={headerIconColor} /></TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => navigation.navigate('MenuModal')}><Ionicons name="menu" size={32} color={headerIconColor} /></TouchableOpacity>
          )}
          <View style={styles.headerCenter}>{title ? <Text style={[styles.screenTitle, { color: headerTextColor }]}>{title}</Text> : null}</View>
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
            onPress={() => navigation.navigate('Calendar', { activateHistory: true })}
            activeOpacity={0.6}
          >
            <MaterialCommunityIcons name="history" size={32} color={bottomIconColor} />
            <Text style={[styles.bottomText, { color: bottomTextColor }]}>HISTORIA</Text>
          </TouchableOpacity>

          <View style={[styles.homeButtonWrapper, { left: screenWidth / 2 - 40 }]}>
            <TouchableOpacity
              style={[styles.homeButton, { borderColor: C.accent, backgroundColor: mode === 'light' ? '#FFFDF8' : '#1A1510' }]}
              onPress={() => navigation.navigate('Calendar')}
              activeOpacity={0.7}
            >
              <View style={{ width: 66, height: 66, borderRadius: 33, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: mode === 'light' ? '#FFFDF8' : '#1A1510' }}>
                <Image source={require('../../assets/dog-home-transparent2.png')} style={[styles.homeButtonImage, { tintColor: mode === 'light' ? '#3D3225' : C.accent }]} />
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 33, ...(Platform.OS === 'web' ? { boxShadow: mode === 'light' ? 'inset 0 0 14px 4px rgba(0,0,0,0.12)' : 'inset 0 0 18px 6px rgba(0,0,0,0.45)' } : {}) }} pointerEvents="none" />
              </View>
            </TouchableOpacity>
            <Text style={[styles.bottomText, { color: bottomTextColor, marginTop: 9 }]}>GŁÓWNA</Text>
          </View>

          <TouchableOpacity
            style={[styles.bottomSideBtn, { right: screenWidth / 4 - 35 }]}
            onPress={() => {
              const d = new Date();
              const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              navigation.navigate('Training', { date: todayStr });
            }}
            activeOpacity={0.6}
          >
            <MaterialCommunityIcons name="square-edit-outline" size={32} color={bottomIconColor} />
            <Text style={[styles.bottomText, { color: bottomTextColor }]}>EDYCJA</Text>
          </TouchableOpacity>

          <View style={styles.versionBadge}>
            <Text style={[styles.versionText, { color: bottomVersionColor }]}>v{APP_VERSION}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function makeStyles(accent, barBg, TC, insets) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: TC.background },
  iosHeader: { backgroundColor: barBg, paddingTop: Platform.OS === 'ios' ? Math.max(insets.top + 15, 55) : Math.max(insets.top + 5, 45), paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: accent, borderBottomLeftRadius: 22, borderBottomRightRadius: 22, overflow: 'hidden' },
  headerTopRow: { alignItems: 'center', marginBottom: 4 },
  appTitle: { color: accent, fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  headerBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  screenTitle: { color: TC.textSecondary, fontSize: 16, fontWeight: '600' },
  content: { flex: 1, paddingBottom: 80 },
  iosBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 90,
    backgroundColor: 'transparent', zIndex: 100, overflow: 'visible',
  },
  bottomSideBtn: { position: 'absolute', top: 12, width: 70, alignItems: 'center' },
  homeButtonWrapper: { position: 'absolute', top: -25, width: 80, alignItems: 'center', zIndex: 102 },
  homeButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#000000', borderWidth: 2, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 10 },
  homeButtonImage: { width: 90, height: 90 },
  bottomText: { fontSize: 10, fontWeight: '700', color: TC.textMuted, letterSpacing: 0.5, marginTop: 4 },
  versionBadge: { position: 'absolute', right: 16, bottom: 28 },
  versionText: { color: TC.textMuted, fontSize: 9, fontWeight: '600' },
});
}



export default AppLayout;
