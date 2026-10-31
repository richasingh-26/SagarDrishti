import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'default' | 'black' | 'white' | 'pink';

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'default',
  setTheme: () => {},
  cycleTheme: () => {},
});

const STORAGE_KEY = 'sagardrishti-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Theme;
      if (saved === 'black' || saved === 'white' || saved === 'default' || saved === 'pink') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'default';
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
  };

  const cycleTheme = () => {
    setThemeState((curr) => {
      if (curr === 'default') return 'black';
      if (curr === 'black') return 'white';
      if (curr === 'white') return 'pink';
      return 'default';
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
