import type { Metadata } from 'next';
import './globals.css';
import { CookieConsent } from '../components/CookieConsent';
import { LocaleDomTranslator } from '../components/LocaleDomTranslator';
import { LanguageProvider } from '../lib/language';
import { ThemeProvider } from '../lib/theme';
import localFont from 'next/font/local';

const lexend = localFont({ src: [
  { path: '../../public/fonts/Lexend-Regular.ttf', weight: '400' },
  { path: '../../public/fonts/Lexend-Medium.ttf', weight: '500' },
  { path: '../../public/fonts/Lexend-SemiBold.ttf', weight: '600' },
  { path: '../../public/fonts/Lexend-Bold.ttf', weight: '700' },
], variable: '--font-lexend', display: 'swap' });
const archivoBlack = localFont({ src: '../../public/fonts/Archivo-Black.ttf', variable: '--font-archivo-black', display: 'swap', weight: '400' });

export const metadata: Metadata = {
  title: 'Umutungo - Rwanda property marketplace',
  description: 'Discover, list, and manage every kind of property in Rwanda.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${lexend.variable} ${archivoBlack.variable}`}><ThemeProvider><LanguageProvider><LocaleDomTranslator />{children}</LanguageProvider></ThemeProvider><CookieConsent /></body>
    </html>
  );
}
