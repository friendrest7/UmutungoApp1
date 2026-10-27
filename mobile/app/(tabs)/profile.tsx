import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { updateProfile } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useTheme, ThemeMode } from '@/theme/ThemeContext';
import { languageOptions, normalizeLanguage, useI18n } from '@/i18n';

function SettingsCard() {
  const { colors, styles, mode, setMode } = useTheme();
  const { language, setLanguage, t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const modes: ThemeMode[] = ['system', 'light', 'dark'];
  const selectedLanguage = languageOptions.find((item) => item.code === language)?.label ?? language;
  return <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((current) => !current)} style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
      <View style={{ flex: 1, gap: 3 }}><Text style={styles.heading}>{t('Theme')} · {t('Language')}</Text><Text style={styles.muted}>{t(mode[0].toUpperCase() + mode.slice(1))} · {selectedLanguage}</Text></View>
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.ink} />
    </Pressable>
    {expanded && <View style={{ gap: 10, paddingHorizontal: 14, paddingBottom: 14 }}>
      <Text style={styles.label}>{t('Theme')}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>{modes.map((item) => <Pressable key={item} style={[item === mode ? styles.button : styles.secondaryButton, { flex: 1 }]} onPress={() => void setMode(item)}><Text style={item === mode ? styles.buttonText : styles.secondaryText}>{t(item[0].toUpperCase() + item.slice(1))}</Text></Pressable>)}</View>
      <Text style={styles.label}>{t('Language')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{languageOptions.map((item) => <Pressable key={item.code} style={[item.code === language ? styles.button : styles.secondaryButton, { flexGrow: 1, flexBasis: '45%' }]} onPress={() => void setLanguage(item.code)}><Text style={item.code === language ? styles.buttonText : styles.secondaryText}>{item.label}</Text></Pressable>)}</View>
    </View>}
  </View>;
}

