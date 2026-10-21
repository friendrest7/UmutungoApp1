'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { AiChatbot } from './AiChatbot';
import { Footer } from './Footer';
import { Icon, type IconName } from './Icons';
import { Navbar } from './Navbar';
import { Language, t } from '../data/translations';
import { usePersistentLanguage } from '../lib/language';
import { usePersistentTheme } from '../lib/theme';
import { AboutVideo, getAboutVideo } from '../lib/umutungoApi';

type InfoPage = 'how' | 'about' | 'categories';

const categoryCards: { name: string; detail: string; slug: string; icon: IconName; accent: string }[] = [
  { name: 'Homes', detail: 'Houses and homes for sale or rent.', slug: 'houses', icon: 'home', accent: 'green' },
  { name: 'Apartments', detail: 'Easy city living in Kigali.', slug: 'apartments', icon: 'building', accent: 'blue' },
  { name: 'Land', detail: 'Plots for your next project.', slug: 'land', icon: 'leaf', accent: 'olive' },
  { name: 'Commercial spaces', detail: 'Shops, offices and workspaces.', slug: 'commercial', icon: 'building', accent: 'orange' },
  { name: 'Offices', detail: 'Professional office properties for teams.', slug: 'offices', icon: 'building', accent: 'slate' },
  { name: 'Cars', detail: 'Cars for sale or hire.', slug: 'vehicles', icon: 'car', accent: 'rose' },
  { name: 'Car parts', detail: 'Parts and accessories for your car.', slug: 'car-parts', icon: 'wrench', accent: 'orange' },
  { name: 'Home appliances', detail: 'Useful appliances for your home.', slug: 'appliances', icon: 'appliance', accent: 'blue' },
];

function HowItWorksStory({ copy }: { copy: (key: string) => string }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const scenes = [
    { eyebrow: '01 — Begin your search', title: 'Find the right property.', body: 'Browse homes, land, and commercial listings. Filter by property type, sale or rental intent, price, and location to find options that fit your plans.', cta: 'Browse property listings.', image: '/properties/story-begin.jpg', tag: 'Homes · Kigali' },
    { eyebrow: '02 — Compare the details', title: 'Every detail, in focus.', body: 'Review asking price, rooms, amenities, condition, and photos in one clear view. Save listings that fit your plans and compare them before arranging a viewing.', cta: '', image: '/properties/story-detail.jpg', tag: 'Property details' },
    { eyebrow: '03 — Review the location', title: 'Understand the neighbourhood.', body: 'Location supports a good property decision. Check the address and nearby shops, schools, transport, and services to see how the property fits your commute, routine, and budget.', cta: '', image: '/properties/kigali-neighborhood.jpg', tag: 'Explore Kigali' },
    { eyebrow: '04 — Take the next step', title: 'Choose what comes next.', body: 'When a property feels right, contact the owner or representative directly. Ask questions, arrange a viewing, or discuss the next step for buying, renting, or using the space. If you are sharing a property, clear details help people make informed choices. Umutungo brings searchers, owners, and property professionals together around better information.', cta: '', image: '/properties/story-next-step.jpg', tag: 'Ready when you are' },
  ];

  useEffect(() => {
    const updateProgress = () => {
      const section = sectionRef.current;
      if (!section) return;
      const travel = Math.max(section.offsetHeight - window.innerHeight, 1);
      const nextProgress = Math.min(1, Math.max(0, -section.getBoundingClientRect().top / travel));
      setSelectedIndex(null);
      setProgress((current) => Math.abs(current - nextProgress) > 0.002 ? nextProgress : current);
    };
    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    return () => { window.removeEventListener('scroll', updateProgress); window.removeEventListener('resize', updateProgress); };
  }, []);

  const activeIndex = selectedIndex ?? Math.min(scenes.length - 1, Math.floor(progress * scenes.length));
  const activeScene = scenes[activeIndex];

  return <section ref={sectionRef} className="scroll-story" id="story" style={{ '--story-progress': progress } as CSSProperties}>
    <div className="scroll-story-inner container">
      <div className="scroll-story-intro">
        <h2>{copy('The search')}<br /><em>{copy('comes alive.')}</em></h2>
        <p>{copy('Choose a step to see how Umutungo helps you find, compare, or list property.')}</p>
        <div className="scroll-story-progress" aria-label="Story progress">{scenes.map((scene, index) => <span key={scene.eyebrow} className={index <= activeIndex ? 'is-active' : ''} />)}</div>
      </div>
      <div className="scroll-story-steps" aria-label={copy('How the journey works')}>
        {scenes.map((scene, index) => <article className={`scroll-story-step ${index === activeIndex ? 'is-active' : ''}`} key={scene.eyebrow}>
          <button className="scroll-story-step-select" type="button" aria-pressed={index === activeIndex} onClick={() => setSelectedIndex(index)}>
            <span className="scroll-story-step-index">{copy(scene.eyebrow)}</span>
            <h3>{copy(scene.title)}</h3>
          </button>
          {index === activeIndex && <div className="scroll-story-step-detail"><p>{copy(scene.body)}</p>{scene.cta && <a className="scroll-story-cta" href="/categories/houses">{copy(scene.cta)} <Icon name="arrow" size={13} /></a>}</div>}
        </article>)}
      </div>
      <div className="scroll-story-visual-wrap">
        <div className="scroll-story-visual" aria-live="polite" aria-label={copy(activeScene.tag)}>
          <div className="scroll-story-visual-image" style={{ backgroundImage: `url(${activeScene.image})` }} />
          <div className="scroll-story-visual-shade" />
          <span className="scroll-story-visual-tag">{copy(activeScene.tag)}</span>
          <div className="scroll-story-visual-caption"><span>Umutungo</span><strong>{String(activeIndex + 1).padStart(2, '0')} / {String(scenes.length).padStart(2, '0')}</strong></div>
        </div>
      </div>
    </div>
  </section>;
}

