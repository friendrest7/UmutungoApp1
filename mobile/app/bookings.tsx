import { useCallback, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { getPayment, listBookings, startMomoPayment } from '@/api/client';
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
  const [phone, setPhone] = useState('');
  const [payingBooking, setPayingBooking] = useState('');
  const [paymentNotice, setPaymentNotice] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setItems((await listBookings()).items); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Bookings could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  const pay = async (booking: ApiBooking) => {
    if (!phone.trim()) { setPaymentNotice('Enter the MTN MoMo number to charge.'); return; }
    setPayingBooking(booking.id); setPaymentNotice('Sending payment request to MTN MoMo…');
    try {
      const started = await startMomoPayment({ related_type: 'booking', related_id: booking.id, transaction_type: 'rent', phone: phone.trim() });
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const result = await getPayment(started.id);
        if (result.status === 'successful') { setPaymentNotice('Payment confirmed by MTN MoMo.'); await load(); return; }
        if (result.status === 'failed' || result.status === 'expired') { setPaymentNotice(`Payment ${result.status}. You can start a new request.`); await load(); return; }
      }
      setPaymentNotice('Payment is still pending. Approve the official MTN prompt or check again in a moment.');
    } catch (cause) {
      setPaymentNotice(cause instanceof Error ? cause.message : 'MTN payment could not be started.');
    } finally { setPayingBooking(''); }
  };
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  if (!user) return <View style={[styles.screen, styles.safeContent]}><Text style={styles.heading}>Sign in to view bookings</Text><Pressable style={styles.button} onPress={() => router.push('/auth/sign-in')}><Text style={styles.buttonText}>Sign in</Text></Pressable></View>;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.safeContent}>
    <Pressable onPress={() => router.back()}><Text style={{ color: colors.green, fontWeight: '800' }}>‹ Back</Text></Pressable>
    <Text style={styles.title}>Bookings</Text>
    <Text style={styles.body}>Reservation dates and decisions for properties you booked or listed.</Text>
    {paymentNotice ? <Text style={styles.body}>{paymentNotice}</Text> : null}
    {error ? <ErrorState message={error} onRetry={() => void load()} /> : loading ? <LoadingState /> : items.length === 0 ? <EmptyState title="No bookings yet" message="Your reservation requests will appear here." /> : <View style={{ gap: 10 }}>{items.map((item) => <View key={item.id} style={[styles.card, { gap: 6 }]}><Pressable onPress={() => router.push({ pathname: '/property/[id]', params: { id: item.listing_id } })}><Text style={styles.heading}>{item.listing_title}</Text><Text style={styles.body}>{item.check_in} – {item.check_out}</Text><Text style={styles.muted}>{item.guests} guest{item.guests === 1 ? '' : 's'} · {item.status}</Text>{item.guest_name && <Text style={styles.muted}>Requested by {item.guest_name}</Text>}<Text style={styles.muted}>Rate: RWF {item.quote.rate_amount.toLocaleString()} × {item.quote.billed_units} {item.quote.pricing_period === 'daily' ? 'nights' : '30-day periods'}</Text><Text style={styles.muted}>Base RWF {item.quote.base_amount.toLocaleString()} · Fee RWF {item.quote.service_fee_amount.toLocaleString()}</Text><Text style={styles.heading}>Total RWF {item.quote.total_amount.toLocaleString()}</Text><Text style={styles.muted}>Payment: {item.payment_status || 'not started'}</Text></Pressable>{item.is_guest && item.status === 'confirmed' && item.payment_status !== 'successful' && <><TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="MTN MoMo phone number" placeholderTextColor={colors.muted} keyboardType="phone-pad" /><Pressable disabled={!!payingBooking} style={styles.button} onPress={() => void pay(item)}><Text style={styles.buttonText}>{payingBooking === item.id ? 'Waiting for MTN…' : 'Pay with MTN MoMo'}</Text></Pressable></>}</View>)}</View>}
  </ScrollView>;
}
