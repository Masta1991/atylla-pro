import { useCallback, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDailyFact, millisecondsUntilNextFactDay } from '../services/dailyFacts';

export default function useDailyFact() {
  const [fact, setFact] = useState(() => getDailyFact());
  useFocusEffect(useCallback(() => {
    let timer;
    const refresh = () => {
      clearTimeout(timer);
      const now = new Date();
      setFact(getDailyFact(now));
      timer = setTimeout(refresh, millisecondsUntilNextFactDay(now) + 20);
    };
    const visibility = () => {
      if (!document.hidden) refresh();
    };
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
      else clearTimeout(timer);
    });
    if (Platform.OS === 'web') {
      document.addEventListener('visibilitychange', visibility);
      window.addEventListener('focus', refresh);
    }
    refresh();
    return () => {
      clearTimeout(timer);
      subscription.remove();
      if (Platform.OS === 'web') {
        document.removeEventListener('visibilitychange', visibility);
        window.removeEventListener('focus', refresh);
      }
    };
  }, []));
  return fact;
}
