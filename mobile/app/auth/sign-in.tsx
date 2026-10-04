import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { requestOtp, signInWithGoogle, verifyOtp } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { ErrorState } from '@/components/StateView';
import { useTheme } from '@/theme/ThemeContext';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { colors, styles } = useTheme();
  const router = useRouter();
  const { setUser, setProfile } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleRequest, googleResponse, promptGoogle] = Google.useAuthRequest({
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => {
    if (googleResponse?.type !== 'success') return;
    const accessToken = googleResponse.authentication?.accessToken;
    if (!accessToken) {
      setError('Google did not return an access token.');
      return;
    }
    setGoogleBusy(true);
    setError('');
    void signInWithGoogle({
      access_token: accessToken,
      client_id: Platform.OS === 'android' ? process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID : process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      role: 'tenant',
    }).then((result) => {
      setUser(result.user);
      setProfile(result.profile);
      router.replace('/(tabs)');
    }).catch((cause) => {
      setError(cause instanceof Error ? cause.message : 'Google sign-in could not be completed.');
    }).finally(() => setGoogleBusy(false));
  }, [googleResponse, router, setProfile, setUser]);

  const submitPhone = async () => {
    if (phone.replace(/\D/g, '').length < 9) {
      setError('Enter a valid Rwanda phone number.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await requestOtp(phone.trim());
      setNotice(result.development_code ? `Verification code sent. Development code: ${result.development_code}` : result.message);
      setStep('code');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Verification code could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    if (code.trim().length < 4) {
      setError('Enter the verification code.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await verifyOtp(phone.trim(), code.trim());
      setUser(result.user);
      router.replace('/(tabs)');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That code is not correct.');
    } finally {
      setBusy(false);
    }
  };

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.safeContent} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()}><Text style={{ color: colors.green, fontWeight: '800' }}>‹ Back</Text></Pressable>
      <Text style={styles.brand}>UMUTUNGO</Text>
      <Text style={styles.title}>Sign in to continue.</Text>
      <Text style={styles.body}>Use Google or the phone number connected to your Umutungo account.</Text>
      {error && <ErrorState message={error} />}
      <Pressable style={[styles.secondaryButton, { flexDirection: 'row', gap: 8 }]} disabled={!googleRequest || googleBusy} onPress={() => void promptGoogle()}>
        <MaterialCommunityIcons name="google" size={19} color="#4285F4" />
        <Text style={styles.secondaryText}>{googleBusy ? 'Connecting to Google...' : googleRequest ? 'Continue with Google' : 'Google sign-in is not configured'}</Text>
      </Pressable>
      <Text style={[styles.muted, { textAlign: 'center' }]}>Google access is verified by the Umutungo API before a session is created.</Text>
      {step === 'phone' ? <View style={{ gap: 10 }}>
        <Text style={styles.label}>Rwanda phone number</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+250 7XX XXX XXX" placeholderTextColor={colors.muted} keyboardType="phone-pad" autoComplete="tel" />
        <Pressable style={styles.button} disabled={busy} onPress={() => void submitPhone()}><Text style={styles.buttonText}>{busy ? 'Sending...' : 'Send verification code'}</Text></Pressable>
      </View> : <View style={{ gap: 10 }}>
        <Text style={[styles.body, { color: colors.greenDark }]}>{notice}</Text>
        <Text style={styles.label}>Verification code</Text>
        <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="111111 in development" placeholderTextColor={colors.muted} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" />
        <Pressable style={styles.button} disabled={busy} onPress={() => void submitCode()}><Text style={styles.buttonText}>{busy ? 'Verifying...' : 'Verify and continue'}</Text></Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => setStep('phone')}><Text style={styles.secondaryText}>Change phone number</Text></Pressable>
      </View>}
      <View style={[styles.card, { gap: 8, marginTop: 12 }]}>
        <Text style={styles.heading}>Apple sign-in</Text>
        <Text style={styles.body}>Apple sign-in remains follow-up work because the backend and Apple developer configuration are not yet available.</Text>
      </View>
      <Pressable onPress={() => router.push('/auth/register')}><Text style={{ color: colors.green, textAlign: 'center', fontWeight: '800' }}>Create a new account</Text></Pressable>
    </ScrollView>
  </KeyboardAvoidingView>;
}
