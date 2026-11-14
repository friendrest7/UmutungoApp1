'use client';

import Image from 'next/image';
import { useEffect, useState, type FormEvent } from 'react';
import { AiChatbot } from '../components/AiChatbot';
import { Icon, type IconName } from '../components/Icons';
import { Logo } from '../components/Logo';
import { Navbar } from '../components/Navbar';
import { SiteFooter } from '../components/SiteFooter';
import { type PropertyPlaceholder } from '../components/PropertyCard';
import { t } from '../data/translations';
import { apiToken, listFavorites, publicUmutungoApi, removeFavorite, saveFavorite, umutungoApi, type FavoriteItem } from '../lib/umutungoApi';
import { toProperty, type ApiListing } from '../lib/listings';
import { readCachedApiListings, writeCachedApiListings } from '../lib/listingCache';
import { isLocalDevelopmentHost, readLocalPropertyListings, writeLocalPropertyListings } from '../lib/localListings';
import { goToSignIn } from '../lib/signIn';
import { usePersistentLanguage } from '../lib/language';
import { usePersistentTheme } from '../lib/theme';
import styles from './landing.module.css';

type Intent = 'Buy' | 'Rent' | 'All';
type ListingFilter = 'all' | 'sale' | 'rent';
type Story = { id: string; name: string; body: string };

const ANDROID_APP_URL = 'https://expo.dev/artifacts/eas/SNaCxDJnUvtKjrTOxPwA4glDW9nQZrbxRYwfw8HziKg.apk';
const IOS_APP_URL = 'https://apps.apple.com/rw/search?term=Umutungo';

const categories = [
  { name: 'Houses', slug: 'houses', image: '/properties/house-02.jpg' },
  { name: 'Apartments', slug: 'apartments', image: '/properties/apartment-01.jpg' },
  { name: 'Land', slug: 'land', image: '/properties/land-02.jpg' },
  { name: 'Commercial', slug: 'commercial', image: '/properties/commercial-01.jpg' },
  { name: 'Offices', slug: 'offices', image: '/properties/office-04.jpg' },
  { name: 'Hotels', slug: 'hospitality', image: '/properties/hospitality-03.jpg' },
  { name: 'Vehicles', slug: 'vehicles', image: '/properties/vehicle-02.jpg' },
  { name: 'Furniture', slug: 'furniture', image: '/properties/furniture-04.jpg' },
  { name: 'Appliances', slug: 'appliances', image: '/properties/appliance-03.jpg' },
  { name: 'Equipment', slug: 'equipment', image: '/properties/equipment-02.jpg' },
];

const searchCategories = [
  { value: 'properties', label: 'Properties & assets' },
  ...categories.map((category) => ({ value: category.slug, label: category.name })),
  { value: 'other', label: 'Other assets' },
];
const searchLocations = ['Anywhere in Rwanda', 'Kigali', 'Eastern Province', 'Northern Province', 'Southern Province', 'Western Province'];
const searchBudgets = ['Any budget', 'Under RWF 500,000', 'RWF 500,000 - 1,000,000', 'Over RWF 1,000,000'];

const audiences = [
  { step: '01 / Connect', title: 'Komisiyoneri', body: 'Connect people with properties and assets. Bring your next listing to the marketplace.', cta: 'Join as Komisiyoneri', href: '/register?role=Komisiyoneri' },
  { step: '02 / Own', title: 'Property Owners', body: 'Showcase your property to people looking for their next home, workspace or investment.', cta: 'Advertise a property', href: '/register?role=Property%20Owner' },
  { step: '03 / Rent', title: 'Landlords', body: 'Share your available spaces and help prospective tenants find a place to call home.', cta: 'List a rental', href: '/landlord' },
];


function availability(property: PropertyPlaceholder) {
  if (property.availableFor === 'rent') return 'To rent';
  if (property.availableFor === 'both') return 'Sale or rent';
  if (property.availableFor === 'book') return 'To book';
  return 'For sale';
}

function matchesFilter(property: PropertyPlaceholder, filter: ListingFilter) {
  if (filter === 'all') return true;
  if (filter === 'rent') return property.availableFor === 'rent' || property.availableFor === 'both' || property.availableFor === 'book';
  return !property.availableFor || property.availableFor === 'sale' || property.availableFor === 'both';
}

