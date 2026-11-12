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
  return <Tabs screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true, tabBarShowLabel: true, tabBarActiveTintColor: colors.greenDark, tabBarInactiveTintColor: colors.muted, tabBarStyle: { height: 70 + insets.bottom, paddingBottom: Math.max(10, insets.bottom), paddingTop: 8, paddingHorizontal: 8, borderTopColor: colors.line, borderTopWidth: 1, backgroundColor: colors.paper, elevation: 12, shadowColor: '#10251a', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } }, tabBarLabelStyle: { fontFamily: 'LexendSemiBold', fontSize: 11, fontWeight: '600', marginTop: 3 }, tabBarIconStyle: { marginTop: 0 }, tabBarItemStyle: { borderRadius: 14, marginHorizontal: 2 } }}>
    <Tabs.Screen name="index" options={{ title: t('Home'), href: isOwner ? null : undefined, tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} color={color} size={23} /> }} />
    <Tabs.Screen name="search" options={{ title: t('Search'), href: isOwner ? null : undefined, tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'search' : 'search-outline'} color={color} size={23} /> }} />
    <Tabs.Screen name="saved" options={{ title: t('Saved'), href: isOwner ? null : undefined, tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'heart' : 'heart-outline'} color={color} size={23} /> }} />
    <Tabs.Screen name="profile" options={{ title: t('Profile'), href: isOwner ? null : undefined, tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} color={color} size={23} /> }} />
    <Tabs.Screen name="owner-home" options={{ title: 'Home', href: isOwner ? undefined : null, tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} color={color} size={23} /> }} />
    <Tabs.Screen name="owner-properties" options={{ title: 'Properties', href: isOwner ? undefined : null, tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'business' : 'business-outline'} color={color} size={23} /> }} />
    <Tabs.Screen name="owner-rent" options={{ title: 'Rent', href: isOwner ? undefined : null, tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'cash' : 'cash-outline'} color={color} size={23} /> }} />
    <Tabs.Screen name="owner-inbox" options={{ title: 'Inbox', href: isOwner ? undefined : null, tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} color={color} size={23} /> }} />
    <Tabs.Screen name="owner-more" options={{ title: 'More', href: isOwner ? undefined : null, tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'grid' : 'grid-outline'} color={color} size={23} /> }} />
    <Tabs.Screen name="dashboard" options={{ href: null }} />
  </Tabs>;
}
