'use client';

import { FormEvent, useEffect, useRef, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import { AiChatbot } from '../components/AiChatbot';
import { Footer } from '../components/Footer';
import { Icon } from '../components/Icons';
import { Navbar } from '../components/Navbar';
import { PropertyCard, PropertyPlaceholder } from '../components/PropertyCard';
import { PropertyViewer } from '../components/PropertyViewer';
import { PropertySearch } from '../components/PropertySearch';
import { ReviewPanel } from '../components/ReviewPanel';
import { Language, t } from '../data/translations';
import { listFavorites, removeFavorite, saveFavorite, type FavoriteItem } from '../lib/umutungoApi';
import { usePersistentLanguage } from '../lib/language';
import { usePersistentTheme } from '../lib/theme';

const properties: PropertyPlaceholder[] = [
  { id: 'gisozi-home', title: 'Four-bedroom home with garden', type: 'House', location: 'Gisozi - Kigali', price: 'RWF 1,250,000', priceNote: '/ month', bedrooms: 4, bathrooms: 3, area: 220, accent: '#087d3d', image: '/properties/house-01.jpg', images: ['/properties/house-01.jpg', '/properties/house-02.jpg', '/properties/tour-living.jpg', '/properties/tour-kitchen.jpg', '/properties/tour-bedroom-real.jpg'], listed: 'Listed 4 days ago' },
  { id: 'nyarutarama-home', title: 'Five-bedroom family residence', type: 'House', location: 'Nyarutarama - Kigali', price: 'RWF 2,400,000', priceNote: '/ month', bedrooms: 5, bathrooms: 4, area: 310, accent: '#6d8d6f', image: '/properties/house-02.jpg', images: ['/properties/house-02.jpg', '/properties/house-01.jpg', '/properties/tour-living.jpg', '/properties/tour-kitchen.jpg', '/properties/tour-bedroom-real.jpg'], listed: 'Listed 2 weeks ago' },
  { id: 'kacyiru-apartment', title: 'Light-filled Kacyiru apartment', type: 'Apartment', location: 'Kacyiru - Kigali', price: 'RWF 1,100,000', priceNote: '/ month', bedrooms: 2, bathrooms: 2, area: 118, accent: '#b17c5b', image: '/properties/apartment-01.jpg', images: ['/properties/apartment-01.jpg', '/properties/tour-living.jpg', '/properties/tour-kitchen.jpg', '/properties/tour-bedroom-real.jpg', '/properties/apartment-02.jpg'], listed: 'Listed yesterday' },
  { id: 'kimihurura-apartment', title: 'Modern apartment near Kimihurura', type: 'Apartment', location: 'Kimihurura - Kigali', price: 'RWF 1,650,000', priceNote: '/ month', bedrooms: 3, bathrooms: 2, area: 145, accent: '#7f8f77', image: '/properties/apartment-02.jpg', images: ['/properties/apartment-02.jpg', '/properties/apartment-01.jpg', '/properties/tour-living.jpg', '/properties/tour-kitchen.jpg', '/properties/tour-bedroom-real.jpg'], listed: 'Listed 3 days ago' },
  { id: 'gacuriro-land', title: 'Residential plot in Gacuriro', type: 'Land', location: 'Gacuriro - Kigali', price: 'RWF 85,000,000', priceNote: ' asking', bedrooms: 0, bathrooms: 0, area: 620, accent: '#788f55', image: '/properties/land-01.jpg', images: ['/properties/land-01.jpg'], listed: 'Listed 5 days ago' },
  { id: 'remera-commercial', title: 'Street-facing commercial space', type: 'Commercial', location: 'Remera - Kigali', price: 'RWF 1,900,000', priceNote: '/ month', bedrooms: 0, bathrooms: 1, area: 180, accent: '#8a674d', image: '/properties/commercial-01.jpg', images: ['/properties/commercial-01.jpg', '/properties/commercial-02.jpg'], listed: 'Listed 1 week ago' },
  { id: 'kicukiro-workspace', title: 'Flexible office in Kicukiro', type: 'Commercial', location: 'Kicukiro - Kigali', price: 'RWF 2,250,000', priceNote: '/ month', bedrooms: 0, bathrooms: 2, area: 240, accent: '#516d75', image: '/properties/commercial-02.jpg', images: ['/properties/commercial-02.jpg', '/properties/commercial-01.jpg'], listed: 'Listed 2 weeks ago' },
];

const categories = [
  { name: 'Residential houses', slug: 'houses', detail: 'Family houses and places to rent.', image: '/properties/house-01.jpg' },
  { name: 'Apartments', slug: 'apartments', detail: 'Easy city living in Kigali.', image: '/properties/apartment-01.jpg' },
  { name: 'Land', slug: 'land', detail: 'Plots for your next project.', image: '/properties/land-01.jpg' },
  { name: 'Commercial buildings', slug: 'commercial', detail: 'Shops and commercial spaces.', image: '/properties/commercial-01.jpg' },
  { name: 'Offices', slug: 'offices', detail: 'Flexible workspaces for teams.', image: '/properties/commercial-02.jpg' },
  { name: 'Hotels and lodges', slug: 'hospitality', detail: 'Stays, lodges, and bookable rooms.', image: '/properties/apartment-02.jpg' },
  { name: 'Vehicles', slug: 'vehicles', detail: 'Vehicles for sale or hire.', image: '/properties/vehicle-01.png' },
  { name: 'Furniture', slug: 'furniture', detail: 'Furniture for homes and spaces.', image: '/properties/tour-living.jpg' },
  { name: 'Appliances', slug: 'appliances', detail: 'Useful appliances from local sellers.', image: '/properties/tour-kitchen.jpg' },
  { name: 'Equipment', slug: 'equipment', detail: 'Tools and equipment for every project.', image: '/properties/commercial-02.jpg' },
  { name: 'Other assets', slug: 'other', detail: 'Other rentable, sellable, or bookable assets.', image: '/properties/story-detail.jpg' },
];

const neighbourhoods = [
  { name: 'Nyarutarama', note: 'Leafy streets and larger homes.', image: '/properties/house-02.jpg' },
  { name: 'Kacyiru', note: 'Close to offices and embassies.', image: '/properties/apartment-01.jpg' },
  { name: 'Kimihurura', note: 'Restaurants, offices and city life.', image: '/properties/apartment-02.jpg' },
  { name: 'Remera', note: 'Good transport and everyday essentials.', image: '/properties/commercial-01.jpg' },
  { name: 'Gacuriro', note: 'Newer homes and quieter streets.', image: '/properties/land-01.jpg' },
];

const categoryTypes: Record<string, string> = { Homes: 'House', Apartments: 'Apartment', Land: 'Land', 'Commercial spaces': 'Commercial' };

function ScrollStory({ copy }: { copy: (key: string) => string }) {
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
          <span className="scroll-story-step-index">{copy(scene.eyebrow)}</span>
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

export default function HomePage() {
  const { darkMode, toggleTheme } = usePersistentTheme();
  const { language, changeLanguage } = usePersistentLanguage();
  const [location, setLocation] = useState('Kigali');
  const [district, setDistrict] = useState('');
  const [sector, setSector] = useState('');
  const [type, setType] = useState('Any type');
  const [intent, setIntent] = useState('Buy or rent');
  const [priceRange, setPriceRange] = useState('Any price');
  const [directoryQuery, setDirectoryQuery] = useState('');
  const [searchMessage, setSearchMessage] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<PropertyPlaceholder | null>(null);
  const copy = (key: string) => t(language, key);

  useEffect(() => {
  }, []);

  useEffect(() => {
    const localeMap: Record<string, string> = { English: 'en', French: 'fr', Kinyarwanda: 'rw', Swahili: 'sw' };
    document.documentElement.lang = localeMap[language] ?? 'en';
  }, [language]);

  useEffect(() => {
    const readLocalFavorites = () => {
      try {
        const stored = JSON.parse(window.localStorage.getItem('umutungo-favorites') ?? '[]') as FavoriteItem[];
        const items = Array.isArray(stored) ? stored : [];
        setFavoriteItems(items);
        setFavorites(items.map((item) => item.property_id));
      } catch {
        setFavoriteItems([]);
        setFavorites([]);
      }
    };
    readLocalFavorites();
    const onFavoritesChanged = () => readLocalFavorites();
    window.addEventListener('umutungo:favorites-changed', onFavoritesChanged);
    void listFavorites().then((remote) => {
      if (remote === null) return;
      setFavoriteItems(remote);
      setFavorites(remote.map((item) => item.property_id));
      window.localStorage.setItem('umutungo-favorites', JSON.stringify(remote));
      window.dispatchEvent(new Event('umutungo:favorites-changed'));
    }).catch(() => undefined);
    return () => window.removeEventListener('umutungo:favorites-changed', onFavoritesChanged);
  }, []);

  const requestSignIn = (role: 'Tenant' | 'Commissioner / Komisiyoneri') => window.dispatchEvent(new CustomEvent('umutungo:request-sign-in', { detail: { role } }));
  const requestTenantSignIn = () => window.dispatchEvent(new CustomEvent('umutungo:request-sign-in', { detail: { role: 'Tenant', returnTo: '/tenant' } }));
  const submitDirectorySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    window.location.assign(`/directory${directoryQuery.trim() ? `?search=${encodeURIComponent(directoryQuery.trim())}` : ''}`);
  };
  const submitSearch = () => {
    if ((intent === 'Buy' || intent === 'Rent') && !window.localStorage.getItem('umutungo-demo-user')) { requestTenantSignIn(); return; }
    const categorySlugs: Record<string, string> = { House: 'houses', Apartment: 'apartments', Land: 'land', Commercial: 'commercial' };
    const shopSlug = categorySlugs[type] ?? 'houses';
    const params = new URLSearchParams({ location, intent, priceRange });
    if (district) params.set('district', district);
    if (sector) params.set('sector', sector);
    window.location.assign(`/categories/${shopSlug}?${params.toString()}`);
  };

  const toggleFavorite = (property: PropertyPlaceholder) => {
    const item: FavoriteItem = { property_id: property.id, title: property.title, type: property.type, location: property.location, price: `${property.price} ${property.priceNote}`, image: property.image };
    const wasSaved = favorites.includes(property.id);
    const nextItems = wasSaved ? favoriteItems.filter((favorite) => favorite.property_id !== property.id) : [...favoriteItems, item];
    setFavoriteItems(nextItems);
    setFavorites(nextItems.map((favorite) => favorite.property_id));
    window.localStorage.setItem('umutungo-favorites', JSON.stringify(nextItems));
    window.dispatchEvent(new Event('umutungo:favorites-changed'));
    void (wasSaved ? removeFavorite(property.id) : saveFavorite(item)).catch(() => undefined);
  };
  const selectCategory = (category: typeof categories[number]) => {
    window.location.assign(`/categories/${category.slug}`);
  };
  const visibleProperties = properties.filter((property) => {
    const matchesCategory = !selectedCategory || property.type === categoryTypes[selectedCategory];
    const matchesType = type === 'Any type' || property.type === type;
    const matchesLocation = location === 'Kigali' || property.location.toLowerCase().includes(location.toLowerCase());
    const matchesDistrict = !district || property.location.toLowerCase().includes(district.toLowerCase());
    const matchesSector = !sector || property.location.toLowerCase().includes(sector.toLowerCase());
    const isRental = property.priceNote.includes('/ month');
    const matchesIntent = intent === 'Buy or rent' || (intent === 'Rent' && isRental) || (intent === 'Buy' && !isRental);
    const numericPrice = Number(property.price.replace(/[^0-9]/g, ''));
    const matchesPrice = priceRange === 'Any price' || (priceRange === 'Under RWF 500,000' && numericPrice < 500000) || (priceRange === 'RWF 500,000 - 1,000,000' && numericPrice >= 500000 && numericPrice <= 1000000) || (priceRange === 'Over RWF 1,000,000' && numericPrice > 1000000);
    return matchesCategory && matchesType && matchesLocation && matchesDistrict && matchesSector && matchesIntent && matchesPrice;
  });

  return <div className={`${darkMode ? 'app theme-dark' : 'app'} app-realistic`}>
    <Navbar darkMode={darkMode} onToggleTheme={toggleTheme} language={language} onLanguageChange={changeLanguage} />
    <AiChatbot language={language} />
    <main>
      <section className="hero-section" id="home">
        <div className="hero-image"><Image className="hero-image-photo" src="/landingog.png" alt="Kigali cityscape" fill priority quality={82} sizes="100vw" /><div className="hero-image-overlay" /><div className="container hero-content"><div className="hero-copy">
          <h1>Discover, list, and manage every kind of property in Rwanda.</h1>
          <div className="landing-search-actions"><form className="landing-directory-search" onSubmit={submitDirectorySearch}><Icon name="search" size={16} /><input aria-label="Describe the property you want" value={directoryQuery} onChange={(event) => setDirectoryQuery(event.target.value)} placeholder="Search for a property you want to get here" /><button type="submit" aria-label="Search properties"><Icon name="arrow" size={15} /></button></form><a className="landing-view-all-properties" href="/categories/houses">View all properties</a></div>
          <p className="hero-lead">Umutungo connects property owners, landlords, commissioners, and customers through one trusted marketplace for real estate, land, vehicles, accommodation, furniture, appliances, and equipment.</p>
          <div className="hero-actions"><a className="button button-primary" href="/register?role=Komisiyoneri">Join as Komisiyoneri <Icon name="arrow" size={16} /></a><a className="button button-secondary" href="/register?role=Landlord">Join as Landlord <Icon name="arrow" size={16} /></a><a className="button button-commissioner" href="/register?role=Property%20Owner">Join as Property Owner <Icon name="arrow" size={16} /></a></div>
        </div></div></div>
        <div className="landing-search-board"><div className="container hero-search-wrap"><PropertySearch language={language} location={location} district={district} sector={sector} type={type} intent={intent} priceRange={priceRange} onLocationChange={(value) => { setLocation(value); setDistrict(''); setSector(''); }} onDistrictChange={(value) => { setDistrict(value); setSector(''); }} onSectorChange={setSector} onTypeChange={setType} onIntentChange={(value) => { setIntent(value); if ((value === 'Buy' || value === 'Rent') && !window.localStorage.getItem('umutungo-demo-user')) requestTenantSignIn(); }} onPriceRangeChange={setPriceRange} onSubmit={submitSearch} /></div></div>
      </section>

      <section className="category-section section container" id="categories">
        <div className="section-heading split-heading"><div><p className="eyebrow">Browse Categories</p><h2>Find every kind<br /><em>of property.</em></h2></div><p className="section-description">Explore homes, land, vehicles, accommodation, furniture, appliances, equipment, and other assets in one trusted marketplace.</p></div>
        <div className="category-grid premium-category-grid">{categories.map((category) => <a className="premium-category-card" href={`/categories/${category.slug}`} key={category.slug}><span className="premium-category-image" style={{ backgroundImage: `url(${category.image})` }} /><span className="premium-category-copy"><strong>{category.name}</strong><small>{category.detail}</small><Icon name="arrow" size={15} /></span></a>)}</div>
      </section>

      <section className="section section-property container" id="properties">
        <div className="section-heading split-heading"><div><p className="eyebrow">{selectedCategory ? copy('Category view') : copy('Featured properties')}</p><h2>{selectedCategory ? <>{copy(selectedCategory)}<br /><em>{copy('properties.')}</em></> : `${copy('Places worth')} ${copy('a closer look.')}`}</h2></div><p className={`section-description ${selectedCategory ? '' : 'featured-properties-description'}`}>{selectedCategory ? `${visibleProperties.length} ${copy('properties found in this category.')}` : 'A small selection of homes currently available in Kigali, personalised to you. Check it out.'}</p></div>
        {searchMessage && <div className="search-feedback" role="status"><Icon name="check" size={16} /> {searchMessage}</div>}
        <div className="property-grid">{visibleProperties.map((property) => <PropertyCard key={property.id} language={language} property={property} favorite={favorites.includes(property.id)} onFavorite={() => toggleFavorite(property)} onView={() => setSelectedProperty(property)} />)}</div>
        {selectedCategory && <button className="category-reset" type="button" onClick={() => { setSelectedCategory(''); setType('Any type'); }}>{copy('Show all properties')}</button>}
      </section>

      {false && <section className="info-section how-it-works-section" id="how-it-works">
        <div className="container">
          <div className="section-heading split-heading"><div><p className="eyebrow">{copy('How Umutungo works')}</p><h2>{copy('Find where')}<br /><em>{copy('you belong.')}</em></h2></div><p className="section-description">{copy('We are here for everyone who wants a place to live — the easy, trusted and comfortable way.')}</p></div>
          <div className="process-grid">
            <article className="process-card"><span className="process-number">01</span><Icon name="search" size={22} /><h3>{copy('Easy to explore')}</h3><p>{copy('Clear places, clear next steps')}</p></article>
            <article className="process-card"><span className="process-number">02</span><Icon name="check" size={22} /><h3>{copy('Built on trust')}</h3><p>{copy('Better information for everyone')}</p></article>
            <article className="process-card"><span className="process-number">03</span><Icon name="globe" size={22} /><h3>{copy('Made for Rwanda')}</h3><p>{copy('Rooted in how we live')}</p></article>
          </div>
          <a className="text-arrow-link" href="#properties">{copy('Explore spaces')} <Icon name="arrow" size={15} /></a>
        </div>
       </section>}

      <section className="info-section about-section" id="about">
        <div className="container about-interface"><div className="about-panel"><p className="eyebrow">{copy('Why Umutungo')}</p><h2>{copy('Property search,')}<br /><em>{copy('made clearer.')}</em></h2><p>{copy('The useful details, in one place, so the next step feels easier.')}</p><a className="button button-primary" href="#properties">{copy('Find a property')} <Icon name="arrow" size={15} /></a></div><div className="about-feature-list"><article><Icon name="check" size={20} /><div><h3>{copy('Verified listings')}</h3><p>{copy('Clear details on the places we feature.')}</p></div></article><article><Icon name="users" size={20} /><div><h3>{copy('Local agents')}</h3><p>{copy('Speak to people who know the area and the market.')}</p></div></article><article><Icon name="heart" size={20} /><div><h3>{copy('Compare with ease')}</h3><p>{copy('See price, space and location before you visit.')}</p></div></article></div></div>
      </section>

      <section className="contact-interface" id="contact">
        <div className="container contact-interface-grid"><div><p className="eyebrow">{copy('Connect')}</p><h2>{copy('Every place has a story.')}<br /><em>{copy('Let’s help you find yours.')}</em></h2><p className="contact-interface-copy">{copy('We are building a property experience where every person in the journey can move with more clarity and confidence.')}</p><a className="contact-email" href="mailto:hello@umutungo.rw">hello@umutungo.rw <Icon name="arrow" size={15} /></a></div><form className="contact-interface-form" action="mailto:hello@umutungo.rw" method="post" encType="text/plain"><label><span>{copy('Name')}</span><input name="name" placeholder={copy('Your name')} required /></label><label><span>{copy('Email address')}</span><input name="email" type="email" placeholder="you@example.com" required /></label><label><span>{copy('Message')}</span><textarea name="message" placeholder={copy('How can we help?')} rows={4} required /></label><button className="button button-primary" type="submit">{copy('Send message')} <Icon name="arrow" size={15} /></button></form></div>
      </section>

      {false && <section className="neighbourhood-section section container" id="explore">
        <div className="section-heading split-heading"><div><p className="eyebrow">{copy('Explore Kigali')}</p><h2>{copy('Look around')}<br /><em>{copy('the neighbourhoods.')}</em></h2></div><p className="section-description">{copy('Get a feel for the areas people choose for home, work and everyday life.')}</p></div>
        <div className="neighbourhood-grid">{neighbourhoods.map((neighbourhood, index) => <a className={`neighbourhood-card neighbourhood-card-${index + 1}`} href="#properties" key={neighbourhood.name} style={{ backgroundImage: `linear-gradient(180deg, rgba(8, 20, 11, .05), rgba(8, 20, 11, .78)), url(${neighbourhood.image})` }}><span><strong>{copy(neighbourhood.name)}</strong><small>{copy(neighbourhood.note)}</small></span><Icon name="arrow" size={17} /></a>)}</div>
       </section>}

      <section className="stats-section"><div className="container stats-grid"><div><strong>1,200+</strong><span>{copy('properties listed')}</span></div><div><strong>300+</strong><span>{copy('verified agents')}</span></div><div><strong>15</strong><span>{copy('districts covered')}</span></div></div></section>

      <ReviewPanel language={language} />
    </main>
    <Footer language={language} darkMode={darkMode} />
    {selectedProperty && <PropertyViewer language={language} property={selectedProperty} onClose={() => setSelectedProperty(null)} />}
  </div>;
}
