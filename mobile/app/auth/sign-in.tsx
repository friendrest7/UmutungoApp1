import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { requestOtp, signInWithGoogle, signInWithPassword, verifyOtp } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { ErrorState } from '@/components/StateView';
import { useTheme } from '@/theme/ThemeContext';
import { useI18n } from '@/i18n';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { colors, styles } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { setUser, setProfile } = useAuth();
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailOpen, setEmailOpen] = useState(false);
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || googleWebClientId;
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || googleWebClientId;
  const [googleRequest, googleResponse, promptGoogle] = Google.useAuthRequest({
    androidClientId: googleAndroidClientId,
    iosClientId: googleIosClientId,
    webClientId: googleWebClientId,
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
      client_id: Platform.OS === 'android' ? googleAndroidClientId : Platform.OS === 'ios' ? googleIosClientId : googleWebClientId,
      role: 'client',
    }).then((result) => {
      setUser(result.user);
      setProfile(result.profile);
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
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

  const submitEmail = async () => {
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setBusy(true); setError('');
    try {
      const result = await signInWithPassword(email.trim(), password);
      setUser(result.user); setProfile(null); router.replace('/(tabs)');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Email sign-in is unavailable.'); }
    finally { setBusy(false); }
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
      <Pressable onPress={() => router.back()}><Text style={{ color: colors.green, fontWeight: '800' }}>‹ {t('Back')}</Text></Pressable>
      <Text style={styles.brand}>UMUTUNGO</Text>
      <Text style={styles.title}>{t('Sign in to continue.')}</Text>
      <Text style={styles.body}>{t('Use Google or the phone number connected to your Umutungo account.')}</Text>
      {error && <ErrorState message={error} />}
      <Pressable style={[styles.secondaryButton, { flexDirection: 'row', gap: 8 }]} disabled={!googleRequest || googleBusy} onPress={() => void promptGoogle()}>
        <MaterialCommunityIcons name="google" size={19} color="#4285F4" />
        <Text style={styles.secondaryText}>{googleBusy ? t('Connecting to Google...') : googleRequest ? t('Continue with Google') : t('Google sign-in is not configured')}</Text>
      </Pressable>
      <Text style={[styles.muted, { textAlign: 'center' }]}>{t('Google access is verified by the Umutungo API before a session is created.')}</Text>
      <Pressable style={styles.secondaryButton} onPress={() => { setEmailOpen((open) => !open); setError(''); }}><Text style={styles.secondaryText}>{emailOpen ? t('Use phone sign-in') : t('Sign in with email and password')}</Text></Pressable>
      {emailOpen && <View style={[styles.card, { gap: 9 }]}><Text style={styles.label}>{t('Email')}</Text><TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" autoComplete="email" /><Text style={styles.label}>{t('Password')}</Text><TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" /><Pressable style={styles.button} disabled={busy} onPress={() => void submitEmail()}><Text style={styles.buttonText}>{busy ? t('Signing in...') : t('Sign in')}</Text></Pressable><Text style={styles.muted}>{t('Email and password are enabled for development demo accounts only. Use phone verification for live accounts.')}</Text></View>}
      {step === 'phone' ? <View style={{ gap: 10 }}>
        <Text style={styles.label}>{t('Rwanda phone number')}</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+250 7XX XXX XXX" placeholderTextColor={colors.muted} keyboardType="phone-pad" autoComplete="tel" />
        <Pressable style={styles.button} disabled={busy} onPress={() => void submitPhone()}><Text style={styles.buttonText}>{busy ? t('Sending...') : t('Send verification code')}</Text></Pressable>
      </View> : <View style={{ gap: 10 }}>
        <Text style={[styles.body, { color: colors.greenDark }]}>{notice}</Text>
        <Text style={styles.label}>{t('Verification code')}</Text>
        <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder={t('Enter the code you received')} placeholderTextColor={colors.muted} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" />
        <Pressable style={styles.button} disabled={busy} onPress={() => void submitCode()}><Text style={styles.buttonText}>{busy ? t('Verifying...') : t('Verify and continue')}</Text></Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => setStep('phone')}><Text style={styles.secondaryText}>{t('Change phone number')}</Text></Pressable>
      </View>}
      <View style={[styles.card, { gap: 8, marginTop: 12 }]}>
        <Text style={styles.heading}>{t('Apple sign-in')}</Text>
        <Text style={styles.body}>{t('Apple sign-in is not available yet.')}</Text>
      </View>
      <Pressable onPress={() => router.push('/auth/register')}><Text style={{ color: colors.green, textAlign: 'center', fontWeight: '800' }}>{t('Create a new account')}</Text></Pressable>
    </ScrollView>
  </KeyboardAvoidingView>;
}
