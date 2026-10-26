import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getCachedListings, listListings } from '@/api/client';
import type { ApiListing, ListingQuery } from '@/api/types';
import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { PropertyCard } from '@/components/PropertyCard';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { useTheme } from '@/theme/ThemeContext';
import { useI18n } from '@/i18n';

const categories = [
  ['house', 'Houses'], ['apartment', 'Apartments'], ['land', 'Land'], ['commercial', 'Commercial'],
  ['office', 'Offices'], ['hospitality', 'Hotels & lodges'], ['vehicle', 'Vehicles'], ['car_parts', 'Car parts'], ['furniture', 'Furniture'],
  ['appliance', 'Appliances'], ['equipment', 'Equipment'], ['other', 'Other assets'],
] as const;
const priceRanges = [
  { label: '0–300,000', min: 0, max: 300_000 },
  { label: '300,000–500,000', min: 300_000, max: 500_000 },
  { label: '500,000–1,000,000', min: 500_000, max: 1_000_000 },
  { label: '1,000,000–10,000,000', min: 1_000_000, max: 10_000_000 },
  { label: '10,000,000+', min: 10_000_000, max: Infinity },
];

type SearchMessage = { role: 'user' | 'assistant'; content: string };
type SearchPlan = { status: 'clarify' | 'search'; reply: string; category: string; location: string; province: string; district: string; sector: string; intent: string; priceRange: string; minBedrooms: number };
const PROPERTY_SEARCH_URL = process.env.EXPO_PUBLIC_PROPERTY_SEARCH_API_URL || (process.env.EXPO_PUBLIC_CHAT_API_URL || 'https://umutungo.rw/api/chat').replace(/\/api\/chat\/?$/, '/api/property-search');
const LISTING_PAGE_SIZE = 12;
const searchCategoryMap: Record<string, string> = { houses: 'house', apartments: 'apartment', land: 'land', commercial: 'commercial', offices: 'office', hospitality: 'hospitality', vehicles: 'vehicle', 'car-parts': 'car_parts', furniture: 'furniture', appliances: 'appliance', equipment: 'equipment', other: 'other' };

function matchesPriceRange(price: number, range: string) {
  const normalized = range.replace(/[–—]/g, '-');
  if (!range || normalized === 'Any price') return true;
  if (normalized === '0-300,000') return price <= 300_000;
  if (normalized === '300,000-500,000') return price > 300_000 && price <= 500_000;
  if (normalized === '500,000-1,000,000') return price > 500_000 && price <= 1_000_000;
  if (normalized === '1,000,000-10,000,000') return price > 1_000_000 && price <= 10_000_000;
  if (normalized === '10,000,000+') return price > 10_000_000;
  if (normalized === 'Under RWF 500,000') return price < 500_000;
  if (normalized === 'RWF 500,000 - 1,000,000') return price >= 500_000 && price <= 1_000_000;
  if (normalized === 'Over RWF 1,000,000') return price > 1_000_000;
  return true;
}

