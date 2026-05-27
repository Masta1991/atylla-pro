import React, { createContext, useContext, useState, useEffect } from 'react';

export const THEMES = {
  copper: { name: 'Miedziany (Premium)', accent: '#c28b71', accentDark: '#8a5c48', headerBg: '#1a1e23' },
  blue:   { name: 'Niebieski', accent: '#31d5f2', accentDark: '#1a8fa8' },
  purple: { name: 'Fioletowy', accent: '#a855f7', accentDark: '#7c3aed' },
  pink:   { name: 'Różowy',    accent: '#f472b6', accentDark: '#db2777' },
  orange: { name: 'Pomarańczowy', accent: '#fb923c', accentDark: '#c2410c' },
};

const ThemeContext = createContext({
  theme: 'copper',
  colors: THEMES.copper,
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('copper');

  useEffect(() => {
    import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
      AsyncStorage.getItem('appTheme').then(saved => {
        if (saved && THEMES[saved]) setThemeState(saved);
      });
    }).catch(() => {});
  }, []);

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
      AsyncStorage.setItem('appTheme', newTheme);
    }).catch(() => {});
  };

  return (
    <ThemeContext.Provider value={{ theme, colors: THEMES[theme] || THEMES.copper, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
