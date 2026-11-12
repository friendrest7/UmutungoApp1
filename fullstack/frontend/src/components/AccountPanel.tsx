import { useEffect, useState } from 'react';
import { Language, t } from '../data/translations';
import { Icon } from './Icons';
import styles from './AccountPanel.module.css';

const languages: Language[] = ['English', 'French', 'Kinyarwanda', 'Swahili'];
const languageCodes: Record<Language, string> = { English: 'EN', French: 'FR', Kinyarwanda: 'RW', Swahili: 'SW' };
const dashboardHints: Record<string, string> = {
  Landlord: 'Properties, tenants and rent',
  'Property Owner': 'Your listings and enquiries',
  'Commissioner / Komisiyoneri': 'Listings, clients and visits',
  Client: 'Applications and viewings',
  Tenant: 'Rent, repairs and viewings',
  Admin: 'Platform administration',
};

type StoredUser = { name?: string; email?: string; phone?: string; testingFirstName?: string };

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U';

export function AccountPanel({ language, role, darkMode, onToggleTheme, onLanguageChange, onAccount, onFavorites, onSignOut, favoritesCount = 0, showSettings = true, compact = false }: {
  language: Language;
  role?: string;
  darkMode: boolean;
  onToggleTheme: () => void;
  onLanguageChange: (language: Language) => void;
  onAccount: () => void;
  onFavorites: () => void;
  onSignOut: () => void;
  favoritesCount?: number;
  showSettings?: boolean;
  compact?: boolean;
}) {
  const [user, setUser] = useState<StoredUser>({});
  useEffect(() => {
    try { setUser(JSON.parse(window.localStorage.getItem('umutungo-demo-user') ?? '{}') as StoredUser); }
    catch { setUser({}); }
  }, []);
  const roleLabel = role === 'Commissioner / Komisiyoneri' ? 'Komisiyoneri' : role;
  const name = user.name?.trim() || user.testingFirstName || (roleLabel ? t(language, roleLabel) : t(language, 'Account'));
  const meta = user.email || user.phone || t(language, 'Umutungo account');

  return <div className={`${styles.panel} ${compact ? styles.compact : ''}`} role="menu" aria-label={t(language, 'Account')}>
    <div className={styles.identity}>
      <span className={styles.avatar} aria-hidden="true">{initials(name)}</span>
      <span className={styles.who}>
        <span className={styles.name}>{name}</span>
        <span className={styles.meta}>{meta}</span>
        {roleLabel && <span className={styles.role}>{t(language, roleLabel)}</span>}
      </span>
    </div>

    <div className={styles.section}>
      <button className={styles.item} type="button" role="menuitem" onClick={onAccount}>
        <span className={styles.itemIcon}><Icon name="home" size={16} /></span>
        <span className={styles.itemText}><strong>{t(language, 'Dashboard')}</strong><small>{t(language, dashboardHints[role ?? ''] ?? 'Your Umutungo workspace')}</small></span>
        <span className={styles.chevron} aria-hidden="true"><Icon name="chevron" size={14} /></span>
      </button>
      <button className={styles.item} type="button" role="menuitem" onClick={onFavorites}>
        <span className={styles.itemIcon}><Icon name="heart" size={16} /></span>
        <span className={styles.itemText}><strong>{t(language, 'Favorites')}</strong><small>{t(language, 'Properties you saved')}</small></span>
        <span className={styles.count}>{favoritesCount > 99 ? '99+' : favoritesCount}</span>
      </button>
    </div>

    {showSettings && <div className={styles.section}>
      <span className={styles.label}>{t(language, 'Preferences')}</span>
      <div className={styles.row}>
        <span className={styles.rowLabel}><Icon name={darkMode ? 'moon' : 'sun'} size={16} />{t(language, 'Dark mode')}</span>
        <button className={styles.switch} type="button" role="switch" aria-checked={darkMode} aria-label={t(language, 'Dark mode')} onClick={onToggleTheme} />
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}><Icon name="globe" size={16} />{t(language, 'Language')}</span>
        <span className={styles.lang} role="group" aria-label={t(language, 'Language')}>
          {languages.map((item) => <button key={item} type="button" aria-pressed={language === item} title={item} onClick={() => onLanguageChange(item)}>{languageCodes[item]}</button>)}
        </span>
      </div>
    </div>}

    <div className={styles.section}>
      <button className={`${styles.item} ${styles.logout}`} type="button" role="menuitem" onClick={onSignOut}>
        <span className={styles.itemIcon}><Icon name="arrow" size={16} /></span>
        <span className={styles.itemText}><strong>{t(language, 'Log out')}</strong></span>
      </button>
    </div>
  </div>;
}
