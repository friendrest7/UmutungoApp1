'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AiChatbot } from './AiChatbot';
import { Icon } from './Icons';
import { InterfacePreferences } from './InterfacePreferences';
import { Navbar } from './Navbar';
import { PropertySearch } from './PropertySearch';
import { ConversationalPropertySearch } from './ConversationalPropertySearch';
import { Language, t } from '../data/translations';
import { usePersistentLanguage } from '../lib/language';
import { usePersistentTheme } from '../lib/theme';
import { testingListings } from '../data/testingListings';
import { getDistrictNames } from '../data/rwandaLocations';
import type { PropertyPlaceholder } from './PropertyCard';
import { PropertyViewer } from './PropertyViewer';
import { listFavorites, publicUmutungoApi, removeFavorite, saveFavorite, type FavoriteItem } from '../lib/umutungoApi';

type Listing = { id: string; title: string; location: string; price: string; intent: 'For rent' | 'For sale' | 'For sale or rent' | 'For lease' | 'For sale or lease' | 'Book'; detail: string; image: string; images?: string[]; listed?: string; verified?: boolean; testingOnly?: boolean; ownerName?: string; categoryName?: string; categorySlug?: string };
type CategoryConfig = { name: string; eyebrow: string; description: string; cover: string; accent: string; filters: string[] };


const cleanListingText = (value: string) => value
  .replace(/\u00c3\u201a\u00c2\u00b7|\u00c2\u00b7|\u00a0\u00b7/g, '\u00b7')
  .replace(/\u00c3\u201a\u00c2\u00b2|\u00c2\u00b2/g, '\u00b2');

const listing = (id: string, title: string, location: string, price: string, intent: Listing['intent'], detail: string, image: string, verified = false): Listing => ({ id, title, location, price, intent, detail, image, verified });

const normalizeListing = (item: Listing): Listing => ({
  ...item,
  location: cleanListingText(item.location),
  detail: cleanListingText(item.detail),
  price: cleanListingText(item.price),
});

