import React, { createContext, useContext, useState, useEffect } from 'react';

export const THEMES = {
  copper: { name: 'Miedziany (Premium)', accent: '#c28b71', accentDark: '#8a5c48', headerBg: '#1a1e23' },
  blue:   { name: 'Niebieski', accent: '#31d5f2', accentDark: '#1a8fa8' },
  purple: { name: 'Fioletowy', accent: '#8a6fac', accentDark: '#5c4675' },
  pink:   { name: 'Różowy',    accent: '#f472b6', accentDark: '#db2777' },
  orange: { name: 'Pomarańczowy', accent: '#fb923c', accentDark: '#c2410c' },
  white:  { name: 'Biały', accent: '#ffffff', accentDark: '#e6edf3' },
};

export const BAR_STYLES = {
  glossyGlass: { name: 'Glossy Glass' },
};

export const LIGHT_COLORS = {
  background: '#FAF6F0',
  surface: '#FFFDF8',
  surfaceLight: '#F3EDE4',
  border: '#E5DCCE',
  text: '#3D3225',
  textSecondary: '#7A6E5D',
  textMuted: '#A89880',
  danger: '#CF222E',
  success: '#1A7F37',
  warning: '#9A6700',
  white: '#ffffff',
};

export const DARK_COLORS = {
  background: '#0d1117',
  surface: '#161b22',
  surfaceLight: '#21262d',
  border: '#30363d',
  text: '#e6edf3',
  textSecondary: '#8b949e',
  textMuted: '#484f58',
  danger: '#f85149',
  success: '#3fb950',
  warning: '#d29922',
  white: '#ffffff',
};

const ThemeContext = createContext({
  theme: 'copper',
  colors: THEMES.copper,
  setTheme: () => {},
  barStyle: 'glossyGlass',
  setBarStyle: () => {},
  mode: 'dark',
  setMode: () => {},
  themeColors: DARK_COLORS,
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('copper');
  const [barStyle, setBarStyleState] = useState('glossyGlass');
  const [mode, setModeState] = useState('dark');

  useEffect(() => {
    import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
      AsyncStorage.getItem('appTheme').then(saved => {
        if (saved && THEMES[saved]) setThemeState(saved);
      });
      AsyncStorage.getItem('appBarStyle').then(saved => {
        setBarStyleState('glossyGlass');
      });
      AsyncStorage.getItem('appThemeMode').then(saved => {
        if (saved && (saved === 'dark' || saved === 'light')) setModeState(saved);
      });
    }).catch(() => {});
  }, []);

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
      AsyncStorage.setItem('appTheme', newTheme);
    }).catch(() => {});
  };

  const setBarStyle = (newBarStyle) => {
    setBarStyleState(newBarStyle);
    import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
      AsyncStorage.setItem('appBarStyle', newBarStyle);
    }).catch(() => {});
  };

  const setMode = (newMode) => {
    setModeState(newMode);
    import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
      AsyncStorage.setItem('appThemeMode', newMode);
    }).catch(() => {});
    if (newMode === 'light') {
      if (theme !== 'copper' && theme !== 'white') setTheme('copper');
      setBarStyle('glossyGlass');
    } else if (newMode === 'dark') {
      setBarStyle('glossyGlass');
    }
  };

  const themeColors = mode === 'light' ? LIGHT_COLORS : DARK_COLORS;

  const baseTheme = THEMES[theme] || THEMES.copper;
  const colors = React.useMemo(() => {
    if (theme === 'white' && mode === 'light') {
      return { ...baseTheme, accent: '#24292F', accentDark: '#57606A' };
    }
    return baseTheme;
  }, [theme, mode, baseTheme]);

  return (
    <ThemeContext.Provider value={{
      theme,
      colors,
      setTheme,
      barStyle,
      setBarStyle,
      mode,
      setMode,
      themeColors,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}


