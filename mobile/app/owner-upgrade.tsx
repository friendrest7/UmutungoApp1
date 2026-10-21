import { useCallback, useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getOwnerUpgrades, startOwnerUpgrade, type OwnerPlan, type OwnerPurchase } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { ErrorState, LoadingState } from '@/components/StateView';
import { useTheme } from '@/theme/ThemeContext';
import MomoQrScanner from '@/components/MomoQrScanner';

const plans: OwnerPlan[] = ['silver', 'gold', 'platinum'];

export default function OwnerUpgradeScreen() {
  const { styles, colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [prices, setPrices] = useState<Record<OwnerPlan, number> | null>(null);
  const [purchase, setPurchase] = useState<OwnerPurchase | null>(null);
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [showMomoScanner, setShowMomoScanner] = useState(false);
  const idempotencyKeys = useRef<Partial<Record<OwnerPlan, string>>>({});

  const load = useCallback(async () => {
    const result = await getOwnerUpgrades();
    setPrices(result.prices);
    setPurchase(result.purchases[0] ?? null);
    return result;
  }, []);

  useEffect(() => { void Promise.resolve().then(load).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not load Owner plans.')); }, [load]);
  useEffect(() => {
    if (purchase?.status !== 'pending') return;
    const timer = setInterval(() => { void load().catch(() => undefined); }, 8000);
    return () => clearInterval(timer);
  }, [purchase?.status, load]);

  const start = async (plan: OwnerPlan) => {
    const normalizedPhone = phone.trim().replace(/[\s()-]/g, '');
    if (!/^(?:\+?250\d{9}|0\d{9})$/.test(normalizedPhone)) { setError('Enter a valid Rwanda number, for example +250 7XX XXX XXX.'); return; }
    setBusy(true); setError(''); setNotice('Starting MTN MoMo request…');
    const idempotencyKey = idempotencyKeys.current[plan] ?? Crypto.randomUUID();
    idempotencyKeys.current[plan] = idempotencyKey;
    try {
      const result = await startOwnerUpgrade({ plan, phone: normalizedPhone, idempotency_key: idempotencyKey });
      setPurchase(result);
      if (result.payment_status === 'failed' || result.status === 'failed') {
        delete idempotencyKeys.current[plan];
        setNotice('MTN could not start this payment. Check your number and balance, then try again.');
      } else if (result.payment_status === 'successful' || result.status === 'active') {
        setNotice('MTN confirmed your payment and the plan is active.');
      } else {
        setNotice('Payment request sent. Approve it on your MTN MoMo phone; this screen will check for confirmation.');
      }
      await load();
    } catch (cause) {
      setNotice('');
      setError(cause instanceof Error ? cause.message : 'MTN payment could not be started.');
      const latest = await load().catch(() => null);
      if (latest?.purchases[0]?.plan === plan && latest.purchases[0].status === 'failed') delete idempotencyKeys.current[plan];
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
      <Pressable style={styles.button} disabled={busy || (prices?.[plan] ?? 0) <= 0 || (purchase?.status === 'pending' && purchase.plan === plan)} onPress={() => void start(plan)}><Text style={styles.buttonText}>{busy ? 'Starting…' : `Pay RWF ${(prices?.[plan] ?? 0).toLocaleString()} with MTN MoMo`}</Text></Pressable>
    </View>)}
    <View style={[styles.card, { gap: 8 }]}><Text style={styles.heading}>MTN Rwanda phone number</Text><View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><TextInput style={[styles.input, { flex: 1 }]} value={phone} onChangeText={setPhone} placeholder="+250 7XX XXX XXX" placeholderTextColor={colors.muted} keyboardType="phone-pad" autoComplete="tel" /><Pressable style={[styles.secondaryButton, { paddingHorizontal: 12 }]} onPress={() => setShowMomoScanner(true)}><Text style={styles.secondaryText}>Scan QR</Text></Pressable></View></View>
    {notice ? <Text style={{ color: colors.greenDark, fontWeight: '700' }}>{notice}</Text> : null}
    {purchase ? <View style={[styles.card, { gap: 6 }]}><Text style={styles.heading}>Latest payment: {purchase.payment_status}</Text><Text style={styles.body}>{purchase.plan} · {purchase.currency} {purchase.amount.toLocaleString()}</Text><Text style={styles.muted}>Reference: {purchase.transaction_reference}</Text>{purchase.expires_at ? <Text style={styles.muted}>Expires: {new Date(purchase.expires_at).toLocaleDateString()}</Text> : null}</View> : null}
    <MomoQrScanner visible={showMomoScanner} onClose={() => setShowMomoScanner(false)} onPhoneScanned={setPhone} />
  </ScrollView>;
}
