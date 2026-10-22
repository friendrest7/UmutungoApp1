import { useState } from 'react';
import { Image, KeyboardAvoidingView, Pressable, ScrollView, TextInput, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { useTheme } from '@/theme/ThemeContext';
import { useRouter } from 'expo-router';
import { useI18n } from '@/i18n';

type ChatListing = { id: string; title: string; price: number; currency?: string; province?: string; district?: string; sector?: string; images?: string[]; media?: { url: string; type?: string }[] };
type ChatMessage = { role: 'user' | 'assistant'; content: string; listings?: ChatListing[] };
const CHAT_URL = process.env.EXPO_PUBLIC_CHAT_API_URL || 'https://umutungo.rw/api/chat';

export default function ChatScreen() {
  const { colors, styles } = useTheme();
  const { language } = useI18n();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: 'Hi, I can help you explore homes, land, and other listings in Rwanda. What are you looking for?' }]);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = async () => {
    const content = value.trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next); setValue(''); setBusy(true); setError('');
    if (/\b(image|images|photo|photos|picture|pictures|photograph)\b/i.test(content)) {
      const previousListings = [...messages].reverse().find((message) => message.role === 'assistant' && message.listings?.length)?.listings ?? [];
      const listingsWithPhotos = previousListings.filter((listing) => (listing.images?.length ?? 0) > 0 || (listing.media ?? []).some((media) => !media.type?.toLowerCase().includes('video')));
      if (listingsWithPhotos.length) {
        setMessages([...next, { role: 'assistant', content: 'Here are the photos from those property listings:', listings: listingsWithPhotos }]);
        setBusy(false);
        return;
      }
    }
    try {
      const languageName = { en: 'English', fr: 'French', rw: 'Kinyarwanda', sw: 'Swahili' }[language];
      const response = await fetch(CHAT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ language: languageName, messages: next.slice(-12).map(({ role, content: message }) => ({ role, content: message })) }) });
      const body = await response.json() as { message?: string; error?: string; listings?: ChatListing[] };
      if (!response.ok || !body.message) throw new Error(body.error || `Assistant unavailable (${response.status}).`);
      setMessages((current) => [...current, { role: 'assistant', content: body.message!, listings: body.listings?.length ? body.listings : undefined }]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The assistant could not be reached. Check the chat API URL and connection.'); }
    finally { setBusy(false); }
  };
  return <KeyboardAvoidingView style={styles.screen} behavior="padding" keyboardVerticalOffset={0}>
    <View style={{ padding: 18, paddingBottom: 10 }}><Text style={styles.brand}>UMUTUNGO ASSISTANT</Text><Text style={styles.title}>Tell me what you need</Text><Text style={styles.muted}>The assistant uses live listing and professional directory results where available.</Text></View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, gap: 10 }} keyboardShouldPersistTaps="handled">
      {messages.map((message, index) => <View key={`${index}-${message.role}`} style={[styles.card, { alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%', backgroundColor: message.role === 'user' ? colors.greenSoft : colors.paper }]}><Text style={styles.body}>{message.content}</Text>{message.listings?.map((listing) => {
        const photo = listing.images?.[0] ?? listing.media?.find((media) => !media.type?.toLowerCase().includes('video'))?.url;
        const location = [listing.sector, listing.district, listing.province].filter(Boolean).join(' · ');
        return <Pressable key={listing.id} onPress={() => router.push({ pathname: '/property/[id]', params: { id: listing.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 9, padding: 8, borderRadius: 12, backgroundColor: colors.canvas }}>
          <Image source={photo ? { uri: photo } : require('../assets/placeholder-property.jpg')} style={{ width: 74, height: 68, borderRadius: 9, backgroundColor: colors.greenSoft }} resizeMode="cover" />
          <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.ink, fontSize: 12, fontWeight: '800' }} numberOfLines={2}>{listing.title}</Text><Text style={styles.muted} numberOfLines={1}>{location || 'Rwanda'}</Text><Text style={{ color: colors.greenDark, fontWeight: '800', fontSize: 11 }}>{listing.currency ?? 'RWF'} {Number(listing.price).toLocaleString()}</Text></View>
        </Pressable>;
      })}</View>)}
      {busy && <Text style={styles.muted}>Finding an answer…</Text>}{error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
    <View style={{ flexDirection: 'row', gap: 8, padding: 14, paddingBottom: 20, borderTopWidth: 1, borderTopColor: colors.line }}><TextInput style={[styles.input, { flex: 1, minHeight: 48 }]} value={value} onChangeText={setValue} placeholder="Ask about a place to rent or buy…" placeholderTextColor={colors.muted} multiline maxLength={1200} onSubmitEditing={() => void send()} /><Pressable style={[styles.button, { justifyContent: 'center', paddingHorizontal: 18 }]} disabled={busy || !value.trim()} onPress={() => void send()}><Text style={styles.buttonText}>{busy ? '…' : 'Send'}</Text></Pressable></View>
  </KeyboardAvoidingView>;
}
