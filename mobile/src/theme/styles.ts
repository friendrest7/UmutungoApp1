import { StyleSheet } from 'react-native';
import { colors } from './colors';

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 20, gap: 16 },
  safeContent: { flexGrow: 1, padding: 20, gap: 16 },
  brand: { color: colors.green, fontSize: 15, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  heading: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  body: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  label: { color: colors.greenDark, fontSize: 12, fontWeight: '800' },
  input: { minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper, color: colors.ink, fontSize: 15 },
  button: { minHeight: 50, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.green },
  buttonText: { color: colors.paper, fontSize: 14, fontWeight: '800' },
  secondaryButton: { minHeight: 46, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.green, borderRadius: 14, backgroundColor: colors.paper },
  secondaryText: { color: colors.greenDark, fontSize: 14, fontWeight: '800' },
  card: { padding: 16, borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: colors.paper },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 17 },
});
