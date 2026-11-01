import type { Metadata } from 'next';
import './globals.css';
import { CookieConsent } from '../components/CookieConsent';
import { LocaleDomTranslator } from '../components/LocaleDomTranslator';
import { LanguageProvider } from '../lib/language';
import { ThemeProvider } from '../lib/theme';
import localFont from 'next/font/local';

const lexend = localFont({ src: [
  { path: '../../public/fonts/Lexend-Thin.ttf', weight: '100' },
  { path: '../../public/fonts/Lexend-ExtraLight.ttf', weight: '200' },
  { path: '../../public/fonts/Lexend-Light.ttf', weight: '300' },
  { path: '../../public/fonts/Lexend-Regular.ttf', weight: '400' },
  { path: '../../public/fonts/Lexend-Medium.ttf', weight: '500' },
  { path: '../../public/fonts/Lexend-SemiBold.ttf', weight: '600' },
  { path: '../../public/fonts/Lexend-Bold.ttf', weight: '700' },
  { path: '../../public/fonts/Lexend-ExtraBold.ttf', weight: '800' },
  { path: '../../public/fonts/Lexend-Black.ttf', weight: '900' },
], variable: '--font-lexend', display: 'swap' });

export const metadata: Metadata = {
  title: 'Umutungo - Rwanda property marketplace',
  description: 'Discover, list, and manage every kind of property in Rwanda.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={lexend.variable}>
      <body><ThemeProvider><LanguageProvider><LocaleDomTranslator />{children}</LanguageProvider></ThemeProvider><CookieConsent /></body>
    </html>
  );
}
