'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AiChatbot } from './AiChatbot';
import { Icon } from './Icons';
import { InterfacePreferences } from './InterfacePreferences';
import { Navbar } from './Navbar';
import { Language, t } from '../data/translations';
import { usePersistentLanguage } from '../lib/language';
import { usePersistentTheme } from '../lib/theme';
import type { PropertyPlaceholder } from './PropertyCard';
import { PropertyViewer } from './PropertyViewer';
import { listFavorites, publicUmutungoApi, removeFavorite, saveFavorite, type FavoriteItem } from '../lib/umutungoApi';

type Listing = { id: string; title: string; location: string; price: string; intent: 'For rent' | 'For sale' | 'Book'; detail: string; rating: string; image: string; verified?: boolean };
type CategoryConfig = { name: string; eyebrow: string; description: string; cover: string; accent: string; filters: string[]; listings: Listing[] };

const listing = (id: string, title: string, location: string, price: string, intent: Listing['intent'], detail: string, image: string, rating = '4.8', verified = false): Listing => ({ id, title, location, price, intent, detail, image: title === 'Quiet home near Rebero' ? '/properties/house-01.jpg' : title === 'Development plot with city views' ? '/properties/land-01.jpg' : image, rating, verified });

const cleanListingText = (value: string) => value
  .replace(/\u00c3\u201a\u00c2\u00b7|\u00c2\u00b7|\u00a0\u00b7/g, '\u00b7')
  .replace(/\u00c3\u201a\u00c2\u00b2|\u00c2\u00b2/g, '\u00b2');

const normalizeListing = (item: Listing): Listing => ({
  ...item,
  location: cleanListingText(item.location),
  detail: cleanListingText(item.detail),
  price: cleanListingText(item.price),
});

