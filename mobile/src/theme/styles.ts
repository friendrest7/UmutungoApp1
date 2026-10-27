import { StyleSheet } from 'react-native';
import type { ColorPalette } from './colors';
import { brandColors } from './colors';

export function createStyles(colors: ColorPalette) {
return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, gap: 16 },
  safeContent: { width: '100%', maxWidth: 760, alignSelf: 'center', flexGrow: 1, padding: 20, gap: 16 },
  brand: { color: colors.green, fontFamily: brandColors.bodyFont, fontSize: 15, fontWeight: '700', letterSpacing: 1.4 },
  title: { color: colors.ink, fontFamily: brandColors.headingFont, fontSize: 30, fontWeight: '400', letterSpacing: -0.4 },
  heading: { color: colors.ink, fontFamily: brandColors.bodyFont, fontSize: 21, fontWeight: '600' },
  body: { color: colors.muted, fontFamily: brandColors.bodyFont, fontSize: 14, lineHeight: 21 },
  label: { color: colors.greenDark, fontFamily: brandColors.bodyFont, fontSize: 12, fontWeight: '600' },
  input: { minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper, color: colors.ink, fontFamily: brandColors.bodyFont, fontSize: 15 },
  button: { minHeight: 50, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.green },
  buttonText: { color: brandColors.black, fontFamily: brandColors.bodyFont, fontSize: 14, fontWeight: '600' },
  secondaryButton: { minHeight: 46, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.green, borderRadius: 14, backgroundColor: colors.paper },
  secondaryText: { color: colors.greenDark, fontFamily: brandColors.bodyFont, fontSize: 14, fontWeight: '600' },
  card: { padding: 16, borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: colors.paper },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterButton: { flexGrow: 1, flexBasis: 120 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 17 },
});
}
