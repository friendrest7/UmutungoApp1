import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { colors } from '@/theme/colors';
import { styles } from '@/theme/styles';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  if (!user) return <ScrollView style={styles.screen} contentContainerStyle={styles.safeContent}><Text style={styles.title}>Your profile</Text><Text style={styles.body}>Sign in to manage your account, saved properties, messages, and listings.</Text><Pressable style={styles.button} onPress={() => router.push('/auth/sign-in')}><Text style={styles.buttonText}>Sign in</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => router.push('/auth/register')}><Text style={styles.secondaryText}>Create account</Text></Pressable></ScrollView>;
  const canManage = user.role === 'property_owner' || user.role === 'komisiyoneri' || user.role === 'admin';
  return <ScrollView style={styles.screen} contentContainerStyle={styles.safeContent}><Text style={styles.brand}>UMUTUNGO ACCOUNT</Text><Text style={styles.title}>{user.name || 'My profile'}</Text><View style={styles.card}><Text style={styles.label}>Phone</Text><Text style={[styles.heading, { marginTop: 5 }]}>{user.phone}</Text><Text style={[styles.label, { marginTop: 16 }]}>Email</Text><Text style={[styles.heading, { marginTop: 5 }]}>{user.email || 'Not provided'}</Text><Text style={[styles.label, { marginTop: 16 }]}>Role</Text><Text style={[styles.heading, { marginTop: 5 }]}>{user.role}</Text></View><View style={[styles.card, { gap: 8 }]}><Text style={styles.heading}>Profile editing</Text><Text style={styles.body}>The current Go API exposes profile data with GET /api/v1/me but does not expose a profile update endpoint. Editing is therefore not enabled until that backend contract exists.</Text></View>{canManage && <><Pressable style={styles.button} onPress={() => router.push('/listing/new')}><Text style={styles.buttonText}>Create listing</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => router.push('/listing/manage')}><Text style={styles.secondaryText}>Manage my listings</Text></Pressable></>}<Pressable style={[styles.secondaryButton, { borderColor: colors.danger }]} onPress={() => { void signOut(); }}><Text style={{ color: colors.danger, fontWeight: '800' }}>Sign out</Text></Pressable></ScrollView>;
}
