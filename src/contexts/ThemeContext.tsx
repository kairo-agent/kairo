'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Theme } from '@/types';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  /**
   * `true` cuando el ThemeProvider ya montó en cliente y leyó localStorage.
   * Usar para evitar hydration mismatch al renderizar elementos dependientes
   * de theme (logo dark/light, icono Sun/Moon, etc.):
   *   {mounted && (theme === 'dark' ? <SunIcon /> : <MoonIcon />)}
   *
   * Si no necesitas ocultar el elemento durante mount, usa `theme` directo —
   * el server siempre renderea con defaultTheme y el cliente actualiza en
   * el effect inicial (puede haber un flash breve si user tiene tema distinto
   * al default guardado en localStorage).
   */
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'kairo-theme';

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme = 'light' }: ThemeProviderProps) {
  // Server y cliente primer render usan defaultTheme — evita hydration mismatch.
  // Lectura de localStorage diferida al useEffect post-mount.
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [mounted, setMounted] = useState(false);

  // Mount: lee localStorage y aplica si difiere del default
  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (stored === 'light' || stored === 'dark') {
        setThemeState(stored);
      }
    } catch {
      /* ignore */
    }
    setMounted(true);
  }, []);

  // Persist + apply data-theme cuando theme cambia (solo despues de mount)
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme, mounted]);

  const toggleTheme = () => {
    setThemeState((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, mounted }}>
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
