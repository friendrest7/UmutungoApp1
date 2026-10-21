import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { applyToListing, createBooking, createListingReview, getListing, getPayment, listFavorites, listListingReviews, removeFavorite, saveFavorite, sendMessage, startMomoPayment } from '@/api/client';
import type { ApiListing, ApiReview } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { useTheme } from '@/theme/ThemeContext';
import { formatPrice, listingLocation } from '@/components/PropertyCard';
import { useI18n } from '@/i18n';
import MomoQrScanner from '@/components/MomoQrScanner';

export default function PropertyDetailScreen() {
  const { colors, styles } = useTheme();
  const { t } = useI18n();
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
  const [applicationMessage, setApplicationMessage] = useState('');
  const [applicationNotice, setApplicationNotice] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('1');
  const [bookingNotice, setBookingNotice] = useState('');
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [rating, setRating] = useState(5);
  const [reviewBody, setReviewBody] = useState('');
  const [reviewNotice, setReviewNotice] = useState('');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentNotice, setPaymentNotice] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [showMomoScanner, setShowMomoScanner] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!id) return;
    setError('');
    try {
      const result = await getListing(id);
      setListing(result);
      try { setReviews((await listListingReviews(id)).items); } catch { setReviews([]); }
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

  useEffect(() => { void Promise.resolve().then(load); }, [id, user?.id]);

  const photos = useMemo(() => listing?.media?.filter((item) => item.type === 'photo' && item.url) ?? [], [listing]);
  const galleryWidth = Math.max(260, Math.min(width - 40, 520));

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

  const apply = async () => {
    if (!listing) return;
    if (!user) { router.push('/auth/sign-in'); return; }
    setBusy(true); setError(''); setApplicationNotice('');
    try { await applyToListing(listing.id, applicationMessage.trim()); setApplicationNotice('Your application was sent. You can track it in Applications.'); setApplicationMessage(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Application could not be sent.'); }
    finally { setBusy(false); }
  };

  const book = async () => {
    if (!listing) return;
    if (!user) { router.push('/auth/sign-in'); return; }
    const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    if (!validDate(checkIn) || !validDate(checkOut) || new Date(checkOut) <= new Date(checkIn) || !Number.isInteger(Number(guests)) || Number(guests) < 1) { setError('Enter valid dates (YYYY-MM-DD), with check-out after check-in, and at least one guest.'); return; }
    setBusy(true); setError(''); setBookingNotice('');
    try { await createBooking({ listing_id: listing.id, check_in: checkIn, check_out: checkOut, guests: Number(guests) }); setBookingNotice('Booking request sent to the owner.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Booking request could not be sent.'); }
    finally { setBusy(false); }
  };

  const payWithMomo = async () => {
    if (!listing) return;
    if (!user) { router.push('/auth/sign-in'); return; }
    if (!paymentPhone.trim()) { setPaymentError('Enter the MTN Rwanda phone number to charge.'); return; }
    setBusy(true); setPaymentError(''); setPaymentNotice('Starting MTN MoMo payment…');
    try {
      const started = await startMomoPayment({ related_type: 'listing', related_id: listing.id, transaction_type: listing.transaction_type === 'rent_out' ? 'rent' : 'buy', phone: paymentPhone.trim() });
      setPaymentNotice('Approve the payment request on your phone. Waiting for MTN…');
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const current = await getPayment(started.id);
        if (current.status === 'successful') { setPaymentNotice('Payment confirmed by MTN.'); return; }
        if (current.status === 'failed') { setPaymentError('MTN could not complete the payment. Please try again.'); setPaymentNotice(''); return; }
      }
      setPaymentNotice('Payment is still pending with MTN. You can return to this property and try again after checking your MoMo notification.');
    } catch (cause) {
      setPaymentError(cause instanceof Error ? cause.message : 'MTN payment could not be started.');
      setPaymentNotice('');
    } finally { setBusy(false); }
  };

  const review = async () => {
    if (!listing) return;
    if (!user) { router.push('/auth/sign-in'); return; }
    setBusy(true); setError(''); setReviewNotice('');
    try { await createListingReview({ listing_id: listing.id, rating, body: reviewBody.trim() }); setReviewBody(''); setReviewNotice('Your review was submitted.'); setReviews((await listListingReviews(listing.id)).items); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Review could not be submitted. You must have viewed or rented this property.'); }
    finally { setBusy(false); }
  };

  if (loading) return <View style={styles.screen}><LoadingState label={t('Loading property...')} /></View>;
  if (error || !listing) return <View style={styles.screen}><ErrorState message={error || t('Property not found.')} onRetry={() => { setLoading(true); void load(); }} /></View>;

  const isHouse = ['house', 'houses'].includes(listing.category.trim().toLowerCase().replace(/[_-]+/g, ' '));

  return <ScrollView style={styles.screen} contentContainerStyle={styles.safeContent}>
    <Pressable onPress={() => router.back()}><Text style={{ color: colors.green, fontWeight: '800' }}>‹ {t('Back to search')}</Text></Pressable>
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
      {photos.length ? photos.map((photo) => <Image key={photo.url} source={{ uri: photo.url }} style={{ width: galleryWidth, height: Math.min(300, galleryWidth * 0.68), borderRadius: 18 }} />) : <View style={{ width: galleryWidth, height: Math.min(300, galleryWidth * 0.68), borderRadius: 18, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={styles.muted}>{t('No property photos supplied')}</Text></View>}
    </ScrollView>
    <View style={{ gap: 7 }}>
      <Text style={styles.brand}>{listing.category} · {listing.transaction_type}</Text>
      <Text style={[styles.title, { fontSize: 15, lineHeight: 20 }]}>{listing.title}</Text>
      <Text style={styles.body}>{listingLocation(listing)}</Text>
      <Text style={{ color: colors.greenDark, fontSize: 21, fontWeight: '900' }}>{formatPrice(listing)}</Text>
      <Text style={styles.body}>{listing.description || t('No description supplied by the owner.')}</Text>
    </View>
    {isHouse && listing.media?.some((item) => item.type === 'tour_3d' && item.url) && <Pressable style={styles.secondaryButton} onPress={() => { const tour = listing.media?.find((item) => item.type === 'tour_3d' && item.url); if (tour?.url) void Linking.openURL(tour.url); }}><Text style={styles.secondaryText}>Open 3D property tour</Text></Pressable>}
    {(listing.transaction_type === 'sell' || listing.transaction_type === 'rent_out') && user?.id !== listing.owner.id && <View style={[styles.card, { gap: 10 }]}><Text style={styles.heading}>Pay with MTN MoMo</Text><Text style={styles.body}>Amount: {formatPrice(listing)}. The server uses the published listing price.</Text><View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><TextInput style={[styles.input, { flex: 1 }]} value={paymentPhone} onChangeText={setPaymentPhone} placeholder="MTN Rwanda number (e.g. 078...)" placeholderTextColor={colors.muted} keyboardType="phone-pad" autoComplete="tel" /><Pressable style={[styles.secondaryButton, { paddingHorizontal: 12 }]} onPress={() => setShowMomoScanner(true)}><Text style={styles.secondaryText}>Scan QR</Text></Pressable></View><Pressable style={styles.button} disabled={busy} onPress={() => void payWithMomo()}><Text style={styles.buttonText}>{busy ? 'Waiting for MTN…' : 'Request MoMo payment'}</Text></Pressable>{paymentNotice && <Text style={{ color: colors.greenDark, fontWeight: '700' }}>{paymentNotice}</Text>}{paymentError && <Text style={styles.error}>{paymentError}</Text>}</View>}
    <Pressable style={saved ? styles.secondaryButton : styles.button} disabled={busy} onPress={() => void toggleSaved()}><Text style={saved ? styles.secondaryText : styles.buttonText}>{saved ? t('Remove from saved') : t('Save property')}</Text></Pressable>
    <View style={[styles.card, { gap: 10 }]}><Text style={styles.heading}>{t('Contact owner')}: {listing.owner.name}</Text><Text style={styles.body}>{t('Send a message to the property owner.')}</Text><TextInput style={[styles.input, { minHeight: 100, textAlignVertical: 'top', paddingTop: 12 }]} value={message} onChangeText={setMessage} placeholder={t('Ask about availability, viewing times, or terms')} placeholderTextColor={colors.muted} multiline /><Pressable style={styles.button} disabled={busy || !message.trim()} onPress={() => void send()}><Text style={styles.buttonText}>{t('Send message')}</Text></Pressable>{messageNotice && <Text style={{ color: colors.greenDark, fontWeight: '700' }}>{messageNotice}</Text>}{messageError && <Text style={styles.error}>{messageError}</Text>}<Pressable onPress={() => router.push({ pathname: '/messages', params: { listing_id: listing.id, recipient_id: listing.owner.id, title: listing.owner.name } })}><Text style={{ color: colors.green, fontWeight: '800' }}>Open inbox</Text></Pressable></View>
    {listing.transaction_type === 'rent_out' && user?.id !== listing.owner.id && <View style={[styles.card, { gap: 10 }]}><Text style={styles.heading}>Apply to rent this property</Text><TextInput style={[styles.input, { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }]} value={applicationMessage} onChangeText={setApplicationMessage} placeholder="Introduce yourself and include any details for the owner" placeholderTextColor={colors.muted} multiline /><Pressable style={styles.button} disabled={busy} onPress={() => void apply()}><Text style={styles.buttonText}>{busy ? 'Sending…' : 'Submit application'}</Text></Pressable>{applicationNotice && <Text style={{ color: colors.greenDark, fontWeight: '700' }}>{applicationNotice}</Text>}</View>}
    {listing.transaction_type === 'book' && user?.id !== listing.owner.id && <View style={[styles.card, { gap: 10 }]}><Text style={styles.heading}>Request a booking</Text><Text style={styles.muted}>Use YYYY-MM-DD dates.</Text><TextInput style={styles.input} value={checkIn} onChangeText={setCheckIn} placeholder="Check-in · 2026-10-20" placeholderTextColor={colors.muted} /><TextInput style={styles.input} value={checkOut} onChangeText={setCheckOut} placeholder="Check-out · 2026-10-23" placeholderTextColor={colors.muted} /><TextInput style={styles.input} value={guests} onChangeText={setGuests} placeholder="Guests" placeholderTextColor={colors.muted} keyboardType="number-pad" /><Pressable style={styles.button} disabled={busy} onPress={() => void book()}><Text style={styles.buttonText}>{busy ? 'Sending…' : 'Request booking'}</Text></Pressable>{bookingNotice && <Text style={{ color: colors.greenDark, fontWeight: '700' }}>{bookingNotice}</Text>}</View>}
    <View style={[styles.card, { gap: 10 }]}><Text style={styles.heading}>Reviews</Text>{reviews.length === 0 ? <Text style={styles.muted}>No reviews yet.</Text> : reviews.map((item) => <View key={item.id} style={{ gap: 3 }}><Text style={styles.body}>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)} · {item.author_name}</Text>{item.body ? <Text style={styles.body}>{item.body}</Text> : null}</View>)}{user?.id !== listing.owner.id && <><Text style={styles.label}>Your rating</Text><View style={{ flexDirection: 'row', gap: 8 }}>{[1, 2, 3, 4, 5].map((value) => <Pressable key={value} onPress={() => setRating(value)}><Text style={{ color: value <= rating ? colors.green : colors.muted, fontSize: 24 }}>★</Text></Pressable>)}</View><TextInput style={[styles.input, { minHeight: 76, textAlignVertical: 'top', paddingTop: 12 }]} value={reviewBody} onChangeText={setReviewBody} placeholder="Share your experience after viewing this property" placeholderTextColor={colors.muted} multiline /><Pressable style={styles.secondaryButton} disabled={busy} onPress={() => void review()}><Text style={styles.secondaryText}>Submit review (viewers and tenants)</Text></Pressable>{reviewNotice && <Text style={{ color: colors.greenDark, fontWeight: '700' }}>{reviewNotice}</Text>}</>}</View>
    <MomoQrScanner visible={showMomoScanner} onClose={() => setShowMomoScanner(false)} onPhoneScanned={setPaymentPhone} />
  </ScrollView>;
}
