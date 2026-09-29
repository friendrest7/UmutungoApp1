import type { Metadata } from 'next';
import './globals.css';
import { CookieConsent } from '../components/CookieConsent';
import { LanguageProvider } from '../lib/language';
import { ThemeProvider } from '../lib/theme';

export const metadata: Metadata = {
  title: 'Umutungo — Find where you belong',
  description: 'A trusted, comfortable way to discover property and assets in Rwanda.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><ThemeProvider><LanguageProvider>{children}</LanguageProvider></ThemeProvider><CookieConsent /></body>
    </html>
  );
}