export default function ProfileScreen() {
  const { user, profile, refresh, signOut, setUser, setProfile } = useAuth();
  const router = useRouter();
  const { colors, styles } = useTheme();
  const { language: activeLanguage, setLanguage: persistLanguage, t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [language, setLanguage] = useState('en');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  if (!user) return <ScrollView style={styles.screen} contentContainerStyle={styles.safeContent}><Text style={styles.title}>{t('Your profile')}</Text><Text style={styles.body}>{t('Sign in to manage your account, saved properties, messages, and listings.')}</Text><SettingsCard /><Pressable style={styles.button} onPress={() => router.push('/auth/sign-in')}><Text style={styles.buttonText}>{t('Sign in')}</Text></Pressable><View style={[styles.card, { gap: 10, padding: 14 }]}><Text style={styles.heading}>{t('New to Umutungo?')}</Text><Text style={styles.muted}>{t('Create an account to save properties, message owners, and manage your listings.')}</Text><Pressable accessibilityRole="button" style={[styles.button, { minHeight: 52, flexDirection: 'row', gap: 9, borderRadius: 14 }]} onPress={() => router.push('/auth/register')}><Ionicons name="person-add-outline" size={19} color="#000000" /><Text style={styles.buttonText}>{t('Create account')}</Text></Pressable></View></ScrollView>;

  const canManage = user.role === 'property_owner' || user.role === 'komisiyoneri' || user.role === 'admin';
  const save = async () => {
    if (!name.trim()) { setError(t('Name is required.')); return; }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) { setError(t('Enter a valid email address.')); return; }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await updateProfile({ name: name.trim(), email: email.trim(), bio: bio.trim(), language });
      await persistLanguage(normalizeLanguage(language));
      setUser(result.user);
      setProfile(result.profile);
      setEditing(false);
      setNotice(t('Profile updated.'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Profile could not be updated.');
    } finally {
      setBusy(false);
    }
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.safeContent}>
    <Text style={styles.brand}>UMUTUNGO ACCOUNT</Text>
    <Text style={styles.title}>{user.name || t('Your profile')}</Text>
    {error && <Text style={styles.error}>{error}</Text>}
    {notice && <Text style={{ color: colors.greenDark, fontWeight: '700' }}>{notice}</Text>}
    <View style={[styles.card, { gap: 10 }]}>
      {editing ? <>
        <Text style={styles.label}>{t('Full name')}</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />
        <Text style={styles.label}>{t('Email')}</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Text style={styles.label}>{t('Bio')}</Text>
        <TextInput style={[styles.input, { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }]} value={bio} onChangeText={setBio} multiline maxLength={1000} />
        <Text style={styles.label}>{t('Language')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{languageOptions.map((item) => <Pressable key={item.code} style={[item.code === language ? styles.button : styles.secondaryButton, { flexGrow: 1, flexBasis: '45%' }]} onPress={() => { setLanguage(item.code); void persistLanguage(item.code); }}><Text style={item.code === language ? styles.buttonText : styles.secondaryText}>{item.label}</Text></Pressable>)}</View>
        <View style={{ flexDirection: 'row', gap: 8 }}><Pressable style={[styles.button, { flex: 1 }]} disabled={busy} onPress={() => void save()}><Text style={styles.buttonText}>{busy ? t('Saving...') : t('Save')}</Text></Pressable><Pressable style={[styles.secondaryButton, { flex: 1 }]} disabled={busy} onPress={() => setEditing(false)}><Text style={styles.secondaryText}>{t('Cancel')}</Text></Pressable></View>
      </> : <>
        <Text style={styles.label}>{t('Phone')}</Text><Text style={styles.heading}>{user.phone || t('Not provided')}</Text>
        <Text style={styles.label}>{t('Email')}</Text><Text style={styles.heading}>{user.email || t('Not provided')}</Text>
        <Text style={styles.label}>{t('Role')}</Text><Text style={styles.heading}>{t(user.role)}</Text>
        <Text style={styles.label}>{t('Bio')}</Text><Text style={styles.body}>{profile?.bio || t('No bio added.')}</Text>
        <Text style={styles.label}>Language</Text><Text style={styles.body}>{profile?.language || 'en'}</Text>
        <Pressable style={styles.secondaryButton} onPress={() => { setName(user.name ?? ''); setEmail(user.email ?? ''); setBio(profile?.bio ?? ''); setLanguage(normalizeLanguage(profile?.language ?? activeLanguage)); setError(''); setNotice(''); setEditing(true); }}><Text style={styles.secondaryText}>{t('Edit profile')}</Text></Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => void refresh()}><Text style={styles.secondaryText}>{t('Refresh account')}</Text></Pressable>
      </>}
    </View>
    <SettingsCard />
    <Pressable style={styles.secondaryButton} onPress={() => router.push('/chat' as never)}><Text style={styles.secondaryText}>Umutungo AI assistant</Text></Pressable>
    <Pressable style={styles.secondaryButton} onPress={() => router.push('/dashboard' as never)}><Text style={styles.secondaryText}>Open role dashboard</Text></Pressable>
    <Pressable style={styles.secondaryButton} onPress={() => router.push('/messages')}><Text style={styles.secondaryText}>{t('Messages')}</Text></Pressable>
    <Pressable style={styles.secondaryButton} onPress={() => router.push('/notifications')}><Text style={styles.secondaryText}>Notifications</Text></Pressable>
    <Pressable style={styles.secondaryButton} onPress={() => router.push('/applications')}><Text style={styles.secondaryText}>Rental applications</Text></Pressable>
    {canManage && <><Pressable style={styles.button} onPress={() => router.push('/listing/new')}><Text style={styles.buttonText}>{t('Create listing')}</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => router.push('/listing/manage')}><Text style={styles.secondaryText}>{t('Manage my listings')}</Text></Pressable></>}
    {user.role === 'property_owner' && <Pressable style={styles.secondaryButton} onPress={() => router.push('/owner-upgrade' as never)}><Text style={styles.secondaryText}>Owner premium plans · MTN MoMo</Text></Pressable>}
    <Pressable style={[styles.secondaryButton, { borderColor: colors.danger }]} onPress={() => { void signOut(); }}><Text style={{ color: colors.danger, fontWeight: '800' }}>{t('Sign out')}</Text></Pressable>
  </ScrollView>;
}
