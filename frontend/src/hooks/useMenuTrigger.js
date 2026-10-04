import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

// Calendar and AppLayout both own triggers; restore the initiating control.
export default function useMenuTrigger(navigation) {
  const ref = useRef(null);
  const returnFromMenu = useRef(false);
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'web' || !returnFromMenu.current) return undefined;
    returnFromMenu.current = false;
    const frame = requestAnimationFrame(() => ref.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []));
  const open = useCallback(() => {
    returnFromMenu.current = true;
    navigation.navigate('MenuModal');
  }, [navigation]);
  return { ref, open };
}
