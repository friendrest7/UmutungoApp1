'use client';

import { Icon } from './Icons';
import { ThemeToggle } from './ThemeToggle';
import { supportedLanguages, usePersistentLanguage } from '../lib/language';
import { usePersistentTheme } from '../lib/theme';
import { Language, t } from '../data/translations';

const languageCodes: Record<Language, string> = { English: 'EN', French: 'FR', Kinyarwanda: 'RW', Swahili: 'SW' };

export function InterfacePreferences({ className = '' }: { className?: string }) {
  const { darkMode, toggleTheme } = usePersistentTheme();
  const { language, changeLanguage } = usePersistentLanguage();

  return <div className={`interface-preferences ${className}`.trim()} aria-label={t(language, 'Site preferences')}>
    <label className="interface-language-select" title={t(language, 'Language')}>
      <Icon name="globe" size={15} />
      <select value={language} aria-label={t(language, 'Language')} onChange={(event) => changeLanguage(event.target.value as Language)}>
        {supportedLanguages.map((item) => <option key={item} value={item}>{languageCodes[item]}</option>)}
      </select>
    </label>
    <ThemeToggle darkMode={darkMode} onToggle={toggleTheme} language={language} />
  </div>;
}
