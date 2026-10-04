import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export function LoadingState({ label = 'Loading...' }: { label?: string }) { const { colors, styles } = useTheme(); return <View style={{ alignItems: 'center', gap: 10, padding: 32 }}><ActivityIndicator color={colors.green} /><Text style={styles.muted}>{label}</Text></View>; }
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) { const { styles } = useTheme(); return <View style={{ alignItems: 'center', gap: 12, padding: 28 }}><Text style={[styles.error, { textAlign: 'center' }]}>{message}</Text>{onRetry && <Pressable style={styles.secondaryButton} onPress={onRetry}><Text style={styles.secondaryText}>Retry</Text></Pressable>}</View>; }
export function EmptyState({ title, message }: { title: string; message: string }) { const { styles } = useTheme(); return <View style={[styles.card, { alignItems: 'center', gap: 8 }]}><Text style={styles.heading}>{title}</Text><Text style={[styles.body, { textAlign: 'center' }]}>{message}</Text></View>; }
