import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'umutungo-theme';
const LEGACY_DASHBOARD_THEME_KEY = 'umutungo-dashboard-theme';
const THEME_CHANGED_EVENT = 'umutungo:theme-changed';

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

export function usePersistentTheme() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const syncTheme = () => setTheme(readStoredTheme());
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
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => {
      const nextTheme: Theme = currentTheme === 'dark' ? 'light' : 'dark';
      storeTheme(nextTheme);
      window.dispatchEvent(new Event(THEME_CHANGED_EVENT));
      return nextTheme;
    });
  }, []);

  return { darkMode: theme === 'dark', toggleTheme };
}
