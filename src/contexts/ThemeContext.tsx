'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Theme } from '@/types';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'kairo-theme';

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme = 'light' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize theme from localStorage on mount
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (storedTheme && (storedTheme === 'light' || storedTheme === 'dark')) {
        setThemeState(storedTheme);
      }
      setIsInitialized(true);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (!isInitialized) return;

    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, isInitialized]);

  const toggleTheme = () => {
    setThemeState(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  // Prevent flash of incorrect theme
  if (!isInitialized) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
