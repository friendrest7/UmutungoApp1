export type ColorPalette = typeof lightColors;

export const lightColors = {
  green: '#0b6b3a', greenDark: '#064c29', greenSoft: '#e8f5eb', ink: '#111111',
  muted: '#66756b', line: '#dce7df', paper: '#ffffff', canvas: '#f7faf7', amber: '#b87516', danger: '#b3261e',
};

export const darkColors: ColorPalette = {
  green: '#63d99a', greenDark: '#a9edc5', greenSoft: '#1d3a2b', ink: '#f2faf5',
  muted: '#b1c3b7', line: '#385244', paper: '#15231b', canvas: '#0c1510', amber: '#f1bd62', danger: '#ff9189',
};

// Legacy inline styles read this object directly; ThemeProvider updates it before children render.
export const colors: ColorPalette = { ...lightColors };