const categoryConfigs: Record<string, CategoryConfig> = {
  properties: { name: 'Properties', eyebrow: '', description: 'Search for homes, apartments, land, commercial spaces, vehicles, furniture, appliances, equipment, and more, all in one place.', cover: '/properties/house-02.jpg', accent: '#39734b', filters: ['All properties', 'For rent', 'For sale'] },
  houses: { name: 'Houses', eyebrow: 'Homes with room to live', description: 'Family homes, townhouses, and standalone properties across Kigali and beyond.', cover: '/properties/house-02.jpg', accent: '#39734b', filters: ['All homes', 'For rent', 'For sale'] },
  apartments: { name: 'Apartments', eyebrow: 'City living, made easy', description: 'Well-located apartments for renting, buying, and making Kigali your base.', cover: '/properties/apartment-01.jpg', accent: '#527b83', filters: ['All apartments', 'For rent', 'For sale'] },
  land: { name: 'Land', eyebrow: 'A better place to begin', description: 'Residential, commercial, and development plots with the location details to plan your next move.', cover: '/properties/land-01.jpg', accent: '#788f55', filters: ['All land', 'Residential', 'Commercial'] },
  commercial: { name: 'Commercial', eyebrow: 'Spaces that mean business', description: 'Shops, workspaces, and commercial properties selected for visibility, access, and growth.', cover: '/properties/commercial-01.jpg', accent: '#9a6f4d', filters: ['All commercial', 'For rent', 'For sale'] },
  offices: { name: 'Offices', eyebrow: 'A better place to work', description: 'Professional offices and flexible workspaces for teams building in Rwanda.', cover: '/properties/commercial-02.jpg', accent: '#527b83', filters: ['All offices', 'For rent'] },
  equipment: { name: 'Equipment', eyebrow: 'Tools for the next project', description: 'Practical equipment listings from trusted local owners and businesses.', cover: '/properties/commercial-02.jpg', accent: '#65735f', filters: ['All equipment', 'For rent', 'For sale'] },
  hospitality: { name: 'Hospitality', eyebrow: 'Stay somewhere memorable', description: 'Hotels, guesthouses, and short stays with clear booking details.', cover: '/properties/apartment-02.jpg', accent: '#9a6f4d', filters: ['All stays', 'Book now'] },
  vehicles: { name: 'Vehicles', eyebrow: 'Move with confidence', description: 'Vehicles for sale, hire, and work across Rwanda with clear owner information.', cover: '/properties/vehicle-01.png', accent: '#4f7a63', filters: ['All vehicles', 'For rent', 'For sale'] },
  'car-parts': { name: 'Car parts', eyebrow: 'Parts for the road ahead', description: 'Find car parts and accessories listed by local sellers.', cover: '/properties/vehicle-01.png', accent: '#65735f', filters: ['All car parts', 'For sale'] },
  furniture: { name: 'Furniture', eyebrow: 'Make a space yours', description: 'Furniture for homes, offices, lodges, and other spaces.', cover: '/properties/tour-living.jpg', accent: '#8a674d', filters: ['All furniture', 'For rent', 'For sale'] },
  appliances: { name: 'Appliances', eyebrow: 'Useful things, ready to go', description: 'Home and commercial appliances from local owners and businesses.', cover: '/properties/tour-kitchen.jpg', accent: '#527b83', filters: ['All appliances', 'For rent', 'For sale'] },
  other: { name: 'Other assets', eyebrow: 'More ways to use Umutungo', description: 'Rentable, sellable, and bookable assets that do not fit one category.', cover: '/properties/story-detail.jpg', accent: '#65735f', filters: ['All assets', 'For rent', 'For sale', 'Book now'] },
};
const shopCategories: Array<{ slug: string; label: string; icon: 'home' | 'building' | 'leaf' | 'users' | 'car' | 'wrench' | 'appliance' }> = [
  { slug: 'properties', label: 'Properties', icon: 'building' },
  { slug: 'houses', label: 'Houses', icon: 'home' },
  { slug: 'apartments', label: 'Apartments', icon: 'building' },
  { slug: 'land', label: 'Land', icon: 'leaf' },
  { slug: 'commercial', label: 'Commercial', icon: 'building' },
  { slug: 'offices', label: 'Offices', icon: 'building' },
  { slug: 'hospitality', label: 'Hospitality', icon: 'home' },
  { slug: 'vehicles', label: 'Vehicles', icon: 'users' },
  { slug: 'car-parts', label: 'Car parts', icon: 'wrench' },
  { slug: 'furniture', label: 'Furniture', icon: 'building' },
  { slug: 'appliances', label: 'Home appliances', icon: 'appliance' },
  { slug: 'equipment', label: 'Equipment', icon: 'users' },
  { slug: 'other', label: 'Other', icon: 'users' },
];

const categoryAliases: Record<string, string[]> = {
  properties: ['house', 'houses', 'residential house', 'residential houses', 'residential', 'apartment', 'apartments', 'flat', 'flats', 'land', 'plot', 'plots', 'commercial', 'commercial building', 'commercial buildings', 'office', 'offices', 'hospitality', 'hotel', 'hotels', 'lodge', 'lodges', 'vehicle', 'vehicles', 'car', 'cars', 'car part', 'car parts', 'spare part', 'spare parts', 'auto parts', 'furniture', 'appliance', 'appliances', 'equipment', 'other', 'other asset', 'other assets'],
  houses: ['house', 'houses', 'residential house', 'residential houses', 'residential'],
  apartments: ['apartment', 'apartments', 'flat', 'flats'],
  land: ['land', 'plot', 'plots'],
  commercial: ['commercial', 'commercial building', 'commercial buildings'],
  offices: ['office', 'offices'],
  hospitality: ['hospitality', 'hotel', 'hotels', 'lodge', 'lodges'],
  vehicles: ['vehicle', 'vehicles', 'car', 'cars'],
  'car-parts': ['car part', 'car parts', 'spare part', 'spare parts', 'auto parts', 'automotive parts'],
  furniture: ['furniture'],
  appliances: ['appliance', 'appliances', 'home appliance', 'home appliances'],
  equipment: ['equipment'],
  other: ['other', 'other asset', 'other assets'],
};

const normalizedCategory = (value: string) => value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');

