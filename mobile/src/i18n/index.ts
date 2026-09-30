export type Language = 'English' | 'French' | 'Kinyarwanda' | 'Swahili';

const translations: Record<Language, Record<string, string>> = {
  English: { Home: 'Home', Search: 'Search', Saved: 'Saved', Profile: 'Profile', 'Find your next home': 'Find your next home', 'Search properties': 'Search properties', 'No listings found': 'No listings found', Retry: 'Retry', 'Sign in': 'Sign in', 'Sign out': 'Sign out', 'Contact owner': 'Contact owner', 'Create listing': 'Create listing' },
  French: { Home: 'Accueil', Search: 'Rechercher', Saved: 'Enregistrés', Profile: 'Profil', 'Find your next home': 'Trouvez votre prochain logement', 'Search properties': 'Rechercher des biens', 'No listings found': 'Aucun bien trouvé', Retry: 'Réessayer', 'Sign in': 'Se connecter', 'Sign out': 'Se déconnecter', 'Contact owner': 'Contacter le propriétaire', 'Create listing': 'Créer une annonce' },
  Kinyarwanda: { Home: 'Ahabanza', Search: 'Shaka', Saved: 'Byabitswe', Profile: 'Umwirondoro', 'Find your next home': 'Shaka urugo rwawe rutaha', 'Search properties': 'Shaka imitungo', 'No listings found': 'Nta mutungo wabonetse', Retry: 'Ongera ugerageze', 'Sign in': 'Injira', 'Sign out': 'Sohoka', 'Contact owner': 'Vugana na nyirumutungo', 'Create listing': 'Kora itangazo' },
  Swahili: { Home: 'Nyumbani', Search: 'Tafuta', Saved: 'Zilizohifadhiwa', Profile: 'Wasifu', 'Find your next home': 'Pata nyumba yako ijayo', 'Search properties': 'Tafuta mali', 'No listings found': 'Hakuna mali iliyopatikana', Retry: 'Jaribu tena', 'Sign in': 'Ingia', 'Sign out': 'Toka', 'Contact owner': 'Wasiliana na mwenye mali', 'Create listing': 'Unda tangazo' },
};

export function t(language: Language, key: string) { return translations[language][key] ?? translations.English[key] ?? key; }
