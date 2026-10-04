import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/auth/AuthContext';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import { LocalizationProvider } from '@/i18n';

function AppShell() {
  const { isDark, colors } = useTheme();
  return <><StatusBar style={isDark ? 'light' : 'dark'} /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} /></>;
}

export default function RootLayout() {
  return <AuthProvider><LocalizationProvider><ThemeProvider><AppShell /></ThemeProvider></LocalizationProvider></AuthProvider>;
}
