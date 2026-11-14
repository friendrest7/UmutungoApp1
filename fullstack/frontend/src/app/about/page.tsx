'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { AiChatbot } from '../../components/AiChatbot';
import { Icon, type IconName } from '../../components/Icons';
import { Navbar } from '../../components/Navbar';
import { SiteFooter } from '../../components/SiteFooter';
import { t, type Language } from '../../data/translations';
import { usePersistentLanguage } from '../../lib/language';
import { usePersistentTheme } from '../../lib/theme';
import { getAboutVideo, publicUmutungoApi, type AboutVideo } from '../../lib/umutungoApi';
import styles from './about.module.css';

const pillars: Array<{ icon: IconName; title: string; body: string; points: string[] }> = [
  {
    icon: 'search',
    title: 'Discover',
    body: 'Search homes, apartments, land, commercial spaces and everyday assets in one place.',
    points: ['Filter by location, category and budget', 'Save favourites and compare listings', 'Contact owners and Komisiyoneri directly'],
  },
  {
    icon: 'building',
    title: 'Advertise',
    body: 'Owners and Komisiyoneri publish listings that answer the important questions up front.',
    points: ['Photos, price, location and key facts', 'Featured placement for more visibility', 'Plans that grow with your portfolio'],
  },
  {
    icon: 'home',
    title: 'Manage',
    body: 'Landlords keep rentals organised after the tenant moves in.',
    points: ['Record rent and see who is overdue', 'Handle repair requests from tenants', 'Keep enquiries and messages in one inbox'],
  },
];

const audiences = [
  { title: 'People searching', body: 'Buyers, tenants and anyone looking for a space or an asset. Browsing is free.', cta: 'Browse listings', href: '/categories/properties' },
  { title: 'Property owners', body: 'Sell or rent out what you own and receive enquiries from prepared buyers and tenants.', cta: 'Advertise a property', href: '/register?role=Property%20Owner' },
  { title: 'Landlords', body: 'Advertise vacancies and manage tenants, rent and repairs from one workspace.', cta: 'List a rental', href: '/landlord' },
  { title: 'Komisiyoneri', body: 'Manage your clients’ listings, follow up leads and build a professional profile.', cta: 'Join as Komisiyoneri', href: '/register?role=Komisiyoneri' },
];

const principles = [
  { title: 'Clarity first', body: 'Every listing should show the price, location and facts people need before they make a call.' },
  { title: 'Trust is earned', body: 'Contact details are verified before they are shown, and listings can be reported for review.' },
  { title: 'Built for Rwanda', body: 'Prices in RWF, payments with Mobile Money, and the site in Kinyarwanda, English, French and Swahili.' },
  { title: 'Open to everyone', body: 'Searching is free. Anyone can find a place, and anyone with a property can reach the people looking for one.' },
];

