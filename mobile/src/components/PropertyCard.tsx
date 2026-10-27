import { useState } from 'react';
import { FlatList, Image, Linking, Modal, Pressable, Share, useWindowDimensions, View } from 'react-native';
import { useEffect } from 'react';
import * as Clipboard from 'expo-clipboard';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../auth/AuthContext';
import { listFavorites, removeFavorite, saveFavorite } from '../api/client';
import type { ApiListing } from '../api/types';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n';

const fallback = require('../../assets/placeholder-property.jpg');
const listingPhotoFallbacks: Record<string, number> = {
  '7080a20f-4c7a-40e2-9ac5-2885af91ae2d': require('../../assets/listing-fallbacks/nice-house.jpg'),
  '6c08d5f3-489b-4578-8811-eb0ac3a1aa8a': require('../../assets/listing-fallbacks/friend-rest-appliance.jpg'),
};
const favoriteSnapshotRequests = new Map<string, Promise<Set<string>>>();
function favoriteSnapshot(userId: string) {
  let snapshot = favoriteSnapshotRequests.get(userId);
  if (!snapshot) {
    snapshot = listFavorites().then((result) => new Set(result.items.map((item) => item.property_id))).catch(() => new Set<string>());
    favoriteSnapshotRequests.set(userId, snapshot);
  }
  return snapshot;
}
export function formatPrice(listing: ApiListing) { return (listing.currency || 'RWF') + ' ' + Number(listing.price || 0).toLocaleString(); }
export function listingLocation(listing: ApiListing) { return [listing.village, listing.cell, listing.sector, listing.district, listing.province].filter(Boolean).join(', '); }

