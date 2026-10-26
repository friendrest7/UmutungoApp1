import { useState } from 'react';
import { FlatList, Image, Pressable, useWindowDimensions, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import type { ApiListing } from '../api/types';

const fallback = require('../../assets/placeholder-property.jpg');
const listingPhotoFallbacks: Record<string, number> = {
  '7080a20f-4c7a-40e2-9ac5-2885af91ae2d': require('../../assets/listing-fallbacks/nice-house.jpg'),
  '6c08d5f3-489b-4578-8811-eb0ac3a1aa8a': require('../../assets/listing-fallbacks/friend-rest-appliance.jpg'),
};
export function formatPrice(listing: ApiListing) { return `${listing.currency || 'RWF'} ${Number(listing.price || 0).toLocaleString()}`; }
export function listingLocation(listing: ApiListing) { return [listing.sector, listing.district, listing.province].filter(Boolean).join(' · '); }
export function PropertyCard({ listing, onPress, cardWidth }: { listing: ApiListing; onPress: () => void; cardWidth?: number }) {
  const { colors, styles, isDark } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [activePhoto, setActivePhoto] = useState(0);
  const photos = [...new Set([
    ...(listing.media ?? []).filter((item) => item.url && !item.type.toLowerCase().includes('video') && !item.type.toLowerCase().includes('tour')).map((item) => item.url),
    ...(listing.images ?? []).filter(Boolean),
  ])];
  const cardFallback = listingPhotoFallbacks[listing.id] ?? fallback;
  const imageWidth = cardWidth ?? Math.min(screenWidth - 40, 720);
  const intent = /rent/i.test(listing.transaction_type || '') ? 'For rent' : /book/i.test(listing.transaction_type || '') ? 'For booking' : 'For sale';
  return <Pressable accessibilityRole="button" accessibilityLabel={`${listing.title}, view property`} style={({ pressed }) => [styles.card, { width: cardWidth, padding: 0, overflow: 'hidden', opacity: pressed ? 0.9 : 1, borderRadius: 20 }]} onPress={onPress}>
    <View style={{ position: 'relative' }}><FlatList horizontal pagingEnabled showsHorizontalScrollIndicator={false} nestedScrollEnabled style={{ height: 200 }} data={photos.length ? photos : ['']} keyExtractor={(photo, index) => `${photo || 'fallback'}-${index}`} initialNumToRender={1} maxToRenderPerBatch={2} windowSize={2} getItemLayout={(_, index) => ({ length: imageWidth, offset: imageWidth * index, index })} onMomentumScrollEnd={(event) => setActivePhoto(Math.round(event.nativeEvent.contentOffset.x / imageWidth))} renderItem={({ item: photo }) => <Image source={photo && !failedImages[photo] ? { uri: photo } : cardFallback} style={{ width: imageWidth, height: 200 }} resizeMode="cover" onError={() => { if (photo) setFailedImages((current) => ({ ...current, [photo]: true })); }} />} />{photos.length > 1 && <View style={{ position: 'absolute', bottom: 10, alignSelf: 'center', flexDirection: 'row', gap: 5 }}>{photos.map((photo, index) => <View key={`${photo}-${index}`} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: index === activePhoto ? '#ffffff' : 'rgba(255, 255, 255,0.55)' }} />)}</View>}
      <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 }}><Text style={{ color: colors.greenDark, fontWeight: '800', fontSize: 10 }}>{intent}</Text></View>
    </View>
    <View style={{ padding: 11, gap: 3 }}>
      <Text style={[styles.muted, { color: colors.greenDark, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 }]}>{listing.category}</Text>
      <Text style={[styles.heading, { color: isDark ? colors.ink : colors.greenDark }]} numberOfLines={2}>{listing.title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Ionicons name="location-outline" size={15} color={colors.muted} /><Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>{listingLocation(listing) || 'Rwanda'}</Text></View>
      <Text style={{ color: colors.greenDark, fontSize: 16, fontWeight: '900', marginTop: 1, flexShrink: 0 }}>{formatPrice(listing)}</Text>
      <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, borderRadius: 9, backgroundColor: '#00a84f', paddingHorizontal: 12, paddingVertical: 8 }}><Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 12 }}>View property</Text><Ionicons name="arrow-forward" size={14} color="#ffffff" /></View>
    </View>
  </Pressable>;
}
