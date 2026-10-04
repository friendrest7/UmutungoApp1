import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/auth/AuthContext';

export type Language = 'en' | 'fr' | 'rw' | 'sw';
export const languageOptions: Array<{ code: Language; label: string }> = [
  { code: 'en', label: 'English' }, { code: 'fr', label: 'Français' }, { code: 'rw', label: 'Kinyarwanda' }, { code: 'sw', label: 'Kiswahili' },
];

const translations: Record<Language, Record<string, string>> = {
  en: { Home: 'Home', Search: 'Search', Saved: 'Saved', Profile: 'Profile', 'Find your next home': 'Find your next home', 'Search properties': 'Search properties', 'No listings found': 'No listings found', Retry: 'Retry', 'Sign in': 'Sign in', 'Sign out': 'Sign out', 'Contact owner': 'Contact owner', 'Create listing': 'Create listing', 'Your profile': 'Your profile', 'Create account': 'Create account', Language: 'Language', Theme: 'Theme', System: 'System', Light: 'Light', Dark: 'Dark', Save: 'Save', Cancel: 'Cancel', 'Edit profile': 'Edit profile', 'Profile updated.': 'Profile updated.', 'Search properties by location or title': 'Search properties by location or title', Rent: 'Rent', Buy: 'Buy', 'Latest listings': 'Latest listings', 'Nothing saved yet': 'Nothing saved yet', 'Tap the heart on a property to keep it here.': 'Tap the heart on a property to keep it here.' },
  fr: { Home: 'Accueil', Search: 'Rechercher', Saved: 'Enregistrés', Profile: 'Profil', 'Find your next home': 'Trouvez votre prochain logement', 'Search properties': 'Rechercher des biens', 'No listings found': 'Aucun bien trouvé', Retry: 'Réessayer', 'Sign in': 'Se connecter', 'Sign out': 'Se déconnecter', 'Contact owner': 'Contacter le propriétaire', 'Create listing': 'Créer une annonce', 'Your profile': 'Votre profil', 'Create account': 'Créer un compte', Language: 'Langue', Theme: 'Thème', System: 'Système', Light: 'Clair', Dark: 'Sombre', Save: 'Enregistrer', Cancel: 'Annuler', 'Edit profile': 'Modifier le profil', 'Profile updated.': 'Profil mis à jour.', 'Search properties by location or title': 'Rechercher par lieu ou titre', Rent: 'Louer', Buy: 'Acheter', 'Latest listings': 'Dernières annonces', 'Nothing saved yet': 'Aucun favori', 'Tap the heart on a property to keep it here.': 'Touchez le cœur d’un bien pour le conserver ici.' },
  rw: { Home: 'Ahabanza', Search: 'Shaka', Saved: 'Byabitswe', Profile: 'Umwirondoro', 'Find your next home': 'Shaka urugo rwawe rutaha', 'Search properties': 'Shaka imitungo', 'No listings found': 'Nta mutungo wabonetse', Retry: 'Ongera ugerageze', 'Sign in': 'Injira', 'Sign out': 'Sohoka', 'Contact owner': 'Vugana na nyirumutungo', 'Create listing': 'Kora itangazo', 'Your profile': 'Umwirondoro wawe', 'Create account': 'Fungura konti', Language: 'Ururimi', Theme: 'Imigaragarire', System: 'Sisitemu', Light: 'Urumuri', Dark: 'Umwijima', Save: 'Bika', Cancel: 'Hagarika', 'Edit profile': 'Hindura umwirondoro', 'Profile updated.': 'Umwirondoro wavuguruwe.', 'Search properties by location or title': 'Shaka umutungo ukoresheje ahantu cyangwa izina', Rent: 'Gukodesha', Buy: 'Kugura', 'Latest listings': 'Imitungo mishya', 'Nothing saved yet': 'Nta kintu wabika', 'Tap the heart on a property to keep it here.': 'Kanda umutima ubike umutungo hano.' },
  sw: { Home: 'Nyumbani', Search: 'Tafuta', Saved: 'Zilizohifadhiwa', Profile: 'Wasifu', 'Find your next home': 'Pata nyumba yako ijayo', 'Search properties': 'Tafuta mali', 'No listings found': 'Hakuna mali iliyopatikana', Retry: 'Jaribu tena', 'Sign in': 'Ingia', 'Sign out': 'Toka', 'Contact owner': 'Wasiliana na mwenye mali', 'Create listing': 'Unda tangazo', 'Your profile': 'Wasifu wako', 'Create account': 'Fungua akaunti', Language: 'Lugha', Theme: 'Mandhari', System: 'Mfumo', Light: 'Mwanga', Dark: 'Giza', Save: 'Hifadhi', Cancel: 'Ghairi', 'Edit profile': 'Hariri wasifu', 'Profile updated.': 'Wasifu umesasishwa.', 'Search properties by location or title': 'Tafuta kwa eneo au jina', Rent: 'Kodisha', Buy: 'Nunua', 'Latest listings': 'Mali za hivi karibuni', 'Nothing saved yet': 'Hakuna kilichohifadhiwa', 'Tap the heart on a property to keep it here.': 'Gusa moyo ili kuhifadhi mali hapa.' },
};

export function normalizeLanguage(value?: string | null): Language { return value === 'fr' || value === 'rw' || value === 'sw' ? value : 'en'; }
export function t(language: Language, key: string) { return translations[language][key] ?? translations.en[key] ?? key; }

type I18nContextValue = { language: Language; setLanguage: (language: Language) => Promise<void>; t: (key: string) => string };
const I18nContext = createContext<I18nContextValue | null>(null);
const LANGUAGE_KEY = 'umutungo-language';

export function LocalizationProvider({ children }: PropsWithChildren) {
  const { profile } = useAuth();
  const [language, setLanguageState] = useState<Language>('en');
  useEffect(() => { void SecureStore.getItemAsync(LANGUAGE_KEY).then((stored) => setLanguageState(normalizeLanguage(stored))); }, []);
  useEffect(() => { if (profile?.language) { const next = normalizeLanguage(profile.language); setLanguageState(next); void SecureStore.setItemAsync(LANGUAGE_KEY, next); } }, [profile?.language]);
  const setLanguage = async (next: Language) => { setLanguageState(next); await SecureStore.setItemAsync(LANGUAGE_KEY, next); };
  const value = useMemo(() => ({ language, setLanguage, t: (key: string) => t(language, key) }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside LocalizationProvider');
  return context;
}
