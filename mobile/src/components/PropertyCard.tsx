import { Image, Pressable, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { styles } from '../theme/styles';
import type { ApiListing } from '../api/types';

const fallback = require('../../assets/placeholder-property.jpg');
export function formatPrice(listing: ApiListing) { return `${listing.currency || 'RWF'} ${Number(listing.price || 0).toLocaleString()}`; }
export function listingLocation(listing: ApiListing) { return [listing.sector, listing.district, listing.province].filter(Boolean).join(' · '); }
export function PropertyCard({ listing, onPress }: { listing: ApiListing; onPress: () => void }) {
  const image = listing.media?.find((item) => item.type === 'photo')?.url;
  return <Pressable style={({ pressed }) => [styles.card, { padding: 0, overflow: 'hidden', opacity: pressed ? 0.86 : 1 }]} onPress={onPress}><Image source={image ? { uri: image } : fallback} style={{ width: '100%', height: 170 }} /><View style={{ padding: 14, gap: 7 }}><Text style={[styles.muted, { color: colors.greenDark, fontWeight: '800', textTransform: 'uppercase' }]}>{listing.category} · {listing.transaction_type}</Text><Text style={styles.heading} numberOfLines={2}>{listing.title}</Text><Text style={styles.body}>{listingLocation(listing)}</Text><Text style={{ color: colors.greenDark, fontSize: 16, fontWeight: '900' }}>{formatPrice(listing)}</Text></View></Pressable>;
}
