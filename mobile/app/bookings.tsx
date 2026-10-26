import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { listBookings } from '@/api/client';
import type { ApiBooking } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { useTheme } from '@/theme/ThemeContext';

export default function BookingsScreen() {
  const { user } = useAuth();
  const { colors, styles } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<ApiBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setItems((await listBookings()).items); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Bookings could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  if (!user) return <View style={[styles.screen, styles.safeContent]}><Text style={styles.heading}>Sign in to view bookings</Text><Pressable style={styles.button} onPress={() => router.push('/auth/sign-in')}><Text style={styles.buttonText}>Sign in</Text></Pressable></View>;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.safeContent}>
    <Pressable onPress={() => router.back()}><Text style={{ color: colors.green, fontWeight: '800' }}>‹ Back</Text></Pressable>
    <Text style={styles.title}>Bookings</Text>
    <Text style={styles.body}>Reservation dates and decisions for properties you booked or listed.</Text>
    {error ? <ErrorState message={error} onRetry={() => void load()} /> : loading ? <LoadingState /> : items.length === 0 ? <EmptyState title="No bookings yet" message="Your reservation requests will appear here." /> : <View style={{ gap: 10 }}>{items.map((item) => <Pressable key={item.id} onPress={() => router.push({ pathname: '/property/[id]', params: { id: item.listing_id } })} style={[styles.card, { gap: 6 }]}><Text style={styles.heading}>{item.listing_title}</Text><Text style={styles.body}>{item.check_in} – {item.check_out}</Text><Text style={styles.muted}>{item.guests} guest{item.guests === 1 ? '' : 's'} · {item.status}</Text>{item.guest_name && <Text style={styles.muted}>Requested by {item.guest_name}</Text>}</Pressable>)}</View>}
  </ScrollView>;
}
