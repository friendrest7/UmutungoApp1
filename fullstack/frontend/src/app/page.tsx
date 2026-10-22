'use client';

import { useEffect, useState } from 'react';
import { AiChatbot } from '../components/AiChatbot';
import { Footer } from '../components/Footer';
import { Icon, type IconName } from '../components/Icons';
import { Navbar } from '../components/Navbar';
import { PropertyCard, PropertyPlaceholder } from '../components/PropertyCard';
import { ConversationalPropertySearch } from '../components/ConversationalPropertySearch';
import { Language, t } from '../data/translations';
import { listFavorites, publicUmutungoApi, removeFavorite, saveFavorite, type FavoriteItem } from '../lib/umutungoApi';
import { toProperty, type ApiListing } from '../lib/listings';
import { usePersistentLanguage } from '../lib/language';
import { usePersistentTheme } from '../lib/theme';

const landingPriceRanges = [
  { label: '0–300,000', min: 0, max: 300_000 },
  { label: '300,000–500,000', min: 300_000, max: 500_000 },
  { label: '500,000–1,000,000', min: 500_000, max: 1_000_000 },
  { label: '1,000,000–10,000,000', min: 1_000_000, max: 10_000_000 },
  { label: '10,000,000+', min: 10_000_000, max: null },
];
export default function HomePage() {
  const { darkMode, toggleTheme } = usePersistentTheme();
  const { language, changeLanguage } = usePersistentLanguage();
  const [properties, setProperties] = useState<PropertyPlaceholder[]>([]);
  const [listingLoadError, setListingLoadError] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [selectedListingCategory, setSelectedListingCategory] = useState<string | null>(null);
  const [selectedPriceRange, setSelectedPriceRange] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const copy = (key: string) => t(language, key);

  useEffect(() => {
    let cancelled = false;
    const loadListings = () => {
      void publicUmutungoApi<{ items: ApiListing[] }>('/api/v1/listings', { cache: 'no-store' })
        .then((result) => { if (!cancelled) { setListingLoadError(false); setProperties((result?.items ?? []).filter((item) => item.images?.some(Boolean) || item.media?.some((media) => Boolean(media.url))).map(toProperty)); } })
        .catch(() => { if (!cancelled) { setProperties([]); setListingLoadError(true); } });
    };
    loadListings();
    window.addEventListener('umutungo:listings-changed', loadListings);
    return () => { cancelled = true; window.removeEventListener('umutungo:listings-changed', loadListings); };
  }, []);

  useEffect(() => {
    const syncSignIn = () => {
      try {
        setSignedIn(Boolean(JSON.parse(window.localStorage.getItem('umutungo-demo-user') ?? 'null')));
      } catch { setSignedIn(false); }
    };
    syncSignIn();
    window.addEventListener('umutungo:auth-changed', syncSignIn);
    window.addEventListener('storage', syncSignIn);
    return () => { window.removeEventListener('umutungo:auth-changed', syncSignIn); window.removeEventListener('storage', syncSignIn); };
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
  const visibleProperties = properties;
  const listingCategories = [
    { name: 'Residential houses', slug: 'houses', types: ['house'] }, { name: 'Apartments', slug: 'apartments', types: ['apartment'] },
    { name: 'Land', slug: 'land', types: ['land'] }, { name: 'Commercial buildings', slug: 'commercial', types: ['commercial'] },
    { name: 'Offices', slug: 'offices', types: ['office'] }, { name: 'Hotels and lodges', slug: 'hospitality', types: ['hospitality'] },
    { name: 'Vehicles', slug: 'vehicles', types: ['vehicle'] }, { name: 'Furniture', slug: 'furniture', types: ['furniture'] },
    { name: 'Appliances', slug: 'appliances', types: ['appliance'] }, { name: 'Equipment', slug: 'equipment', types: ['equipment'] },
    { name: 'Other assets', slug: 'other', types: ['other'] },
  ];
  const propertyCategories = listingCategories.filter((category) => !selectedListingCategory || category.slug === selectedListingCategory).map((category) => {
    const liveListings = visibleProperties.filter((property) => category.types.includes(property.type.toLowerCase()));
    const listings = liveListings.filter((property) => {
      if (!selectedPriceRange) return true;
      const range = landingPriceRanges.find((item) => item.label === selectedPriceRange);
      const amount = Number(property.price.replace(/[^\d]/g, ''));
      if (!range || !Number.isFinite(amount)) return false;
      return range.max === null ? amount > range.min : range.min === 0 ? amount <= range.max : amount > range.min && amount <= range.max;
    });
    return { ...category, listings };
  });
  const landingListings = propertyCategories.flatMap((category) => category.listings);

  return <div className={`${darkMode ? 'app theme-dark' : 'app'} app-realistic`}>
    <Navbar darkMode={darkMode} onToggleTheme={toggleTheme} language={language} onLanguageChange={changeLanguage} />
    <AiChatbot language={language} />
    <main>
      <section className="hero-section" id="home">
        <div className="hero-image hero-has-video"><video className="hero-video" autoPlay muted loop playsInline preload="metadata" poster="/properties/land-01.jpg" aria-hidden="true"><source src="/properties/land.mp4" type="video/mp4" /></video><div className="hero-image-overlay" /><div className="container hero-content"><div className="hero-copy">
          <h1 className="landing-search-heading">{t(language, 'You are on Umutungo, you can find different properties')} <a className="button landing-properties-cta" href="/categories/properties">{t(language, 'here')}</a>.</h1>
          <div className="landing-conversational-search"><ConversationalPropertySearch language={language} compact /></div>
          {!signedIn && <div className="hero-role-join" aria-label="Join Umutungo"><a className="button" href="/register?role=Komisiyoneri">{t(language, 'Join as Komisiyoneri')}</a><a className="button" href="/register?role=Property%20Owner">{t(language, 'Join as Property Owner')}</a><a className="button" href="/register?role=Landlord">{t(language, 'Join as Landlord')}</a></div>}
        </div></div>
        </div>
      </section>

      <section className="section section-property container" id="properties">
        <div className="landing-discovery-panel">
          <div className="landing-discovery-intro"><h2>{t(language, 'Explore Umutungo and find a property that fits your plans.')}</h2><p>{t(language, 'Browse homes, land, vehicles, furniture and more across Rwanda. Choose a category and price range to explore the available listings.')}</p></div>
        <div className="landing-category-filter" aria-label={t(language, 'Filter properties by category')}>
          <button type="button" className={selectedListingCategory === null ? 'is-selected' : ''} aria-pressed={selectedListingCategory === null} onClick={() => setSelectedListingCategory(null)}><Icon name="building" size={18} /><span>{t(language, 'All')}</span></button>
          {listingCategories.map((category) => {
            const icon: IconName = category.slug === 'houses' || category.slug === 'hospitality' ? 'home' : category.slug === 'land' ? 'leaf' : category.slug === 'vehicles' ? 'car' : category.slug === 'appliances' ? 'appliance' : category.slug === 'equipment' ? 'wrench' : 'building';
            return <button key={category.slug} type="button" className={selectedListingCategory === category.slug ? 'is-selected' : ''} aria-pressed={selectedListingCategory === category.slug} onClick={() => setSelectedListingCategory((current) => current === category.slug ? null : category.slug)}><Icon name={icon} size={18} /><span>{t(language, category.name)}</span></button>;
          })}
        </div>
        <div className="landing-price-filter" aria-label={t(language, 'Filter properties by price range')}>
          <span>{t(language, 'Price range')}</span>
          <div className="landing-price-options">
            {landingPriceRanges.map((range) => <button key={range.label} type="button" className={selectedPriceRange === range.label ? 'is-selected' : ''} aria-pressed={selectedPriceRange === range.label} onClick={() => setSelectedPriceRange((current) => current === range.label ? null : range.label)}>{range.label}</button>)}
          </div>
        </div>
        </div>
        {landingListings.length > 0 && <div className="property-grid landing-property-grid">{landingListings.map((property) => <PropertyCard key={property.id} language={language} property={property} favorite={favorites.includes(property.id)} onFavorite={() => toggleFavorite(property)} />)}</div>}
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

      <section className="contact-interface" id="contact">
        <div className="container contact-interface-grid"><div><h2>{copy('Need help with your property search?')}<br /><em>{copy('Contact the Umutungo')} <a className="contact-team-link" href="https://mail.google.com/mail/?view=cm&fs=1&to=hello%40umutungo.rw" target="_blank" rel="noreferrer"><span className="contact-team-link-label">{copy('team')}</span><Icon name="arrow" size={15} /></a></em></h2><p className="contact-interface-copy">{copy('We are building a property experience where every person in the journey can move with more clarity and confidence.')}</p><a className="contact-email" href="mailto:hello@umutungo.rw">hello@umutungo.rw <Icon name="arrow" size={15} /></a></div><form className="contact-interface-form" action="mailto:hello@umutungo.rw" method="post" encType="text/plain"><label><span>{copy('Name')}</span><input name="name" placeholder={copy('Your name')} required /></label><label><span>{copy('Email address')}</span><input name="email" type="email" placeholder="you@example.com" required /></label><label><span>{copy('Message')}</span><textarea name="message" placeholder={copy('How can we help?')} rows={4} required /></label><button className="button button-primary" type="submit">{copy('Send message')} <Icon name="arrow" size={15} /></button></form></div>
      </section>

    </main>
    <Footer language={language} darkMode={darkMode} />
  </div>;
}
