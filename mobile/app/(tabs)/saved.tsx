import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { listFavorites, removeFavorite } from '@/api/client';
import type { FavoriteItem } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { useTheme } from '@/theme/ThemeContext';
import { useI18n } from '@/i18n';

export default function SavedScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors, styles } = useTheme();
  const { t } = useI18n();
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => { if (!user) { setLoading(false); return; } setLoading(true); setError(''); try { setItems((await listFavorites()).items); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Saved properties could not be loaded.'); } finally { setLoading(false); } }, [user]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  if (!user) return <ScrollView style={styles.screen} contentContainerStyle={styles.safeContent}><Text style={styles.title}>{t('Saved')}</Text><EmptyState title="Sign in to save properties" message="Your saved homes are connected to your Umutungo account." /><Pressable style={styles.button} onPress={() => router.push('/auth/sign-in')}><Text style={styles.buttonText}>{t('Sign in')}</Text></Pressable></ScrollView>;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.safeContent}><Text style={styles.title}>{t('Saved')}</Text>{loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : items.length === 0 ? <EmptyState title={t('Nothing saved yet')} message={t('Tap the heart on a property to keep it here.')} /> : <View style={{ gap: 12 }}>{items.map((item) => <View key={item.property_id} style={[styles.card, { flexDirection: 'row', gap: 12, alignItems: 'center' }]}><Image source={item.image ? { uri: item.image } : require('../../assets/placeholder-property.jpg')} style={{ width: 88, height: 88, borderRadius: 12 }} /><View style={{ flex: 1, gap: 4 }}><Text style={styles.heading} numberOfLines={2}>{item.title}</Text><Text style={styles.muted}>{item.location}</Text><Text style={{ color: colors.greenDark, fontWeight: '800' }}>{item.price}</Text><View style={{ flexDirection: 'row', gap: 12, marginTop: 5 }}><Pressable onPress={() => router.push(`/property/${item.property_id}`)}><Text style={{ color: colors.green, fontWeight: '800' }}>View</Text></Pressable><Pressable onPress={async () => { try { await removeFavorite(item.property_id); setItems((current) => current.filter((saved) => saved.property_id !== item.property_id)); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not remove saved property.'); } }}><Text style={{ color: colors.danger, fontWeight: '800' }}>Remove</Text></Pressable></View></View></View>)}</View>}</ScrollView>;
}
