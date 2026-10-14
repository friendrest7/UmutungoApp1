import { Tabs, usePathname, useRouter } from 'expo-router';
import { Keyboard, Pressable, Text } from 'react-native';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { useI18n } from '@/i18n';
import { useAuth } from '@/auth/AuthContext';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return <><Tabs screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true, tabBarActiveTintColor: colors.green, tabBarInactiveTintColor: colors.muted, tabBarStyle: { height: 60 + insets.bottom, paddingBottom: Math.max(8, insets.bottom), paddingTop: 8, borderTopColor: colors.line, backgroundColor: colors.paper }, tabBarLabelStyle: { fontSize: 11, fontWeight: '700' }}}>
    <Tabs.Screen name="index" options={{ title: t('Home'), tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="search" options={{ title: t('Search'), tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="saved" options={{ title: t('Saved'), tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="dashboard" options={{ title: user ? t('Dashboard') : t('Join'), tabBarIcon: ({ color, size }) => <Ionicons name={user?.role === 'admin' ? 'shield-checkmark-outline' : 'briefcase-outline'} color={color} size={size} /> }} />
    <Tabs.Screen name="profile" options={{ title: t('Profile'), tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} /> }} />
  </Tabs>{pathname !== '/chat' && !keyboardVisible && <Pressable accessibilityRole="button" accessibilityLabel="Open Umutungo AI assistant" onPress={() => router.push('/chat' as never)} style={{ position: 'absolute', right: 14, bottom: 60 + insets.bottom + 10, minHeight: 42, paddingHorizontal: 13, borderRadius: 22, backgroundColor: colors.green, flexDirection: 'row', alignItems: 'center', gap: 7, elevation: 5, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}><Ionicons name="sparkles" size={16} color="#fff" /><Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Ask AI</Text></Pressable>}</>;
}
