import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
const CHAT_URL = process.env.EXPO_PUBLIC_CHAT_API_URL || 'https://umutungo.rw/api/chat';

export default function ChatScreen() {
  const { colors, styles } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: 'Hi, I can help you explore homes, land, and other listings in Rwanda. What are you looking for?' }]);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = async () => {
    const content = value.trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next); setValue(''); setBusy(true); setError('');
    try {
      const response = await fetch(CHAT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ messages: next.slice(-12) }) });
      const body = await response.json() as { message?: string; error?: string };
      if (!response.ok || !body.message) throw new Error(body.error || `Assistant unavailable (${response.status}).`);
      setMessages((current) => [...current, { role: 'assistant', content: body.message! }]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The assistant could not be reached. Check the chat API URL and connection.'); }
    finally { setBusy(false); }
  };
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={{ padding: 18, paddingBottom: 10 }}><Text style={styles.brand}>UMUTUNGO ASSISTANT</Text><Text style={styles.title}>Tell me what you need</Text><Text style={styles.muted}>The assistant uses live listing and professional directory results where available.</Text></View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, gap: 10 }} keyboardShouldPersistTaps="handled">
      {messages.map((message, index) => <View key={`${index}-${message.role}`} style={[styles.card, { alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', backgroundColor: message.role === 'user' ? colors.greenSoft : colors.paper }]}><Text style={styles.body}>{message.content}</Text></View>)}
      {busy && <Text style={styles.muted}>Finding an answer…</Text>}{error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
    <View style={{ flexDirection: 'row', gap: 8, padding: 14, paddingBottom: 20, borderTopWidth: 1, borderTopColor: colors.line }}><TextInput style={[styles.input, { flex: 1, minHeight: 48 }]} value={value} onChangeText={setValue} placeholder="Ask about a place to rent or buy…" placeholderTextColor={colors.muted} multiline maxLength={1200} onSubmitEditing={() => void send()} /><Pressable style={[styles.button, { justifyContent: 'center', paddingHorizontal: 18 }]} disabled={busy || !value.trim()} onPress={() => void send()}><Text style={styles.buttonText}>{busy ? '…' : 'Send'}</Text></Pressable></View>
  </KeyboardAvoidingView>;
}