const categoryConfigs: Record<string, CategoryConfig> = {
  houses: { name: 'Houses', eyebrow: 'Homes with room to live', description: 'Family homes, townhouses, and standalone properties across Kigali and beyond.', cover: '/properties/house-02.jpg', accent: '#39734b', filters: ['All homes', 'For rent', 'For sale'], listings: [listing('house-1', 'Four-bedroom home with garden', 'Gisozi Â· Kigali', 'RWF 1,250,000 / month', 'For rent', '4 beds Â· 3 baths Â· 220 mÂ²', '/properties/house-01.jpg', '4.9', true), listing('house-2', 'Nyarutarama family residence', 'Nyarutarama Â· Kigali', 'RWF 2,400,000 / month', 'For rent', '5 beds Â· 4 baths Â· 310 mÂ²', '/properties/house-02.jpg', '4.8', true), listing('house-3', 'Quiet home near Rebero', 'Rebero Â· Kigali', 'RWF 185,000,000', 'For sale', '4 beds Â· 3 baths Â· 280 mÂ²', '/properties/kigali-neighborhood.jpg', '4.7')] },
  apartments: { name: 'Apartments', eyebrow: 'City living, made easy', description: 'Well-located apartments for renting, buying, and making Kigali your base.', cover: '/properties/apartment-01.jpg', accent: '#527b83', filters: ['All apartments', 'For rent', 'For sale'], listings: [listing('apt-1', 'Light-filled Kacyiru apartment', 'Kacyiru Â· Kigali', 'RWF 1,100,000 / month', 'For rent', '2 beds Â· 2 baths Â· 118 mÂ²', '/properties/apartment-01.jpg', '4.9', true), listing('apt-2', 'Modern apartment near Kimihurura', 'Kimihurura Â· Kigali', 'RWF 1,650,000 / month', 'For rent', '3 beds Â· 2 baths Â· 145 mÂ²', '/properties/apartment-02.jpg', '4.8', true), listing('apt-3', 'Compact city apartment', 'Kicukiro Â· Kigali', 'RWF 78,000,000', 'For sale', '2 beds Â· 2 baths Â· 94 mÂ²', '/properties/apartment-02.jpg', '4.6')] },
  land: { name: 'Land', eyebrow: 'A better place to begin', description: 'Residential, commercial, and development plots with the location details to plan your next move.', cover: '/properties/land-01.jpg', accent: '#788f55', filters: ['All land', 'Residential', 'Commercial'], listings: [listing('land-1', 'Residential plot in Gacuriro', 'Gacuriro Â· Kigali', 'RWF 85,000,000', 'For sale', '620 mÂ² Â· Residential Â· Road access', '/properties/land-01.jpg', '4.8', true), listing('land-2', 'Development plot with city views', 'Kicukiro Â· Kigali', 'RWF 120,000,000', 'For sale', '850 mÂ² Â· Mixed use Â· Serviced', '/properties/kigali-neighborhood.jpg', '4.7'), listing('land-3', 'Growing neighbourhood plot', 'Gasabo Â· Kigali', 'RWF 48,000,000', 'For sale', '400 mÂ² Â· Residential Â· Title ready', '/properties/land-01.jpg', '4.6')] },
  commercial: { name: 'Commercial', eyebrow: 'Spaces that mean business', description: 'Shops, workspaces, and commercial properties selected for visibility, access, and growth.', cover: '/properties/commercial-01.jpg', accent: '#9a6f4d', filters: ['All commercial', 'For rent', 'For sale'], listings: [listing('commercial-1', 'Street-facing commercial space', 'Remera Â· Kigali', 'RWF 1,900,000 / month', 'For rent', '180 mÂ² Â· Retail Â· Parking', '/properties/commercial-01.jpg', '4.8', true), listing('commercial-2', 'Flexible office in Kicukiro', 'Kicukiro Â· Kigali', 'RWF 2,250,000 / month', 'For rent', '240 mÂ² Â· Office Â· 2 baths', '/properties/commercial-02.jpg', '4.7', true), listing('commercial-3', 'Corner retail property', 'Nyabugogo Â· Kigali', 'RWF 265,000,000', 'For sale', '310 mÂ² Â· Retail Â· Main road', '/properties/commercial-01.jpg', '4.6')] },
  offices: { name: 'Offices', eyebrow: 'A better place to work', description: 'Professional offices and flexible workspaces for teams building in Rwanda.', cover: '/properties/commercial-02.jpg', accent: '#527b83', filters: ['All offices', 'For rent'], listings: [listing('office-1', 'Flexible office in Kicukiro', 'Kicukiro Â· Kigali', 'RWF 2,250,000 / month', 'For rent', '240 mÂ² Â· 2 baths Â· Parking', '/properties/commercial-02.jpg', '4.8', true), listing('office-2', 'Bright team workspace', 'Kacyiru Â· Kigali', 'RWF 1,450,000 / month', 'For rent', '120 mÂ² Â· Furnished Â· Meeting room', '/properties/commercial-01.jpg', '4.7')] },
  equipment: { name: 'Equipment', eyebrow: 'Tools for the next project', description: 'Practical equipment listings from trusted local owners and businesses.', cover: '/properties/commercial-02.jpg', accent: '#65735f', filters: ['All equipment', 'For rent', 'For sale'], listings: [listing('equipment-1', 'Construction equipment package', 'Kigali Â· Rwanda', 'RWF 180,000 / day', 'For rent', 'Verified owner Â· Delivery available', '/properties/commercial-02.jpg', '4.8', true), listing('equipment-2', 'Commercial kitchen equipment', 'Remera Â· Kigali', 'RWF 7,500,000', 'For sale', 'Good condition Â· Inspection available', '/properties/commercial-01.jpg', '4.6')] },
  hospitality: { name: 'Hospitality', eyebrow: 'Stay somewhere memorable', description: 'Hotels, guesthouses, and short stays with clear booking details.', cover: '/properties/apartment-02.jpg', accent: '#9a6f4d', filters: ['All stays', 'Book now'], listings: [listing('hospitality-1', 'Kigali garden guesthouse', 'Kimihurura Â· Kigali', 'RWF 95,000 / night', 'Book', '2 guests Â· Breakfast Â· Wi-Fi', '/properties/apartment-02.jpg', '4.9', true), listing('hospitality-2', 'Quiet serviced apartment', 'Nyarutarama Â· Kigali', 'RWF 180,000 / night', 'Book', '4 guests Â· 2 beds Â· Kitchen', '/properties/apartment-01.jpg', '4.8', true)] },
};

