'use client';

import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Language } from '../data/translations';

export const supportedLanguages: Language[] = ['English', 'French', 'Kinyarwanda', 'Swahili'];
const LANGUAGE_STORAGE_KEY = 'umutungo-language';
const LANGUAGE_CHANGED_EVENT = 'umutungo:language-changed';
type LanguageContextValue = { language: Language; changeLanguage: (language: Language) => void };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'English';
  try {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
    return storedLanguage && supportedLanguages.includes(storedLanguage) ? storedLanguage : 'English';
  } catch {
    return 'English';
  }
}

function applyLanguageToDocument(language: Language) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = ({ English: 'en', French: 'fr', Kinyarwanda: 'rw', Swahili: 'sw' } as Record<Language, string>)[language];
  }
}

function useLanguageState(): LanguageContextValue {
  const [language, setLanguage] = useState<Language>('English');

  useEffect(() => {
    const syncLanguage = () => {
      const nextLanguage = readStoredLanguage();
      setLanguage(nextLanguage);
      applyLanguageToDocument(nextLanguage);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY) syncLanguage();
    };

    syncLanguage();
    window.addEventListener('storage', onStorage);
    window.addEventListener(LANGUAGE_CHANGED_EVENT, syncLanguage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(LANGUAGE_CHANGED_EVENT, syncLanguage);
    };
  }, []);

  const changeLanguage = useCallback((nextLanguage: Language) => {
    if (!supportedLanguages.includes(nextLanguage)) return;
    try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage); } catch { /* Keep the current session language. */ }
    setLanguage(nextLanguage);
    applyLanguageToDocument(nextLanguage);
    window.dispatchEvent(new Event(LANGUAGE_CHANGED_EVENT));
  }, []);

  return { language, changeLanguage };
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  return createElement(LanguageContext.Provider, { value: useLanguageState() }, children);
}

export function usePersistentLanguage() {
  const context = useContext(LanguageContext);
  const localLanguage = useLanguageState();
  return context ?? localLanguage;
}