export function InfoPageShell({ page }: { page: InfoPage }) {
  const { language, changeLanguage: setLanguage } = usePersistentLanguage();
  const { darkMode, toggleTheme } = usePersistentTheme();
  const copy = (key: string) => t(language, key);

  useEffect(() => {
  }, []);

  useEffect(() => {
    document.documentElement.lang = ({ English: 'en', French: 'fr', Kinyarwanda: 'rw', Swahili: 'sw' } as Record<Language, string>)[language];
  }, [language]);

  const changeLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
  };

  return <div className={`${darkMode ? 'app theme-dark' : 'app'} app-realistic info-page-shell`}>
    <Navbar darkMode={darkMode} onToggleTheme={toggleTheme} language={language} onLanguageChange={changeLanguage} />
    {page === 'how' && <HowItWorksPage copy={copy} />}
    {page === 'about' && <AboutPage copy={copy} />}
    {page === 'categories' && <CategoriesPage copy={copy} />}
    <Footer language={language} darkMode={darkMode} />
    <AiChatbot language={language} />
  </div>;
}

function HowItWorksPage({ copy }: { copy: (key: string) => string }) {
  return <main className="standalone-page how-page">
    <HowItWorksStory copy={copy} />
    <section className="journey-banner"><div className="container journey-banner-inner"><div><p className="eyebrow">{copy('Made for Rwanda')}</p><h2>{copy('Rooted in how we live')}</h2></div><Link className="text-arrow-link" href="/categories/properties">{copy('Browse by category')} <Icon name="arrow" size={15} /></Link></div></section>
  </main>;
}

