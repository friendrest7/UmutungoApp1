'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { AiChatbot } from './AiChatbot';
import { Footer } from './Footer';
import { Icon } from './Icons';
import { Navbar } from './Navbar';
import { Language, t } from '../data/translations';
import { usePersistentTheme } from '../lib/theme';

type InfoPage = 'how' | 'about' | 'categories';

const categoryCards = [
  { name: 'Homes', detail: 'Family houses and places to rent.', slug: 'houses', image: '/properties/house-01.jpg', accent: 'green' },
  { name: 'Apartments', detail: 'Easy city living in Kigali.', slug: 'apartments', image: '/properties/apartment-01.jpg', accent: 'blue' },
  { name: 'Land', detail: 'Plots for your next project.', slug: 'land', image: '/properties/land-01.jpg', accent: 'olive' },
  { name: 'Commercial spaces', detail: 'Shops, offices and workspaces.', slug: 'commercial', image: '/properties/commercial-01.jpg', accent: 'orange' },
  { name: 'Offices', detail: 'Professional places to build your team.', slug: 'offices', image: '/properties/commercial-02.jpg', accent: 'slate' },
  { name: 'Hospitality', detail: 'Short stays with clear booking details.', slug: 'hospitality', image: '/properties/apartment-02.jpg', accent: 'rose' },
];

function HowItWorksStory({ copy }: { copy: (key: string) => string }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const scenes = [
    { eyebrow: '01 — Begin anywhere', title: 'Start with the feeling.', body: 'Tell us what home means to you, then let the right places rise to the surface. The process is meant to feel fun and relieving—we care about your convenience, and we are genuinely happy to have you here.', cta: 'Tap Search and see the magic unfold.', image: '/properties/story-begin.jpg', tag: 'Homes · Kigali' },
    { eyebrow: '02 — See it clearly', title: 'Every detail, in focus.', body: 'Move from the wide view to the small things that make a place feel like yours. We want you to live in the house of your dreams, work in the office of your dreams, and drive your dream car.', cta: '', image: '/properties/story-detail.jpg', tag: 'Thoughtful details' },
    { eyebrow: '03 — Know your place', title: 'A neighbourhood with a rhythm.', body: 'Explore the streets, essentials and energy around every listing before you visit. Use your finger to move through the house, keep exploring each room, and enjoy the feeling of viewing your next home before you arrive.', cta: '', image: '/properties/kigali-neighborhood.jpg', tag: 'Explore Kigali' },
    { eyebrow: '04 — Take the next step', title: 'Make it yours.', body: 'When it feels right, connect with a verified owner or agent and move forward with confidence. You will receive thoughtful service and a smooth, welcoming experience. If you want to become an agent or landlord on the platform, you are welcome here too—with the tools and support to get what you want from your property journey.', cta: '', image: '/properties/story-next-step.jpg', tag: 'Ready when you are' },
  ];

  useEffect(() => {
    const updateProgress = () => {
      const section = sectionRef.current;
      if (!section) return;
      const travel = Math.max(section.offsetHeight - window.innerHeight, 1);
      const nextProgress = Math.min(1, Math.max(0, -section.getBoundingClientRect().top / travel));
      setProgress((current) => Math.abs(current - nextProgress) > 0.002 ? nextProgress : current);
    };
    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    return () => { window.removeEventListener('scroll', updateProgress); window.removeEventListener('resize', updateProgress); };
  }, []);

  const activeIndex = Math.min(scenes.length - 1, Math.floor(progress * scenes.length));
  const activeScene = scenes[activeIndex];

  return <section ref={sectionRef} className="scroll-story" id="story" style={{ '--story-progress': progress } as CSSProperties}>
    <div className="scroll-story-inner container">
      <div className="scroll-story-intro">
        <p className="eyebrow">{copy('A better way to look')}</p>
        <h2>{copy('The search')}<br /><em>{copy('comes alive.')}</em></h2>
        <p>{copy('Scroll through a simpler way to find the place that feels like home.')}</p>
        <div className="scroll-story-progress" aria-label="Story progress">{scenes.map((scene, index) => <span key={scene.eyebrow} className={index <= activeIndex ? 'is-active' : ''} />)}</div>
      </div>
      <div className="scroll-story-steps">
        {scenes.map((scene, index) => <article className={`scroll-story-step ${index === activeIndex ? 'is-active' : ''}`} key={scene.eyebrow}>
          <span className="scroll-story-step-index">{scene.eyebrow}</span>
          <h3>{copy(scene.title)}</h3>
          <p>{copy(scene.body)}{scene.cta && <> <a className="scroll-story-cta" href="/categories/houses">{copy(scene.cta)} <Icon name="arrow" size={13} /></a></>}</p>
        </article>)}
      </div>
      <div className="scroll-story-visual-wrap">
        <div className="scroll-story-visual">
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
  const [language, setLanguage] = useState<Language>('English');
  const { darkMode, toggleTheme } = usePersistentTheme();
  const copy = (key: string) => t(language, key);

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem('umutungo-language') as Language | null;
    if (storedLanguage && ['English', 'French', 'Kinyarwanda', 'Swahili'].includes(storedLanguage)) setLanguage(storedLanguage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = ({ English: 'en', French: 'fr', Kinyarwanda: 'rw', Swahili: 'sw' } as Record<Language, string>)[language];
  }, [language]);

  const changeLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem('umutungo-language', nextLanguage);
  };

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
  return <main className="standalone-page how-page">
    <section className="standalone-hero how-page-hero"><div className="container standalone-hero-grid"><div><p className="eyebrow">{copy('How Umutungo works')}</p><h1>{copy('Umutungo is a platform to help people get their dream living places and other properties.')}</h1><p>{copy('We are here for everyone who wants a place to live — the easy, trusted and comfortable way.')}</p><a className="button button-primary" href="/categories/houses">{copy('Explore spaces')} <Icon name="arrow" size={15} /></a></div><div className="journey-orbit"><div className="orbit-ring orbit-ring-one" /><div className="orbit-ring orbit-ring-two" /><span className="orbit-center"><Icon name="home" size={28} /></span><span className="orbit-node orbit-node-one">Search</span><span className="orbit-node orbit-node-two">Compare</span><span className="orbit-node orbit-node-three">Move in</span></div></div></section>
    <HowItWorksStory copy={copy} />
    <section className="journey-banner"><div className="container journey-banner-inner"><div><p className="eyebrow">{copy('Made for Rwanda')}</p><h2>{copy('Rooted in how we live')}</h2></div><Link className="text-arrow-link" href="/categories">{copy('Browse by category')} <Icon name="arrow" size={15} /></Link></div></section>
  </main>;
}