export default function AboutPage() {
  const { darkMode, toggleTheme } = usePersistentTheme();
  const { language, changeLanguage } = usePersistentLanguage();
  const copy = (key: string) => t(language, key);
  const [video, setVideo] = useState<AboutVideo | null>(null);
  const [listingCount, setListingCount] = useState<number | null>(null);

  useEffect(() => {
    document.documentElement.lang = ({ English: 'en', French: 'fr', Kinyarwanda: 'rw', Swahili: 'sw' } as Record<Language, string>)[language];
  }, [language]);

  useEffect(() => {
    let active = true;
    void getAboutVideo().then((result) => { if (active) setVideo(result); }).catch(() => undefined);
    void publicUmutungoApi<{ items: unknown[] }>('/api/v1/listings', { cache: 'no-store' })
      .then((result) => { if (active && result?.items?.length) setListingCount(result.items.length); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const facts = [
    listingCount ? { value: listingCount.toLocaleString(), label: 'Live listings' } : { value: 'Free', label: 'To search and browse' },
    { value: '12', label: 'Property & asset categories' },
    { value: '4', label: 'Languages supported' },
    { value: '5', label: 'Provinces in search' },
  ];

  return <div className={`${darkMode ? 'app theme-dark' : 'app'}`}>
    <Navbar active="about" darkMode={darkMode} onToggleTheme={toggleTheme} language={language} onLanguageChange={changeLanguage} />
    <AiChatbot language={language} />
    <main className={styles.page} data-own-colors="">

      {/* Hero */}
      <section className={styles.hero} aria-labelledby="about-title">
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>{copy('About Umutungo')}</p>
            <h1 id="about-title" className={styles.display}>{copy('Bringing Rwanda’s property market into one trusted place.')}</h1>
            <p className={styles.lead}>{copy('Umutungo connects people with homes, land, workspaces and valuable assets across Rwanda, and gives owners, landlords and Komisiyoneri the tools to reach them.')}</p>
            <div className={styles.actions}>
              <a className={styles.btnGreen} href="/categories/properties">{copy('Browse listings')} <span aria-hidden="true">→</span></a>
              <a className={styles.btnOutline} href="/post-property">{copy('Post a Property')}</a>
            </div>
          </div>
          <div className={styles.heroMedia}>
            <div className={styles.heroImage}><Image src="/properties/kigali-downtown.jpg" alt={copy('Kigali city centre')} fill priority sizes="(max-width: 900px) 100vw, 560px" /></div>
            <div className={styles.heroBadge}>
              <span><Icon name="pin" size={16} /></span>
              <div><strong>{copy('Made in Rwanda')}</strong><small>{copy('For the way we live, work and invest')}</small></div>
            </div>
          </div>
        </div>
      </section>

      {/* Facts */}
      <section className={styles.container} aria-label={copy('Umutungo at a glance')}>
        <dl className={styles.facts}>
          {facts.map((fact) => <div key={fact.label}><dt>{copy(fact.label)}</dt><dd>{fact.value}</dd></div>)}
        </dl>
      </section>

      {/* Story */}
      <section className={styles.section} aria-labelledby="story-title">
        <div className={`${styles.container} ${styles.storyGrid}`}>
          <div>
            <p className={styles.kicker}>{copy('Our story')}</p>
            <h2 id="story-title" className={styles.display}>{copy('Why we built Umutungo')}</h2>
            <p className={styles.body}>{copy('Finding a property used to mean days of searching without knowing what was actually available. Listings were scattered, details were missing, and good options were easy to miss.')}</p>
            <p className={styles.body}>{copy('We built Umutungo so that anyone can see what is available in minutes, compare it clearly, and reach the right person directly. Our goal is simple: help everyone find what they are looking for.')}</p>
          </div>
          <figure className={styles.video}>
            <video src={video?.url ?? '/properties/landing.mp4'} controls playsInline preload="metadata" poster="/properties/story-begin.jpg" aria-label={video?.title ?? copy('Umutungo introduction')}>{copy('Your browser does not support video playback.')}</video>
            <figcaption>{video?.title ?? copy('A short introduction to Umutungo')}</figcaption>
          </figure>
        </div>
      </section>

      {/* What we do */}
      <section className={styles.section} aria-labelledby="pillars-title">
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>{copy('What we do')}</p>
            <h2 id="pillars-title" className={styles.display}>{copy('One platform, from search to settled.')}</h2>
          </div>
          <div className={styles.pillars}>
            {pillars.map((pillar, index) => <article key={pillar.title} className={styles.pillar}>
              <div className={styles.pillarTop}>
                <span className={styles.pillarIcon}><Icon name={pillar.icon} size={20} /></span>
                <span className={styles.pillarIndex}>{String(index + 1).padStart(2, '0')}</span>
              </div>
              <h3>{copy(pillar.title)}</h3>
              <p>{copy(pillar.body)}</p>
              <ul>{pillar.points.map((point) => <li key={point}><Icon name="check" size={14} />{copy(point)}</li>)}</ul>
            </article>)}
          </div>
        </div>
      </section>

      {/* Who we serve */}
      <section className={styles.section} aria-labelledby="serve-title">
        <div className={`${styles.container} ${styles.serveGrid}`}>
          <div className={styles.serveIntro}>
            <p className={styles.kicker}>{copy('Who we serve')}</p>
            <h2 id="serve-title" className={styles.display}>{copy('Umutungo is designed for everyone.')}</h2>
            <p className={styles.body}>{copy('Whether you are searching, sharing a space, or helping someone move forward, there is a place for you here.')}</p>
            <div className={styles.serveImage}><Image src="/properties/office-03.jpg" alt="" fill sizes="(max-width: 900px) 100vw, 420px" /></div>
          </div>
          <ul className={styles.serveList}>
            {audiences.map((audience, index) => <li key={audience.title}>
              <span className={styles.serveIndex}>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{copy(audience.title)}</h3>
                <p>{copy(audience.body)}</p>
              </div>
              <a href={audience.href} className={styles.serveLink}>{copy(audience.cta)} <span aria-hidden="true">→</span></a>
            </li>)}
          </ul>
        </div>
      </section>

      {/* Principles */}
      <section className={styles.section} aria-labelledby="principles-title">
        <div className={styles.container}>
          <div className={styles.principles}>
            <div className={styles.principlesHead}>
              <p className={styles.kickerGreen}>{copy('Our principles')}</p>
              <h2 id="principles-title" className={styles.display}>{copy('What we hold ourselves to.')}</h2>
            </div>
            <ol className={styles.principleGrid}>
              {principles.map((principle, index) => <li key={principle.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{copy(principle.title)}</h3>
                <p>{copy(principle.body)}</p>
              </li>)}
            </ol>
          </div>
        </div>
      </section>

      {/* Contact + closing */}
      <section className={styles.section} aria-labelledby="closing-title">
        <div className={`${styles.container} ${styles.closing}`}>
          <div>
            <p className={styles.kicker}>{copy('Get in touch')}</p>
            <h2 id="closing-title" className={styles.display}>{copy('We’re here for you.')}</h2>
            <p className={styles.body}>{copy('Questions about a listing, your account or a partnership? Send us a message and we will get back to you.')}</p>
            <div className={styles.actions}>
              <a className={styles.btnGreen} href="/contact">{copy('Contact the team')} <span aria-hidden="true">→</span></a>
              <a className={styles.btnOutline} href="/how-it-works">{copy('How it works')}</a>
            </div>
          </div>
          <ul className={styles.contactList}>
            <li><span><Icon name="mail" size={16} /></span><div><small>{copy('Email')}</small><a href="mailto:hello@umutungo.rw">hello@umutungo.rw</a></div></li>
            <li><span><Icon name="pin" size={16} /></span><div><small>{copy('Based in')}</small><strong>{copy('Rwanda')}</strong></div></li>
            <li><span><Icon name="download" size={16} /></span><div><small>{copy('On the go')}</small><a href="/#app-download">{copy('Get the mobile app')}</a></div></li>
          </ul>
        </div>
      </section>
    </main>
    <SiteFooter language={language} onLanguageChange={changeLanguage} darkMode={darkMode} onToggleTheme={toggleTheme} />
  </div>;
}
