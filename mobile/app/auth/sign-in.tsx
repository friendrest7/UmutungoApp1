import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { requestOtp, verifyOtp } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { ErrorState } from '@/components/StateView';
import { colors } from '@/theme/colors';
import { styles } from '@/theme/styles';

export default function SignInScreen() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitPhone = async () => { if (phone.replace(/\D/g, '').length < 9) { setError('Enter a valid Rwanda phone number.'); return; } setBusy(true); setError(''); try { const result = await requestOtp(phone.trim()); setNotice(result.development_code ? `Verification code sent. Development code: ${result.development_code}` : result.message); setStep('code'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Verification code could not be sent.'); } finally { setBusy(false); } };
  const submitCode = async () => { if (code.trim().length < 4) { setError('Enter the verification code.'); return; } setBusy(true); setError(''); try { const result = await verifyOtp(phone.trim(), code.trim()); setUser(result.user); router.replace('/(tabs)'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'That code is not correct.'); } finally { setBusy(false); } };
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.safeContent} keyboardShouldPersistTaps="handled"><Pressable onPress={() => router.back()}><Text style={{ color: colors.green, fontWeight: '800' }}>‹ Back</Text></Pressable><Text style={styles.brand}>UMUTUNGO</Text><Text style={styles.title}>Sign in to continue.</Text><Text style={styles.body}>Use the phone number connected to your Umutungo account.</Text>{error && <ErrorState message={error} />}{step === 'phone' ? <View style={{ gap: 10 }}><Text style={styles.label}>Rwanda phone number</Text><TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+250 7XX XXX XXX" placeholderTextColor={colors.muted} keyboardType="phone-pad" autoComplete="tel" /><Pressable style={styles.button} disabled={busy} onPress={() => void submitPhone()}><Text style={styles.buttonText}>{busy ? 'Sending...' : 'Send verification code'}</Text></Pressable></View> : <View style={{ gap: 10 }}><Text style={[styles.body, { color: colors.greenDark }]}>{notice}</Text><Text style={styles.label}>Verification code</Text><TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="111111 in development" placeholderTextColor={colors.muted} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" /><Pressable style={styles.button} disabled={busy} onPress={() => void submitCode()}><Text style={styles.buttonText}>{busy ? 'Verifying...' : 'Verify and continue'}</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => setStep('phone')}><Text style={styles.secondaryText}>Change phone number</Text></Pressable></View>}<View style={[styles.card, { gap: 8, marginTop: 12 }]}><Text style={styles.heading}>Other sign-in providers</Text><Text style={styles.body}>Google and Apple mobile sign-in are not enabled by the current Go API. This app does not pretend those flows succeeded; use phone OTP until a mobile OAuth exchange is added.</Text></View><Pressable onPress={() => router.push('/auth/register')}><Text style={{ color: colors.green, textAlign: 'center', fontWeight: '800' }}>Create a new account</Text></Pressable></ScrollView></KeyboardAvoidingView>;
}
