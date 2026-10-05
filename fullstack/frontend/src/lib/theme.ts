'use client';

import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'umutungo-theme';
const LEGACY_DASHBOARD_THEME_KEY = 'umutungo-dashboard-theme';
const THEME_CHANGED_EVENT = 'umutungo:theme-changed';
type ThemeContextValue = { darkMode: boolean; toggleTheme: () => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'dark' || storedTheme === 'light') return storedTheme;

    const legacyTheme = window.localStorage.getItem(LEGACY_DASHBOARD_THEME_KEY);
    if (legacyTheme === 'dark' || legacyTheme === 'light') {
      window.localStorage.setItem(THEME_STORAGE_KEY, legacyTheme);
      return legacyTheme;
    }
  } catch {
    // Use the light theme when browser storage is unavailable.
  }

  return 'light';
}

function storeTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The current session still keeps the selected theme in React state.
  }
}

function applyThemeToDocument(theme: Theme) {
  if (typeof document === 'undefined') return;
  const darkMode = theme === 'dark';
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('theme-dark', darkMode);
  document.body.classList.toggle('theme-dark', darkMode);
  document.querySelectorAll<HTMLElement>('.app').forEach((element) => element.classList.toggle('theme-dark', darkMode));
  document.querySelectorAll<HTMLElement>('.role-dashboard').forEach((element) => element.classList.toggle('dashboard-dark', darkMode));
}

function useThemeState(active = true): ThemeContextValue {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    if (!active) return;
    const syncTheme = () => {
      const nextTheme = readStoredTheme();
      setTheme(nextTheme);
      applyThemeToDocument(nextTheme);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === LEGACY_DASHBOARD_THEME_KEY) syncTheme();
    };

    syncTheme();
    window.addEventListener('storage', onStorage);
    window.addEventListener(THEME_CHANGED_EVENT, syncTheme);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(THEME_CHANGED_EVENT, syncTheme);
    };
  }, [active]);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => {
      const nextTheme: Theme = currentTheme === 'dark' ? 'light' : 'dark';
      storeTheme(nextTheme);
      applyThemeToDocument(nextTheme);
      window.dispatchEvent(new Event(THEME_CHANGED_EVENT));
      return nextTheme;
    });
  }, []);

  return { darkMode: theme === 'dark', toggleTheme };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return createElement(ThemeContext.Provider, { value: useThemeState() }, children);
}

export function usePersistentTheme() {
  const context = useContext(ThemeContext);
  // Keep fallback support for isolated consumers, but do not create a second
  // storage listener or DOM observer when the shared provider is available.
  const localTheme = useThemeState(context === null);
  return context ?? localTheme;
}
