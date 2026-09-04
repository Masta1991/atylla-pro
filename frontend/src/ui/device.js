// Atylla Pro — wykrywanie typu urządzenia (telefon vs tablet) dla webu.
// Telefon: kalendarz 3 dni ze scrollem (jak dotąd, bez zmian).
// Tablet: cały tydzień Pon–Sob (6 dni) naraz, bez scrolla poziomego.

import { useState, useEffect } from 'react';
import { Dimensions, Platform } from 'react-native';

// Próg wg wytycznych Androida: mniejszy bok >= 600dp oznacza tablet (7"+).
export const TABLET_SMALLEST_SIDE_DP = 600;

export function getDeviceType(window = Dimensions.get('window')) {
  if (Platform.OS === 'ios' && Platform.isPad === true) {
    return 'tablet';
  }
  const smallestSide = Math.min(window.width, window.height);
  return smallestSide >= TABLET_SMALLEST_SIDE_DP ? 'tablet' : 'phone';
}

export function isTabletDevice(window) {
  return getDeviceType(window) === 'tablet';
}

// Hook: zwraca 'phone' | 'tablet' i przełącza układ na żywo (rotacja, resize okna).
export function useDeviceType() {
  const [deviceType, setDeviceType] = useState(() => getDeviceType());

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDeviceType(getDeviceType(window));
    });
    return () => subscription?.remove();
  }, []);

  return deviceType;
}
