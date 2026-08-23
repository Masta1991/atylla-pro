import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING } from '../assets/theme';
import { useTheme } from '../context/ThemeContext';
import AppLayout from '../components/AppLayout';
import * as api from '../services/api';

const SCREEN_W = Dimensions.get('window').width - 32;

const MONTHS = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];

function getMonday(date) { const d = new Date(date); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); d.setDate(diff); d.setHours(0,0,0,0); return d; }
function formatDateStr(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }

export default function ResultsScreen({ navigation }) {
  const { colors: C, themeColors } = useTheme();
  const styles = useMemo(() => makeStyles(C, themeColors), [C, themeColors]);
  
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [weekCounts, setWeekCounts] = useState([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [monthCancelled, setMonthCancelled] = useState(0);
  const [yearStats, setYearStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMonthData = useCallback(async () => {
    setLoading(true);
    try {
      // Get all weeks in this month
      const firstDay = new Date(viewYear, viewMonth, 1);
      const lastDay = new Date(viewYear, viewMonth + 1, 0);
      
      // Start from Monday of the week containing the 1st
      const startMonday = getMonday(firstDay);
      const weeks = [];
      const monday = new Date(startMonday);
      
      // Fetch up to 6 weeks of events to cover the month
      const fetches = [];
      for (let w = 0; w < 6; w++) {
        const d = new Date(monday);
        d.setDate(d.getDate() + w * 7);
        const monStr = formatDateStr(d);
        fetches.push(api.getWeekEvents(monStr).catch(() => []));
      }
      const allWeeks = await Promise.all(fetches);
      
      // Count events per week that fall within the month
      const counts = allWeeks.map((evts, wi) => {
        const mon = new Date(startMonday);
        mon.setDate(mon.getDate() + wi * 7);
        return evts.filter(ev => {
          const ed = new Date(ev.event_date);
          const inMonth = ed.getMonth() === viewMonth && ed.getFullYear() === viewYear;
          const isValidActive = ev.status === 'active' || (ev.status === 'cancelled' && ev.is_settled);
          return inMonth && isValidActive;
        }).length;
      });
      
      const cancelledCounts = allWeeks.map((evts, wi) => {
        const mon = new Date(startMonday);
        mon.setDate(mon.getDate() + wi * 7);
        return evts.filter(ev => {
          const ed = new Date(ev.event_date);
          const inMonth = ed.getMonth() === viewMonth && ed.getFullYear() === viewYear;
          const isCancelled = ev.status === 'deleted' || (ev.status === 'cancelled' && !ev.is_settled);
          return inMonth && isCancelled;
        }).length;
      });
      
      setWeekCounts(counts.filter((_, i) => {
        const mon = new Date(startMonday);
        mon.setDate(mon.getDate() + i * 7);
        // Include weeks that have any day in this month
        const sun = new Date(mon);
        sun.setDate(sun.getDate() + 6);
        return (mon.getMonth() === viewMonth && mon.getFullYear() === viewYear) ||
               (sun.getMonth() === viewMonth && sun.getFullYear() === viewYear);
      }));
      
      setMonthTotal(counts.reduce((a, b) => a + b, 0));
      setMonthCancelled(cancelledCounts.reduce((a, b) => a + b, 0));
      
      // Year stats (12 months)
      const stats = await api.getCalendarStats(12).catch(() => null);
      setYearStats(stats);
    } catch (e) {
      console.error('Stats error:', e);
    }
    setLoading(false);
  }, [viewYear, viewMonth]);

  useEffect(() => { loadMonthData(); }, [loadMonthData]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };
  const goCurrent = () => {
    setViewMonth(today.getMonth());
    setViewYear(today.getFullYear());
  };

  const isCurrentMonth = viewMonth === today.getMonth() && viewYear === today.getFullYear();

  // Year chart data
  const chartData = useMemo(() => {
    if (!yearStats?.chart_data) return null;
    return yearStats.chart_data.map(item => {
      const [y, m] = item.month.split('-');
      return { month: m, count: item.count, label: `${m}` };
    });
  }, [yearStats]);
  
  const maxChartVal = useMemo(() => {
    if (!yearStats?.chart_data) return 1;
    return Math.max(...yearStats.chart_data.map(i => i.count), 1);
  }, [yearStats]);

  return (
    <AppLayout navigation={navigation} title="Strefa Trenera" showBack>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Month navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.navArrow}>
            <Ionicons name="chevron-back" size={22} color={C.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={goCurrent} style={styles.monthLabel}>
            <Text style={styles.monthText}>{MONTHS[viewMonth]} {viewYear}</Text>
            {!isCurrentMonth && (
              <Text style={styles.todayHint}> (wróć do dziś)</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={nextMonth} style={styles.navArrow}>
            <Ionicons name="chevron-forward" size={22} color={C.accent} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={C.accent} style={{ marginVertical: 60 }} />
        ) : (
          <>
            {/* Monthly stats */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
              <View style={[styles.totalCard, { flex: 1, marginBottom: 0 }]}>
                <Text style={styles.totalLabel}>Odbyte</Text>
                <Text style={[styles.totalValue, { color: C.accent }]}>{monthTotal}</Text>
              </View>
              <View style={[styles.totalCard, { flex: 1, marginBottom: 0, borderColor: themeColors.danger + '40' }]}>
                <Text style={styles.totalLabel}>Odwołane</Text>
                <Text style={[styles.totalValue, { color: themeColors.danger }]}>{monthCancelled}</Text>
              </View>
            </View>

            {/* Weekly breakdown */}
            <Text style={styles.sectionTitle}>Treningi w tygodniach</Text>
            <View style={styles.weekRow}>
              {weekCounts.map((count, i) => (
                <View key={i} style={styles.weekCard}>
                  <Text style={styles.weekNum}>T{i+1}</Text>
                  <Text style={[styles.weekCount, { color: count > 0 ? C.accent : themeColors.textMuted }]}>{count}</Text>
                </View>
              ))}
              {weekCounts.length === 0 && (
                <Text style={styles.noData}>Brak danych</Text>
              )}
            </View>

            {/* Year chart */}
            {chartData && (
              <>
                <Text style={styles.sectionTitle}>Treningi w całym roku</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                  <View style={styles.chartContainer}>
                    {chartData.map((item, i) => {
                      const h = maxChartVal > 0 ? (item.count / maxChartVal) * 130 : 0;
                      const isCurrent = parseInt(item.month) === today.getMonth() + 1;
                      return (
                        <View key={i} style={styles.chartCol}>
                          <View style={styles.chartBarArea}>
                            {item.count > 0 && <Text style={styles.chartVal}>{item.count}</Text>}
                            <View style={[styles.chartBar, { height: h, backgroundColor: isCurrent ? C.accent : C.accent + '60' }]} />
                          </View>
                          <Text style={[styles.chartLabel, isCurrent && { color: C.accent, fontWeight: '800' }]}>{item.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </>
            )}
          </>
        )}
      </ScrollView>
    </AppLayout>
  );
}

function makeStyles(C, TC) {
  return StyleSheet.create({
    scroll: { paddingHorizontal: SPACING.md, paddingBottom: 100 },
    monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: SPACING.md, marginBottom: 20 },
    navArrow: { padding: 8 },
    monthLabel: { flexDirection: 'row', alignItems: 'center', minWidth: 160, justifyContent: 'center' },
    monthText: { color: TC.text, fontSize: 18, fontWeight: '800' },
    todayHint: { color: C.accent, fontSize: 11, fontWeight: '600' },
    totalCard: {
      backgroundColor: TC.surface, borderRadius: 20, borderWidth: 1, borderColor: TC.border,
      padding: 24, alignItems: 'center', marginBottom: 20,
    },
    totalLabel: { color: TC.textSecondary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    totalValue: { fontSize: 48, fontWeight: '800' },
    sectionTitle: { color: TC.textSecondary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
    weekRow: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
    weekCard: {
      flex: 1, minWidth: 60, backgroundColor: TC.surface, borderRadius: 14, borderWidth: 1, borderColor: TC.border,
      padding: 12, alignItems: 'center',
    },
    weekNum: { color: TC.textMuted, fontSize: 10, fontWeight: '700', marginBottom: 4 },
    weekCount: { fontSize: 22, fontWeight: '800' },
    noData: { color: TC.textMuted, textAlign: 'center', marginVertical: 20, fontSize: 13 },
    chartContainer: { flexDirection: 'row', alignItems: 'flex-end', height: 180, paddingBottom: 20, paddingTop: 30, paddingHorizontal: 10, backgroundColor: TC.surface, borderRadius: 16, borderWidth: 1, borderColor: TC.border },
    chartCol: { width: 36, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
    chartBarArea: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
    chartBar: { width: 16, borderRadius: 4 },
    chartVal: { color: TC.text, fontSize: 10, fontWeight: '800' },
    chartLabel: { color: TC.textSecondary, fontSize: 9, fontWeight: '600', marginTop: 6 },
  });
}
