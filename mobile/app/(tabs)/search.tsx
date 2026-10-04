import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { listListings } from '@/api/client';
import type { ApiListing } from '@/api/types';
import { PropertyCard } from '@/components/PropertyCard';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { useTheme } from '@/theme/ThemeContext';
import { useI18n } from '@/i18n';

export default function SearchScreen() {
  const params = useLocalSearchParams<{ search?: string; transaction_type?: string }>();
  const router = useRouter();
  const { colors, styles } = useTheme();
  const { t } = useI18n();
  const [search, setSearch] = useState(params.search ?? '');
  const [transactionType, setTransactionType] = useState(params.transaction_type ?? '');
  const [category, setCategory] = useState('');
  const [listings, setListings] = useState<ApiListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(12);
  const load = async () => { setError(''); setVisible(12); try { const result = await listListings({ search, transaction_type: transactionType, category }); setListings(result.items); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Search could not be completed.'); } finally { setLoading(false); setRefreshing(false); } };
  useEffect(() => { void load(); }, [transactionType, category]);
  const shown = useMemo(() => listings.slice(0, visible), [listings, visible]);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.green} />}><Text style={styles.title}>{t('Search')}</Text><TextInput style={styles.input} value={search} onChangeText={setSearch} onSubmitEditing={() => { setLoading(true); void load(); }} placeholder="Neighbourhood, title, or district" placeholderTextColor={colors.muted} returnKeyType="search" /><View style={styles.filterRow}><Pressable style={[styles.filterButton, transactionType === '' ? styles.button : styles.secondaryButton]} onPress={() => setTransactionType('')}><Text style={transactionType === '' ? styles.buttonText : styles.secondaryText}>All</Text></Pressable><Pressable style={[styles.filterButton, transactionType === 'rent' ? styles.button : styles.secondaryButton]} onPress={() => setTransactionType('rent')}><Text style={transactionType === 'rent' ? styles.buttonText : styles.secondaryText}>{t('Rent')}</Text></Pressable><Pressable style={[styles.filterButton, transactionType === 'buy' ? styles.button : styles.secondaryButton]} onPress={() => setTransactionType('buy')}><Text style={transactionType === 'buy' ? styles.buttonText : styles.secondaryText}>{t('Buy')}</Text></Pressable></View><View style={styles.filterRow}><Pressable style={[styles.filterButton, category === '' ? styles.button : styles.secondaryButton]} onPress={() => setCategory('')}><Text style={category === '' ? styles.buttonText : styles.secondaryText}>Every type</Text></Pressable><Pressable style={[styles.filterButton, category === 'house' ? styles.button : styles.secondaryButton]} onPress={() => setCategory('house')}><Text style={category === 'house' ? styles.buttonText : styles.secondaryText}>Houses</Text></Pressable><Pressable style={[styles.filterButton, category === 'apartment' ? styles.button : styles.secondaryButton]} onPress={() => setCategory('apartment')}><Text style={category === 'apartment' ? styles.buttonText : styles.secondaryText}>Apartments</Text></Pressable></View>{loading ? <LoadingState label="Searching live properties..." /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); void load(); }} /> : shown.length === 0 ? <EmptyState title={t('No listings found')} message="Try another location, category, or transaction type." /> : <View style={{ gap: 12 }}>{shown.map((listing) => <PropertyCard key={listing.id} listing={listing} onPress={() => router.push(`/property/${listing.id}`)} />)}{visible < listings.length && <Pressable style={styles.secondaryButton} onPress={() => setVisible((value) => value + 12)}><Text style={styles.secondaryText}>Load more results</Text></Pressable>}</View>}</ScrollView>;
}