function AboutPage({ copy }: { copy: (key: string) => string }) {
  const [introVideo, setIntroVideo] = useState<AboutVideo | null>(null);
  useEffect(() => {
    let active = true;
    void getAboutVideo().then((video) => { if (active) setIntroVideo(video); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  return <main className="standalone-page about-page">
    <section className="about-film-section"><div className="container about-film-grid"><div className="about-film-copy"><p>{copy('about-platform-intro')}</p><p>{copy('about-platform-mission')}</p></div><div className="about-film-frame"><video src={introVideo?.url ?? '/properties/landing.mp4'} controls playsInline preload="metadata" poster="/properties/story-begin.jpg" aria-label={introVideo?.title ?? 'Umutungo introduction'}>Your browser does not support video playback.</video></div></div></section>
    <section id="about-story" className="standalone-section about-story-section"><div className="container about-story-grid"><div className="about-story-copy"><p>{copy('about-services-overview')}</p><a className="button button-primary" href="/#properties">{copy('Start exploring')} <Icon name="arrow" size={15} /></a></div></div></section>
    <section className="about-people-section"><div className="container"><div className="about-section-heading"><div><h2>{copy('about-designed-for-everyone')}</h2></div><p>{copy('A good property experience should feel useful whether you are searching, sharing a space, or helping someone move forward.')}</p></div><div className="about-people-grid"><Link className="about-people-card" href="/categories/properties"><span className="about-people-icon"><Icon name="search" size={18} /></span><small>01</small><h3>{copy('For people searching')}</h3><p>{copy('Compare homes, land and spaces with clearer information about location, price and the details that matter to your everyday life.')}</p></Link><Link className="about-people-card" href="/register?role=Property%20Owner"><span className="about-people-icon"><Icon name="home" size={18} /></span><small>02</small><h3>{copy('For owners and landlords')}</h3><p>{copy('Share a property in a way that answers the important questions early and brings more prepared enquiries to you.')}</p></Link><Link className="about-people-card" href="/register?role=Komisiyoneri"><span className="about-people-icon"><Icon name="users" size={18} /></span><small>03</small><h3>{copy('For Komisiyoneri')}</h3><p>{copy('Keep property conversations organised, guide clients with confidence and make each viewing more useful.')}</p></Link></div></div></section>
    <section className="values-section"><div className="container"><div className="standalone-heading"><h2>{copy('Better together')}</h2></div><div className="values-grid"><article><span>01</span><h3>{copy('Easier discovery')}</h3><p>{copy('Spend less time searching and more time finding possibilities that feel right for you.')}</p></article><article><span>02</span><h3>{copy('Information you can trust')}</h3><p>{copy('Clear property details and thoughtful verification will help you take the next step with confidence.')}</p></article><article><span>03</span><h3>{copy('Better together')}</h3><p>{copy('Clients, Komisiyoneri and owners work more effectively when everyone has a clearer view.')}</p></article></div></div></section>
    <section className="about-closing-section"><div className="container about-closing-inner"><div><h2>{copy('about-we-are-here')}<br /><em>{copy('about-search-home')}</em></h2></div><a className="button button-primary" href="/#properties">{copy('Explore')} <Icon name="arrow" size={15} /></a></div></section>
  </main>;
}

function CategoriesPage({ copy }: { copy: (key: string) => string }) {
  return <main className="standalone-page categories-page">
    <section className="standalone-hero categories-page-hero"><div className="container"><p className="eyebrow">{copy('Browse by property type')}</p><h1>{copy('Browse property listings')}</h1><p>{copy('Choose a property type, then narrow listings by sale or rent, area, and budget.')}</p></div></section>
    <section className="standalone-section categories-directory"><div className="container"><div className="directory-toolbar"><div><p className="eyebrow">{copy('Property categories')}</p><h2>{copy('Homes, land and commercial property')}</h2></div><span>{String(categoryCards.length).padStart(2, '0')} {copy('categories')}</span></div><div className="directory-grid">{categoryCards.map((category, index) => <Link className={`directory-card directory-card-${category.accent}`} href={`/categories/${category.slug}`} key={category.slug}><span className="directory-card-icon"><Icon name={category.icon} size={30} /></span><span className="directory-card-index">{String(index + 1).padStart(2, '0')}</span><span className="directory-card-copy"><strong>{copy(category.name)}</strong><small>{copy(category.detail)}</small><Icon name="arrow" size={16} /></span></Link>)}</div></div></section>
  </main>;
}