categoryConfigs.vehicles = { name: 'Vehicles', eyebrow: 'Move with confidence', description: 'Vehicles for sale, hire, and work across Rwanda with clear owner information.', cover: '/properties/vehicle-01.png', accent: '#4f7a63', filters: ['All vehicles', 'For rent', 'For sale'], listings: [listing('vehicle-1', 'Reliable family SUV', 'Kigali Ã‚Â· Rwanda', 'RWF 85,000 / day', 'For rent', '5 seats Ã‚Â· Insured Ã‚Â· Delivery available', '/properties/vehicle-01.png', '4.8', true)] };
categoryConfigs.furniture = { name: 'Furniture', eyebrow: 'Make a space yours', description: 'Furniture for homes, offices, lodges, and other spaces.', cover: '/properties/tour-living.jpg', accent: '#8a674d', filters: ['All furniture', 'For rent', 'For sale'], listings: [listing('furniture-1', 'Living room furniture set', 'Kigali Ã‚Â· Rwanda', 'RWF 1,800,000', 'For sale', 'Sofa Ã‚Â· Table Ã‚Â· Ready for delivery', '/properties/tour-living.jpg', '4.7', true)] };
categoryConfigs.appliances = { name: 'Appliances', eyebrow: 'Useful things, ready to go', description: 'Home and commercial appliances from local owners and businesses.', cover: '/properties/tour-kitchen.jpg', accent: '#527b83', filters: ['All appliances', 'For rent', 'For sale'], listings: [listing('appliance-1', 'Complete kitchen appliance set', 'Kigali Ã‚Â· Rwanda', 'RWF 2,400,000', 'For sale', 'Good condition Ã‚Â· Inspection available', '/properties/tour-kitchen.jpg', '4.6', true)] };
categoryConfigs.other = { name: 'Other assets', eyebrow: 'More ways to use Umutungo', description: 'Rentable, sellable, and bookable assets that do not fit one category.', cover: '/properties/story-detail.jpg', accent: '#65735f', filters: ['All assets', 'For rent', 'For sale', 'Book now'], listings: [listing('other-1', 'Event equipment package', 'Kigali Ã‚Â· Rwanda', 'RWF 250,000 / day', 'For rent', 'Flexible booking Ã‚Â· Delivery available', '/properties/story-detail.jpg', '4.7', true)] };

const viewerImages: Record<string, string[]> = {
  Houses: ['/properties/house-01.jpg', '/properties/house-02.jpg', '/properties/tour-living.jpg', '/properties/tour-kitchen.jpg', '/properties/tour-bedroom-real.jpg'],
  Apartments: ['/properties/apartment-01.jpg', '/properties/apartment-02.jpg', '/properties/tour-living.jpg', '/properties/tour-kitchen.jpg', '/properties/tour-bedroom-real.jpg'],
  Land: ['/properties/land-01.jpg', '/properties/kigali-neighborhood.jpg', '/properties/tour-exterior.jpg'],
  Commercial: ['/properties/commercial-01.jpg', '/properties/commercial-02.jpg', '/properties/tour-interior.jpg', '/properties/tour-kitchen.jpg'],
  Offices: ['/properties/commercial-02.jpg', '/properties/commercial-01.jpg', '/properties/tour-interior.jpg'],
  Equipment: ['/properties/commercial-02.jpg', '/properties/commercial-01.jpg', '/properties/tour-interior.jpg'],
  Hospitality: ['/properties/apartment-02.jpg', '/properties/apartment-01.jpg', '/properties/tour-living.jpg', '/properties/tour-bedroom-real.jpg'],
  Vehicles: ['/properties/commercial-02.jpg'], Furniture: ['/properties/tour-living.jpg'], Appliances: ['/properties/tour-kitchen.jpg'], 'Other assets': ['/properties/story-detail.jpg'],
};