const toViewerProperty = (item: Listing, category: CategoryConfig): PropertyPlaceholder => {
  const priceMatch = item.price.match(/\s*\/\s*(month|night|day)$/);
  const bedrooms = Number(item.detail.match(/(\d+)\s*beds?/)?.[1] ?? 0);
  const bathrooms = Number(item.detail.match(/(\d+)\s*baths?/)?.[1] ?? 0);
  const area = Number(item.detail.match(/(\d+)\s*m/)?.[1] ?? 0);
  const type = category.name === 'Houses' ? 'House' : category.name === 'Apartments' || category.name === 'Hospitality' ? 'Apartment' : category.name === 'Land' ? 'Land' : category.name;
  const images = item.images?.length ? item.images : [item.image];

  const isRentOnly = item.intent === 'For rent' || item.intent === 'For lease';
  const isBoth = item.intent === 'For sale or rent' || item.intent === 'For sale or lease';
  return { id: item.id, title: item.title, type, location: item.location.replace(/\s*Â·\s*/g, ' - '), price: item.price.replace(/\s*\/\s*(month|night|day)$/, ''), priceNote: priceMatch ? `/ ${priceMatch[1]}` : isBoth ? item.intent === 'For sale or lease' ? ' sale or lease' : ' sale or rent' : '', bedrooms, bathrooms, area, accent: category.accent, image: item.image, images, listed: item.listed ?? 'Date unavailable', description: item.detail, availableFor: isBoth ? 'both' : isRentOnly ? 'rent' : 'sale' };
};

type DatabaseListing = { id: string; category: string; transaction_type: string; title: string; description: string; price: number; currency: string; province: string; district: string; sector: string; cell?: string; village?: string; status: string; tags?: string[]; amenities?: string[]; images?: string[]; media?: { url: string; type?: string; sort_order?: number }[]; created_at?: string; owner?: { verified?: boolean } };

const toDatabaseListing = (item: DatabaseListing, category: CategoryConfig): Listing => {
  const intent: Listing['intent'] = item.transaction_type === 'rent_out' || item.transaction_type === 'rent' ? 'For rent' : item.transaction_type === 'both' ? category.name === 'Land' ? 'For sale or lease' : 'For sale or rent' : item.transaction_type === 'book' ? 'Book' : 'For sale';
  const location = [item.sector, item.district, item.province].filter(Boolean).join(' Â· ');
  const dateLabel = item.created_at && !Number.isNaN(new Date(item.created_at).getTime()) ? `Listed on ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(item.created_at))}` : 'Date unavailable';
  const detail = [...[item.description, ...(item.amenities ?? [])].filter(Boolean), dateLabel].join(' Â· ') || 'Details available from the owner';
  const imageList = item.images?.filter(Boolean) ?? [];
  const images = imageList.length ? imageList : item.media?.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((media) => media.url).filter(Boolean) ?? [];
  const image = images[0] ?? '/properties/listing-placeholder.svg';
  return { ...listing(item.id, item.title, location, `${item.currency || 'RWF'} ${item.price.toLocaleString()}${intent === 'For rent' ? ' / month' : ''}`, intent, detail, image, item.owner?.verified ?? false), images, listed: item.created_at ? `Listed on ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(item.created_at))}` : 'Date unavailable' };
};

