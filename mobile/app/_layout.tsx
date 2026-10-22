import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { AuthProvider } from '@/auth/AuthContext';
import { syncOfflineChanges } from '@/api/client';
import { useI18n } from '@/i18n';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import { LocalizationProvider } from '@/i18n';

function AppShell() {
  const { isDark, colors } = useTheme();
  const { t } = useI18n();
  const [offline, setOffline] = useState(false);
  useEffect(() => NetInfo.addEventListener((state) => {
    const connected = state.isConnected === true && state.isInternetReachable !== false;
    setOffline(!connected);
    if (connected) void syncOfflineChanges();
  }), []);
  useEffect(() => {
    const prepareNotifications = async () => {
      try {
        if (Platform.OS === 'web') return;
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Umutungo updates',
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#00a84f',
          });
        }
        const permission = await Notifications.getPermissionsAsync();
        if (!permission.granted && permission.canAskAgain) await Notifications.requestPermissionsAsync();
      } catch {
        // Keep the app usable if notification permissions are unavailable on this device.
      }
    };
    void prepareNotifications();
  }, []);
  return <><StatusBar style={isDark ? 'light' : 'dark'} />{offline && <View accessibilityRole="alert" style={{ paddingVertical: 7, paddingHorizontal: 14, backgroundColor: '#8a5a00' }}><Text style={{ color: '#fff', textAlign: 'center', fontSize: 12, fontWeight: '700' }}>{t('Offline mode · showing saved properties. Changes to favorites will sync when you reconnect.')}</Text></View>}<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} /></>;
}

export default function RootLayout() {
  return <AuthProvider><LocalizationProvider><ThemeProvider><AppShell /></ThemeProvider></LocalizationProvider></AuthProvider>;
}