export default function SearchScreen() {
  const params = useLocalSearchParams<{ search?: string; ai_query?: string; transaction_type?: string; category?: string; province?: string; district?: string; sector?: string }>();
  const router = useRouter();
  const { colors, styles } = useTheme();
  const { width } = useWindowDimensions();
  const { t } = useI18n();
  const [search, setSearch] = useState(params.search ?? '');
  const [transactionType, setTransactionType] = useState(params.transaction_type ?? '');
  const [category, setCategory] = useState(params.category ?? '');
  const [listings, setListings] = useState<ApiListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(Boolean(params.ai_query));
  const [assistantPrompt, setAssistantPrompt] = useState(params.ai_query ?? '');
  const [selectedPriceRange, setSelectedPriceRange] = useState('');
  const [assistantMessages, setAssistantMessages] = useState<SearchMessage[]>([]);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantError, setAssistantError] = useState('');
  const skipFilterReload = useRef(false);
  const nextOffset = useRef(0);
  const paging = useRef(false);
  const activeFilters = useRef<ListingQuery>({});
  const load = async (filters: ListingQuery = { search, transaction_type: transactionType, category }) => {
    setError(''); setLoading(true); setHasMore(false); nextOffset.current = 0; activeFilters.current = filters;
    const range = priceRanges.find((item) => item.label === selectedPriceRange);
    const priceFilter = { ...(range?.min ? { min_price: range.min } : {}), ...(range && Number.isFinite(range.max) ? { max_price: range.max } : {}) };
    const pageQuery = { ...filters, ...priceFilter, limit: LISTING_PAGE_SIZE, offset: 0 };
    const cached = await getCachedListings(pageQuery);
    if (cached?.items?.length) {
      setListings(cached.items); nextOffset.current = cached.items.length; setHasMore(cached.has_more ?? cached.items.length === LISTING_PAGE_SIZE); setLoading(false);
    }
    try {
      const result = await listListings(pageQuery);
      setListings(result.items); nextOffset.current = result.items.length; setHasMore(result.has_more ?? result.items.length === LISTING_PAGE_SIZE);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Search could not be completed.'); }
    finally { setLoading(false); setRefreshing(false); }
  };
  const loadNextPage = async () => {
    if (!hasMore || paging.current) return;
    paging.current = true; setLoadingMore(true);
    const range = priceRanges.find((item) => item.label === selectedPriceRange);
    const priceFilter = { ...(range?.min ? { min_price: range.min } : {}), ...(range && Number.isFinite(range.max) ? { max_price: range.max } : {}) };
    try {
      const result = await listListings({ ...activeFilters.current, ...priceFilter, limit: LISTING_PAGE_SIZE, offset: nextOffset.current });
      setListings((current) => [...current, ...result.items.filter((item) => !current.some((loaded) => loaded.id === item.id))]);
      nextOffset.current += result.items.length; setHasMore(result.has_more ?? result.items.length === LISTING_PAGE_SIZE);
    } catch { /* Keep the already loaded results visible while the user remains online/offline. */ }
    finally { paging.current = false; setLoadingMore(false); }
  };
  useEffect(() => { if (skipFilterReload.current) { skipFilterReload.current = false; return; } void Promise.resolve().then(() => load()); }, [transactionType, category, selectedPriceRange]);
  const shown = useMemo(() => {
    const range = priceRanges.find((item) => item.label === selectedPriceRange);
    return listings.filter((item) => !range || (item.price >= range.min && item.price < range.max));
  }, [listings, selectedPriceRange]);
  const tabletColumns = width >= 720 ? 2 : 1;
  const tabletCardWidth = tabletColumns === 2 ? (Math.min(width, 760) - 52) / 2 : undefined;
  const askForProperty = async () => {
    const content = assistantPrompt.trim();
    if (!content || assistantBusy) return;
    const nextMessages = [...assistantMessages, { role: 'user' as const, content }];
    setAssistantMessages(nextMessages); setAssistantPrompt(''); setAssistantBusy(true); setAssistantError('');
    try {
      const response = await fetch(PROPERTY_SEARCH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ messages: nextMessages.slice(-10) }) });
      const plan = await response.json() as SearchPlan & { error?: string };
      if (!response.ok || !plan.reply) throw new Error(plan.error || `Property search assistant unavailable (${response.status}).`);
      if (plan.status === 'search') {
        const categoryFilter = plan.category === 'properties' ? '' : searchCategoryMap[plan.category] ?? '';
        const transactionFilter = plan.intent === 'Rent' ? 'rent_out' : plan.intent === 'Buy' ? 'sell' : '';
        const range = priceRanges.find((item) => item.label === plan.priceRange);
        const filters: ListingQuery = {
          category: categoryFilter,
          transaction_type: transactionFilter,
          ...(plan.province ? { province: plan.province } : {}),
          ...(plan.district ? { district: plan.district } : {}),
          ...(plan.sector ? { sector: plan.sector } : {}),
          ...(range?.min ? { min_price: range.min } : {}),
          ...(range && Number.isFinite(range.max) ? { max_price: range.max } : {}),
          ...(plan.minBedrooms > 0 ? { min_bedrooms: plan.minBedrooms } : {}),
          limit: LISTING_PAGE_SIZE,
          offset: 0,
        };
        skipFilterReload.current = category !== categoryFilter || transactionType !== transactionFilter || selectedPriceRange !== plan.priceRange;
        setSearch(''); setCategory(categoryFilter); setTransactionType(transactionFilter); setSelectedPriceRange(plan.priceRange); setLoading(true); setError('');
        activeFilters.current = filters;
        const result = await listListings(filters);
        let matches = result.items;
        if (plan.location) {
          const location = plan.location.toLocaleLowerCase();
          matches = matches.filter((item) => `${item.province} ${item.district} ${item.sector} ${item.cell ?? ''} ${item.village ?? ''}`.toLocaleLowerCase().includes(location));
        }
        matches = matches.filter((item) => matchesPriceRange(item.price, plan.priceRange));
        nextOffset.current = result.items.length; setHasMore(result.has_more ?? result.items.length === LISTING_PAGE_SIZE); setListings(matches); setLoading(false);
        setAssistantMessages((current) => [...current, { role: 'assistant', content: matches.length ? plan.reply : 'I couldn’t find a live listing matching all those details. Which area, budget, or property feature would you like to adjust?' }]);
      } else {
        setAssistantMessages((current) => [...current, { role: 'assistant', content: plan.reply }]);
      }
    } catch (cause) { setAssistantError(cause instanceof Error ? cause.message : 'The property search assistant could not be reached.'); setLoading(false); }
    finally { setAssistantBusy(false); }
  };
  const filter = (key: string, active: boolean, label: string, action: () => void) => <Pressable key={key} style={[styles.filterButton, active ? styles.button : styles.secondaryButton]} onPress={action}><Text style={active ? styles.buttonText : styles.secondaryText}>{label}</Text></Pressable>;
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
  <ScrollView style={styles.screen} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onScroll={(event) => { const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent; if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 420) void loadNextPage(); }} scrollEventThrottle={250} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.green} />}>
    <Text style={styles.title}>{t('Search')}</Text>
    <View style={{ overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: assistantOpen }} onPress={() => setAssistantOpen((open) => !open)} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, backgroundColor: colors.greenSoft }}><Ionicons name="sparkles-outline" size={21} color={colors.green} /><View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.ink, fontWeight: '800' }}>Find a property by chatting</Text><Text style={styles.muted}>Describe what you need in your own words.</Text></View><Ionicons name={assistantOpen ? 'chevron-up' : 'chevron-down'} size={17} color={colors.green} /></Pressable>
      {assistantOpen && <View style={{ gap: 10, padding: 13 }}>
        <ScrollView style={{ maxHeight: 210 }} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
          {!assistantMessages.length && <Text style={styles.muted}>{t('Describe the properties you want and we get them for you')}</Text>}
          {assistantMessages.map((message, index) => <View key={`${message.role}-${index}`} style={[styles.card, { alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%', padding: 10, backgroundColor: message.role === 'user' ? colors.greenSoft : colors.paper }]}><Text style={styles.body}>{message.content}</Text></View>)}
          {assistantBusy && <Text style={styles.muted}>Finding the right next step…</Text>}
          {assistantError ? <Text style={styles.error}>{assistantError}</Text> : null}
        </ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><TextInput style={[styles.input, { minWidth: 0, flex: 1, minHeight: 44 }]} value={assistantPrompt} onChangeText={setAssistantPrompt} onSubmitEditing={() => void askForProperty()} placeholder={t('Describe the property you need')} placeholderTextColor={colors.muted} returnKeyType="send" editable={!assistantBusy} /><Pressable accessibilityRole="button" style={[styles.button, { minHeight: 44, justifyContent: 'center', paddingHorizontal: 15 }]} disabled={assistantBusy || !assistantPrompt.trim()} onPress={() => void askForProperty()}><Text style={styles.buttonText}>{assistantBusy ? '…' : t('Search')}</Text></Pressable></View>
      </View>}
    </View>
    <TextInput style={styles.input} value={search} onChangeText={setSearch} onSubmitEditing={() => { setLoading(true); void load(); }} placeholder={t('Neighbourhood, district, or property')} placeholderTextColor={colors.muted} returnKeyType="search" />
    <Text style={[styles.body, { fontWeight: '700', marginTop: 6 }]}>{t('Looking to')}</Text>
    <View style={styles.filterRow}>{filter('all', !transactionType, 'All', () => setTransactionType(''))}{filter('rent', transactionType === 'rent_out', t('Rent'), () => setTransactionType('rent_out'))}{filter('sale', transactionType === 'sell', t('Buy'), () => setTransactionType('sell'))}</View>
    <Text style={[styles.body, { fontWeight: '700', marginTop: 8 }]}>{t('Browse categories')}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>{filter('all-categories', !category, 'Every type', () => setCategory(''))}{categories.map(([key, label]) => filter(key, category === key, t(label), () => setCategory(key)))}</ScrollView>
    <Text style={[styles.body, { fontWeight: '700', marginTop: 2 }]}>{t('Price range')}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>{priceRanges.map((range) => filter(`price-${range.label}`, selectedPriceRange === range.label, range.label, () => setSelectedPriceRange((current) => current === range.label ? '' : range.label)))}</ScrollView>
    {loading && !listings.length ? <LoadingState label={t('Loading live properties...')} /> : error && !shown.length ? <ErrorState message={error} onRetry={() => { setLoading(true); void load(); }} /> : shown.length === 0 ? <EmptyState title={t('No listings found')} message={t('Try another location, category, or transaction type.')} /> : <View style={{ flexDirection: tabletColumns === 2 ? 'row' : 'column', flexWrap: tabletColumns === 2 ? 'wrap' : 'nowrap', gap: 12 }}>{shown.map((listing) => <PropertyCard key={listing.id} cardWidth={tabletCardWidth} listing={listing} onPress={() => router.push({ pathname: '/property/[id]', params: { id: listing.id } })} />)}{loadingMore && <LoadingState label={t('Loading live properties...')} />}</View>}
  </ScrollView>
  </KeyboardAvoidingView>;
}
