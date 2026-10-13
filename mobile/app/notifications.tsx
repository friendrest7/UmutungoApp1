import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { listNotifications } from '@/api/client';
import type { ApiNotification } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { useTheme } from '@/theme/ThemeContext';

export default function NotificationsScreen() {
  const { user } = useAuth(); const { colors, styles } = useTheme(); const router = useRouter(); const [items, setItems] = useState<ApiNotification[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { setItems((await listNotifications()).items); } catch (e) { setError(e instanceof Error ? e.message : 'Notifications could not be loaded.'); } finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  if (!user) return <View style={[styles.screen, styles.safeContent]}><Text style={styles.heading}>Sign in to view notifications</Text><Pressable style={styles.button} onPress={() => router.push('/auth/sign-in')}><Text style={styles.buttonText}>Sign in</Text></Pressable></View>;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.safeContent}><Pressable onPress={() => router.back()}><Text style={{ color: colors.green, fontWeight: '800' }}>‹ Back</Text></Pressable><Text style={styles.title}>Notifications</Text>{error ? <ErrorState message={error} onRetry={() => void load()} /> : loading ? <LoadingState /> : items.length === 0 ? <EmptyState title="You're all caught up" message="Updates about your account and properties will appear here." /> : <View style={{ gap: 10 }}>{items.map((item) => <View key={item.id} style={[styles.card, { gap: 5, borderLeftWidth: item.read_at ? 0 : 4, borderLeftColor: colors.green }]}><Text style={styles.heading}>{item.title}</Text><Text style={styles.body}>{item.body}</Text><Text style={styles.muted}>{new Date(item.created_at).toLocaleString()}</Text></View>)}</View>}</ScrollView>;
}
