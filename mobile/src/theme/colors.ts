export type ColorPalette = { [Key in keyof typeof lightColors]: string };

export const brandColors = {
  primary: '#00C763', black: '#000000', white: '#FFFFFF',
  headingFont: 'Lexend', bodyFont: 'Lexend',
} as const;

export const lightColors = {
  green: brandColors.primary, greenDark: '#005b2d', greenSoft: '#e6f8ef', ink: '#111111',
  muted: '#58645c', line: '#dce7e1', paper: brandColors.white, canvas: '#f7faf8', amber: '#b87516', danger: '#b3261e',
};

export const darkColors: ColorPalette = {
  green: brandColors.primary, greenDark: '#5bd18b', greenSoft: '#143724', ink: '#f2faf6',
  muted: '#b1c3b7', line: '#385244', paper: '#17251d', canvas: '#0c1510', amber: '#f1bd62', danger: '#ff9189',
};

// Legacy inline styles read this object directly; ThemeProvider updates it before children render.
export const colors: ColorPalette = { ...lightColors };
