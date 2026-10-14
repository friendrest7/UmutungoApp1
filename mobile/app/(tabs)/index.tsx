import { useEffect, useState } from 'react';
import { Image, ImageBackground, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
  { key: 'house', label: 'Houses', icon: 'home-outline', color: '#e9f3e8' },
  { key: 'apartment', label: 'Apartments', icon: 'business-outline', color: '#e8f0f8' },
  { key: 'land', label: 'Land', icon: 'leaf-outline', color: '#eef2df' },
  { key: 'commercial', label: 'Commercial', icon: 'storefront-outline', color: '#f6eee4' },
  { key: 'office', label: 'Offices', icon: 'briefcase-outline', color: '#e8eff0' },
  { key: 'hospitality', label: 'Hotels and lodges', icon: 'bed-outline', color: '#f4e9e7' },
  { key: 'vehicle', label: 'Vehicles', icon: 'car-outline', color: '#e9eef3' },
  { key: 'furniture', label: 'Furniture', icon: 'bed-outline', color: '#f2ece4' },
  { key: 'appliance', label: 'Appliances', icon: 'grid-outline', color: '#e9f0ef' },
  { key: 'equipment', label: 'Equipment', icon: 'construct-outline', color: '#f1eee4' },
  { key: 'other', label: 'Other assets', icon: 'apps-outline', color: '#eeebf2' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { colors, styles } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const [listings, setListings] = useState<ApiListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const load = async () => {
    setError('');
    if (!listings.length) {
      const cached = await getCachedListings();
      if (cached?.items?.length) { setListings(cached.items); setLoading(false); }
    }
    try { const result = await listListings(); setListings(result.items); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Properties could not be loaded.'); }
    finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { void Promise.resolve().then(load); }, []);
  const goToSearch = (params: { search?: string; category?: string; transaction_type?: string } = {}) => router.push({ pathname: '/search', params });

  return <ScrollView style={styles.screen} contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 28, gap: 22 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.green} />}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 5 }}>
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
        <Text style={{ color: '#d3f0dc', fontSize: 10, fontWeight: '900', letterSpacing: 1.6 }}>{t('UMUTUNGO · RWANDA')}</Text>
        <Text style={{ color: '#ffffff', fontSize: 31, fontWeight: '800', letterSpacing: -0.8, lineHeight: 36 }}>{t('Find a place that feels right.')}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.84)', fontSize: 13, lineHeight: 19 }}>{t('Browse homes, land and spaces from local owners.')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, paddingLeft: 13, paddingRight: 5, borderRadius: 14, backgroundColor: '#ffffff' }}>
          <Ionicons name="search-outline" size={19} color={colors.greenDark} />
          <TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => goToSearch({ search: query.trim() })} placeholder={t('Neighbourhood, district, or property')} placeholderTextColor="#68766c" returnKeyType="search" style={{ minWidth: 0, flex: 1, color: '#17251c', fontSize: 13 }} />
          <Pressable onPress={() => goToSearch({ search: query.trim() })} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.green }} accessibilityLabel={t('Search')}>
            <Ionicons name="arrow-forward" size={18} color="#ffffff" />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 9 }}>
          <Pressable onPress={() => goToSearch({ transaction_type: 'rent_out' })} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.42)', backgroundColor: 'rgba(255,255,255,0.13)' }}>
            <Ionicons name="key-outline" size={14} color="#ffffff" /><Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '800' }}>{t('Rent a place')}</Text>
          </Pressable>
          <Pressable onPress={() => goToSearch({ transaction_type: 'sell' })} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.42)', backgroundColor: 'rgba(255,255,255,0.13)' }}>
            <Ionicons name="home-outline" size={14} color="#ffffff" /><Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '800' }}>{t('Buy a place')}</Text>
          </Pressable>
        </View>
      </View>
    </ImageBackground>

    <Pressable onPress={() => router.push('/chat' as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 16, backgroundColor: colors.greenSoft }}><Ionicons name="sparkles-outline" size={21} color={colors.green} /><View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.ink, fontWeight: '800' }}>{t('Ask the Umutungo assistant')}</Text><Text style={styles.muted}>{t('Describe the home, location, or budget you have in mind.')}</Text></View><Ionicons name="arrow-forward" size={17} color={colors.green} /></Pressable>

    <View style={{ gap: 12, padding: 15, borderRadius: 18, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }}>
      <Text style={styles.heading}>{user ? t('Your Umutungo workspace') : t('Join Umutungo')}</Text>
      {user ? <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={() => router.push('/dashboard' as never)} style={[styles.button, { flex: 1 }]}><Text style={styles.buttonText}>{t('Open dashboard')}</Text></Pressable>
        {(user.role === 'property_owner' || user.role === 'komisiyoneri' || user.role === 'admin') && <Pressable onPress={() => router.push('/listing/new')} style={[styles.secondaryButton, { flex: 1 }]}><Text style={styles.secondaryText}>{t('Post a property')}</Text></Pressable>}
      </View> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {([['client', 'client', 'Join as Client'], ['tenant', 'tenant', 'Join as Tenant'], ['komisiyoneri', 'komisiyoneri', 'Join as Komisiyoneri'], ['landlord', 'property_owner', 'Join as Landlord'], ['property_owner', 'property_owner', 'Join as Property Owner']] as const).map(([key, role, label]) => <Pressable key={key} onPress={() => router.push({ pathname: '/auth/register', params: { role } })} style={[styles.secondaryButton, { flexGrow: 1, flexBasis: '45%' }]}><Text style={styles.secondaryText}>{t(label)}</Text></Pressable>)}
      </View>}
    </View>

    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ gap: 3 }}><Text style={[styles.muted, { color: colors.green, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }]}>{t('EXPLORE')}</Text><Text style={styles.heading}>{t('Browse categories')}</Text></View>
        <Pressable onPress={() => goToSearch()}><Text style={{ color: colors.green, fontSize: 12, fontWeight: '800' }}>{t('View all')}</Text></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 20 }}>
        {categories.map((item) => <Pressable key={item.key} onPress={() => goToSearch({ category: item.key })} style={{ width: 94, minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 9, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper }}>
          <View style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: item.color }}><Ionicons name={item.icon} size={21} color={colors.greenDark} /></View>
          <Text style={{ color: colors.ink, fontSize: 10, fontWeight: '800', textAlign: 'center' }} numberOfLines={2}>{t(item.label)}</Text>
        </Pressable>)}
      </ScrollView>
    </View>

    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ gap: 3 }}><Text style={[styles.muted, { color: colors.green, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }]}>{t('FRESH FROM OWNERS')}</Text><Text style={styles.heading}>{t('Latest listings')}</Text></View>
        <Pressable onPress={() => goToSearch()} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}><Text style={{ color: colors.green, fontSize: 12, fontWeight: '800' }}>{t('View all')}</Text><Ionicons name="arrow-forward" size={14} color={colors.green} /></Pressable>
      </View>
      {loading ? <LoadingState label={t('Loading live properties...')} /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); void load(); }} /> : listings.length === 0 ? <EmptyState title={t('No listings found')} message={t('Published properties will appear here when they are available from the Umutungo API.')} /> : listings.slice(0, 4).map((listing) => <PropertyCard key={listing.id} listing={listing} onPress={() => router.push({ pathname: '/property/[id]', params: { id: listing.id } })} />)}
    </View>

    <Pressable onPress={() => router.push('/(tabs)/profile')} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 17, borderRadius: 18, backgroundColor: colors.greenSoft }}>
      <View style={{ width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.paper }}><Ionicons name="add-circle-outline" size={23} color={colors.green} /></View>
      <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.ink, fontSize: 14, fontWeight: '800' }}>{t('Have a place to rent or sell?')}</Text><Text style={[styles.muted, { fontSize: 11 }]}>{t('Manage listings from your owner account.')}</Text></View>
      <Ionicons name="arrow-forward" size={17} color={colors.green} />
    </Pressable>
  </ScrollView>;
}
