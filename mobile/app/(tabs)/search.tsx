import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { listListings } from '@/api/client';
import type { ApiListing } from '@/api/types';
import { PropertyCard } from '@/components/PropertyCard';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { useTheme } from '@/theme/ThemeContext';
import { useI18n } from '@/i18n';

const categories = [
  ['house', 'Houses'], ['apartment', 'Apartments'], ['land', 'Land'], ['commercial', 'Commercial'],
  ['office', 'Offices'], ['hospitality', 'Hotels & lodges'], ['vehicle', 'Vehicles'], ['furniture', 'Furniture'],
  ['appliance', 'Appliances'], ['equipment', 'Equipment'], ['other', 'Other assets'],
] as const;

export default function SearchScreen() {
  const params = useLocalSearchParams<{ search?: string; transaction_type?: string; category?: string }>();
  const router = useRouter();
  const { colors, styles } = useTheme();
  const { t } = useI18n();
  const [search, setSearch] = useState(params.search ?? '');
  const [transactionType, setTransactionType] = useState(params.transaction_type ?? '');
  const [category, setCategory] = useState(params.category ?? '');
  const [listings, setListings] = useState<ApiListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(12);
  const load = async () => { setError(''); setVisible(12); try { const result = await listListings({ search, transaction_type: transactionType, category }); setListings(result.items); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Search could not be completed.'); } finally { setLoading(false); setRefreshing(false); } };
  useEffect(() => { void load(); }, [transactionType, category]);
  const shown = useMemo(() => listings.slice(0, visible), [listings, visible]);
  const filter = (key: string, active: boolean, label: string, action: () => void) => <Pressable key={key} style={[styles.filterButton, active ? styles.button : styles.secondaryButton]} onPress={action}><Text style={active ? styles.buttonText : styles.secondaryText}>{label}</Text></Pressable>;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.green} />}>
    <Text style={styles.title}>{t('Search')}</Text>
    <TextInput style={styles.input} value={search} onChangeText={setSearch} onSubmitEditing={() => { setLoading(true); void load(); }} placeholder={t('Neighbourhood, district, or property')} placeholderTextColor={colors.muted} returnKeyType="search" />
    <Text style={[styles.body, { fontWeight: '700', marginTop: 6 }]}>{t('Looking to')}</Text>
    <View style={styles.filterRow}>{filter('all', !transactionType, 'All', () => setTransactionType(''))}{filter('rent', transactionType === 'rent_out', t('Rent'), () => setTransactionType('rent_out'))}{filter('sale', transactionType === 'sell', t('Buy'), () => setTransactionType('sell'))}</View>
    <Text style={[styles.body, { fontWeight: '700', marginTop: 8 }]}>{t('Browse categories')}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>{filter('all-categories', !category, 'Every type', () => setCategory(''))}{categories.map(([key, label]) => filter(key, category === key, t(label), () => setCategory(key)))}</ScrollView>
    {loading ? <LoadingState label={t('Loading live properties...')} /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); void load(); }} /> : shown.length === 0 ? <EmptyState title={t('No listings found')} message={t('Try another location, category, or transaction type.')} /> : <View style={{ gap: 12 }}>{shown.map((listing) => <PropertyCard key={listing.id} listing={listing} onPress={() => router.push({ pathname: '/property/[id]', params: { id: listing.id } })} />)}{visible < listings.length && <Pressable style={styles.secondaryButton} onPress={() => setVisible((value) => value + 12)}><Text style={styles.secondaryText}>{t('Load more results')}</Text></Pressable>}</View>}
  </ScrollView>;
}