export function PropertyCard({ listing, onPress, cardWidth }: { listing: ApiListing; onPress: () => void; cardWidth?: number }) {
  const { colors, styles } = useTheme();
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [activePhoto, setActivePhoto] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<'contact' | 'share' | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let active = true;
    if (user) void favoriteSnapshot(user.id).then((ids) => { if (active) setSaved(ids.has(listing.id)); });
    else setSaved(false);
    return () => { active = false; };
  }, [listing.id, user]);
  const photos = [...new Set([
    ...(listing.media ?? []).filter((item) => item.url && !item.type.toLowerCase().includes('video') && !item.type.toLowerCase().includes('tour')).map((item) => item.url),
    ...(listing.images ?? []).filter(Boolean),
  ])];
  const cardFallback = listingPhotoFallbacks[listing.id] ? listingPhotoFallbacks[listing.id] : fallback;
  const imageWidth = cardWidth || Math.min(screenWidth - 40, 720);
  const imageHeight = Math.min(250, Math.max(190, imageWidth * 0.58));
  const intent = /rent/i.test(listing.transaction_type || '') ? 'For rent' : /book/i.test(listing.transaction_type || '') ? 'For booking' : 'For sale';
  const verified = listing.owner?.verified === true;
  const phone = verified ? listing.owner.phone?.trim() : '';
  const roleLabel = listing.owner.role.toLowerCase().includes('komisiyoneri') ? t('Contact advertiser') : t('Contact owner');
  const residential = /house|home|apartment|residential|villa|room/i.test(listing.category);
  const land = /land|plot/i.test(listing.category);
  const vehicle = /vehicle|car|motorcycle|truck/i.test(listing.category);
  const area = Number(listing.measurements?.building_size ?? listing.measurements?.land_size ?? 0);
  const beds = Number(listing.measurements?.bedrooms ?? 0);
  const baths = Number(listing.measurements?.bathrooms ?? 0);
  const parking = Number(listing.measurements?.parking_spaces ?? listing.measurements?.parking ?? 0);
  const publicUrl = 'https://umutungo.rw/property/' + listing.id;
  const mapDestination = listing.latitude != null && listing.longitude != null
    ? `${listing.latitude},${listing.longitude}`
    : `${listingLocation(listing) || 'Rwanda'}, Rwanda`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=Current%20Location&destination=${encodeURIComponent(mapDestination)}&travelmode=driving`;

  const toggleSaved = async () => {
    if (!user) { router.push('/auth/sign-in'); return; }
    setSaving(true);
    try {
      if (saved) await removeFavorite(listing.id);
      else await saveFavorite({ property_id: listing.id, title: listing.title, type: listing.category, location: listingLocation(listing), price: formatPrice(listing), image: photos[0] || '' });
      setSaved(!saved);
      const snapshot = await favoriteSnapshot(user.id);
      if (saved) snapshot.delete(listing.id); else snapshot.add(listing.id);
    } catch { /* Keep the card responsive when the network is unavailable. */ }
    finally { setSaving(false); }
  };
  const shareListing = async () => {
    try { await Share.share({ title: listing.title, message: listing.title + '\n' + publicUrl, url: publicUrl }); }
    catch { setDialog('share'); }
  };
  const copyLink = async () => { await Clipboard.setStringAsync(publicUrl); setCopied(true); };
  const openExternal = async (url: string) => { try { await Linking.openURL(url); } catch { setDialog('share'); } };

  return <View style={[styles.card, { width: cardWidth || '100%', padding: 0, overflow: 'hidden', borderRadius: 18 }]}>
    <View style={{ position: 'relative' }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('View photos for') + ' ' + listing.title} onPress={onPress}>
        <FlatList horizontal pagingEnabled showsHorizontalScrollIndicator={false} nestedScrollEnabled style={{ height: imageHeight }} data={photos.length ? photos : ['']} keyExtractor={(photo, index) => (photo || 'fallback') + '-' + index} initialNumToRender={1} maxToRenderPerBatch={2} windowSize={2} getItemLayout={(_, index) => ({ length: imageWidth, offset: imageWidth * index, index })} onMomentumScrollEnd={(event) => setActivePhoto(Math.round(event.nativeEvent.contentOffset.x / imageWidth))} renderItem={({ item: photo }) => <Image source={photo && !failedImages[photo] ? { uri: photo } : cardFallback} style={{ width: imageWidth, height: imageHeight }} resizeMode="cover" onError={() => { if (photo) setFailedImages((current) => ({ ...current, [photo]: true })); }} />} />
      </Pressable>
      <View pointerEvents="none" style={{ position: 'absolute', top: 12, left: 12, right: 60, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ borderRadius: 18, backgroundColor: '#ffffff', paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ color: '#000000', fontSize: 10, fontWeight: '600' }}>{listing.category}</Text></View>
      </View>
      {verified && <View pointerEvents="none" style={{ position: 'absolute', bottom: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 18, backgroundColor: colors.green, paddingHorizontal: 9, paddingVertical: 6 }}><Ionicons name="checkmark-circle" size={13} color="#000000" /><Text style={{ color: '#000000', fontSize: 10, fontWeight: '700' }}>{t('Verified')}</Text></View>}
      <Pressable accessibilityRole="button" accessibilityLabel={saved ? t('Remove from saved') : t('Save property')} accessibilityState={{ checked: saved, disabled: saving }} disabled={saving} onPress={() => void toggleSaved()} style={{ position: 'absolute', top: 10, right: 10, width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#ffffff' }}><Ionicons name={saved ? 'heart' : 'heart-outline'} size={21} color={saved ? '#c62828' : '#000000'} /></Pressable>
    </View>
    <View style={{ padding: 14, gap: 9 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}><Text style={[styles.heading, { flex: 1, fontFamily: 'ArchivoBlack', fontSize: 17, lineHeight: 23 }]}>{listing.title}</Text><View style={{ borderRadius: 7, backgroundColor: colors.greenSoft, paddingHorizontal: 8, paddingVertical: 5 }}><Text style={{ color: colors.greenDark, fontSize: 10, fontWeight: '600' }}>{intent}</Text></View></View>
      <Pressable accessibilityRole="link" accessibilityLabel={`${t('Directions from your current location to')} ${listingLocation(listing) || 'Rwanda'}. ${t('Google Maps will show the route and estimated travel time.')}`} onPress={() => void openExternal(directionsUrl)} style={{ minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="location-outline" size={16} color={colors.ink} /><View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontFamily: 'Lexend', fontSize: 13 }}>{listingLocation(listing) || 'Rwanda'}</Text><Text style={{ color: colors.greenDark, fontFamily: 'LexendMedium', fontSize: 10 }}>{t('View route and travel time')}</Text></View><Ionicons name="navigate-outline" size={15} color={colors.greenDark} /></Pressable>
      {(residential && (beds > 0 || baths > 0) || parking > 0 || area > 0 && !vehicle) && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 2 }}>{residential && beds > 0 && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="bed-outline" size={15} color={colors.muted} /><Text style={styles.muted}>{beds} beds</Text></View>}{residential && baths > 0 && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="water-outline" size={15} color={colors.muted} /><Text style={styles.muted}>{baths} baths</Text></View>}{parking > 0 && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="car-outline" size={15} color={colors.muted} /><Text style={styles.muted}>{parking} parking</Text></View>}{area > 0 && !vehicle && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="resize-outline" size={15} color={colors.muted} /><Text style={styles.muted}>{area.toLocaleString()} m² {land ? 'land' : 'area'}</Text></View>}</View>}
      <Text style={{ color: colors.ink, fontFamily: 'LexendSemiBold', fontSize: 19 }}>{formatPrice(listing)}{intent === 'For rent' ? <Text style={{ color: colors.muted, fontSize: 12 }}> / month</Text> : intent === 'For booking' ? <Text style={{ color: colors.muted, fontSize: 12 }}> / night</Text> : null}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 7, borderTopWidth: 1, borderTopColor: colors.line }}>
        <Pressable accessibilityRole="link" onPress={onPress} style={{ minHeight: 42, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.green, paddingHorizontal: 8 }}><Text style={{ color: '#000000', textAlign: 'center', fontFamily: 'LexendSemiBold', fontSize: 12 }}>View details</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setDialog('contact')} style={{ minHeight: 42, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: '#ffffff', paddingHorizontal: 7 }}><Text style={{ color: '#111111', textAlign: 'center', fontSize: 11, fontWeight: '600' }}>{roleLabel}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Share')} onPress={() => void shareListing()} style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 10 }}><Ionicons name="share-social-outline" size={18} color={colors.ink} /></Pressable>
      </View>
    </View>
    <Modal visible={dialog !== null} transparent animationType="fade" onRequestClose={() => setDialog(null)}><Pressable onPress={() => setDialog(null)} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)' }}><Pressable onPress={(event) => event.stopPropagation()} style={{ padding: 20, gap: 12, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: colors.paper }}>
      <Text style={styles.heading}>{dialog === 'contact' ? roleLabel : 'Share this listing'}</Text>
      {dialog === 'contact' ? <>{phone ? <><Pressable style={styles.secondaryButton} onPress={() => void openExternal('tel:' + phone)}><Text style={styles.secondaryText}>Call {phone}</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => void openExternal('https://wa.me/' + phone.replace(/\D/g, '') + '?text=' + encodeURIComponent(listing.title + ' ' + publicUrl))}><Text style={styles.secondaryText}>WhatsApp</Text></Pressable></> : <Text style={styles.muted}>Phone and WhatsApp details are not publicly available for this advertiser.</Text>}<Pressable style={styles.button} onPress={() => { setDialog(null); router.push({ pathname: '/messages', params: { listing_id: listing.id, recipient_id: listing.owner.id, title: listing.owner.business_name || listing.owner.name } }); }}><Text style={styles.buttonText}>Message on Umutungo</Text></Pressable></> : <><Pressable style={styles.secondaryButton} onPress={() => void openExternal('https://wa.me/?text=' + encodeURIComponent(listing.title + ' ' + publicUrl))}><Text style={styles.secondaryText}>Share on WhatsApp</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => void openExternal('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(publicUrl))}><Text style={styles.secondaryText}>Share on Facebook</Text></Pressable><Pressable style={styles.button} onPress={() => void copyLink()}><Text style={styles.buttonText}>{copied ? 'Link copied' : 'Copy link'}</Text></Pressable><Text style={styles.muted}>For Instagram, TikTok, or Status, copy the link and paste it into your post.</Text></>}
      <Pressable accessibilityRole="button" onPress={() => setDialog(null)} style={{ minHeight: 42, justifyContent: 'center', alignItems: 'center' }}><Text style={styles.secondaryText}>Close</Text></Pressable>
    </Pressable></Pressable></Modal>
  </View>;
}
