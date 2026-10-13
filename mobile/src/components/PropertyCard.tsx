import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import type { ApiListing } from '../api/types';

const fallback = require('../../assets/placeholder-property.jpg');
export function formatPrice(listing: ApiListing) { return `${listing.currency || 'RWF'} ${Number(listing.price || 0).toLocaleString()}`; }
export function listingLocation(listing: ApiListing) { return [listing.sector, listing.district, listing.province].filter(Boolean).join(' · '); }
export function PropertyCard({ listing, onPress }: { listing: ApiListing; onPress: () => void }) {
  const { colors, styles } = useTheme();
  const image = listing.media?.find((item) => item.type === 'photo')?.url;
  const intent = /rent/i.test(listing.transaction_type || '') ? 'For rent' : /book/i.test(listing.transaction_type || '') ? 'For booking' : 'For sale';
  return <Pressable style={({ pressed }) => [styles.card, { padding: 0, overflow: 'hidden', opacity: pressed ? 0.9 : 1, borderRadius: 20 }]} onPress={onPress}>
    <View style={{ position: 'relative' }}><Image source={image ? { uri: image } : fallback} style={{ width: '100%', height: 190 }} resizeMode="cover" />
      <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 }}><Text style={{ color: colors.greenDark, fontWeight: '800', fontSize: 12 }}>{intent}</Text></View>
    </View>
    <View style={{ padding: 16, gap: 8 }}>
      <Text style={[styles.muted, { color: colors.greenDark, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 }]}>{listing.category}</Text>
      <Text style={styles.heading} numberOfLines={2}>{listing.title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Ionicons name="location-outline" size={15} color={colors.muted} /><Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>{listingLocation(listing) || 'Rwanda'}</Text></View>
      <Text style={{ color: colors.greenDark, fontSize: 18, fontWeight: '900', marginTop: 2 }}>{formatPrice(listing)}</Text>
    </View>
  </Pressable>;
}
