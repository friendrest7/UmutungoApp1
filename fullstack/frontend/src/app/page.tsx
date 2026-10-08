'use client';

import { useEffect, useState } from 'react';
import { AiChatbot } from '../components/AiChatbot';
import { Footer } from '../components/Footer';
import { Icon } from '../components/Icons';
import { Navbar } from '../components/Navbar';
import { PropertyCard, PropertyPlaceholder } from '../components/PropertyCard';
import { PropertyViewer } from '../components/PropertyViewer';
import { PropertySearch } from '../components/PropertySearch';
import { ReviewPanel } from '../components/ReviewPanel';
import { Language, t } from '../data/translations';
import { listFavorites, publicUmutungoApi, removeFavorite, saveFavorite, type FavoriteItem } from '../lib/umutungoApi';
import { toProperty, type ApiListing } from '../lib/listings';
import { usePersistentLanguage } from '../lib/language';
import { usePersistentTheme } from '../lib/theme';

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

export default function HomePage() {
  const { darkMode, toggleTheme } = usePersistentTheme();
  const { language, changeLanguage } = usePersistentLanguage();
  const [location, setLocation] = useState('Kigali');
  const [district, setDistrict] = useState('');
  const [sector, setSector] = useState('');
  const [type, setType] = useState('Any type');
  const [intent, setIntent] = useState('Buy or rent');
  const [priceRange, setPriceRange] = useState('Any price');
  const [properties, setProperties] = useState<PropertyPlaceholder[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<PropertyPlaceholder | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const copy = (key: string) => t(language, key);

  useEffect(() => {
    let cancelled = false;
    void publicUmutungoApi<{ items: ApiListing[] }>('/api/v1/listings')
      .then((result) => { if (!cancelled) setProperties((result?.items ?? []).map(toProperty)); })
      .catch(() => { if (!cancelled) setProperties([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const syncSignIn = () => setSignedIn(Boolean(window.localStorage.getItem('umutungo-demo-user')));
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

  const submitSearch = () => {
    const categorySlugs: Record<string, string> = { House: 'houses', Apartment: 'apartments', Land: 'land', Commercial: 'commercial', Office: 'offices', Hospitality: 'hospitality', Vehicle: 'vehicles', Equipment: 'equipment', Furniture: 'furniture', Appliance: 'appliances' };
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
    const matchesType = type === 'Any type' || property.type === type;
    const matchesLocation = location === 'Kigali' || property.location.toLowerCase().includes(location.toLowerCase());
    const matchesDistrict = !district || property.location.toLowerCase().includes(district.toLowerCase());
    const matchesSector = !sector || property.location.toLowerCase().includes(sector.toLowerCase());
    const isRental = property.priceNote.includes('/ month');
    const matchesIntent = intent === 'Buy or rent' || (intent === 'Rent' && isRental) || (intent === 'Buy' && !isRental);
    const numericPrice = Number(property.price.replace(/[^0-9]/g, ''));
    const matchesPrice = priceRange === 'Any price' || (priceRange === 'Under RWF 500,000' && numericPrice < 500000) || (priceRange === 'RWF 500,000 - 1,000,000' && numericPrice >= 500000 && numericPrice <= 1000000) || (priceRange === 'Over RWF 1,000,000' && numericPrice > 1000000);
    return matchesType && matchesLocation && matchesDistrict && matchesSector && matchesIntent && matchesPrice;
  });

  return <div className={`${darkMode ? 'app theme-dark' : 'app'} app-realistic`}>
    <Navbar darkMode={darkMode} onToggleTheme={toggleTheme} language={language} onLanguageChange={changeLanguage} />
    <AiChatbot language={language} />
    <main>
      <section className="hero-section" id="home">
        <div className="hero-image hero-has-video"><video className="hero-video" autoPlay muted loop playsInline preload="metadata" poster="/properties/land-01.jpg" aria-hidden="true"><source src="/properties/land.mp4" type="video/mp4" /></video><div className="hero-image-overlay" /><div className="container hero-content"><div className="hero-copy">
          <div className="landing-copy-spacer" aria-hidden="true" />
          <div className="landing-search-actions"><a className="landing-view-all-properties" href="/categories/houses">View All Properties</a></div>
          <div className="hero-actions join-role-actions" aria-label="Join Umutungo"><a className="button button-primary" href="/register?role=Client">Join as Client</a><a className="button button-secondary" href="/register?role=Property%20Owner">Join as Owner</a><a className="button button-commissioner" href="/register?role=Komisiyoneri">Join as Komisiyoneri</a></div>
        </div></div></div>
        <div className="landing-search-board"><div className="container hero-search-wrap"><PropertySearch language={language} location={location} district={district} sector={sector} type={type} intent={intent} priceRange={priceRange} onLocationChange={(value) => { setLocation(value); setDistrict(''); setSector(''); }} onDistrictChange={(value) => { setDistrict(value); setSector(''); }} onSectorChange={setSector} onTypeChange={setType} onIntentChange={setIntent} onPriceRangeChange={setPriceRange} onSubmit={submitSearch} /></div></div>
      </section>

      <section className="category-section section container" id="categories">
        <div className="section-heading split-heading"><div><p className="eyebrow">Browse Categories</p><h2>Find every kind<br /><em>of property.</em></h2></div><div className="category-heading-spacer" aria-hidden="true" /></div>
        <div className="category-grid premium-category-grid">{categories.map((category) => <a className="premium-category-card" href={`/categories/${category.slug}`} key={category.slug}><span className="premium-category-image" style={{ backgroundImage: `url(${category.image})` }} /><span className="premium-category-copy"><strong>{category.name}</strong><small>{category.detail}</small><Icon name="arrow" size={15} /></span></a>)}</div>
      </section>

      <section className="section section-property container" id="properties">
        <div className="section-heading split-heading"><div><p className="eyebrow">Properties</p><h2>Available listings</h2></div></div>
        <div className="property-grid">{visibleProperties.map((property) => <PropertyCard key={property.id} language={language} property={property} favorite={favorites.includes(property.id)} onFavorite={() => toggleFavorite(property)} onView={() => setSelectedProperty(property)} />)}</div>
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
        <div className="container contact-interface-grid"><div><p className="eyebrow">{copy('Connect')}</p><h2>{copy('Every place has a story.')}<br /><em>{copy('Let’s help you find yours.')}</em></h2><p className="contact-interface-copy">{copy('We are building a property experience where every person in the journey can move with more clarity and confidence.')}</p><a className="contact-email" href="mailto:hello@umutungo.rw">hello@umutungo.rw <Icon name="arrow" size={15} /></a></div><form className="contact-interface-form" action="mailto:hello@umutungo.rw" method="post" encType="text/plain"><label><span>{copy('Name')}</span><input name="name" placeholder={copy('Your name')} required /></label><label><span>{copy('Email address')}</span><input name="email" type="email" placeholder="you@example.com" required /></label><label><span>{copy('Message')}</span><textarea name="message" placeholder={copy('How can we help?')} rows={4} required /></label><button className="button button-primary" type="submit">{copy('Send message')} <Icon name="arrow" size={15} /></button></form></div>
      </section>

      <ReviewPanel language={language} />
    </main>
    <Footer language={language} darkMode={darkMode} />
    {selectedProperty && <PropertyViewer language={language} property={selectedProperty} onClose={() => setSelectedProperty(null)} />}
  </div>;
}
