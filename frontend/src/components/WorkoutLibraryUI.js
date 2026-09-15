import React, { useMemo, useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { PanelButton, usePanelTheme } from './TrainerPanels';
import DropdownPicker from './DropdownPicker';

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const luminance = hex => rgb(hex).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (a, b, fraction) => '#' + rgb(a).map((v, i) => Math.round(v * (1 - fraction) + rgb(b)[i] * fraction).toString(16).padStart(2, '0')).join('');

export function useLibraryTheme() {
  const base = usePanelTheme(), { C, T } = base;
  // The accent stays exact on fills; text uses its nearest readable shade.
  const { ink, onAccent } = useMemo(() => {
    const backgrounds = [T.surface, T.background, mix(C.accent, T.surface, 0.9), mix(C.accent, T.background, 0.9)];
    let ink = C.accent;
    for (let step = 1; step <= 20 && Math.min(...backgrounds.map(bg => contrast(ink, bg))) < 4.5; step++) ink = mix(C.accent, T.text, step / 20);
    return { ink, onAccent: contrast(C.accent, T.black) >= contrast(C.accent, T.white) ? T.black : T.white };
  }, [C.accent, T]);
  return { ...base, ink, onAccent, s: { ...base.s, heading: [base.s.heading, { color: ink }], title: [base.s.title, { color: ink }] } };
}

export function LibraryButton({ children, primary = false, quiet = false, selected, style, ...props }) {
  const { C, T, s, ink, onAccent } = useLibraryTheme();
  const textOnly = React.Children.toArray(children).every(child => typeof child === 'string' || typeof child === 'number');
  return <PanelButton {...props} selected={selected} style={[
    { borderColor: quiet ? T.border : C.accent, backgroundColor: primary ? C.accent : selected ? C.accent + '18' : 'transparent' }, style,
  ]}>
    {textOnly ? <Text style={[s.buttonText, { color: primary ? onAccent : quiet ? T.text : ink, textAlign: primary ? 'center' : 'left' }]}>{children}</Text> : children}
  </PanelButton>;
}

export function LibraryPicker({ style, ...props }) {
  const { C, ink } = useLibraryTheme();
  return <DropdownPicker {...props} placeholderTextColor={ink} style={[{ borderColor: C.accent, backgroundColor: C.accent + '0c' }, style]} />;
}

export const UNITS = [
  { value: 'KG', label: 'KG · kilogramy', short: 'kg', measure: 'Ciężar' },
  { value: 'KM', label: 'KM · kilometry', short: 'km', measure: 'Dystans' },
  { value: 'MIN', label: 'MIN · minuty', short: 'min', measure: 'Czas' },
  { value: 'SEK', label: 'SEK · sekundy', short: 'sek', measure: 'Czas' },
  { value: 'POW', label: 'POW · powtórzenia', short: 'powt.', measure: 'Powtórzenia' },
];
export const unitInfo = unit => UNITS.find(u => u.value === (unit || 'KG').toUpperCase()) || { short: unit, measure: 'Wartość' };
export function LibraryInput({ label, style, ...props }) {
  const { s, T, C, ink } = useLibraryTheme();
  const [focused, setFocused] = useState(false);
  return <View style={[{ gap: 6, minWidth: 0 }, style]}>
    <Text style={[s.muted, { color: ink }]}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor={T.textSecondary}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={[{ color: T.text, backgroundColor: T.background, borderWidth: 1, borderColor: focused ? C.accent : T.border, borderRadius: 10, minHeight: 46, padding: 12, fontSize: 15, width: '100%' },
        Platform.OS === 'web' && { outlineStyle: focused ? 'solid' : 'none', outlineColor: C.accent, outlineWidth: 2, outlineOffset: 2 }]} {...props} />
  </View>;
}