const shopCategories: Array<{ slug: string; label: string; icon: 'home' | 'building' | 'leaf' | 'users' }> = [
  { slug: 'houses', label: 'Houses', icon: 'home' },
  { slug: 'apartments', label: 'Apartments', icon: 'building' },
  { slug: 'land', label: 'Land', icon: 'leaf' },
  { slug: 'commercial', label: 'Commercial', icon: 'building' },
  { slug: 'offices', label: 'Offices', icon: 'building' },
  { slug: 'hospitality', label: 'Hospitality', icon: 'home' },
  { slug: 'vehicles', label: 'Vehicles', icon: 'users' },
  { slug: 'furniture', label: 'Furniture', icon: 'building' },
  { slug: 'appliances', label: 'Appliances', icon: 'building' },
  { slug: 'equipment', label: 'Equipment', icon: 'users' },
  { slug: 'other', label: 'Other', icon: 'users' },
];

const toViewerProperty = (item: Listing, category: CategoryConfig): PropertyPlaceholder => {
  const priceMatch = item.price.match(/\s*\/\s*(month|night|day)$/);
  const bedrooms = Number(item.detail.match(/(\d+)\s*beds?/)?.[1] ?? 0);
  const bathrooms = Number(item.detail.match(/(\d+)\s*baths?/)?.[1] ?? 0);
  const area = Number(item.detail.match(/(\d+)\s*m/)?.[1] ?? 0);
  const type = category.name === 'Houses' ? 'House' : category.name === 'Apartments' || category.name === 'Hospitality' ? 'Apartment' : category.name === 'Land' ? 'Land' : category.name;
  const images = viewerImages[category.name] ?? [item.image];

  return { id: item.id, title: item.title, type, location: item.location.replace(/\s*Â·\s*/g, ' - '), price: item.price.replace(/\s*\/\s*(month|night|day)$/, ''), priceNote: priceMatch ? `/ ${priceMatch[1]}` : ' asking', bedrooms, bathrooms, area, accent: category.accent, image: item.image, images: [item.image, ...images.filter((image) => image !== item.image)], listed: 'Listed recently', availableFor: item.intent === 'For sale' ? 'sale' : 'rent' };
};

type DatabaseListing = { id: string; category: string; transaction_type: string; title: string; description: string; price: number; currency: string; province: string; district: string; sector: string; cell?: string; village?: string; status: string; tags?: string[]; amenities?: string[] };

const toDatabaseListing = (item: DatabaseListing, category: CategoryConfig): Listing => {
  const intent: Listing['intent'] = item.transaction_type === 'rent_out' || item.transaction_type === 'rent' ? 'For rent' : item.transaction_type === 'book' ? 'Book' : 'For sale';
  const location = [item.sector, item.district, item.province].filter(Boolean).join(' Â· ');
  const detail = [item.description, ...(item.amenities ?? [])].filter(Boolean).join(' Â· ') || 'Details available from the owner';
  return listing(item.id, item.title, location, `${item.currency || 'RWF'} ${item.price.toLocaleString()}${intent === 'For rent' ? ' / month' : ''}`, intent, detail, category.cover, 'New', true);
};

