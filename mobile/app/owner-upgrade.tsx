import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getOwnerUpgrades, startOwnerUpgrade, type OwnerPlan, type OwnerPurchase } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { ErrorState, LoadingState } from '@/components/StateView';
import { useTheme } from '@/theme/ThemeContext';

const plans: OwnerPlan[] = ['silver', 'gold', 'platinum'];

export default function OwnerUpgradeScreen() {
  const { styles, colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [prices, setPrices] = useState<Record<OwnerPlan, number> | null>(null);
  const [purchase, setPurchase] = useState<OwnerPurchase | null>(null);
  const [selected, setSelected] = useState<OwnerPlan>('silver');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const result = await getOwnerUpgrades();
    setPrices(result.prices);
    setPurchase(result.purchases[0] ?? null);
  }, []);

  useEffect(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not load Owner plans.')); }, [load]);
  useEffect(() => {
    if (purchase?.status !== 'pending') return;
    const timer = setInterval(() => { void load().catch(() => undefined); }, 8000);
    return () => clearInterval(timer);
  }, [purchase?.status, load]);

  const start = async (plan: OwnerPlan) => {
    if (!phone.trim()) { setError('Enter your MTN Rwanda number.'); return; }
    setBusy(true); setError(''); setNotice('Starting MTN MoMo request…');
    const idempotencyKey = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    try {
      const result = await startOwnerUpgrade({ plan, phone: phone.trim(), idempotency_key: idempotencyKey });
      setPurchase(result);
      setNotice('Approve the request on your phone. This screen will update after MTN confirms it.');
      await load();
    } catch (cause) {
      setNotice('');
      setError(cause instanceof Error ? cause.message : 'MTN payment could not be started.');
      await load().catch(() => undefined);
    } finally { setBusy(false); }
  };

  if (!user) return <View style={styles.screen}><ErrorState message="Sign in as a Property Owner to manage plans." onRetry={() => router.push('/auth/sign-in')} /></View>;
  if (user.role !== 'property_owner' && user.role !== 'admin') return <View style={styles.screen}><ErrorState message="Owner premium plans are available to Property Owner accounts." onRetry={() => router.back()} /></View>;
  if (!prices && !error) return <View style={styles.screen}><LoadingState label="Loading Owner plans…" /></View>;

  return <ScrollView style={styles.screen} contentContainerStyle={[styles.safeContent, { gap: 14 }]}>
    <Pressable onPress={() => router.back()}><Text style={{ color: colors.green, fontWeight: '800' }}>‹ Back</Text></Pressable>
    <Text style={styles.title}>Owner premium plans</Text>
    <Text style={styles.body}>Pay securely with MTN MoMo. Your plan activates after MTN confirms payment.</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {plans.map((plan) => <View key={plan} style={[styles.card, { gap: 8 }]}>
      <Text style={styles.heading}>{plan[0].toUpperCase() + plan.slice(1)}</Text>
      <Text style={styles.body}>{plan === 'silver' ? '90 days' : plan === 'gold' ? '180 days' : '365 days'} · RWF {(prices?.[plan] ?? 0).toLocaleString()}</Text>
      <Pressable style={styles.button} disabled={busy || (prices?.[plan] ?? 0) <= 0 || purchase?.status === 'pending'} onPress={() => void start(plan)}><Text style={styles.buttonText}>{busy ? 'Starting…' : `Pay RWF ${(prices?.[plan] ?? 0).toLocaleString()} with MTN MoMo`}</Text></Pressable>
    </View>)}
    <View style={[styles.card, { gap: 8 }]}><Text style={styles.heading}>MTN Rwanda phone number</Text><TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+250 7XX XXX XXX" placeholderTextColor={colors.muted} keyboardType="phone-pad" autoComplete="tel" /></View>
    {notice ? <Text style={{ color: colors.greenDark, fontWeight: '700' }}>{notice}</Text> : null}
    {purchase ? <View style={[styles.card, { gap: 6 }]}><Text style={styles.heading}>Latest payment: {purchase.payment_status}</Text><Text style={styles.body}>{purchase.plan} · {purchase.currency} {purchase.amount.toLocaleString()}</Text><Text style={styles.muted}>Reference: {purchase.transaction_reference}</Text>{purchase.expires_at ? <Text style={styles.muted}>Expires: {new Date(purchase.expires_at).toLocaleDateString()}</Text> : null}</View> : null}
  </ScrollView>;
}