function SearchField({ icon, label, value, onChange, options }: { icon: IconName; label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  const id = `hero-search-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return <label className={styles.searchField} htmlFor={id}>
    <span className={styles.searchIcon}><Icon name={icon} size={16} /></span>
    <span className={styles.searchText}>
      <small>{label}</small>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </span>
    <span className={styles.searchChevron} aria-hidden="true"><Icon name="chevron" size={12} /></span>
  </label>;
}

export default function HomePage() {
  const { darkMode, toggleTheme } = usePersistentTheme();
  const { language, changeLanguage } = usePersistentLanguage();
  const copy = (key: string) => t(language, key);

  const [properties, setProperties] = useState<PropertyPlaceholder[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [listingFilter, setListingFilter] = useState<ListingFilter>('all');
  const [signedIn, setSignedIn] = useState(false);

  const [intent, setIntent] = useState<Intent>('Buy');
  const [searchLocation, setSearchLocation] = useState(searchLocations[0]);
  const [searchCategory, setSearchCategory] = useState('properties');
  const [searchBudget, setSearchBudget] = useState(searchBudgets[0]);

  const [stories, setStories] = useState<Story[]>([]);
  const [storyIndex, setStoryIndex] = useState(0);
  const [storyFormOpen, setStoryFormOpen] = useState(false);
  const [storyBody, setStoryBody] = useState('');
  const [storySubmitting, setStorySubmitting] = useState(false);
  const [storyStatus, setStoryStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Listings: cached copy first, then the live API (with local fallbacks for development).
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

  // Signed-in state decides whether visitors can submit a story.
  useEffect(() => {
    const readAccount = () => setSignedIn(Boolean(apiToken() || window.localStorage.getItem('umutungo-demo-user')));
    readAccount();
    window.addEventListener('umutungo:auth-changed', readAccount);
    return () => window.removeEventListener('umutungo:auth-changed', readAccount);
  }, []);

  // Only approved testimonials come back from the public endpoint.
  useEffect(() => {
    void publicUmutungoApi<{ items: Story[] }>('/api/v1/testimonials', { cache: 'no-store' })
      .then((result) => setStories(result?.items ?? []))
      .catch(() => setStories([]));
  }, []);

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

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (intent !== 'All') params.set('intent', intent);
    if (searchLocation !== searchLocations[0]) params.set('location', searchLocation);
    if (searchBudget !== searchBudgets[0]) params.set('priceRange', searchBudget);
    const query = params.toString();
    window.location.assign(`/categories/${searchCategory}${query ? `?${query}` : ''}`);
  };

  const submitStory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStoryStatus(null);
    setStorySubmitting(true);
    try {
      await umutungoApi('/api/v1/testimonials', { method: 'POST', body: JSON.stringify({ body: storyBody }) });
      setStoryBody('');
      setStoryStatus({ kind: 'ok', text: 'Thank you. Your story is with our team for review before it appears here.' });
    } catch (error) {
      setStoryStatus({ kind: 'error', text: error instanceof Error ? error.message : 'Your story could not be submitted. Please try again.' });
    } finally { setStorySubmitting(false); }
  };

  // Featured (paid) listings first, then filtered by sale/rent.
  const sortedListings = [...properties].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  const visibleListings = sortedListings.filter((property) => matchesFilter(property, listingFilter)).slice(0, 8);
  const phoneListing = sortedListings[0];
  const story = stories.length ? stories[storyIndex % stories.length] : null;

  return <div className={`${darkMode ? 'app theme-dark' : 'app'} sidebar-hidden`}>
    <AiChatbot language={language} />
    <main className={styles.landing} data-own-colors="">

      {/* Hero: framed photograph with the navigation and search laid over it. */}
      <section className={styles.heroFrame} id="home" aria-labelledby="landing-title">
        <div className={styles.hero}>
          <Image src="/properties/house-01.jpg" alt="" fill priority sizes="100vw" className={styles.heroImage} />
          <div className={styles.heroVeil} aria-hidden="true" />

          <Navbar variant="overlay" active="home" darkMode={darkMode} onToggleTheme={toggleTheme} language={language} onLanguageChange={changeLanguage} />

          <div className={styles.heroCopy}>
            <p className={styles.heroKicker}>{copy('Umutungo property marketplace for everyone')}</p>
            <h1 id="landing-title" className={styles.heroTitle}>{copy('You are on Umutungo and')}<br />{copy('you can find different properties')} <a className={styles.heroTitleLink} href="/categories/properties">{copy('here')}</a>.</h1>
          </div>

          <div className={styles.heroBottom}>
            <a className={styles.exploreChip} href="/categories/properties"><Icon name="pin" size={14} />{copy('Explore Rwanda')}</a>
            <form className={styles.search} onSubmit={submitSearch} role="search" aria-label={copy('Search listings')}>
              <div className={styles.intentTabs} role="tablist" aria-label={copy('What do you want to do?')}>
                {(['Buy', 'Rent', 'All'] as Intent[]).map((option) => <button key={option} type="button" role="tab" aria-selected={intent === option} className={intent === option ? styles.intentActive : styles.intentTab} onClick={() => setIntent(option)}>{copy(option === 'All' ? 'All assets' : option)}</button>)}
              </div>
              <div className={styles.searchRow}>
                <SearchField icon="pin" label={copy('Location')} value={searchLocation} onChange={setSearchLocation} options={searchLocations.map((value) => ({ value, label: copy(value) }))} />
                <SearchField icon="building" label={copy('Category')} value={searchCategory} onChange={setSearchCategory} options={searchCategories.map((option) => ({ value: option.value, label: copy(option.label) }))} />
                <SearchField icon="creditCard" label={copy('Price range')} value={searchBudget} onChange={setSearchBudget} options={searchBudgets.map((value) => ({ value, label: copy(value) }))} />
                <button type="submit" className={styles.searchSubmit}>{copy('Search')} <span aria-hidden="true">→</span></button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Categories. */}
      <section className={styles.section} id="categories" aria-label={copy('Browse categories')}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>{copy('Browse categories')}</p>
            </div>
          </div>
          <div className={styles.categoryRow}>
            {categories.map((category) => <a key={category.slug} className={styles.categoryTile} href={`/categories/${category.slug}`}>
              <span className={styles.categoryImage}><Image src={category.image} alt="" fill sizes="(max-width: 640px) 40vw, 200px" /></span>
              <span className={styles.categoryLabel}>{copy(category.name)}</span>
            </a>)}
          </div>
        </div>
      </section>

      {/* Featured listings. */}
      <section className={styles.section} id="properties" aria-label={copy('Featured listings')}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.sectionLead}>{copy('Explore homes, land and spaces for work.')}</p>
              <div className={styles.filterChips} role="group" aria-label={copy('Filter listings')}>
                {([['all', 'All'], ['sale', 'For sale'], ['rent', 'To rent']] as Array<[ListingFilter, string]>).map(([value, label]) => <button key={value} type="button" aria-pressed={listingFilter === value} className={listingFilter === value ? styles.chipActive : styles.chip} onClick={() => setListingFilter(value)}>{copy(label)}</button>)}
              </div>
            </div>
            <a className={styles.btnGreenGlow} href="/categories/properties">{copy('View all listings')} <span aria-hidden="true">→</span></a>
          </div>

          {visibleListings.length > 0
            ? <div className={styles.listingGrid}>
              {visibleListings.map((property) => {
                const saved = favorites.includes(property.id);
                const href = `/property/${encodeURIComponent(property.id)}`;
                const image = property.image || '/properties/listing-placeholder.svg';
                return <article key={property.id} className={styles.listingCard}>
                  <a className={styles.listingMedia} href={href} tabIndex={-1} aria-hidden="true">
                    <Image src={image} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 380px" unoptimized={image.startsWith('http')} />
                  </a>
                  <span className={styles.listingBadge}>{copy(property.featured ? 'Featured' : availability(property))}</span>
                  <button type="button" className={saved ? styles.heartActive : styles.heart} aria-pressed={saved} aria-label={`${copy(saved ? 'Remove from favorites' : 'Save to favorites')}: ${property.title}`} onClick={() => toggleFavorite(property)}><Icon name="heart" size={16} /></button>
                  <h3><a href={href}>{copy(property.title)}</a></h3>
                  <p className={styles.listingLocation}>{copy(property.location || 'Location available on request')}</p>
                  <p className={styles.listingPrice}>{property.price}{property.priceNote && !/^\s*asking\s*$/i.test(property.priceNote) && <span> {copy(property.priceNote)}</span>}</p>
                  <a className={styles.detailsButton} href={href}>{copy('View Details')} <span aria-hidden="true">→</span></a>
                </article>;
              })}
            </div>
            : <div className={styles.emptyListings}>
              <Icon name="home" size={22} />
              <p>{copy(properties.length ? 'No listings match this filter yet.' : 'New listings will appear here as soon as they are published.')}</p>
              <a className={styles.btnOutline} href="/post-property">{copy('Post a property')}</a>
            </div>}
        </div>
      </section>

      {/* Other assets banner. */}
      <section className={styles.section} aria-labelledby="assets-title">
        <div className={styles.container}>
          <div className={styles.assetsBanner}>
            <Image src="/properties/tour-living.jpg" alt="" fill sizes="(max-width: 1180px) 100vw, 1180px" className={styles.assetsBg} />
            <div className={styles.assetsVeil} aria-hidden="true" />
            <div className={styles.collage}>
              <a className={styles.collageWide} href="/categories/vehicles"><Image src="/properties/vehicle-02.jpg" alt="" fill sizes="260px" /><span>{copy('Vehicles')}</span></a>
              <a href="/categories/furniture"><Image src="/properties/furniture-04.jpg" alt="" fill sizes="130px" /><span>{copy('Furniture')}</span></a>
              <a href="/categories/equipment"><Image src="/properties/equipment-02.jpg" alt="" fill sizes="130px" /><span>{copy('Equipment')}</span></a>
            </div>
            <div className={styles.assetsCopy}>
              <p className={styles.kickerGreen}>{copy('Explore opportunities')}</p>
              <h2 id="assets-title" className={styles.display}>{copy('A world beyond four walls.')}</h2>
              <p>{copy('Discover vehicles, furniture, appliances and equipment alongside your next property.')}</p>
              <a className={styles.btnGreen} href="/categories/vehicles">{copy('Explore other assets')} <span aria-hidden="true">→</span></a>
              <div className={styles.premiumRow}>
                <div><strong>{copy('Umutungo Premium')}</strong><span>{copy('Increase advertising and listing capacity with a plan that fits your business.')}</span></div>
                <a href="/upgrade">{copy('Explore plans')} <span aria-hidden="true">→</span></a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who it is for. */}
      <section className={styles.section} id="who-its-for" aria-labelledby="audiences-title">
        <div className={`${styles.container} ${styles.whoGrid}`}>
          <div className={styles.whoIntro}>
            <p className={styles.kicker}>{copy('Who is Umutungo for?')}</p>
            <h2 id="audiences-title" className={styles.display}>{copy('Every connection starts here.')}</h2>
            <p className={styles.sectionLead}>{copy('Whether you connect, own or rent out — make your next move here.')}</p>
            <div className={styles.whoImage}><Image src="/properties/office-03.jpg" alt="" fill sizes="(max-width: 900px) 100vw, 420px" /></div>
          </div>
          <ol className={styles.whoList}>
            {audiences.map((audience) => <li key={audience.title}>
              <div>
                <span className={styles.whoStep}>{copy(audience.step)}</span>
                <h3>{copy(audience.title)}</h3>
                <p>{copy(audience.body)}</p>
              </div>
              <a className={styles.btnGreen} href={audience.href}>{copy(audience.cta)}</a>
            </li>)}
          </ol>
        </div>
      </section>

      {/* Customer stories: approved testimonials only. */}
      <section className={styles.section} id="stories" aria-labelledby="stories-title">
        <div className={`${styles.container} ${styles.storiesGrid}`}>
          <div>
            <p className={styles.kicker}>{copy('Customer stories')}</p>
            <h2 id="stories-title" className={styles.display}>{copy('Stories worth sharing.')}</h2>
            <p className={styles.sectionLead}>{copy('Real experiences from the Umutungo community, shared with permission.')}</p>
          </div>
          <figure className={styles.storyCard}>
            <span className={styles.quoteMark} aria-hidden="true">“</span>
            {story
              ? <><blockquote>{story.body}</blockquote><figcaption>{story.name}</figcaption></>
              : <><blockquote>{copy('Approved customer stories will appear here.')}</blockquote><figcaption>{copy('Be the first to tell us how Umutungo helped you.')}</figcaption></>}
            <div className={styles.storyActions}>
              {stories.length > 1 && <div className={styles.storyNav}>
                <button type="button" aria-label={copy('Previous story')} onClick={() => setStoryIndex((index) => (index - 1 + stories.length) % stories.length)}>←</button>
                <span>{(storyIndex % stories.length) + 1} / {stories.length}</span>
                <button type="button" aria-label={copy('Next story')} onClick={() => setStoryIndex((index) => (index + 1) % stories.length)}>→</button>
              </div>}
              {signedIn
                ? <button type="button" className={styles.storyShare} aria-expanded={storyFormOpen} onClick={() => setStoryFormOpen((open) => !open)}>{copy('Share your story')}</button>
                : <button type="button" className={styles.storyShare} onClick={() => goToSignIn('Client')}>{copy('Sign in to share your story')}</button>}
            </div>
            {signedIn && storyFormOpen && <form className={styles.storyForm} onSubmit={submitStory}>
              <label htmlFor="landing-story">{copy('Your story')}</label>
              <textarea id="landing-story" value={storyBody} onChange={(event) => setStoryBody(event.target.value)} minLength={20} maxLength={1000} rows={4} required disabled={storySubmitting} placeholder={copy('Share your experience (20–1000 characters)')} />
              <div><span>{storyBody.length}/1000</span><button type="submit" className={styles.btnGreen} disabled={storySubmitting || storyBody.trim().length < 20}>{copy(storySubmitting ? 'Submitting…' : 'Submit for review')}</button></div>
              {storyStatus && <p role={storyStatus.kind === 'ok' ? 'status' : 'alert'} className={storyStatus.kind === 'ok' ? styles.storyOk : styles.storyError}>{copy(storyStatus.text)}</p>}
            </form>}
          </figure>
        </div>
      </section>

      {/* Mobile app band. */}
      <section className={styles.section} id="app-download" aria-labelledby="app-title">
        <div className={styles.container}>
          <div className={styles.appBand}>
            <div className={styles.appCopy}>
              <h2 id="app-title" className={styles.display}>{copy('Umutungo Mobile App')}</h2>
              <p className={styles.sectionLead}>{copy('Download it and use it in your hands.')}</p>
              <div className={styles.storeButtons}>
                <a className={styles.btnOutline} href={ANDROID_APP_URL} target="_blank" rel="noopener noreferrer"><Icon name="googlePlay" size={16} />{copy('Android app')}</a>
                <a className={styles.btnOutline} href={IOS_APP_URL} target="_blank" rel="noopener noreferrer"><Icon name="apple" size={16} />{copy('App Store')}</a>
              </div>
            </div>
            <div className={styles.phone} aria-hidden="true">
              <div className={styles.phoneScreen}>
                <span className={styles.phoneNotch} />
                <strong className={styles.phoneTitle}>{copy('Find your')}<br />{copy('next move.')}</strong>
                <small>{copy('Properties & assets in Rwanda')}</small>
                <span className={styles.phoneSearch}><Icon name="search" size={11} />{copy('Search properties & assets')}</span>
                <span className={styles.phoneTabs}><b>{copy('Buy')}</b><i>{copy('Rent')}</i><i>{copy('Assets')}</i></span>
                <span className={styles.phoneImage}><Image src={phoneListing?.image && !phoneListing.image.startsWith('http') ? phoneListing.image : '/properties/house-02.jpg'} alt="" fill sizes="160px" /></span>
                <strong className={styles.phoneListing}>{phoneListing ? phoneListing.title : copy('Family house')}</strong>
                <small>{phoneListing ? phoneListing.location : copy('Kigali, Rwanda')}</small>
                <span className={styles.phoneBar}><Icon name="home" size={12} /><Icon name="heart" size={12} /><Icon name="user" size={12} /></span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <SiteFooter language={language} onLanguageChange={changeLanguage} darkMode={darkMode} onToggleTheme={toggleTheme} />
  </div>;
}
