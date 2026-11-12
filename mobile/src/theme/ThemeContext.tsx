import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { colors, darkColors, lightColors, ColorPalette } from './colors';
import { createStyles } from './styles';

export type ThemeMode = 'system' | 'light' | 'dark';
type ThemeContextValue = { mode: ThemeMode; isDark: boolean; colors: ColorPalette; styles: ReturnType<typeof createStyles>; setMode: (mode: ThemeMode) => Promise<void> };
const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_KEY = 'umutungo-theme-mode';

export function ThemeProvider({ children }: PropsWithChildren) {
  // Keep the app readable on devices configured with dark system appearance.
  const [mode, setModeState] = useState<ThemeMode>('light');
  useEffect(() => {
    void SecureStore.getItemAsync(THEME_KEY).then((stored) => {
      // Migrate older installs away from following a dark system appearance by default.
      if (stored === 'dark' || stored === 'light') setModeState(stored);
      else if (stored === 'system') {
        setModeState('light');
        void SecureStore.setItemAsync(THEME_KEY, 'light');
      }
    }).catch(() => setModeState('light'));
  }, []);
  const isDark = mode === 'dark';
  const palette = useMemo(() => isDark ? darkColors : lightColors, [isDark]);
  Object.assign(colors, palette);
  const styles = useMemo(() => createStyles(palette), [palette]);
  const setMode = async (next: ThemeMode) => { setModeState(next); await SecureStore.setItemAsync(THEME_KEY, next); };
  const value = useMemo(() => ({ mode, isDark, colors: palette, styles, setMode }), [mode, isDark, palette, styles]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
