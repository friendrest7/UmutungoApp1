'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { AiChatbot } from '../components/AiChatbot';
import { Footer } from '../components/Footer';
import { Icon, type IconName } from '../components/Icons';
import { Navbar } from '../components/Navbar';
import { PropertyCard, PropertyPlaceholder } from '../components/PropertyCard';
import { ConversationalPropertySearch } from '../components/ConversationalPropertySearch';
import { t } from '../data/translations';
import { listFavorites, publicUmutungoApi, removeFavorite, saveFavorite, type FavoriteItem } from '../lib/umutungoApi';
import { toProperty, type ApiListing } from '../lib/listings';
import { readCachedApiListings, writeCachedApiListings } from '../lib/listingCache';
import { isLocalDevelopmentHost, readLocalPropertyListings, writeLocalPropertyListings } from '../lib/localListings';
import { usePersistentLanguage } from '../lib/language';
import { usePersistentTheme } from '../lib/theme';
import styles from './landing.module.css';

type Goal = 'find' | 'list';

// Categories are grouped into two families so the browse area stays readable.
const propertyCategories = [
  { name: 'Residential houses', slug: 'houses', image: '/properties/house-01.jpg' },
  { name: 'Apartments', slug: 'apartments', image: '/properties/apartment-01.jpg' },
  { name: 'Land', slug: 'land', image: '/properties/land-02.jpg' },
  { name: 'Commercial buildings', slug: 'commercial', image: '/properties/commercial-01.jpg' },
  { name: 'Offices', slug: 'offices', image: '/properties/office-03.jpg' },
  { name: 'Hotels and lodges', slug: 'hospitality', image: '/properties/hospitality-03.jpg' },
];
const assetCategories: Array<{ name: string; slug: string; icon: IconName; hint: string }> = [
  { name: 'Vehicles', slug: 'vehicles', icon: 'car', hint: 'Cars, motorbikes and trucks' },
  { name: 'Furniture', slug: 'furniture', icon: 'home', hint: 'Sofas, beds and dining sets' },
  { name: 'Appliances', slug: 'appliances', icon: 'appliance', hint: 'Fridges, cookers and washers' },
  { name: 'Equipment', slug: 'equipment', icon: 'wrench', hint: 'Tools and machinery for hire' },
  { name: 'Other assets', slug: 'other', icon: 'building', hint: 'Anything else of value' },
];

// Plain-language role descriptions, in the order a visitor is most likely to be.
const audiences: Array<{ icon: IconName; title: string; who: string; body: string; cta: string; href: string }> = [
  { icon: 'search', title: 'Tenants and buyers', who: 'Choose this if you are looking for a place or an item.', body: 'Browse every listing for free, save favourites, message advertisers and track your rent and repair requests in one place.', cta: 'Start browsing', href: '/categories/properties' },
  { icon: 'users', title: 'Komisiyoneri', who: 'Choose this if you list properties on behalf of their owners.', body: 'Manage all your clients’ listings, answer buyer and tenant enquiries, and follow up leads from one professional profile.', cta: 'Join as Komisiyoneri', href: '/register?role=Komisiyoneri' },
  { icon: 'building', title: 'Property Owners', who: 'Choose this if you want to sell or rent out property you own.', body: 'Publish your property with photos, receive enquiries directly, and see how many people view each listing.', cta: 'Join as Property Owner', href: '/register?role=Property%20Owner' },
  { icon: 'home', title: 'Landlords', who: 'Choose this if you rent out units and manage tenants.', body: 'Advertise vacancies, record rent, see who has paid and who is overdue, and handle repair requests from tenants.', cta: 'Join as Landlord', href: '/register?role=Landlord' },
];


const searchExamples = [
  '2-bedroom house to rent in Kicukiro',
];

