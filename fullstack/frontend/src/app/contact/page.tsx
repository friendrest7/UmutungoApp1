'use client';

import { AiChatbot } from '../../components/AiChatbot';
import { Footer } from '../../components/Footer';
import { Icon } from '../../components/Icons';
import { Navbar } from '../../components/Navbar';
import { t } from '../../data/translations';
import { usePersistentLanguage } from '../../lib/language';
import { usePersistentTheme } from '../../lib/theme';

export default function ContactPage() {
  const { darkMode, toggleTheme } = usePersistentTheme();
  const { language, changeLanguage } = usePersistentLanguage();
  const copy = (key: string) => t(language, key);

  return <div className={`${darkMode ? 'app theme-dark' : 'app'} app-realistic`}>
    <Navbar darkMode={darkMode} onToggleTheme={toggleTheme} language={language} onLanguageChange={changeLanguage} />
    <AiChatbot language={language} />
    <main className="contact-page-main">
      <section className="contact-interface">
        <div className="container contact-interface-grid"><div><p className="eyebrow">{copy('Contact')}</p><h1>{copy('Need help with your property search?')}<br /><em>{copy('Contact the Umutungo')} <a className="contact-team-link" href="https://mail.google.com/mail/?view=cm&fs=1&to=hello%40umutungo.rw" target="_blank" rel="noreferrer"><span className="contact-team-link-label">{copy('team')}</span><Icon name="arrow" size={15} /></a></em></h1><p className="contact-interface-copy">{copy('We are building a property experience where every person in the journey can move with more clarity and confidence.')}</p><a className="contact-email" href="mailto:hello@umutungo.rw">hello@umutungo.rw <Icon name="arrow" size={15} /></a></div><form className="contact-interface-form" action="mailto:hello@umutungo.rw" method="post" encType="text/plain"><label><span>{copy('Name')}</span><input name="name" placeholder={copy('Your name')} required /></label><label><span>{copy('Email address')}</span><input name="email" type="email" placeholder="you@example.com" required /></label><label><span>{copy('Message')}</span><textarea name="message" placeholder={copy('How can we help?')} rows={4} required /></label><button className="button button-primary" type="submit">{copy('Send message')} <Icon name="arrow" size={15} /></button></form></div>
      </section>
    </main>
    <Footer language={language} darkMode={darkMode} />
  </div>;
}
