'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AiChatbot } from './AiChatbot';
import { Footer } from './Footer';
import { Icon } from './Icons';
import { Navbar } from './Navbar';
import { Language, t } from '../data/translations';

type InfoPage = 'how' | 'about' | 'categories';

const categoryCards = [
  { name: 'Homes', detail: 'Family houses and places to rent.', slug: 'houses', image: '/properties/house-01.jpg', accent: 'green' },
  { name: 'Apartments', detail: 'Easy city living in Kigali.', slug: 'apartments', image: '/properties/apartment-01.jpg', accent: 'blue' },
  { name: 'Land', detail: 'Plots for your next project.', slug: 'land', image: '/properties/land-01.jpg', accent: 'olive' },
  { name: 'Commercial spaces', detail: 'Shops, offices and workspaces.', slug: 'commercial', image: '/properties/commercial-01.jpg', accent: 'orange' },
  { name: 'Offices', detail: 'Professional places to build your team.', slug: 'offices', image: '/properties/commercial-02.jpg', accent: 'slate' },
  { name: 'Hospitality', detail: 'Short stays with clear booking details.', slug: 'hospitality', image: '/properties/apartment-02.jpg', accent: 'rose' },
];

export function InfoPageShell({ page }: { page: InfoPage }) {
  const [language, setLanguage] = useState<Language>('English');
  const [darkMode, setDarkMode] = useState(false);
  const copy = (key: string) => t(language, key);

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem('umutungo-language') as Language | null;
    if (storedLanguage && ['English', 'French', 'Kinyarwanda', 'Swahili'].includes(storedLanguage)) setLanguage(storedLanguage);
    if (window.localStorage.getItem('umutungo-theme') === 'dark') setDarkMode(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = ({ English: 'en', French: 'fr', Kinyarwanda: 'rw', Swahili: 'sw' } as Record<Language, string>)[language];
  }, [language]);

  const changeLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem('umutungo-language', nextLanguage);
  };

  const toggleTheme = () => setDarkMode((current) => {
    const next = !current;
    window.localStorage.setItem('umutungo-theme', next ? 'dark' : 'light');
    return next;
  });

  return <div className={`${darkMode ? 'app theme-dark' : 'app'} app-realistic info-page-shell`}>
    <Navbar darkMode={darkMode} onToggleTheme={toggleTheme} language={language} onLanguageChange={changeLanguage} />
    <AiChatbot language={language} />
    {page === 'how' && <HowItWorksPage copy={copy} />}
    {page === 'about' && <AboutPage copy={copy} />}
    {page === 'categories' && <CategoriesPage copy={copy} />}
    <Footer language={language} />
  </div>;
}

function HowItWorksPage({ copy }: { copy: (key: string) => string }) {
  const steps = [
    { number: '01', icon: 'search' as const, title: copy('Easy to explore'), text: copy('Clear places, clear next steps') },
    { number: '02', icon: 'check' as const, title: copy('Built on trust'), text: copy('Better information for everyone') },
    { number: '03', icon: 'users' as const, title: copy('Local agents'), text: copy('Speak to people who know the area and the market.') },
  ];

  return <main className="standalone-page how-page">
    <section className="standalone-hero how-page-hero"><div className="container standalone-hero-grid"><div><p className="eyebrow">{copy('How Umutungo works')}</p><h1>{copy('Find where')}<br /><em>{copy('you belong.')}</em></h1><p>{copy('We are here for everyone who wants a place to live — the easy, trusted and comfortable way.')}</p><a className="button button-primary" href="/categories/houses">{copy('Explore spaces')} <Icon name="arrow" size={15} /></a></div><div className="journey-orbit"><div className="orbit-ring orbit-ring-one" /><div className="orbit-ring orbit-ring-two" /><span className="orbit-center"><Icon name="home" size={28} /></span><span className="orbit-node orbit-node-one">Search</span><span className="orbit-node orbit-node-two">Compare</span><span className="orbit-node orbit-node-three">Move in</span></div></div></section>
    <section className="standalone-section"><div className="container"><div className="standalone-heading"><p className="eyebrow">01 — {copy('Easy to explore')}</p><h2>{copy('A clearer search')}<br /><em>{copy('from the first step.')}</em></h2></div><div className="journey-steps">{steps.map((step) => <article className="journey-step" key={step.number}><span className="journey-step-number">{step.number}</span><Icon name={step.icon} size={22} /><h3>{step.title}</h3><p>{step.text}</p></article>)}</div></div></section>
    <section className="journey-banner"><div className="container journey-banner-inner"><div><p className="eyebrow">{copy('Made for Rwanda')}</p><h2>{copy('Rooted in how we live')}</h2></div><Link className="text-arrow-link" href="/categories">{copy('Browse by category')} <Icon name="arrow" size={15} /></Link></div></section>
  </main>;
}