export default function HomePage() {
  const { darkMode, toggleTheme } = usePersistentTheme();
  const { language, changeLanguage } = usePersistentLanguage();
  const [properties, setProperties] = useState<PropertyPlaceholder[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [goal, setGoal] = useState<Goal>('find');
  const [selectedAudience, setSelectedAudience] = useState(0);
  const copy = (key: string) => t(language, key);

  useEffect(() => {
    let cancelled = false;
    const cachedListings = readCachedApiListings();
    if (cachedListings.length) setProperties(cachedListings.map(toProperty));
    const loadListings = () => {
      void publicUmutungoApi<{ items: ApiListing[] }>('/api/v1/listings', { cache: 'no-store' })
        .then((result) => {
          if (cancelled || !result) return;
          let liveListings = (result.items ?? []).map(toProperty);
          if (isLocalDevelopmentHost()) {
            try {
              const stored = JSON.parse(window.localStorage.getItem('umutungo-local-property-listings') ?? '[]') as PropertyPlaceholder[];
              const localFeatured = new Map(stored.filter((item) => typeof item.featured === 'boolean').map((item) => [item.id, Boolean(item.featured)]));
              liveListings = liveListings.map((item) => localFeatured.has(item.id) ? { ...item, featured: localFeatured.get(item.id) } : item);
              const liveIDs = new Set(liveListings.map((item) => item.id));
              liveListings.push(...stored.filter((item) => item.featured && !liveIDs.has(item.id)));
            } catch { /* Keep the live API listings when the local cache cannot be read. */ }
          }
          if (result.items?.length) writeCachedApiListings(result.items);
          if (liveListings.length > 0) {
            setProperties(liveListings);
            writeLocalPropertyListings(liveListings);
            return;
          }
          setProperties(isLocalDevelopmentHost() ? readLocalPropertyListings() : []);
        })
        .catch(() => { if (!cancelled) setProperties(readLocalPropertyListings()); });
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
    window.addEventListener('umutungo:favorites-changed', readLocalFavorites);
    void listFavorites().then((remote) => {
      if (remote === null) return;
      setFavoriteItems(remote);
      setFavorites(remote.map((item) => item.property_id));
      window.localStorage.setItem('umutungo-favorites', JSON.stringify(remote));
      window.dispatchEvent(new Event('umutungo:favorites-changed'));
    }).catch(() => undefined);
    return () => window.removeEventListener('umutungo:favorites-changed', readLocalFavorites);
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

  // Featured (paid) listings appear first but keep their label on the card.
  const landingListings = [...properties].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured))).slice(0, 8);

  return <div className={`${darkMode ? 'app theme-dark' : 'app'} app-realistic`}>
    <Navbar darkMode={darkMode} onToggleTheme={toggleTheme} language={language} onLanguageChange={changeLanguage} />
    <AiChatbot language={language} />
    <main className={styles.landing} data-own-colors="">
      {/* 1. Hero: one clear choice between finding and listing. */}
      <section className={styles.hero} id="home" aria-labelledby="landing-title">
        <video className={styles.heroMedia} autoPlay muted loop playsInline preload="metadata" poster="/properties/land-01.jpg" aria-hidden="true"><source src="/properties/land.mp4" type="video/mp4" /></video>
        <div className={styles.heroVeil} aria-hidden="true" />
        <div className={styles.heroInner}>
          {/* Kept for screen readers and search engines; not shown visually. */}
          <h1 id="landing-title" className={styles.srOnly}>{copy('Umutungo: find, list and manage property in Rwanda')}</h1>
          <p className={styles.heroLead}>{copy('Homes, land, offices and everyday assets for rent, sale or hire across Rwanda, plus simple tools for landlords to manage tenants and rent.')}</p>

          <div className={styles.goalCard}>
            <div className={styles.goalTabs}>
              {/* Find goes straight to the listings page. */}
              <a href="/categories/properties" className={goal === 'find' ? styles.goalTabActive : styles.goalTab}>{copy('Find a property')}</a>
              <button type="button" aria-controls="goal-panel-list" aria-expanded={goal === 'list'} className={goal === 'list' ? styles.goalTabActive : styles.goalTab} onClick={() => setGoal('list')}><Icon name="building" size={17} />{copy('List a property')}</button>
            </div>
            {goal === 'find' ? <div className={styles.goalPanel}>
              <div className={styles.searchWrap}><ConversationalPropertySearch language={language} compact examples={searchExamples} placeholder={copy('e.g. 3-bedroom house in Kimironko')} submitLabel="Search" /></div>
              <a className={styles.browseLink} href="/categories/properties">{copy('Or browse all listings')} <Icon name="arrow" size={14} /></a>
            </div> : <div className={styles.goalPanel} id="goal-panel-list">
              <p className={styles.goalHint}>{copy('Pick the option that describes you. You can add another role to the same account later.')}</p>
              <div className={styles.listChoices}>
                {audiences.slice(1).map((audience) => <a key={audience.title} className={styles.listChoice} href={audience.href}><span className={styles.listChoiceIcon}><Icon name={audience.icon} size={18} /></span><span><strong>{copy(audience.title)}</strong><small>{copy(audience.who)}</small></span><Icon name="arrow" size={15} /></a>)}
              </div>
              <a className={styles.primaryButton} href="/post-property">{copy('Post a property')} <Icon name="arrow" size={15} /></a>
            </div>}
          </div>
        </div>
      </section>

      {/* 3. Categories grouped into two families. */}
      <section className={styles.section} id="categories" aria-labelledby="categories-title">
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div><p className={styles.kicker}>{copy('Browse')}</p><h2 id="categories-title">{copy('What are you looking for?')}</h2></div>
            <a className={styles.textLink} href="/categories/properties">{copy('All listings')} <Icon name="arrow" size={14} /></a>
          </div>
          <h3 className={styles.familyTitle}>{copy('Property')}</h3>
          <div className={styles.propertyTiles}>
            {propertyCategories.map((category) => <a key={category.slug} className={styles.propertyTile} href={`/categories/${category.slug}`}>
              <Image src={category.image} alt="" fill sizes="(max-width: 640px) 70vw, (max-width: 1100px) 33vw, 190px" className={styles.propertyTileImage} />
              <span className={styles.propertyTileLabel}>{copy(category.name)}<Icon name="arrow" size={14} /></span>
            </a>)}
          </div>
          <h3 className={styles.familyTitle}>{copy('Other assets')}</h3>
          <div className={styles.assetTiles}>
            {assetCategories.map((category) => <a key={category.slug} className={styles.assetTile} href={`/categories/${category.slug}`}>
              <span className={styles.assetIcon}><Icon name={category.icon} size={20} /></span>
              <span><strong>{copy(category.name)}</strong><small>{copy(category.hint)}</small></span>
            </a>)}
          </div>
        </div>
      </section>

      {/* 4. Latest listings. */}
      <section className={`${styles.section} ${styles.sectionTinted}`} id="properties" aria-labelledby="listings-title">
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div><h2 id="listings-title">{copy('Latest listings')}</h2></div>
            <a className={styles.textLink} href="/categories/properties">{copy('Browse all properties')} <Icon name="arrow" size={14} /></a>
          </div>
          {landingListings.length > 0
            ? <div className={styles.listingGrid}>{landingListings.map((property) => <PropertyCard key={property.id} language={language} property={property} favorite={favorites.includes(property.id)} onFavorite={() => toggleFavorite(property)} />)}</div>
            : <div className={styles.emptyListings}><Icon name="home" size={22} /><p>{copy('New listings will appear here as soon as they are published.')}</p><a className={styles.secondaryButton} href="/post-property">{copy('Be the first to post a property')}</a></div>}
        </div>
      </section>

      {/* 5. Who it is for, in plain language. */}
      <section className={styles.section} id="who-its-for" aria-labelledby="audiences-title">
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div><p className={styles.kicker}>{copy('Made for everyone in the property journey')}</p><h2 id="audiences-title">{copy('Who is Umutungo for?')}</h2></div>
          </div>
          {/* Cards work as a radio group: click to select (turns green), then follow the link. */}
          <div className={styles.audienceGrid} role="radiogroup" aria-labelledby="audiences-title">
            {audiences.map((audience, index) => {
              const selected = selectedAudience === index;
              return <article key={audience.title} className={selected ? `${styles.audienceCard} ${styles.audienceCardFeatured}` : styles.audienceCard} onClick={() => setSelectedAudience(index)}>
                <label className={styles.audienceSelect}>
                  <input type="radio" name="audience" className={styles.srOnly} checked={selected} onChange={() => setSelectedAudience(index)} />
                  <span className={styles.audienceIcon}><Icon name={audience.icon} size={20} /></span>
                  {selected && <span className={styles.audienceCheck} aria-hidden="true"><Icon name="check" size={14} /></span>}
                  <h3>{copy(audience.title)}</h3>
                  <span className={styles.audienceWho}>{copy(audience.who)}</span>
                  <span className={styles.audienceBody}>{copy(audience.body)}</span>
                </label>
                <a className={styles.audienceLink} href={audience.href}>{copy(audience.cta)} <Icon name="arrow" size={14} /></a>
              </article>;
            })}
          </div>
        </div>
      </section>

      {/* 6. How it works: two short tracks. */}
      <section className={`${styles.section} ${styles.sectionTinted}`} id="how-it-works" aria-labelledby="how-title">
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div><p className={styles.kicker}>{copy('How it works')}</p><h2 id="how-title">{copy('Three steps either way')}</h2></div>
            <a className={styles.textLink} href="/how-it-works">{copy('Read the full guide')} <Icon name="arrow" size={14} /></a>
          </div>
          <div className={styles.tracks}>
            <ol className={styles.track} aria-label={copy('Finding a property')}>
              <li className={styles.trackHeading}><Icon name="search" size={18} />{copy('Finding a property')}</li>
              <li><b>1</b><span><strong>{copy('Search or browse')}</strong>{copy('Describe what you need or pick a category and location.')}</span></li>
              <li><b>2</b><span><strong>{copy('Compare and save')}</strong>{copy('Check photos, price, location and key facts. Save the ones you like.')}</span></li>
              <li><b>3</b><span><strong>{copy('Contact the advertiser')}</strong>{copy('Message in the app, call, or use WhatsApp to arrange a viewing.')}</span></li>
            </ol>
            <ol className={styles.track} aria-label={copy('Listing a property')}>
              <li className={styles.trackHeading}><Icon name="building" size={18} />{copy('Listing a property')}</li>
              <li><b>1</b><span><strong>{copy('Create your account')}</strong>{copy('Sign up with your phone number and confirm it with a one-time code.')}</span></li>
              <li><b>2</b><span><strong>{copy('Add your property')}</strong>{copy('Upload photos, set the price and location, and save it as a draft.')}</span></li>
              <li><b>3</b><span><strong>{copy('Publish and get enquiries')}</strong>{copy('Pay per listing or use a plan, then manage enquiries from your dashboard.')}</span></li>
            </ol>
          </div>
        </div>
      </section>

      {/* 7. Closing call to action. */}
      <section className={styles.ctaBand} aria-labelledby="cta-title">
        <div className={styles.container}>
          <div><h2 id="cta-title">{copy('Ready when you are.')}</h2><p>{copy('Browsing is free. Listing takes a few minutes.')}</p></div>
          <div className={styles.ctaActions}>
            <a className={styles.ctaPrimary} href="/categories/properties"><Icon name="search" size={16} />{copy('Find a property')}</a>
            <a className={styles.ctaSecondary} href="/post-property"><Icon name="building" size={16} />{copy('List a property')}</a>
          </div>
        </div>
      </section>
    </main>
    <Footer language={language} darkMode={darkMode} />
  </div>;
}
