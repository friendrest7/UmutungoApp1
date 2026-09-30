import { useEffect, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { listListings } from '@/api/client';
import type { ApiListing } from '@/api/types';
import { PropertyCard } from '@/components/PropertyCard';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { colors } from '@/theme/colors';
import { styles } from '@/theme/styles';

export default function HomeScreen() {
  const router = useRouter();
  const [listings, setListings] = useState<ApiListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const load = async () => { setError(''); try { const result = await listListings(); setListings(result.items); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Properties could not be loaded.'); } finally { setLoading(false); setRefreshing(false); } };
  useEffect(() => { void load(); }, []);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.green} />}>
    <View style={{ gap: 7, paddingTop: 12 }}><Text style={styles.brand}>UMUTUNGO</Text><Text style={styles.title}>Find your next home.</Text><Text style={styles.body}>Verified homes, land, and spaces across Rwanda.</Text></View>
    <Pressable style={[styles.input, { justifyContent: 'center' }]} onPress={() => router.push('/search')}><Text style={{ color: colors.muted, fontSize: 14 }}>{query || 'Search properties by location or title'}</Text></Pressable>
    <View style={{ flexDirection: 'row', gap: 10 }}><Pressable style={[styles.button, { flex: 1 }]} onPress={() => router.push('/search?transaction_type=rent')}><Text style={styles.buttonText}>Rent</Text></Pressable><Pressable style={[styles.secondaryButton, { flex: 1 }]} onPress={() => router.push('/search?transaction_type=buy')}><Text style={styles.secondaryText}>Buy</Text></Pressable></View>
    <View style={{ gap: 10, marginTop: 8 }}><Text style={styles.heading}>Latest listings</Text>{loading ? <LoadingState label="Loading live properties..." /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); void load(); }} /> : listings.length === 0 ? <EmptyState title="No listings found" message="Published properties will appear here when they are available from the Umutungo API." /> : listings.slice(0, 6).map((listing) => <PropertyCard key={listing.id} listing={listing} onPress={() => router.push(`/property/${listing.id}`)} />)}</View>
  </ScrollView>;
}
