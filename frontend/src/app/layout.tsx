import type { Metadata } from 'next';
import './globals.css';
import { CookieConsent } from '../components/CookieConsent';

export const metadata: Metadata = {
  title: 'Umutungo — Find where you belong',
  description: 'A trusted, comfortable way to discover property and assets in Rwanda.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<CookieConsent /></body>
    </html>
  );
}
