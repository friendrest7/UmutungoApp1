'use client';

import { t, type Language } from '../data/translations';
import { Icon } from './Icons';
import { Logo } from './Logo';
import styles from './SiteFooter.module.css';

const languages: Language[] = ['English', 'French', 'Kinyarwanda', 'Swahili'];

type SiteFooterProps = {
  language: Language;
  onLanguageChange: (language: Language) => void;
  darkMode: boolean;
  onToggleTheme: () => void;
};

/** Dark-green footer shared by the landing page and the newer public pages. */
export function SiteFooter({ language, onLanguageChange, darkMode, onToggleTheme }: SiteFooterProps) {
  const copy = (key: string) => t(language, key);
  const year = new Date().getFullYear();
  return <footer className={styles.footer}>
    <div className={`${styles.container} ${styles.main}`}>
      <div className={styles.brand}>
        <a href="/" aria-label="Umutungo home" className={styles.logo}><Logo darkMode /></a>
        <p className={styles.tagline}>{copy('Connecting People, Properties & Opportunities.')}</p>
        <p>{copy('Rwanda’s property & asset marketplace.')}</p>
      </div>
      <nav aria-label={copy('Explore')}>
        <h2>{copy('Explore')}</h2>
        <a href="/categories/properties">{copy('Properties')}</a>
        <a href="/categories/land">{copy('Land')}</a>
        <a href="/categories/commercial">{copy('Commercial spaces')}</a>
        <a href="/categories/other">{copy('Other assets')}</a>
      </nav>
      <nav aria-label="Umutungo">
        <h2>Umutungo</h2>
        <a href="/post-property">{copy('Post a Property')}</a>
        <a href="/register?role=Komisiyoneri">{copy('Komisiyoneri')}</a>
        <a href="/register?role=Property%20Owner">{copy('Property Owners')}</a>
        <a href="/landlord">{copy('Landlords')}</a>
        <a href="/upgrade">{copy('Premium plans')}</a>
      </nav>
      <nav aria-label={copy('Contact & help')}>
        <h2>{copy('Contact & help')}</h2>
        <a href="/contact">{copy('Help & contact')}</a>
        <a href="/how-it-works">{copy('How it works')}</a>
        <a href="/about">{copy('About us')}</a>
        <a href="mailto:hello@umutungo.rw">hello@umutungo.rw</a>
      </nav>
    </div>
    <div className={`${styles.container} ${styles.bottom}`}>
      <span>© {year} UMUTUNGO · Rwanda</span>
      <div className={styles.controls}>
        <label className={styles.srOnly} htmlFor="site-footer-language">{copy('Language')}</label>
        <select id="site-footer-language" value={language} onChange={(event) => onLanguageChange(event.target.value as Language)}>
          {languages.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <button type="button" onClick={onToggleTheme} aria-label={copy(darkMode ? 'Switch to light mode' : 'Switch to dark mode')}><Icon name={darkMode ? 'sun' : 'moon'} size={14} /></button>
        <a href="mailto:hello@umutungo.rw?subject=Privacy%20policy%20request">{copy('Privacy Policy')}</a>
        <a href="mailto:hello@umutungo.rw?subject=Terms%20of%20use%20request">{copy('Terms of Use')}</a>
      </div>
    </div>
  </footer>;
}
