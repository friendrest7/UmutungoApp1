import { useEffect, useMemo, useState } from 'react';
import { Image, PanResponder, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getListing, listFavorites, removeFavorite, saveFavorite, sendMessage } from '@/api/client';
import type { ApiListing } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { useTheme } from '@/theme/ThemeContext';
import { formatPrice, listingLocation } from '@/components/PropertyCard';

type ViewerMode = 'tour' | 'plan' | null;

export default function PropertyDetailScreen() {
  const { colors, styles } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const [listing, setListing] = useState<ApiListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');
  const [messageNotice, setMessageNotice] = useState('');
  const [messageError, setMessageError] = useState('');
  const [busy, setBusy] = useState(false);
  const [viewerMode, setViewerMode] = useState<ViewerMode>(null);
  const [tourOffset, setTourOffset] = useState(0);

  const load = async () => {
    if (!id) return;
    setError('');
    try {
      const result = await getListing(id);
      setListing(result);
      if (user) {
        try {
          const favorites = await listFavorites();
          setSaved(favorites.items.some((item) => item.property_id === id));
        } catch { /* Saved state is unavailable when the account session cannot load favorites. */ }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Property could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [id, user?.id]);

  const photos = useMemo(() => listing?.media?.filter((item) => item.type === 'photo' && item.url) ?? [], [listing]);
  const galleryWidth = Math.max(260, Math.min(width - 40, 520));
  const tourResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_, gesture) => setTourOffset(Math.max(-90, Math.min(90, gesture.dx))),
    onPanResponderRelease: () => setTourOffset(0),
    onPanResponderTerminate: () => setTourOffset(0),
  }), []);

  const toggleSaved = async () => {
    if (!listing) return;
    if (!user) { router.push('/auth/sign-in'); return; }
    setBusy(true);
    try {
      if (saved) await removeFavorite(listing.id);
      else await saveFavorite({ property_id: listing.id, title: listing.title, type: listing.category, location: listingLocation(listing), price: formatPrice(listing), image: photos[0]?.url ?? '' });
      setSaved(!saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Saved property could not be updated.');
    } finally { setBusy(false); }
  };

  const send = async () => {
    if (!listing || !message.trim()) return;
    if (!user) { router.push('/auth/sign-in'); return; }
    setBusy(true); setMessageError(''); setMessageNotice('');
    try {
      await sendMessage({ listing_id: listing.id, recipient_id: listing.owner.id, body: message.trim() });
      setMessage(''); setMessageNotice('Message sent to the owner.');
    } catch (cause) {
      setMessageError(cause instanceof Error ? cause.message : 'Message could not be sent.');
    } finally { setBusy(false); }
  };

  if (loading) return <View style={styles.screen}><LoadingState label="Loading property..." /></View>;
  if (error || !listing) return <View style={styles.screen}><ErrorState message={error || 'Property not found.'} onRetry={() => { setLoading(true); void load(); }} /></View>;

  return <ScrollView style={styles.screen} contentContainerStyle={styles.safeContent}>
    <Pressable onPress={() => router.back()}><Text style={{ color: colors.green, fontWeight: '800' }}>‹ Back to search</Text></Pressable>
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
      {photos.length ? photos.map((photo) => <Image key={photo.url} source={{ uri: photo.url }} style={{ width: galleryWidth, height: Math.min(300, galleryWidth * 0.68), borderRadius: 18 }} />) : <View style={{ width: galleryWidth, height: Math.min(300, galleryWidth * 0.68), borderRadius: 18, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={styles.muted}>No property photos supplied</Text></View>}
    </ScrollView>
    <View style={{ gap: 7 }}>
      <Text style={styles.brand}>{listing.category} · {listing.transaction_type}</Text>
      <Text style={[styles.title, { fontSize: 15, lineHeight: 20 }]}>{listing.title}</Text>
      <Text style={styles.body}>{listingLocation(listing)}</Text>
      <Text style={{ color: colors.greenDark, fontSize: 21, fontWeight: '900' }}>{formatPrice(listing)}</Text>
      <Text style={styles.body}>{listing.description || 'No description supplied by the owner.'}</Text>
    </View>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Pressable style={[styles.secondaryButton, { flex: 1 }]} onPress={() => setViewerMode('tour')}><Text style={styles.secondaryText}>3D view</Text></Pressable>
      <Pressable style={[styles.secondaryButton, { flex: 1 }]} onPress={() => setViewerMode('plan')}><Text style={styles.secondaryText}>Floor plan</Text></Pressable>
    </View>
    {viewerMode === 'tour' && <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
      <View {...tourResponder.panHandlers} style={{ height: 250, overflow: 'hidden', backgroundColor: '#1b2c20' }}>
        {photos[0]?.url ? <Image source={{ uri: photos[0].url }} resizeMode="cover" style={{ width: '118%', height: '100%', transform: [{ translateX: tourOffset }] }} /> : <View style={{ flex: 1, backgroundColor: colors.greenSoft }} />}
        <View pointerEvents="none" style={{ position: 'absolute', right: 12, bottom: 12, left: 12 }}><Text style={{ color: colors.paper, fontSize: 12, fontWeight: '800', textShadowColor: '#000', textShadowRadius: 5 }}>Swipe with your finger to look around</Text></View>
      </View>
    </View>}
    {viewerMode === 'plan' && <View style={[styles.card, { gap: 10 }]}>
      <Text style={styles.heading}>Interactive floor plan</Text>
      <Text style={styles.muted}>Tap a room to preview it in the gallery.</Text>
      <View style={{ height: 210, borderWidth: 6, borderColor: '#536c58', backgroundColor: '#fffdf8' }}>
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: '34%', bottom: '46%', borderWidth: 2, borderColor: '#6c826d', backgroundColor: '#e7f0e5', alignItems: 'center', justifyContent: 'center' }} onPress={() => setViewerMode('tour')}><Text style={{ color: colors.ink, fontWeight: '800' }}>Living room</Text></Pressable>
        <Pressable style={{ position: 'absolute', top: 0, left: '66%', right: 0, bottom: '46%', borderWidth: 2, borderColor: '#6c826d', backgroundColor: '#e7f0e5', alignItems: 'center', justifyContent: 'center' }} onPress={() => setViewerMode('tour')}><Text style={{ color: colors.ink, fontWeight: '800' }}>Kitchen</Text></Pressable>
        <Pressable style={{ position: 'absolute', top: '54%', left: '43%', right: 0, bottom: 0, borderWidth: 2, borderColor: '#6c826d', backgroundColor: '#e7f0e5', alignItems: 'center', justifyContent: 'center' }} onPress={() => setViewerMode('tour')}><Text style={{ color: colors.ink, fontWeight: '800' }}>Bedroom</Text></Pressable>
      </View>
    </View>}
    <Pressable style={saved ? styles.secondaryButton : styles.button} disabled={busy} onPress={() => void toggleSaved()}><Text style={saved ? styles.secondaryText : styles.buttonText}>{saved ? 'Remove from saved' : 'Save property'}</Text></Pressable>
    <View style={[styles.card, { gap: 10 }]}><Text style={styles.heading}>Contact {listing.owner.name}</Text><Text style={styles.body}>Send a message through the existing Umutungo conversation API.</Text><TextInput style={[styles.input, { minHeight: 100, textAlignVertical: 'top', paddingTop: 12 }]} value={message} onChangeText={setMessage} placeholder="Ask about availability, viewing times, or terms" placeholderTextColor={colors.muted} multiline /><Pressable style={styles.button} disabled={busy || !message.trim()} onPress={() => void send()}><Text style={styles.buttonText}>Send message</Text></Pressable>{messageNotice && <Text style={{ color: colors.greenDark, fontWeight: '700' }}>{messageNotice}</Text>}{messageError && <Text style={styles.error}>{messageError}</Text>}</View>
    <EmptyState title="Need to apply?" message="Rental applications are supported by the API, but this mobile release keeps the first flow focused on browsing, saving, and contacting the owner." />
  </ScrollView>;
}
