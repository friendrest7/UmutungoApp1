import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { updateProfile } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { colors } from '@/theme/colors';
import { styles } from '@/theme/styles';

export default function ProfileScreen() {
  const { user, profile, refresh, signOut, setUser, setProfile } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [language, setLanguage] = useState('en');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setBio(profile?.bio ?? '');
    setLanguage(profile?.language ?? 'en');
  }, [profile, user]);

  if (!user) return <ScrollView style={styles.screen} contentContainerStyle={styles.safeContent}><Text style={styles.title}>Your profile</Text><Text style={styles.body}>Sign in to manage your account, saved properties, messages, and listings.</Text><Pressable style={styles.button} onPress={() => router.push('/auth/sign-in')}><Text style={styles.buttonText}>Sign in</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => router.push('/auth/register')}><Text style={styles.secondaryText}>Create account</Text></Pressable></ScrollView>;

  const canManage = user.role === 'property_owner' || user.role === 'komisiyoneri' || user.role === 'admin';
  const save = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await updateProfile({ name: name.trim(), email: email.trim(), bio: bio.trim(), language });
      setUser(result.user);
      setProfile(result.profile);
      setEditing(false);
      setNotice('Profile updated.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Profile could not be updated.');
    } finally {
      setBusy(false);
    }
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.safeContent}>
    <Text style={styles.brand}>UMUTUNGO ACCOUNT</Text>
    <Text style={styles.title}>{user.name || 'My profile'}</Text>
    {error && <Text style={styles.error}>{error}</Text>}
    {notice && <Text style={{ color: colors.greenDark, fontWeight: '700' }}>{notice}</Text>}
    <View style={[styles.card, { gap: 10 }]}>
      {editing ? <>
        <Text style={styles.label}>Full name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Text style={styles.label}>Bio</Text>
        <TextInput style={[styles.input, { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }]} value={bio} onChangeText={setBio} multiline maxLength={1000} />
        <Text style={styles.label}>Language code</Text>
        <TextInput style={styles.input} value={language} onChangeText={setLanguage} autoCapitalize="none" placeholder="en, fr, rw, or sw" />
        <View style={{ flexDirection: 'row', gap: 8 }}><Pressable style={[styles.button, { flex: 1 }]} disabled={busy} onPress={() => void save()}><Text style={styles.buttonText}>{busy ? 'Saving...' : 'Save profile'}</Text></Pressable><Pressable style={[styles.secondaryButton, { flex: 1 }]} disabled={busy} onPress={() => setEditing(false)}><Text style={styles.secondaryText}>Cancel</Text></Pressable></View>
      </> : <>
        <Text style={styles.label}>Phone</Text><Text style={styles.heading}>{user.phone || 'Not provided'}</Text>
        <Text style={styles.label}>Email</Text><Text style={styles.heading}>{user.email || 'Not provided'}</Text>
        <Text style={styles.label}>Role</Text><Text style={styles.heading}>{user.role}</Text>
        <Text style={styles.label}>Bio</Text><Text style={styles.body}>{profile?.bio || 'No bio added.'}</Text>
        <Text style={styles.label}>Language</Text><Text style={styles.body}>{profile?.language || 'en'}</Text>
        <Pressable style={styles.secondaryButton} onPress={() => { setError(''); setNotice(''); setEditing(true); }}><Text style={styles.secondaryText}>Edit profile</Text></Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => void refresh()}><Text style={styles.secondaryText}>Refresh account</Text></Pressable>
      </>}
    </View>
    {canManage && <><Pressable style={styles.button} onPress={() => router.push('/listing/new')}><Text style={styles.buttonText}>Create listing</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => router.push('/listing/manage')}><Text style={styles.secondaryText}>Manage my listings</Text></Pressable></>}
    <Pressable style={[styles.secondaryButton, { borderColor: colors.danger }]} onPress={() => { void signOut(); }}><Text style={{ color: colors.danger, fontWeight: '800' }}>Sign out</Text></Pressable>
  </ScrollView>;
}
