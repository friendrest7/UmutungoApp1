import { Tabs, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { useI18n } from '@/i18n';
import { useAuth } from '@/auth/AuthContext';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isOwner = user?.role === 'property_owner';
  const ownerRoute = pathname.includes('/owner-');
  useEffect(() => {
    if (authLoading || !ownerRoute || isOwner) return;
    router.replace((user ? '/(tabs)/dashboard' : '/auth/sign-in') as never);
  }, [authLoading, isOwner, ownerRoute, router, user]);
  return <Tabs screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true, tabBarActiveTintColor: colors.green, tabBarInactiveTintColor: colors.muted, tabBarStyle: { height: 64 + insets.bottom, paddingBottom: Math.max(8, insets.bottom), paddingTop: 7, borderTopColor: colors.line, backgroundColor: colors.paper }, tabBarLabelStyle: { fontFamily: 'LexendBold', fontSize: 10, fontWeight: '700' }, tabBarIconStyle: { marginTop: 1 } }}>
    {isOwner ? <>
      <Tabs.Screen name="owner-home" options={{ title: 'Home', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} color={color} size={22} /> }} />
      <Tabs.Screen name="owner-properties" options={{ title: 'Properties', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'business' : 'business-outline'} color={color} size={22} /> }} />
      <Tabs.Screen name="owner-rent" options={{ title: 'Rent', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'cash' : 'cash-outline'} color={color} size={22} /> }} />
      <Tabs.Screen name="owner-inbox" options={{ title: 'Inbox', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} color={color} size={22} /> }} />
      <Tabs.Screen name="owner-more" options={{ title: 'More', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'grid' : 'grid-outline'} color={color} size={22} /> }} />
      <Tabs.Screen name="index" options={{ href: null }} /><Tabs.Screen name="search" options={{ href: null }} /><Tabs.Screen name="saved" options={{ href: null }} /><Tabs.Screen name="dashboard" options={{ href: null }} /><Tabs.Screen name="profile" options={{ href: null }} />
    </> : <>
    <Tabs.Screen name="index" options={{ title: t('Home'), tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} color={color} size={22} /> }} />
    <Tabs.Screen name="search" options={{ title: t('Search'), tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'search' : 'search-outline'} color={color} size={22} /> }} />
    <Tabs.Screen name="saved" options={{ title: t('Saved'), tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'heart' : 'heart-outline'} color={color} size={22} /> }} />
    <Tabs.Screen name="profile" options={{ title: t('Profile'), tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} color={color} size={22} /> }} />
    <Tabs.Screen name="dashboard" options={{ href: null }} /><Tabs.Screen name="owner-home" options={{ href: null }} /><Tabs.Screen name="owner-properties" options={{ href: null }} /><Tabs.Screen name="owner-rent" options={{ href: null }} /><Tabs.Screen name="owner-inbox" options={{ href: null }} /><Tabs.Screen name="owner-more" options={{ href: null }} />
    </>}
  </Tabs>;
}
