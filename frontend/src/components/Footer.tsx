import { Language, t } from '../data/translations';
import { Icon } from './Icons';
import { Logo } from './Logo';

export function Footer({ language, darkMode = false }: { language: Language; darkMode?: boolean }) {
  return (
    <footer className="site-footer" id="footer-contact">
      <div className="container app-download" id="app-download">
        <div className="app-download-copy"><h2>{t(language, 'Get the Umutungo app')}</h2><p>{t(language, 'Keep your property search close.')}</p></div>
        <div className="app-download-options" aria-label={t(language, 'Download links coming soon')}>
          <a className="app-download-option" href="#" aria-disabled="true" title={t(language, 'Download links coming soon')} onClick={(event) => event.preventDefault()}><span className="app-download-icon"><Icon name="googlePlay" size={19} /></span><span><small>{t(language, 'Download on')}</small><strong>{t(language, 'Google Play')}</strong></span></a>
          <a className="app-download-option" href="#" aria-disabled="true" title={t(language, 'Download links coming soon')} onClick={(event) => event.preventDefault()}><span className="app-download-icon"><Icon name="apple" size={19} /></span><span><small>{t(language, 'Download on')}</small><strong>{t(language, 'iOS app')}</strong></span></a>
        </div>
      </div>
      <div className="container footer-main"><a className="footer-register-link" href="/register">{t(language, 'Create an account')} <Icon name="arrow" size={14} /></a>
        <div className="footer-brand-block"><a href="#home"><Logo darkMode={darkMode} /></a><p>{t(language, 'Making the journey home')}<br />{t(language, 'feel a little more human.')}</p></div>
        <div className="footer-column"><span>{t(language, 'Explore')}</span><a href="/">{t(language, 'Home')}</a><a href="/categories">{t(language, 'Categories')}</a><a href="/how-it-works">{t(language, 'How it works')}</a></div>
        <div className="footer-column"><span>{t(language, 'For you')}</span><a href="/post-property">{t(language, 'Post a House')}</a><a href="/#rwanda">{t(language, 'Umutungo in Rwanda')}</a><a href="/about">{t(language, 'Our promise')}</a></div>
        <div className="footer-column"><span>{t(language, 'Connect')}</span><a href="mailto:hello@umutungo.rw">hello@umutungo.rw</a><a className="footer-social-link instagram-link" href="#home" aria-label="Instagram"><Icon name="instagram" size={22} />Instagram <span aria-hidden="true">↗</span></a><a className="footer-social-link linkedin-link" href="#home" aria-label="LinkedIn"><Icon name="linkedin" size={22} />LinkedIn <span aria-hidden="true">↗</span></a></div>
      </div>
      <div className="container footer-bottom"><span>{t(language, '© 2024 Umutungo. Made in Rwanda.')}</span><span><a href="#home">{t(language, 'Privacy')}</a><a href="#home">{t(language, 'Terms')}</a></span></div>
    </footer>
  );
}
