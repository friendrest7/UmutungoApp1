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
import { readCachedApiListings, writeCachedApiListings } from '../lib/listingCache';
import { isLocalDevelopmentHost, readLocalPropertyListings, writeLocalPropertyListings } from '../lib/localListings';
import { usePersistentLanguage } from '../lib/language';
import { usePersistentTheme } from '../lib/theme';

export default function HomePage() {
  const { darkMode, toggleTheme } = usePersistentTheme();
  const { language, changeLanguage } = usePersistentLanguage();
  const [properties, setProperties] = useState<PropertyPlaceholder[]>([]);
  const [listingLoadError, setListingLoadError] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const copy = (key: string) => t(language, key);

  useEffect(() => {
    let cancelled = false;
    const cachedListings = readCachedApiListings();
    if (cachedListings.length) setProperties(cachedListings.map(toProperty));
    const loadListings = () => {
      void publicUmutungoApi<{ items: ApiListing[] }>('/api/v1/listings', { cache: 'no-store' })
        .then((result) => {
          if (cancelled) return;
          if (!result) return;
          let liveListings = (result?.items ?? []).map(toProperty);
          if (isLocalDevelopmentHost()) {
            try {
              const stored = JSON.parse(window.localStorage.getItem('umutungo-local-property-listings') ?? '[]') as PropertyPlaceholder[];
              const localFeatured = new Map(stored.filter((item) => typeof item.featured === 'boolean').map((item) => [item.id, Boolean(item.featured)]));
              liveListings = liveListings.map((item) => localFeatured.has(item.id) ? { ...item, featured: localFeatured.get(item.id) } : item);
              const liveIDs = new Set(liveListings.map((item) => item.id));
              liveListings.push(...stored.filter((item) => item.featured && !liveIDs.has(item.id)));
            } catch { /* Keep the live API listings when the local cache cannot be read. */ }
          }
          if (result?.items?.length) writeCachedApiListings(result.items);
          if (liveListings.length > 0) {
            setListingLoadError(false);
            setProperties(liveListings);
            writeLocalPropertyListings(liveListings);
            return;
          }
          setListingLoadError(false);
          setProperties(isLocalDevelopmentHost() ? readLocalPropertyListings() : []);
        })
        .catch(() => {
          if (!cancelled) {
            setProperties(readLocalPropertyListings());
            setListingLoadError(true);
          }
        });
    };
    loadListings();
    window.addEventListener('umutungo:listings-changed', loadListings);
    return () => { cancelled = true; window.removeEventListener('umutungo:listings-changed', loadListings); };
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
    { name: 'Residential houses', slug: 'houses' }, { name: 'Apartments', slug: 'apartments' },
    { name: 'Land', slug: 'land' }, { name: 'Commercial buildings', slug: 'commercial' },
    { name: 'Offices', slug: 'offices' }, { name: 'Hotels and lodges', slug: 'hospitality' },
    { name: 'Vehicles', slug: 'vehicles' }, { name: 'Furniture', slug: 'furniture' },
    { name: 'Appliances', slug: 'appliances' }, { name: 'Equipment', slug: 'equipment' },
    { name: 'Other assets', slug: 'other' },
  ];
  const landingListings = [...visibleProperties].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured))).slice(0, 6);

  return <div className={`${darkMode ? 'app theme-dark' : 'app'} app-realistic`}>
    <Navbar darkMode={darkMode} onToggleTheme={toggleTheme} language={language} onLanguageChange={changeLanguage} />
    <AiChatbot language={language} />
    <main>
      <section className="hero-section" id="home">
        <div className="hero-image hero-has-video"><video className="hero-video" autoPlay muted loop playsInline preload="metadata" poster="/properties/land-01.jpg" aria-hidden="true"><source src="/properties/land.mp4" type="video/mp4" /></video><div className="hero-image-overlay" /><div className="container hero-content"><div className="hero-copy">
            <h1 className="landing-search-heading">{t(language, 'You are on Umutungo, you can find different properties')} <a className="button landing-properties-cta" href="/categories/properties">{t(language, 'here')}</a>.</h1>
            <div className="landing-conversational-search"><ConversationalPropertySearch language={language} compact /></div>
        </div></div>
        </div>
      </section>

      <section className="section section-property container" id="properties">
        <div className="landing-discovery-panel">
          <div className="landing-discovery-intro"><h2>{t(language, 'Find the right property for whatever comes next.')}</h2><p>{t(language, 'Explore homes, land, vehicles, furniture and more for rent, sale, hire or a stay. Browsing is free, so explore the options and find what interests you.')}</p></div>
        <nav className="landing-category-filter" aria-label={t(language, 'Browse property categories')}>
          <a href="/categories/properties"><Icon name="building" size={18} /><span>{t(language, 'All')}</span></a>
          {listingCategories.map((category) => {
            const icon: IconName = category.slug === 'houses' || category.slug === 'hospitality' ? 'home' : category.slug === 'land' ? 'leaf' : category.slug === 'vehicles' ? 'car' : category.slug === 'appliances' ? 'appliance' : category.slug === 'equipment' ? 'wrench' : 'building';
            return <a href={`/categories/${category.slug}`} key={category.slug}><Icon name={icon} size={18} /><span>{t(language, category.name)}</span></a>;
          })}
        </nav>
        </div>
        {landingListings.length > 0 && <><div className="landing-property-backdrop"><div className="property-grid landing-property-grid">{landingListings.map((property) => <PropertyCard key={property.id} language={language} property={property} favorite={favorites.includes(property.id)} onFavorite={() => toggleFavorite(property)} />)}</div></div><div className="landing-preview-actions"><a className="button button-primary" href="/categories/properties">{t(language, 'Browse all properties')} <Icon name="arrow" size={15} /></a><a className="button button-outline" href="/post-property">{t(language, 'Post a property')}</a></div></>}
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

    </main>
    <Footer language={language} darkMode={darkMode} />
  </div>;
}