export function CategoryExperience({ slug, initialQuery = '', initialLocation = '', initialDistrict = '', initialSector = '', initialIntent = '', initialPriceRange = '' }: { slug: string; initialQuery?: string; initialLocation?: string; initialDistrict?: string; initialSector?: string; initialIntent?: string; initialPriceRange?: string }) {
  const { language, changeLanguage: setLanguage } = usePersistentLanguage();
  const { darkMode, toggleTheme } = usePersistentTheme();
  const rawCategory = categoryConfigs[slug] ?? categoryConfigs.properties;
  const category = { ...rawCategory, name: t(language, rawCategory.name), eyebrow: t(language, rawCategory.eyebrow), description: t(language, rawCategory.description) };
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState(category.filters[0]);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const categoryPickerRef = useRef<HTMLDivElement>(null);
  const [searchLocation, setSearchLocation] = useState(initialLocation || 'Kigali');
  const [searchDistrict, setSearchDistrict] = useState(initialDistrict);
  const [searchSector, setSearchSector] = useState(initialSector);
  const [searchType, setSearchType] = useState(slug === 'houses' ? 'House' : 'Any type');
  const [searchIntent, setSearchIntent] = useState(initialIntent || 'Buy or rent');
  const [searchPriceRange, setSearchPriceRange] = useState(initialPriceRange || 'Any price');
  const [saved, setSaved] = useState<string[]>([]);
  const [activeListing, setActiveListing] = useState<Listing | null>(null);
  const [databaseListings, setDatabaseListings] = useState<Listing[]>([]);
  const [listingLoadError, setListingLoadError] = useState(false);
  const [testingAccount, setTestingAccount] = useState(false);
  const [testingFirstName, setTestingFirstName] = useState('Umutungo');
  const [hoveredGalleryId, setHoveredGalleryId] = useState<string | null>(null);
  const [galleryIndexes, setGalleryIndexes] = useState<Record<string, number>>({});
  useEffect(() => {
    const readTestingAccount = () => {
      try {
        const account = JSON.parse(window.localStorage.getItem('umutungo-demo-user') ?? 'null') as { testingAccount?: boolean; testingFirstName?: string } | null;
        setTestingAccount(account?.testingAccount === true);
        setTestingFirstName(account?.testingFirstName || 'Umutungo');
      } catch { setTestingAccount(false); setTestingFirstName('Umutungo'); }
    };
    readTestingAccount();
    window.addEventListener('umutungo:auth-changed', readTestingAccount);
    window.addEventListener('storage', readTestingAccount);
    return () => { window.removeEventListener('umutungo:auth-changed', readTestingAccount); window.removeEventListener('storage', readTestingAccount); };
  }, []);
  const demoListings: Listing[] = useMemo(() => testingListings.filter((property) => slug === 'properties' || property.categorySlug === slug).map((property) => {
    const details = [property.bedrooms > 0 ? `${property.bedrooms} bedrooms` : '', property.bathrooms > 0 ? `${property.bathrooms} bathrooms` : '', property.area > 0 ? `${property.area} m²` : ''].filter(Boolean).join(', ');
    return {
      id: property.id, title: property.title, location: property.location,
      price: `${property.price}${property.priceNote.startsWith('/') ? ` ${property.priceNote}` : property.priceNote}`,
      intent: property.type === 'Hospitality' ? 'Book' : property.type === 'Land' && property.availableFor === 'rent' ? 'For lease' : property.availableFor === 'rent' ? 'For rent' : 'For sale',
      detail: details || `${property.type} listing`, image: property.image, images: property.images, listed: property.listed, testingOnly: true, categoryName: property.type, categorySlug: property.categorySlug,
      verified: false, ownerName: testingAccount ? testingFirstName : undefined,
    };
  }), [slug, testingAccount, testingFirstName]);
  const changeLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
  };
  useEffect(() => {
    if (!categoryPickerOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!categoryPickerRef.current?.contains(event.target as Node)) setCategoryPickerOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCategoryPickerOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [categoryPickerOpen]);
  const submitHouseSearch = () => {
    const categorySlugs: Record<string, string> = { 'Any type': 'properties', House: 'houses', Apartment: 'apartments', Land: 'land', Commercial: 'commercial' };
    const searchSlug = categorySlugs[searchType] ?? 'houses';
    const params = new URLSearchParams({ location: searchLocation, intent: searchIntent, priceRange: searchPriceRange });
    if (searchDistrict) params.set('district', searchDistrict);
    if (searchSector) params.set('sector', searchSector);
    if (query.trim()) params.set('q', query.trim());
    window.location.assign(`/categories/${searchSlug}?${params.toString()}`);
  };
  useEffect(() => {
    let cancelled = false;
    const aliases = categoryAliases[slug] ?? [normalizedCategory(rawCategory.name)];
    void publicUmutungoApi<{ items: DatabaseListing[] }>('/api/v1/listings', { cache: 'no-store' })
      .then((result) => {
        if (cancelled) return;
        setListingLoadError(false);
        const matchingItems = (result?.items ?? []).filter((item) => (slug === 'properties' || aliases.includes(normalizedCategory(item.category))) && (item.images?.some(Boolean) || item.media?.some((media) => Boolean(media.url))));
        setDatabaseListings(matchingItems.map((item) => {
          const itemCategory = Object.entries(categoryAliases).find(([categorySlug, itemAliases]) => categorySlug !== 'properties' && itemAliases.includes(normalizedCategory(item.category)))?.[0];
          const itemConfig = itemCategory ? categoryConfigs[itemCategory] : rawCategory;
          return { ...toDatabaseListing(item, itemConfig), categoryName: itemConfig.name };
        }));
      })
      .catch(() => { if (!cancelled) { setDatabaseListings([]); setListingLoadError(true); } });
    return () => { cancelled = true; };
  }, [rawCategory, slug]);
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
  const listings = useMemo(() => {
    const firstDemos = demoListings.filter((item) => item.id.endsWith('-1'));
    const otherDemos = demoListings.filter((item) => !item.id.endsWith('-1'));
    const categoryDemo = demoListings.filter((item) => item.categorySlug === slug && item.id.endsWith('-1'));
    const sourceListings = slug === 'properties'
      ? [...firstDemos, ...otherDemos, ...databaseListings]
      : [...categoryDemo, ...databaseListings, ...demoListings.filter((item) => item.categorySlug === slug && !item.id.endsWith('-1'))];
    const provinceDistricts = initialLocation ? getDistrictNames(initialLocation) : [];
    const filteredListings = sourceListings.filter((item) => {
    const ignoredQueryWords = ['in', 'near', 'for', 'a', 'the', 'to', 'with', 'buy', 'sell', 'sale', 'rent', 'lease', 'property', 'properties', ...(slug === 'properties' ? [] : (categoryAliases[slug] ?? []).flatMap((alias) => alias.split(' ')))];
    const queryWords = query.toLowerCase().split(/\s+/).filter((word) => word && !ignoredQueryWords.includes(word));
    const normalizedItemCategory = normalizedCategory(item.categoryName ?? '');
    const itemCategorySlug = Object.entries(categoryAliases).find(([categorySlug, aliases]) => categorySlug !== 'properties' && categoryConfigs[categorySlug] && (normalizedCategory(categoryConfigs[categorySlug].name) === normalizedItemCategory || aliases.includes(normalizedItemCategory)))?.[0];
    const itemCategoryWords = itemCategorySlug ? categoryAliases[itemCategorySlug] ?? [] : [];
    const searchableText = `${item.title} ${item.location} ${item.detail} ${category.name} ${item.categoryName ?? ''} ${itemCategoryWords.join(' ')}`.toLowerCase();
    const matchesQuery = queryWords.every((word) => searchableText.includes(word));
    const matchesLocation = !initialLocation || initialLocation === 'Kigali' || item.location.toLowerCase().includes(initialLocation.toLowerCase()) || provinceDistricts.some((districtName) => item.location.toLowerCase().includes(districtName.toLowerCase()));
    const matchesDistrict = !initialDistrict || item.location.toLowerCase().includes(initialDistrict.toLowerCase());
    const matchesSector = !initialSector || item.location.toLowerCase().includes(initialSector.toLowerCase());
    const matchesIntent = !initialIntent || initialIntent === 'Buy or rent' || (initialIntent === 'Rent' && (item.intent === 'For rent' || item.intent === 'For sale or rent' || item.intent === 'For lease' || item.intent === 'For sale or lease')) || (initialIntent === 'Buy' && (item.intent === 'For sale' || item.intent === 'For sale or rent' || item.intent === 'For sale or lease'));
    const numericPrice = Number(item.price.replace(/[^0-9]/g, ''));
    const matchesPrice = !initialPriceRange || initialPriceRange === 'Any price' || (initialPriceRange === 'Under RWF 500,000' && numericPrice < 500000) || (initialPriceRange === 'RWF 500,000 - 1,000,000' && numericPrice >= 500000 && numericPrice <= 1000000) || (initialPriceRange === 'Over RWF 1,000,000' && numericPrice > 1000000);
    const selectedCategory = Object.entries(categoryConfigs).find(([categorySlug, config]) => categorySlug !== 'properties' && config.name === filter);
    const itemCategoryName = normalizedCategory(item.categoryName ?? '');
    const matchesCategory = filter === 'All properties' || Boolean(selectedCategory && (normalizedCategory(selectedCategory[1].name) === itemCategoryName || (categoryAliases[selectedCategory[0]] ?? []).includes(itemCategoryName)));
    const matchesFilter = slug === 'properties'
      ? matchesCategory
      : filter.startsWith('All') || (filter === 'For rent' && ['For rent', 'For sale or rent', 'For lease', 'For sale or lease'].includes(item.intent)) || (filter === 'For sale' && ['For sale', 'For sale or rent', 'For sale or lease'].includes(item.intent)) || (filter === 'Book now' && item.intent === 'Book') || ['Residential', 'Commercial', 'Private office', 'Open workspace'].includes(filter);
      return matchesQuery && matchesLocation && matchesDistrict && matchesSector && matchesIntent && matchesPrice && matchesFilter;
    }).map(normalizeListing);
    return slug === 'properties' ? filteredListings : filteredListings.slice(0, 10);
  }, [category, databaseListings, demoListings, filter, initialDistrict, initialIntent, initialLocation, initialPriceRange, initialSector, query, slug]);
  useEffect(() => {
    const item = listings.find((listingItem) => listingItem.id === hoveredGalleryId);
    const imageCount = item?.images?.length ?? 0;
    if (!hoveredGalleryId || imageCount < 2) return;
    const timer = window.setInterval(() => setGalleryIndexes((current) => ({ ...current, [hoveredGalleryId]: ((current[hoveredGalleryId] ?? 1) + 1) % imageCount })), 2200);
    return () => window.clearInterval(timer);
  }, [hoveredGalleryId, listings]);
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
    <section className={`category-experience-hero ${slug === 'apartments' ? 'no-hero-copy' : ''} ${slug === 'houses' ? 'houses-category-hero' : ''}`} style={{ backgroundImage: `linear-gradient(90deg, rgba(8, 18, 10, .78), rgba(8, 18, 10, .2)), url(${category.cover})` }}>{slug !== 'apartments' && <div>{slug === 'properties' ? <h1 className="properties-hero-heading">Umutungo<br /><em>property search hub</em></h1> : <h1>{t(language, category.eyebrow)}</h1>}{category.description && <p>{t(language, category.description)}</p>}</div>}<div className="category-search-box"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${t(language, 'Search')} ${translatedCategoryName.toLowerCase()} ${t(language, 'by location or feature')}`} /><button type="button" aria-label={t(language, 'Search category')} onClick={() => setQuery(query.trim())}><Icon name="arrow" size={15} /></button></div></section>
    {slug === 'properties' && <div className="container conversational-property-search-wrap"><ConversationalPropertySearch language={language} /></div>}
    {slug === 'houses' && <section className="houses-property-search"><div className="container"><PropertySearch language={language} location={searchLocation} district={searchDistrict} sector={searchSector} type={searchType} intent={searchIntent} priceRange={searchPriceRange} onLocationChange={(value) => { setSearchLocation(value); setSearchDistrict(''); setSearchSector(''); }} onDistrictChange={(value) => { setSearchDistrict(value); setSearchSector(''); }} onSectorChange={setSearchSector} onTypeChange={setSearchType} onIntentChange={setSearchIntent} onPriceRangeChange={setSearchPriceRange} onSubmit={submitHouseSearch} /></div></section>}
    <section className="category-experience-body">
      <div className={`category-catalog-toolbar ${slug === 'properties' ? 'properties-catalog-toolbar' : ''}`}>
        <div className="category-results-heading"><div><span className="category-experience-eyebrow">{listings.length} property listings</span><h2>Find the properties you need.</h2><p>Browse listings for free.</p></div></div>
        <div className={`category-filter-row ${slug === 'properties' || slug === 'houses' ? 'category-filter-row-select' : ''}`}>{slug === 'properties' ? <div className="category-picker" ref={categoryPickerRef}><span className="category-picker-label">Browse categories</span><button className="category-picker-trigger" type="button" aria-label="Filter listings by category" aria-expanded={categoryPickerOpen} aria-controls="property-category-options" onClick={() => setCategoryPickerOpen((open) => !open)}><span className="category-picker-trigger-icon"><Icon name={shopCategories.find((item) => categoryConfigs[item.slug]?.name === filter)?.icon ?? 'building'} size={16} /></span><strong>{filter === 'All properties' ? 'All categories' : filter}</strong><Icon name="chevron" size={15} /></button>{categoryPickerOpen && <div className="category-picker-menu" id="property-category-options" role="listbox" aria-label="Property categories"><button className={`category-picker-option ${filter === 'All properties' ? 'is-active' : ''}`} type="button" role="option" aria-selected={filter === 'All properties'} onClick={() => { setFilter('All properties'); setCategoryPickerOpen(false); }}><span><Icon name="building" size={17} /></span><strong>All categories</strong><small>See every listing</small></button>{shopCategories.filter((item) => item.slug !== 'properties').map((item) => <button className={`category-picker-option ${filter === categoryConfigs[item.slug]?.name ? 'is-active' : ''}`} type="button" role="option" aria-selected={filter === categoryConfigs[item.slug]?.name} key={item.slug} onClick={() => { setFilter(categoryConfigs[item.slug]?.name ?? 'All properties'); setCategoryPickerOpen(false); }}><span><Icon name={item.icon} size={17} /></span><strong>{categoryConfigs[item.slug]?.name}</strong><small>Browse {categoryConfigs[item.slug]?.name.toLowerCase()}</small></button>)}</div>}</div> : slug === 'houses' ? <label className="category-filter-select-label"><span>Listing type</span><select aria-label="Filter homes by listing type" value={filter} onChange={(event) => setFilter(event.target.value)}>{category.filters.map((item) => <option key={item} value={item}>{item}</option>)}</select></label> : category.filters.map((item) => <button className={filter === item ? 'active' : ''} key={item} type="button" onClick={() => setFilter(item)}>{item}</button>)}</div>
      </div>
      {listings.length ? <>
        <div className="owner-listing-heading"><h2>Property listings</h2><p>{listings.some((item) => item.testingOnly) ? 'Demo listings are examples; availability and prices may not be current.' : 'Listings posted directly to Umutungo.'}</p></div>
        <div className="category-listing-grid">{listings.map((item) => <article className="category-listing-card" key={item.id}>
          <div className="category-listing-image" onMouseEnter={() => { setHoveredGalleryId(item.id); setGalleryIndexes((current) => ({ ...current, [item.id]: 1 })); }} onMouseLeave={() => { setHoveredGalleryId(null); setGalleryIndexes((current) => ({ ...current, [item.id]: 0 })); }} onFocus={() => { setHoveredGalleryId(item.id); setGalleryIndexes((current) => ({ ...current, [item.id]: 1 })); }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { setHoveredGalleryId(null); setGalleryIndexes((current) => ({ ...current, [item.id]: 0 })); } }}>
            <div className="category-listing-image-track" style={{ transform: `translateX(-${(galleryIndexes[item.id] ?? 0) * 100}%)` }}>{(item.images?.length ? item.images : [item.image]).map((image, imageIndex) => <span className="category-listing-image-slide" key={`${image}-${imageIndex}`} style={{ backgroundImage: `linear-gradient(180deg, transparent 45%, rgba(5, 15, 8, .64)), url(${image})` }} />)}</div>
            <button className={`category-save ${saved.includes(item.id) ? 'saved' : ''}`} type="button" aria-label={`Save ${item.title}`} onClick={() => toggleListingFavorite(item)}><Icon name="heart" size={16} filled={saved.includes(item.id)} /></button>
            {item.testingOnly && <span className="category-demo-badge">Demo listing</span>}
            {item.verified && <span className="category-verified"><Icon name="check" size={12} /> Verified</span>}
          </div>
          <div className="category-listing-copy"><div className="category-listing-meta"><span className={`listing-intent ${item.intent === 'For sale' ? 'for-sale' : item.intent === 'For rent' ? 'for-rent' : ''}`}>{item.intent}</span></div>
            <h3>{item.title}</h3><p><Icon name="pin" size={13} /> {item.location}</p>{item.testingOnly && <small className="listing-owner-name"><span>{item.ownerName?.slice(0, 1).toUpperCase()}</span> Listed by {item.ownerName}</small>}
            <div className="category-listing-footer"><div><strong>{item.price}</strong><small>{item.detail}</small></div><button className="category-view-button" type="button" onClick={() => setActiveListing(item)}>View property <Icon name="arrow" size={13} /></button></div>
          </div>
        </article>)}</div>
      </> : null}
    </section>
    {activeListing && <PropertyViewer language={language} property={toViewerProperty(activeListing, rawCategory)} initialMode="tour" onClose={() => setActiveListing(null)} />}
  </main><AiChatbot language={language} /></div>;
}