function AboutPage({ copy }: { copy: (key: string) => string }) {
  return <main className="standalone-page about-page">
    <section className="standalone-hero about-page-hero"><div className="container about-hero-layout"><div className="about-hero-copy"><p className="eyebrow">{copy('People first')}</p><h1>{copy('Property search,')}<br /><em>{copy('made clearer.')}</em></h1><p>{copy('We are building a more human way to discover homes, land and spaces in Rwanda — with the details people need before they make a decision.')}</p><div className="about-hero-actions"><a className="button button-primary" href="/#properties">{copy('Find a property')} <Icon name="arrow" size={15} /></a><a className="about-text-link" href="#about-story">{copy('Our story')} <Icon name="arrow" size={14} /></a></div><div className="about-hero-meta"><span>{copy('Made for Rwanda')}</span><span>Kigali · Rwanda</span><span>{copy('Homes · land · spaces')}</span></div></div><div className="about-portrait" style={{ backgroundImage: "linear-gradient(180deg, transparent, rgba(10, 31, 17, .74)), url('/properties/kigali-neighborhood.jpg')" }}><span>{copy('A clearer place to begin')}</span><strong>01</strong></div></div></section>
    <section id="about-story" className="standalone-section about-story-section"><div className="container about-story-grid"><div className="standalone-heading"><p className="eyebrow">{copy('Our story')}</p><h2>{copy('A place for every story')}</h2><div className="about-story-marker"><span>U</span><small>{copy('Umutungo means property, belonging and possibility.')}</small></div></div><div className="about-story-copy"><p>{copy('Finding a home is never only about walls, rooms or an address. It is about the morning routine, the people nearby, the budget that has to work, and the feeling that a place could become yours.')}</p><p>{copy('That is why Umutungo is designed around real decisions, not just listings. We bring the useful details closer together so renters, buyers, owners and commissioners can have better conversations from the start.')}</p><p>{copy('We are still building, listening and learning. Every clearer listing, honest question and confident next step helps shape the platform we want to share with Rwanda.')}</p><a className="button button-primary" href="/#properties">{copy('Start exploring')} <Icon name="arrow" size={15} /></a></div></div></section>
    <section className="about-people-section"><div className="container"><div className="about-section-heading"><div><p className="eyebrow">{copy('Who Umutungo is for')}</p><h2>{copy('One place, different journeys.')}</h2></div><p>{copy('A good property experience should feel useful whether you are searching, sharing a space, or helping someone move forward.')}</p></div><div className="about-people-grid"><article><span className="about-people-icon"><Icon name="search" size={18} /></span><small>01</small><h3>{copy('For people searching')}</h3><p>{copy('Compare homes, land and spaces with clearer information about location, price and the details that matter to your everyday life.')}</p></article><article><span className="about-people-icon"><Icon name="home" size={18} /></span><small>02</small><h3>{copy('For owners and landlords')}</h3><p>{copy('Share a property in a way that answers the important questions early and brings more prepared enquiries to you.')}</p></article><article><span className="about-people-icon"><Icon name="users" size={18} /></span><small>03</small><h3>{copy('For commissioners')}</h3><p>{copy('Keep property conversations organised, guide clients with confidence and make each viewing more useful.')}</p></article></div></div></section>
    <section className="values-section"><div className="container"><div className="standalone-heading"><p className="eyebrow">{copy('The Umutungo promise')}</p><h2>{copy('Better together')}</h2></div><div className="values-grid"><article><span>01</span><h3>{copy('Easier discovery')}</h3><p>{copy('Spend less time searching and more time finding possibilities that feel right for you.')}</p></article><article><span>02</span><h3>{copy('Information you can trust')}</h3><p>{copy('Clear property details and thoughtful verification will help you take the next step with confidence.')}</p></article><article><span>03</span><h3>{copy('Better together')}</h3><p>{copy('Clients, Komisiyoneri and owners work more effectively when everyone has a clearer view.')}</p></article></div></div></section>
    <section className="about-closing-section"><div className="container about-closing-inner"><div><p className="eyebrow">{copy('Your next chapter starts here')}</p><h2>{copy('Making the journey home')}<br /><em>{copy('feel a little more human.')}</em></h2></div><a className="button button-primary" href="/#properties">{copy('Explore')} <Icon name="arrow" size={15} /></a></div></section>
  </main>;
}

function CategoriesPage({ copy }: { copy: (key: string) => string }) {
  return <main className="standalone-page categories-page">
    <section className="standalone-hero categories-page-hero"><div className="container"><p className="eyebrow">{copy('Browse by category')}</p><h1>{copy('Find your kind')}<br /><em>{copy('of place.')}</em></h1><p>{copy('Choose a starting point, then narrow it down by area, budget and what matters to you.')}</p></div></section>
    <section className="standalone-section categories-directory"><div className="container"><div className="directory-toolbar"><div><p className="eyebrow">{copy('Explore spaces')}</p><h2>{copy('A place for every story')}</h2></div><span>06 {copy('categories')}</span></div><div className="directory-grid">{categoryCards.map((category, index) => <Link className={`directory-card directory-card-${category.accent}`} href={`/categories/${category.slug}`} key={category.slug}><span className="directory-card-image" style={{ backgroundImage: `linear-gradient(180deg, transparent 30%, rgba(5, 15, 8, .78)), url(${category.image})` }} /><span className="directory-card-index">0{index + 1}</span><span className="directory-card-copy"><strong>{copy(category.name)}</strong><small>{copy(category.detail)}</small><Icon name="arrow" size={16} /></span></Link>)}</div></div></section>
  </main>;
}
