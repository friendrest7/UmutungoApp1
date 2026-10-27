import { useEffect, useRef, useState } from 'react';
import { Image, ImageBackground, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { getCachedListings, listListings } from '@/api/client';
import type { ApiListing } from '@/api/types';
import { PropertyCard } from '@/components/PropertyCard';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { useTheme } from '@/theme/ThemeContext';
import { useI18n } from '@/i18n';

const categories: Array<{ key: string; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = [
  { key: 'house', label: 'Houses', icon: 'home-outline', color: '#e8f3ed' },
  { key: 'apartment', label: 'Apartments', icon: 'business-outline', color: '#e8f0f8' },
  { key: 'land', label: 'Land', icon: 'leaf-outline', color: '#eef2df' },
  { key: 'commercial', label: 'Commercial', icon: 'storefront-outline', color: '#f6eee4' },
  { key: 'office', label: 'Offices', icon: 'briefcase-outline', color: '#e8eff0' },
  { key: 'hospitality', label: 'Hotels and lodges', icon: 'bed-outline', color: '#f4e9e7' },
  { key: 'vehicle', label: 'Vehicles', icon: 'car-outline', color: '#e9eef3' },
  { key: 'car_parts', label: 'Car parts', icon: 'construct-outline', color: '#f1eee4' },
  { key: 'furniture', label: 'Furniture', icon: 'bed-outline', color: '#f2ece4' },
  { key: 'appliance', label: 'Appliances', icon: 'grid-outline', color: '#e9f0ec' },
  { key: 'equipment', label: 'Equipment', icon: 'construct-outline', color: '#f1eee4' },
  { key: 'other', label: 'Other assets', icon: 'apps-outline', color: '#eeebf2' },
];
const priceRanges = [
  { label: '0–300,000', min: 0, max: 300_000 },
  { label: '300,000–500,000', min: 300_000, max: 500_000 },
  { label: '500,000–1,000,000', min: 500_000, max: 1_000_000 },
  { label: '1,000,000–10,000,000', min: 1_000_000, max: 10_000_000 },
  { label: '10,000,000+', min: 10_000_000, max: Infinity },
];
const LISTING_PAGE_SIZE = 12;
function discoveryFilters(category: string, priceLabel: string) {
  const range = priceRanges.find((item) => item.label === priceLabel);
  return {
    ...(category ? { category } : {}),
    ...(range?.min ? { min_price: range.min } : {}),
    ...(range && Number.isFinite(range.max) ? { max_price: range.max } : {}),
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const { colors, styles } = useTheme();
  const { width } = useWindowDimensions();
  const { t } = useI18n();
  const { user } = useAuth();
  const [listings, setListings] = useState<ApiListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPriceRange, setSelectedPriceRange] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedBounds, setFeedBounds] = useState({ y: 0, height: 0 });
  const nextOffset = useRef(0);
  const paging = useRef(false);
  const started = useRef(false);
  const load = async () => {
    started.current = true;
    setError('');
    if (!listings.length) {
      const cached = await getCachedListings();
      if (cached?.items?.length) {
        setListings(cached.items.slice(0, LISTING_PAGE_SIZE));
        nextOffset.current = Math.min(cached.items.length, LISTING_PAGE_SIZE);
        setHasMore(cached.has_more ?? cached.items.length >= LISTING_PAGE_SIZE);
        setLoading(false);
      }
    }
    try {
      const result = await listListings({ ...discoveryFilters(selectedCategory, selectedPriceRange), limit: LISTING_PAGE_SIZE, offset: 0 });
      setListings(result.items);
      nextOffset.current = result.items.length;
      setHasMore(result.has_more ?? result.items.length === LISTING_PAGE_SIZE);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Properties could not be loaded.'); }
    finally { setLoading(false); setRefreshing(false); }
  };
  const loadNextPage = async () => {
    if (paging.current || !hasMore) return;
    paging.current = true;
    setLoadingMore(true);
    try {
      const result = await listListings({ ...discoveryFilters(selectedCategory, selectedPriceRange), limit: LISTING_PAGE_SIZE, offset: nextOffset.current });
      setListings((current) => [...current, ...result.items.filter((item) => !current.some((loaded) => loaded.id === item.id))]);
      nextOffset.current += result.items.length;
      setHasMore(result.has_more ?? result.items.length === LISTING_PAGE_SIZE);
    } catch {
      // Keep the listings already on screen available if a later page fails.
    } finally {
      paging.current = false;
      setLoadingMore(false);
    }
  };
  useEffect(() => { void Promise.resolve().then(load); }, []);
  useEffect(() => {
    if (!started.current) return;
    nextOffset.current = 0;
    setHasMore(true);
    setLoading(true);
    setError('');
    void listListings({ ...discoveryFilters(selectedCategory, selectedPriceRange), limit: LISTING_PAGE_SIZE, offset: 0 })
      .then((result) => { setListings(result.items); nextOffset.current = result.items.length; setHasMore(result.has_more ?? result.items.length === LISTING_PAGE_SIZE); })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Properties could not be loaded.'))
      .finally(() => setLoading(false));
  }, [selectedCategory, selectedPriceRange]);
  const goToSearch = (params: { search?: string; category?: string; transaction_type?: string } = {}) => router.push({ pathname: '/search', params });
  const goToAiSearch = () => { const prompt = query.trim(); router.push({ pathname: '/search', params: prompt ? { ai_query: prompt } : {} }); };
  const visibleListings = listings.filter((item) => {
    const listingCategory = item.category.toLowerCase().replace(/[^a-z]/g, '');
    const selected = selectedCategory.replace(/[^a-z]/g, '');
    if (selected && !listingCategory.includes(selected) && !selected.includes(listingCategory)) return false;
    const range = priceRanges.find((item) => item.label === selectedPriceRange);
    return !range || (item.price >= range.min && item.price < range.max);
  });
  const tabletColumns = width >= 720 ? 2 : 1;
  const tabletCardWidth = tabletColumns === 2 ? (Math.min(width, 900) - 52) / 2 : undefined;
  useEffect(() => {
    if (!loading && hasMore && visibleListings.length === 0) void loadNextPage();
  }, [hasMore, loading, selectedCategory, selectedPriceRange, visibleListings.length]);

  return <ScrollView style={styles.screen} onScroll={(event) => { const { contentOffset, layoutMeasurement } = event.nativeEvent; if (feedBounds.height && contentOffset.y + layoutMeasurement.height >= feedBounds.y + feedBounds.height - 300) void loadNextPage(); }} scrollEventThrottle={250} contentContainerStyle={{ width: '100%', maxWidth: 900, alignSelf: 'center', padding: 20, paddingBottom: 28, gap: 22 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.green} />}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 30 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <Image source={require('../../assets/logo.png')} style={{ width: 40, height: 40, borderRadius: 20 }} />
        <View><Text style={[styles.brand, { fontSize: 16, letterSpacing: -0.2 }]}>Umutungo</Text></View>
      </View>
      <Pressable onPress={() => router.push('/(tabs)/profile')} style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }} accessibilityLabel={t('Profile')}>
        <Ionicons name="person-outline" size={19} color={colors.greenDark} />
      </Pressable>
    </View>

    <ImageBackground source={require('../../assets/landing-house.jpg')} imageStyle={{ borderRadius: 24 }} style={{ minHeight: 300, overflow: 'hidden', borderRadius: 24, justifyContent: 'flex-end' }}>
      <View style={{ ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8, 28, 17, 0.48)' }} />
      <View style={{ padding: 21, gap: 12 }}>
        <Text style={{ color: '#d3f0e0', fontSize: 10, fontWeight: '900', letterSpacing: 1.6 }}>{t('UMUTUNGO · RWANDA')}</Text>
        <Text style={{ color: '#ffffff', fontSize: 31, fontWeight: '800', letterSpacing: -0.8, lineHeight: 36 }}>{t('Find a place that feels right.')}</Text>
        <Text style={{ color: 'rgba(255, 255, 255,0.84)', fontSize: 13, lineHeight: 19 }}>{t('Browse homes, land and spaces from local owners.')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, paddingLeft: 13, paddingRight: 5, borderRadius: 14, backgroundColor: '#ffffff' }}>
          <Ionicons name="sparkles-outline" size={19} color={colors.greenDark} />
          <TextInput value={query} onChangeText={setQuery} onSubmitEditing={goToAiSearch} placeholder={t('Describe the properties you want and we get them for you')} placeholderTextColor="#68766c" returnKeyType="search" style={{ minWidth: 0, flex: 1, color: '#17251d', fontSize: 13 }} />
          <Pressable onPress={goToAiSearch} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.green }} accessibilityLabel={t('Search')}>
            <Ionicons name="arrow-forward" size={18} color="#ffffff" />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 9 }}>
          <Pressable onPress={() => goToSearch({ transaction_type: 'rent_out' })} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255, 255, 255,0.42)', backgroundColor: 'rgba(255, 255, 255,0.13)' }}>
            <Ionicons name="key-outline" size={14} color="#000000" /><Text style={{ color: '#000000', fontSize: 11, fontWeight: '700' }}>{t('Rent a place')}</Text>
          </Pressable>
          <Pressable onPress={() => goToSearch({ transaction_type: 'sell' })} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255, 255, 255,0.42)', backgroundColor: 'rgba(255, 255, 255,0.13)' }}>
            <Ionicons name="home-outline" size={14} color="#000000" /><Text style={{ color: '#000000', fontSize: 11, fontWeight: '700' }}>{t('Buy a place')}</Text>
          </Pressable>
        </View>
      </View>
    </ImageBackground>

    <View style={{ gap: 9, padding: 15, borderRadius: 18, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }}>
      <Text style={[styles.heading, { fontSize: 18 }]}>{t('Explore Umutungo and find a property that fits your plans.')}</Text>
      <Text style={[styles.muted, { lineHeight: 19 }]}>{t('Browse homes, land, vehicles, furniture and more across Rwanda. Choose a category and price range to explore the available listings.')}</Text>
    </View>

    <View style={{ gap: 9 }}>
      <Text style={[styles.muted, { fontSize: 11, fontWeight: '800' }]}>{t('Categories')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingRight: 20 }}>
        <Pressable onPress={() => setSelectedCategory('')} style={{ width: 62, alignItems: 'center', gap: 5 }}><View style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: selectedCategory ? colors.paper : colors.greenSoft, borderWidth: 1, borderColor: colors.line }}><Ionicons name="apps-outline" size={19} color={colors.green} /></View><Text style={{ color: colors.ink, fontSize: 9, fontWeight: '700', textAlign: 'center' }}>{t('All')}</Text></Pressable>
        {categories.map((item) => <Pressable key={item.key} onPress={() => setSelectedCategory((current) => current === item.key ? '' : item.key)} style={{ width: 66, alignItems: 'center', gap: 5 }}><View style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: selectedCategory === item.key ? colors.greenSoft : colors.paper, borderWidth: 1, borderColor: selectedCategory === item.key ? colors.green : colors.line }}><Ionicons name={item.icon} size={19} color={colors.greenDark} /></View><Text style={{ color: colors.ink, fontSize: 9, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>{t(item.label)}</Text></Pressable>)}
      </ScrollView>
      <Text style={[styles.muted, { fontSize: 11, fontWeight: '800', marginTop: 2 }]}>{t('Price range')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 20 }}>
        {priceRanges.map((range) => <Pressable key={range.label} onPress={() => setSelectedPriceRange((current) => current === range.label ? '' : range.label)} style={[styles.filterButton, selectedPriceRange === range.label ? styles.button : styles.secondaryButton, { paddingHorizontal: 12, minHeight: 34 }]}><Text style={selectedPriceRange === range.label ? styles.buttonText : styles.secondaryText}>{range.label}</Text></Pressable>)}
      </ScrollView>
    </View>

    {!user && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {([['komisiyoneri', 'Join as Komisiyoneri'], ['landlord', 'Join as Landlord'], ['property_owner', 'Join as Property Owner']] as const).map(([role, label]) => <Pressable key={role} onPress={() => router.push({ pathname: '/auth/register', params: { role: role === 'landlord' ? 'property_owner' : role } })} style={[styles.secondaryButton, { flexGrow: 1, flexBasis: '30%', paddingHorizontal: 8 }]}><Text style={[styles.secondaryText, { textAlign: 'center' }]}>{t(label)}</Text></Pressable>)}
    </View>}

    <Pressable onPress={() => router.push('/chat' as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 16, backgroundColor: colors.greenSoft }}><Ionicons name="sparkles-outline" size={21} color={colors.green} /><View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.ink, fontWeight: '800' }}>{t('Ask the Umutungo assistant')}</Text><Text style={styles.muted}>{t('Describe the home, location, or budget you have in mind.')}</Text></View><Ionicons name="arrow-forward" size={17} color={colors.green} /></Pressable>

    <View style={{ gap: 12, padding: 15, borderRadius: 18, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }}>
      <Text style={styles.heading}>{user ? t('Your Umutungo workspace') : t('Join Umutungo')}</Text>
      {user ? <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={() => router.push('/dashboard' as never)} style={[styles.button, { flex: 1 }]}><Text style={styles.buttonText}>{t('Open dashboard')}</Text></Pressable>
        {(user.role === 'property_owner' || user.role === 'komisiyoneri' || user.role === 'admin') && <Pressable onPress={() => router.push('/listing/new')} style={[styles.secondaryButton, { flex: 1 }]}><Text style={styles.secondaryText}>{t('Post a property')}</Text></Pressable>}
      </View> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {([['client', 'client', 'Join as Client'], ['tenant', 'tenant', 'Join as Tenant']] as const).map(([key, role, label]) => <Pressable key={key} onPress={() => router.push({ pathname: '/auth/register', params: { role } })} style={[styles.secondaryButton, { flexGrow: 1, flexBasis: '45%' }]}><Text style={styles.secondaryText}>{t(label)}</Text></Pressable>)}
      </View>}
    </View>

    <View onLayout={(event) => setFeedBounds({ y: event.nativeEvent.layout.y, height: event.nativeEvent.layout.height })} style={{ gap: 12 }}>
      {!loading && !error && <Text style={styles.heading}>{t('Available properties')} · {visibleListings.length}</Text>}
      {loading ? <LoadingState label={t('Loading live properties...')} /> : error && visibleListings.length === 0 ? <ErrorState message={error} onRetry={() => { setLoading(true); void load(); }} /> : visibleListings.length === 0 ? <EmptyState title={t('No listings found')} message={t('Published properties will appear here when they are available from the Umutungo API.')} /> : <><View style={{ flexDirection: tabletColumns === 2 ? 'row' : 'column', flexWrap: tabletColumns === 2 ? 'wrap' : 'nowrap', gap: 12 }}>{visibleListings.map((listing) => <PropertyCard key={listing.id} cardWidth={tabletCardWidth} listing={listing} onPress={() => router.push({ pathname: '/property/[id]', params: { id: listing.id } })} />)}</View>{loadingMore && <LoadingState label={t('Loading live properties...')} />}<Pressable style={styles.secondaryButton} onPress={() => goToSearch(selectedCategory ? { category: selectedCategory } : {})}><Text style={styles.secondaryText}>{t('Browse all properties')}</Text></Pressable></>}
    </View>

    <Pressable onPress={() => router.push('/(tabs)/profile')} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 17, borderRadius: 18, backgroundColor: colors.greenSoft }}>
      <View style={{ width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.paper }}><Ionicons name="add-circle-outline" size={23} color={colors.green} /></View>
      <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.ink, fontSize: 14, fontWeight: '800' }}>{t('Have a place to rent or sell?')}</Text><Text style={[styles.muted, { fontSize: 11 }]}>{t('Manage listings from your owner account.')}</Text></View>
      <Ionicons name="arrow-forward" size={17} color={colors.green} />
    </Pressable>
  </ScrollView>;
}
