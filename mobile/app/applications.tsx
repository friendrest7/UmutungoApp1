import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { useFocusEffect, useRouter } from 'expo-router';
import { decideApplication, listApplications, markApplicationViewed } from '@/api/client';
import type { ApiApplication } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { useTheme } from '@/theme/ThemeContext';

export default function ApplicationsScreen() {
  const { user } = useAuth(); const { colors, styles } = useTheme(); const router = useRouter();
  const [items, setItems] = useState<ApiApplication[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { setItems((await listApplications()).items); } catch (e) { setError(e instanceof Error ? e.message : 'Applications could not be loaded.'); } finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const update = async (item: ApiApplication, status: 'accepted' | 'rejected' | 'more_info' | 'viewed') => {
    setBusy(item.id); setError('');
    try { if (status === 'viewed') await markApplicationViewed(item.id); else await decideApplication(item.id, status); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Application could not be updated.'); }
    finally { setBusy(''); }
  };
  if (!user) return <View style={[styles.screen, styles.safeContent]}><Text style={styles.heading}>Sign in to view applications</Text><Pressable style={styles.button} onPress={() => router.push('/auth/sign-in')}><Text style={styles.buttonText}>Sign in</Text></Pressable></View>;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.safeContent}><Pressable onPress={() => router.back()}><Text style={{ color: colors.green, fontWeight: '800' }}>‹ Back</Text></Pressable><Text style={styles.title}>Rental applications</Text><Text style={styles.body}>Applications you sent and applications for your listings.</Text>{error ? <ErrorState message={error} onRetry={() => void load()} /> : loading ? <LoadingState /> : items.length === 0 ? <EmptyState title="No applications yet" message="Applications for your rentals will appear here." /> : <View style={{ gap: 12 }}>{items.map((item) => { const mine = item.applicant_id === user.id; return <View key={item.id} style={[styles.card, { gap: 8 }]}><Text style={styles.heading}>{item.listing_title}</Text><Text style={styles.muted}>{mine ? 'Your application' : `Applicant: ${item.applicant_name || 'Umutungo user'}`} · {item.status}</Text>{item.message ? <Text style={styles.body}>{item.message}</Text> : null}{item.viewed_at ? <Text style={styles.muted}>Viewing recorded</Text> : null}{mine && !item.viewed_at && <Pressable style={styles.secondaryButton} disabled={busy === item.id} onPress={() => void update(item, 'viewed')}><Text style={styles.secondaryText}>{busy === item.id ? 'Saving…' : 'Mark property viewed'}</Text></Pressable>}{!mine && ['pending', 'more_info'].includes(item.status) && <View style={{ flexDirection: 'row', gap: 8 }}><Pressable style={[styles.button, { flex: 1 }]} disabled={busy === item.id} onPress={() => void update(item, 'accepted')}><Text style={styles.buttonText}>Accept</Text></Pressable><Pressable style={[styles.secondaryButton, { flex: 1 }]} disabled={busy === item.id} onPress={() => void update(item, 'more_info')}><Text style={styles.secondaryText}>Request info</Text></Pressable><Pressable style={[styles.secondaryButton, { flex: 1 }]} disabled={busy === item.id} onPress={() => void update(item, 'rejected')}><Text style={styles.secondaryText}>Decline</Text></Pressable></View>}</View>; })}</View>}</ScrollView>;
}