export function CategoryExperience({ slug, initialQuery = '', initialLocation = '', initialDistrict = '', initialSector = '', initialIntent = '', initialPriceRange = '' }: { slug: string; initialQuery?: string; initialLocation?: string; initialDistrict?: string; initialSector?: string; initialIntent?: string; initialPriceRange?: string }) {
  const { language, changeLanguage: setLanguage } = usePersistentLanguage();
  const { darkMode, toggleTheme } = usePersistentTheme();
  const rawCategory = categoryConfigs[slug] ?? categoryConfigs.houses;
  const category = { ...rawCategory, name: t(language, rawCategory.name), eyebrow: t(language, rawCategory.eyebrow), description: t(language, rawCategory.description) };
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState(category.filters[0]);
  const [saved, setSaved] = useState<string[]>([]);
  const [activeListing, setActiveListing] = useState<Listing | null>(null);
  const [databaseListings, setDatabaseListings] = useState<Listing[]>([]);
  const changeLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
  };
  useEffect(() => {
    let cancelled = false;
    const categoryName = rawCategory.name.toLowerCase().replace(/s$/, '');
    void publicUmutungoApi<{ items: DatabaseListing[] }>(`/api/v1/listings?category=${encodeURIComponent(categoryName)}`)
      .then((result) => { if (!cancelled) setDatabaseListings((result?.items ?? []).map((item) => toDatabaseListing(item, rawCategory))); })
      .catch(() => { if (!cancelled) setDatabaseListings([]); });
    return () => { cancelled = true; };
  }, [rawCategory]);
  useEffect(() => {
    const readFavorites = () => {
      try {
        const stored = JSON.parse(window.localStorage.getItem('umutungo-favorites') ?? '[]') as FavoriteItem[];
        setSaved(Array.isArray(stored) ? stored.map((item) => item.property_id) : []);
      } catch {
        setSaved([]);
      }
    };
    readFavorites();
    window.addEventListener('umutungo:favorites-changed', readFavorites);
    void listFavorites().then((remote) => {
      if (remote === null) return;
      window.localStorage.setItem('umutungo-favorites', JSON.stringify(remote));
      window.dispatchEvent(new Event('umutungo:favorites-changed'));
    }).catch(() => undefined);
    return () => window.removeEventListener('umutungo:favorites-changed', readFavorites);
  }, []);
  const translatedCategoryName = t(language, category.name);
  const listings = useMemo(() => [...databaseListings, ...category.listings].filter((item) => {
    const matchesQuery = `${item.title} ${item.location} ${item.detail}`.toLowerCase().includes(query.toLowerCase());
    const matchesLocation = !initialLocation || initialLocation === 'Kigali' || item.location.toLowerCase().includes(initialLocation.toLowerCase());
    const matchesDistrict = !initialDistrict || item.location.toLowerCase().includes(initialDistrict.toLowerCase());
    const matchesSector = !initialSector || item.location.toLowerCase().includes(initialSector.toLowerCase());
    const matchesIntent = !initialIntent || initialIntent === 'Buy or rent' || (initialIntent === 'Rent' && item.intent === 'For rent') || (initialIntent === 'Buy' && item.intent === 'For sale');
    const numericPrice = Number(item.price.replace(/[^0-9]/g, ''));
    const matchesPrice = !initialPriceRange || initialPriceRange === 'Any price' || (initialPriceRange === 'Under RWF 500,000' && numericPrice < 500000) || (initialPriceRange === 'RWF 500,000 - 1,000,000' && numericPrice >= 500000 && numericPrice <= 1000000) || (initialPriceRange === 'Over RWF 1,000,000' && numericPrice > 1000000);
    const matchesFilter = filter.startsWith('All') || (filter === 'For rent' && item.intent === 'For rent') || (filter === 'For sale' && item.intent === 'For sale') || (filter === 'Book now' && item.intent === 'Book') || ['Residential', 'Commercial', 'Private office', 'Open workspace'].includes(filter);
    return matchesQuery && matchesLocation && matchesDistrict && matchesSector && matchesIntent && matchesPrice && matchesFilter;
  }).map(normalizeListing), [category, databaseListings, filter, initialDistrict, initialIntent, initialLocation, initialPriceRange, initialSector, query]);

  const toggleListingFavorite = (item: Listing) => {
    const wasSaved = saved.includes(item.id);
    const favorite: FavoriteItem = { property_id: item.id, title: item.title, type: category.name, location: item.location.replace(/\s*Â·\s*/g, ' - '), price: item.price, image: item.image };
    let currentItems: FavoriteItem[] = [];
    try {
      const stored = JSON.parse(window.localStorage.getItem('umutungo-favorites') ?? '[]') as FavoriteItem[];
      currentItems = Array.isArray(stored) ? stored : [];
    } catch { currentItems = []; }
    const nextItems = wasSaved ? currentItems.filter((savedItem) => savedItem.property_id !== item.id) : [...currentItems, favorite];
    window.localStorage.setItem('umutungo-favorites', JSON.stringify(nextItems));
    window.dispatchEvent(new Event('umutungo:favorites-changed'));
    void (wasSaved ? removeFavorite(item.id) : saveFavorite(favorite)).catch(() => undefined);
  };

  return <div className={`${darkMode ? 'app theme-dark' : 'app'} app-realistic category-shell`}><Navbar darkMode={darkMode} onToggleTheme={toggleTheme} language={language} onLanguageChange={changeLanguage} /><main className="category-experience" style={{ '--category-accent': category.accent } as React.CSSProperties}>
    <header className="category-experience-header"><Link href="/" className="category-back"><Icon name="home" size={15} /> {t(language, 'Home')}</Link><nav className="category-shop-nav" aria-label={t(language, 'Property shop categories')}>{shopCategories.map((item) => <Link className={item.slug === slug ? 'is-active' : ''} href={`/categories/${item.slug}`} key={item.slug}><Icon name={item.icon} size={14} />{t(language, item.label)}</Link>)}</nav><div><span>{translatedCategoryName}</span><Link href="/">Umutungo <Icon name="arrow" size={14} /></Link></div><InterfacePreferences /></header>
    <section className="category-experience-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(8, 18, 10, .78), rgba(8, 18, 10, .2)), url(${category.cover})` }}><div><span className="category-experience-eyebrow">{t(language, category.eyebrow)}</span><h1>{t(language, 'Find your next')}<br /><em>{translatedCategoryName.toLowerCase()} {t(language, 'space.')}</em></h1><p>{t(language, category.description)}</p></div><div className="category-search-box"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${t(language, 'Search')} ${translatedCategoryName.toLowerCase()} ${t(language, 'by location or feature')}`} /><button type="button" aria-label={t(language, 'Search category')} onClick={() => setQuery(query.trim())}><Icon name="arrow" size={15} /></button></div></section>
    <section className="category-experience-body"><div className="category-results-heading"><div><span className="category-experience-eyebrow">{listings.length} available now</span><h2>Explore {category.name.toLowerCase()}</h2></div><button className="category-map-button" type="button"><Icon name="pin" size={15} /> Map view</button></div><div className="category-filter-row">{category.filters.map((item) => <button className={filter === item ? 'active' : ''} key={item} type="button" onClick={() => setFilter(item)}>{item}</button>)}</div>{listings.length ? <div className="category-listing-grid">{listings.map((item) => <article className="category-listing-card" key={item.id}><div className="category-listing-image" style={{ backgroundImage: `linear-gradient(180deg, transparent 45%, rgba(5, 15, 8, .64)), url(${item.image})` }}><button className={`category-save ${saved.includes(item.id) ? 'saved' : ''}`} type="button" aria-label={`Save ${item.title}`} onClick={() => toggleListingFavorite(item)}><Icon name="heart" size={16} filled={saved.includes(item.id)} /></button>{item.verified && <span className="category-verified"><Icon name="check" size={12} /> Verified</span>}</div><div className="category-listing-copy"><div className="category-listing-meta"><span className={`listing-intent ${item.intent === 'For sale' ? 'for-sale' : item.intent === 'For rent' ? 'for-rent' : ''}`}>{item.intent}</span><span className="category-stars" aria-label={`Rated ${item.rating} out of 5`}>{String.fromCharCode(9733)} {item.rating}</span></div><h3>{item.title}</h3><p><Icon name="pin" size={13} /> {item.location}</p><div className="category-listing-footer"><div><strong>{item.price}</strong><small>{item.detail}</small></div><button className="category-view-button" type="button" onClick={() => setActiveListing(item)}>View property <Icon name="arrow" size={13} /></button></div></div></article>)}</div> : <div className="category-empty"><Icon name="search" size={21} /><h3>No listings match that search</h3><p>Try another neighbourhood, property type, or clear the filter.</p><button type="button" onClick={() => { setQuery(''); setFilter(category.filters[0]); }}>Clear search</button></div>}</section>
    {activeListing && <PropertyViewer language={language} property={toViewerProperty(activeListing, rawCategory)} onClose={() => setActiveListing(null)} />}
  </main><AiChatbot language={language} /></div>;
}
