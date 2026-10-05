import { Icon } from './Icons';
import { Language, t } from '../data/translations';

type ThemeToggleProps = { darkMode: boolean; onToggle: () => void; language: Language };

export function ThemeToggle({ darkMode, onToggle, language }: ThemeToggleProps) {
  return (
    <button className="icon-button theme-toggle" type="button" onClick={onToggle} aria-label={darkMode ? t(language, 'Light mode') : t(language, 'Dark mode')} title={t(language, 'Toggle theme')}>
      <Icon name={darkMode ? 'sun' : 'moon'} size={17} />
      <span className="theme-label">{darkMode ? t(language, 'Light mode') : t(language, 'Dark mode')}</span>
    </button>
  );
}
