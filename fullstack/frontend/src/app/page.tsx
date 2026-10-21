'use client';

import { useEffect, useState } from 'react';
import { AiChatbot } from '../components/AiChatbot';
import { Footer } from '../components/Footer';
import { Icon, type IconName } from '../components/Icons';
import { Navbar } from '../components/Navbar';
import { PropertyCard, PropertyPlaceholder } from '../components/PropertyCard';
import { PropertyViewer } from '../components/PropertyViewer';
import { Language, t } from '../data/translations';
import { testingListings } from '../data/testingListings';
import { listFavorites, publicUmutungoApi, removeFavorite, saveFavorite, type FavoriteItem } from '../lib/umutungoApi';
import { toProperty, type ApiListing } from '../lib/listings';
import { usePersistentLanguage } from '../lib/language';
import { usePersistentTheme } from '../lib/theme';

const categories: { name: string; slug: string; detail: string; icon: IconName }[] = [
  { name: 'Homes', slug: 'houses', detail: 'Houses and homes for sale or rent.', icon: 'home' },
  { name: 'Apartments', slug: 'apartments', detail: 'Easy city living in Kigali.', icon: 'building' },
  { name: 'Land', slug: 'land', detail: 'Plots for your next project.', icon: 'leaf' },
  { name: 'Commercial spaces', slug: 'commercial', detail: 'Shops, offices and workspaces.', icon: 'building' },
  { name: 'Offices', slug: 'offices', detail: 'Professional office properties for teams.', icon: 'building' },
  { name: 'Cars', slug: 'vehicles', detail: 'Cars for sale or hire.', icon: 'car' },
  { name: 'Car parts', slug: 'car-parts', detail: 'Parts and accessories for your car.', icon: 'wrench' },
  { name: 'Home appliances', slug: 'appliances', detail: 'Useful appliances for your home.', icon: 'appliance' },
];
export default function HomePage() {
  const { darkMode, toggleTheme } = usePersistentTheme();
  const { language, changeLanguage } = usePersistentLanguage();
  const [properties, setProperties] = useState<PropertyPlaceholder[]>([]);
  const [listingLoadError, setListingLoadError] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<PropertyPlaceholder | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [testingAccount, setTestingAccount] = useState(false);
  const [testingFirstName, setTestingFirstName] = useState('Umutungo');
  const copy = (key: string) => t(language, key);

  useEffect(() => {
    let cancelled = false;
    void publicUmutungoApi<{ items: ApiListing[] }>('/api/v1/listings', { cache: 'no-store' })
      .then((result) => { if (!cancelled) { setListingLoadError(false); setProperties((result?.items ?? []).filter((item) => item.images?.some(Boolean) || item.media?.some((media) => Boolean(media.url))).map(toProperty)); } })
      .catch(() => { if (!cancelled) { setProperties([]); setListingLoadError(true); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const syncSignIn = () => {
      try {
        const account = JSON.parse(window.localStorage.getItem('umutungo-demo-user') ?? 'null') as { testingAccount?: boolean; testingFirstName?: string } | null;
        setSignedIn(Boolean(account));
        setTestingAccount(account?.testingAccount === true);
        setTestingFirstName(account?.testingFirstName || 'Umutungo');
      } catch { setSignedIn(false); setTestingAccount(false); setTestingFirstName('Umutungo'); }
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
  const propertyCategories = listingCategories.map((category) => {
    const liveListings = visibleProperties.filter((property) => category.types.includes(property.type.toLowerCase())).slice(0, 3);
    const testListings = testingListings.filter((property) => property.categorySlug === category.slug).slice(0, Math.max(0, 3 - liveListings.length)).map((property) => testingAccount ? ({ ...property, poster: { name: testingFirstName, role: 'Property Owner' as const } }) : property);
    return { ...category, listings: [...liveListings, ...testListings] };
  });

  return <div className={`${darkMode ? 'app theme-dark' : 'app'} app-realistic`}>
    <Navbar darkMode={darkMode} onToggleTheme={toggleTheme} language={language} onLanguageChange={changeLanguage} />
    <AiChatbot language={language} />
    <main>
      <section className="hero-section" id="home">
        <div className="hero-image hero-has-video"><video className="hero-video" autoPlay muted loop playsInline preload="metadata" poster="/properties/land-01.jpg" aria-hidden="true"><source src="/properties/land.mp4" type="video/mp4" /></video><div className="hero-image-overlay" /><div className="container hero-content"><div className="hero-copy">
          <h1 className="landing-search-heading">You are on Umutungo, you can find different properties <a className="button landing-properties-cta" href="/categories/properties">here</a>.</h1>
          {!signedIn && <div className="hero-role-join" aria-label="Join Umutungo"><a className="button" href="/register?role=Komisiyoneri">{t(language, 'Join as Komisiyoneri')}</a><a className="button" href="/register?role=Property%20Owner">{t(language, 'Join as Property Owner')}</a><a className="button" href="/register?role=Landlord">{t(language, 'Join as Landlord')}</a></div>}
        </div></div>
        </div>
      </section>

      <section className="section section-property container" id="properties">
        <div className="section-heading split-heading"><div><p className="eyebrow">{t(language, 'Properties')}</p><h2>{t(language, 'Available listings')}</h2></div><a className="featured-shop-link" href="/categories/properties">{t(language, 'View All Properties')} <Icon name="arrow" size={15} /></a></div>{propertyCategories.filter((category) => category.listings.length > 0).map((category) => <div className="landing-category-listings" key={category.slug}><div className="section-heading split-heading"><h3>{t(language, category.name)}</h3><a className="featured-shop-link" href={`/categories/${category.slug}`}>{t(language, 'View all')} <Icon name="arrow" size={15} /></a></div><div className="property-grid">{category.listings.map((property) => <PropertyCard key={property.id} language={language} property={property} favorite={favorites.includes(property.id)} onFavorite={() => toggleFavorite(property)} onView={() => setSelectedProperty(property)} />)}</div></div>)}
      </section>

      <section className="category-section section container" id="categories">
        <div className="section-heading split-heading"><div><h2>{t(language, 'Homes, land and commercial property')}</h2></div><div className="category-heading-spacer" aria-hidden="true" /></div>
        <div className="category-grid premium-category-grid">{categories.map((category, index) => <a className="premium-category-card premium-category-card-icons" href={`/categories/${category.slug}`} key={category.slug}><span className="premium-category-index">{String(index + 1).padStart(2, '0')}</span><span className="premium-category-icon"><Icon name={category.icon} size={32} /></span><span className="premium-category-copy"><strong>{t(language, category.name)}</strong><small>{t(language, category.detail)}</small><Icon name="arrow" size={15} /></span></a>)}</div>
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
        <div className="container contact-interface-grid"><div><h2>{copy('Need help with your property search?')}<br /><em>{copy('Contact the Umutungo team.')}</em></h2><p className="contact-interface-copy">{copy('We are building a property experience where every person in the journey can move with more clarity and confidence.')}</p><a className="contact-email" href="mailto:hello@umutungo.rw">hello@umutungo.rw <Icon name="arrow" size={15} /></a></div><form className="contact-interface-form" action="mailto:hello@umutungo.rw" method="post" encType="text/plain"><label><span>{copy('Name')}</span><input name="name" placeholder={copy('Your name')} required /></label><label><span>{copy('Email address')}</span><input name="email" type="email" placeholder="you@example.com" required /></label><label><span>{copy('Message')}</span><textarea name="message" placeholder={copy('How can we help?')} rows={4} required /></label><button className="button button-primary" type="submit">{copy('Send message')} <Icon name="arrow" size={15} /></button></form></div>
      </section>

    </main>
    <Footer language={language} darkMode={darkMode} />
    {selectedProperty && <PropertyViewer language={language} property={selectedProperty} initialMode="tour" onClose={() => setSelectedProperty(null)} />}
  </div>;
}