function AboutPage({ copy }: { copy: (key: string) => string }) {
  return <main className="standalone-page about-page">
    <section className="standalone-hero about-page-hero"><div className="container about-hero-layout"><div><p className="eyebrow">{copy('Why Umutungo')}</p><h1>{copy('Property search,')}<br /><em>{copy('made clearer.')}</em></h1><p>{copy('The useful details, in one place, so the next step feels easier.')}</p></div><div className="about-portrait" style={{ backgroundImage: "linear-gradient(180deg, transparent, rgba(10, 31, 17, .74)), url('/properties/kigali-neighborhood.jpg')" }}><span>{copy('Made for Rwanda')}</span><strong>01</strong></div></div></section>
    <section className="standalone-section"><div className="container about-story-grid"><div className="standalone-heading"><p className="eyebrow">{copy('Our promise')}</p><h2>{copy('A place for every story')}</h2></div><div className="about-story-copy"><p>{copy('We are building a property experience where every person in the journey can move with more clarity and confidence.')}</p><p>{copy('Every place has a story.')}</p><a className="button button-primary" href="/#properties">{copy('Find a property')} <Icon name="arrow" size={15} /></a></div></div></section>
    <section className="values-section"><div className="container"><div className="standalone-heading"><p className="eyebrow">{copy('The Umutungo promise')}</p><h2>{copy('Better together')}</h2></div><div className="values-grid"><article><span>01</span><h3>{copy('Easier discovery')}</h3><p>{copy('Spend less time searching and more time finding possibilities that feel right for you.')}</p></article><article><span>02</span><h3>{copy('Information you can trust')}</h3><p>{copy('Clear property details and thoughtful verification will help you take the next step with confidence.')}</p></article><article><span>03</span><h3>{copy('Better together')}</h3><p>{copy('Clients, Komisiyoneri and owners work more effectively when everyone has a clearer view.')}</p></article></div></div></section>
  </main>;
}

function CategoriesPage({ copy }: { copy: (key: string) => string }) {
  return <main className="standalone-page categories-page">
    <section className="standalone-hero categories-page-hero"><div className="container"><p className="eyebrow">{copy('Browse by category')}</p><h1>{copy('Find your kind')}<br /><em>{copy('of place.')}</em></h1><p>{copy('Choose a starting point, then narrow it down by area, budget and what matters to you.')}</p></div></section>
    <section className="standalone-section categories-directory"><div className="container"><div className="directory-toolbar"><div><p className="eyebrow">{copy('Explore spaces')}</p><h2>{copy('A place for every story')}</h2></div><span>06 {copy('categories')}</span></div><div className="directory-grid">{categoryCards.map((category, index) => <Link className={`directory-card directory-card-${category.accent}`} href={`/categories/${category.slug}`} key={category.slug}><span className="directory-card-image" style={{ backgroundImage: `linear-gradient(180deg, transparent 30%, rgba(5, 15, 8, .78)), url(${category.image})` }} /><span className="directory-card-index">0{index + 1}</span><span className="directory-card-copy"><strong>{copy(category.name)}</strong><small>{copy(category.detail)}</small><Icon name="arrow" size={16} /></span></Link>)}</div></div></section>
  </main>;
}
