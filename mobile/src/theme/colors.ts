export type ColorPalette = typeof lightColors;

export const lightColors = {
  green: '#00a84f', greenDark: '#008c42', greenSoft: '#e8f6ed', ink: '#111111',
  muted: '#66756b', line: '#dce7e1', paper: '#ffffff', canvas: '#f7faf8', amber: '#b87516', danger: '#b3261e',
};

export const darkColors: ColorPalette = {
  green: '#00a84f', greenDark: '#5bd18b', greenSoft: '#143724', ink: '#f2faf6',
  muted: '#b1c3b7', line: '#385244', paper: '#15231b', canvas: '#0c1510', amber: '#f1bd62', danger: '#ff9189',
};

// Legacy inline styles read this object directly; ThemeProvider updates it before children render.
export const colors: ColorPalette = { ...lightColors };
