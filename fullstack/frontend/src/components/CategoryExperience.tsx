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

type Listing = { id: string; title: string; location: string; price: string; intent: 'For rent' | 'For sale' | 'Book'; detail: string; rating: string; image: string; images?: string[]; listed?: string; verified?: boolean; sample?: boolean };
type CategoryConfig = { name: string; eyebrow: string; description: string; cover: string; accent: string; filters: string[]; listings: Listing[] };


const cleanListingText = (value: string) => value
  .replace(/\u00c3\u201a\u00c2\u00b7|\u00c2\u00b7|\u00a0\u00b7/g, '\u00b7')
  .replace(/\u00c3\u201a\u00c2\u00b2|\u00c2\u00b2/g, '\u00b2');

const listing = (id: string, title: string, location: string, price: string, intent: Listing['intent'], detail: string, image: string, rating = '4.8', verified = false): Listing => ({ id, title, location, price, intent, detail, image, rating, verified });

const normalizeListing = (item: Listing): Listing => ({
  ...item,
  location: cleanListingText(item.location),
  detail: cleanListingText(item.detail),
  price: cleanListingText(item.price),
});

const categoryConfigs: Record<string, CategoryConfig> = {
  houses: { name: 'Houses', eyebrow: 'Homes with room to live', description: 'Family homes, townhouses, and standalone properties across Kigali and beyond.', cover: '/properties/house-02.jpg', accent: '#39734b', filters: ['All homes', 'For rent', 'For sale'], listings: [listing('house-1', 'Four-bedroom home with garden', 'Gisozi · Kigali', 'RWF 1,250,000 / month', 'For rent', '4 beds · 3 baths · 220 m²', '/properties/house-01.jpg', '4.9', true), listing('house-2', 'Nyarutarama family residence', 'Nyarutarama · Kigali', 'RWF 2,400,000 / month', 'For rent', '5 beds · 4 baths · 310 m²', '/properties/house-02.jpg', '4.8', true), listing('house-3', 'Quiet home near Rebero', 'Rebero · Kigali', 'RWF 185,000,000', 'For sale', '4 beds · 3 baths · 280 m²', '/properties/kigali-neighborhood.jpg', '4.7')] },
  apartments: { name: 'Apartments', eyebrow: 'City living, made easy', description: 'Well-located apartments for renting, buying, and making Kigali your base.', cover: '/properties/apartment-01.jpg', accent: '#527b83', filters: ['All apartments', 'For rent', 'For sale'], listings: [listing('apt-1', 'Light-filled Kacyiru apartment', 'Kacyiru · Kigali', 'RWF 1,100,000 / month', 'For rent', '2 beds · 2 baths · 118 m²', '/properties/apartment-01.jpg', '4.9', true), listing('apt-2', 'Modern apartment near Kimihurura', 'Kimihurura · Kigali', 'RWF 1,650,000 / month', 'For rent', '3 beds · 2 baths · 145 m²', '/properties/apartment-02.jpg', '4.8', true), listing('apt-3', 'Compact city apartment', 'Kicukiro · Kigali', 'RWF 78,000,000', 'For sale', '2 beds · 2 baths · 94 m²', '/properties/apartment-02.jpg', '4.6')] },
  land: { name: 'Land', eyebrow: 'A better place to begin', description: 'Residential, commercial, and development plots with the location details to plan your next move.', cover: '/properties/land-01.jpg', accent: '#788f55', filters: ['All land', 'Residential', 'Commercial'], listings: [listing('land-1', 'Residential plot in Gacuriro', 'Gacuriro · Kigali', 'RWF 85,000,000', 'For sale', '620 m² · Residential · Road access', '/properties/land-01.jpg', '4.8', true), listing('land-2', 'Development plot with city views', 'Kicukiro · Kigali', 'RWF 120,000,000', 'For sale', '850 m² · Mixed use · Serviced', '/properties/kigali-neighborhood.jpg', '4.7'), listing('land-3', 'Growing neighbourhood plot', 'Gasabo · Kigali', 'RWF 48,000,000', 'For sale', '400 m² · Residential · Title ready', '/properties/land-01.jpg', '4.6')] },
  commercial: { name: 'Commercial', eyebrow: 'Spaces that mean business', description: 'Shops, workspaces, and commercial properties selected for visibility, access, and growth.', cover: '/properties/commercial-01.jpg', accent: '#9a6f4d', filters: ['All commercial', 'For rent', 'For sale'], listings: [listing('commercial-1', 'Street-facing commercial space', 'Remera · Kigali', 'RWF 1,900,000 / month', 'For rent', '180 m² · Retail · Parking', '/properties/commercial-01.jpg', '4.8', true), listing('commercial-2', 'Flexible office in Kicukiro', 'Kicukiro · Kigali', 'RWF 2,250,000 / month', 'For rent', '240 m² · Office · 2 baths', '/properties/commercial-02.jpg', '4.7', true), listing('commercial-3', 'Corner retail property', 'Nyabugogo · Kigali', 'RWF 265,000,000', 'For sale', '310 m² · Retail · Main road', '/properties/commercial-01.jpg', '4.6')] },
  offices: { name: 'Offices', eyebrow: 'A better place to work', description: 'Professional offices and flexible workspaces for teams building in Rwanda.', cover: '/properties/commercial-02.jpg', accent: '#527b83', filters: ['All offices', 'For rent'], listings: [listing('office-1', 'Flexible office in Kicukiro', 'Kicukiro · Kigali', 'RWF 2,250,000 / month', 'For rent', '240 m² · 2 baths · Parking', '/properties/commercial-02.jpg', '4.8', true), listing('office-2', 'Bright team workspace', 'Kacyiru · Kigali', 'RWF 1,450,000 / month', 'For rent', '120 m² · Furnished · Meeting room', '/properties/commercial-01.jpg', '4.7')] },
  equipment: { name: 'Equipment', eyebrow: 'Tools for the next project', description: 'Practical equipment listings from trusted local owners and businesses.', cover: '/properties/commercial-02.jpg', accent: '#65735f', filters: ['All equipment', 'For rent', 'For sale'], listings: [listing('equipment-1', 'Construction equipment package', 'Kigali · Rwanda', 'RWF 180,000 / day', 'For rent', 'Verified owner · Delivery available', '/properties/commercial-02.jpg', '4.8', true), listing('equipment-2', 'Commercial kitchen equipment', 'Remera · Kigali', 'RWF 7,500,000', 'For sale', 'Good condition · Inspection available', '/properties/commercial-01.jpg', '4.6')] },
  hospitality: { name: 'Hospitality', eyebrow: 'Stay somewhere memorable', description: 'Hotels, guesthouses, and short stays with clear booking details.', cover: '/properties/apartment-02.jpg', accent: '#9a6f4d', filters: ['All stays', 'Book now'], listings: [listing('hospitality-1', 'Kigali garden guesthouse', 'Kimihurura · Kigali', 'RWF 95,000 / night', 'Book', '2 guests · Breakfast · Wi-Fi', '/properties/apartment-02.jpg', '4.9', true), listing('hospitality-2', 'Quiet serviced apartment', 'Nyarutarama · Kigali', 'RWF 180,000 / night', 'Book', '4 guests · 2 beds · Kitchen', '/properties/apartment-01.jpg', '4.8', true)] },
};

categoryConfigs.vehicles = { name: 'Vehicles', eyebrow: 'Move with confidence', description: 'Vehicles for sale, hire, and work across Rwanda with clear owner information.', cover: '/properties/vehicle-01.png', accent: '#4f7a63', filters: ['All vehicles', 'For rent', 'For sale'], listings: [listing('vehicle-1', 'Reliable family SUV', 'Kigali · Rwanda', 'RWF 85,000 / day', 'For rent', '5 seats · Insured · Delivery available', '/properties/vehicle-01.png', '4.8', true)] };
categoryConfigs.furniture = { name: 'Furniture', eyebrow: 'Make a space yours', description: 'Furniture for homes, offices, lodges, and other spaces.', cover: '/properties/tour-living.jpg', accent: '#8a674d', filters: ['All furniture', 'For rent', 'For sale'], listings: [listing('furniture-1', 'Living room furniture set', 'Kigali · Rwanda', 'RWF 1,800,000', 'For sale', 'Sofa · Table · Ready for delivery', '/properties/tour-living.jpg', '4.7', true)] };
categoryConfigs.appliances = { name: 'Appliances', eyebrow: 'Useful things, ready to go', description: 'Home and commercial appliances from local owners and businesses.', cover: '/properties/tour-kitchen.jpg', accent: '#527b83', filters: ['All appliances', 'For rent', 'For sale'], listings: [listing('appliance-1', 'Complete kitchen appliance set', 'Kigali · Rwanda', 'RWF 2,400,000', 'For sale', 'Good condition · Inspection available', '/properties/tour-kitchen.jpg', '4.6', true)] };
categoryConfigs.other = { name: 'Other assets', eyebrow: 'More ways to use Umutungo', description: 'Rentable, sellable, and bookable assets that do not fit one category.', cover: '/properties/story-detail.jpg', accent: '#65735f', filters: ['All assets', 'For rent', 'For sale', 'Book now'], listings: [listing('other-1', 'Event equipment package', 'Kigali · Rwanda', 'RWF 250,000 / day', 'For rent', 'Flexible booking · Delivery available', '/properties/story-detail.jpg', '4.7', true)] };

// Clearly marked sample cards fill category pages until there is enough live inventory.
// These are presentation examples only; real owner listings still come from the public API.
const catalogImages: Record<string, string[]> = {
  houses: ['/properties/rwanda-house-01.jpg', '/properties/rwanda-house-02.jpg', '/properties/house-01.jpg', '/properties/house-02.jpg', '/properties/kigali-neighborhood.jpg'],
  apartments: ['/properties/apartment-01.jpg', '/properties/apartment-02.jpg', '/properties/tour-bedroom-real.jpg', '/properties/tour-interior.jpg', '/properties/tour-living.jpg'],
  land: ['/properties/land-01.jpg', '/properties/land-02.jpg', '/properties/kigali-neighborhood.jpg', '/properties/rwanda-house-01.jpg', '/properties/house-01.jpg'],
  commercial: ['/properties/commercial-01.jpg', '/properties/commercial-02.jpg', '/properties/commercial-03.jpg', '/properties/commercial-04.jpg', '/properties/commercial-05.jpg'],
  offices: ['/properties/office-03.jpg', '/properties/office-04.jpg', '/properties/commercial-02.jpg', '/properties/commercial-04.jpg', '/properties/commercial-05.jpg'],
  hospitality: ['/properties/apartment-01.jpg', '/properties/apartment-02.jpg', '/properties/hospitality-03.jpg', '/properties/hospitality-04.jpg', '/properties/hospitality-05.jpg'],
  vehicles: ['/properties/vehicle-01.png', '/properties/vehicle-02.jpg', '/properties/vehicle-03.jpg', '/properties/vehicle-04.jpg', '/properties/vehicle-05.jpg'],
  furniture: ['/properties/tour-living.jpg', '/properties/furniture-02.jpg', '/properties/furniture-03.jpg', '/properties/furniture-04.jpg', '/properties/tour-interior.jpg'],
  appliances: ['/properties/tour-kitchen.jpg', '/properties/appliance-02.jpg', '/properties/appliance-03.jpg', '/properties/appliance-04.jpg', '/properties/appliance-05.jpg'],
  equipment: ['/properties/equipment-01.jpg', '/properties/equipment-02.jpg', '/properties/equipment-03.jpg', '/properties/equipment-04.jpg', '/properties/equipment-05.jpg'],
  other: ['/properties/story-detail.jpg', '/properties/other-02.jpg', '/properties/other-03.jpg', '/properties/other-04.jpg', '/properties/other-05.jpg'],
};
const sampleTitles: Record<string, string[]> = {
  houses: ['Family home with garden', 'Hillside home with city views', 'Three-bedroom home near schools', 'Modern home with secure parking', 'Quiet family house'],
  apartments: ['Bright apartment near local shops', 'Furnished city apartment', 'Two-bedroom apartment with balcony', 'Modern apartment for a small family', 'Serviced apartment in a calm neighbourhood'],
  land: ['Serviced residential plot', 'Elevated plot with road access', 'Development plot near the city', 'Residential plot in a growing area', 'Commercial plot on an access road'],
  commercial: ['Street-facing retail space', 'Flexible commercial unit', 'Corner shop with storage', 'Open-plan business space', 'Neighbourhood retail property'],
  offices: ['Bright team workspace', 'Private office suite', 'Furnished office with meeting room', 'Flexible coworking space', 'Professional office near amenities'],
  hospitality: ['Garden guesthouse stay', 'Serviced apartment for visitors', 'Boutique hotel room', 'Family lodge with breakfast', 'Quiet short stay with Wi-Fi'],
  vehicles: ['Family SUV for hire', 'Compact city car', 'Comfortable sedan for hire', 'Utility vehicle for work', 'Seven-seat vehicle for trips'],
  furniture: ['Living room furniture set', 'Comfortable sofa set', 'Bedroom furniture package', 'Dining table and chairs', 'Modern office furniture set'],
  appliances: ['Kitchen appliance package', 'Gas cooker in good condition', 'Refrigerator ready for use', 'Washing machine for sale', 'Cooker and extractor set'],
  equipment: ['Construction tools for hire', 'Workshop equipment package', 'Power tools for a project', 'Site equipment with delivery', 'Commercial kitchen equipment'],
  other: ['Event setup package', 'Meeting and event space', 'Celebration venue setup', 'Restaurant space for booking', 'Community event equipment'],
};
const catalogPrices: Record<string, string[]> = {
  houses: ['RWF 950,000 / month', 'RWF 145,000,000', 'RWF 780,000 / month', 'RWF 165,000,000', 'RWF 1,200,000 / month'],
  apartments: ['RWF 850,000 / month', 'RWF 1,100,000 / month', 'RWF 92,000,000', 'RWF 980,000 / month', 'RWF 120,000 / night'],
  land: ['RWF 45,000,000', 'RWF 68,000,000', 'RWF 92,000,000', 'RWF 36,000,000', 'RWF 110,000,000'],
  commercial: ['RWF 900,000 / month', 'RWF 1,400,000 / month', 'RWF 125,000,000', 'RWF 1,750,000 / month', 'RWF 210,000,000'],
  offices: ['RWF 1,200,000 / month', 'RWF 850,000 / month', 'RWF 1,600,000 / month', 'RWF 350,000 / day', 'RWF 2,000,000 / month'],
  hospitality: ['RWF 75,000 / night', 'RWF 110,000 / night', 'RWF 95,000 / night', 'RWF 130,000 / night', 'RWF 80,000 / night'],
  vehicles: ['RWF 70,000 / day', 'RWF 45,000 / day', 'RWF 60,000 / day', 'RWF 85,000 / day', 'RWF 95,000 / day'],
  furniture: ['RWF 1,200,000', 'RWF 650,000', 'RWF 1,500,000', 'RWF 420,000', 'RWF 2,100,000'],
  appliances: ['RWF 1,800,000', 'RWF 280,000', 'RWF 550,000', 'RWF 420,000', 'RWF 760,000'],
  equipment: ['RWF 90,000 / day', 'RWF 1,800,000', 'RWF 45,000 / day', 'RWF 120,000 / day', 'RWF 2,600,000'],
  other: ['RWF 180,000 / day', 'RWF 250,000 / day', 'RWF 350,000 / day', 'RWF 90,000 / night', 'RWF 120,000 / day'],
};
const catalogLocations = ['Kacyiru · Kigali', 'Kimironko · Kigali', 'Kicukiro · Kigali', 'Musanze · Northern Province', 'Huye · Southern Province'];
for (const [slug, config] of Object.entries(categoryConfigs)) {
  config.listings = Array.from({ length: 5 }, (_, index) => {
    const existing = config.listings[index];
    if (existing) return { ...existing, sample: true, verified: false, detail: `Illustrative example · ${existing.detail.replace('Verified owner · ', '')}` };
    const intent: Listing['intent'] = slug === 'hospitality' ? 'Book' : index % 2 === 0 ? 'For rent' : 'For sale';
    return { ...listing(`${slug}-sample-${index + 1}`, sampleTitles[slug][index], catalogLocations[index], catalogPrices[slug][index], intent, 'Illustrative example · Details and availability are not verified', catalogImages[slug][index], '—'), sample: true };
  });
}

const viewerImages: Record<string, string[]> = {
  Houses: ['/properties/house-01.jpg', '/properties/house-02.jpg', '/properties/tour-living.jpg', '/properties/tour-kitchen.jpg', '/properties/tour-bedroom-real.jpg'],
  Apartments: ['/properties/apartment-01.jpg', '/properties/apartment-02.jpg', '/properties/tour-living.jpg', '/properties/tour-kitchen.jpg', '/properties/tour-bedroom-real.jpg'],
  Land: ['/properties/land-01.jpg', '/properties/kigali-neighborhood.jpg', '/properties/tour-exterior.jpg'],
  Commercial: ['/properties/commercial-01.jpg', '/properties/commercial-02.jpg', '/properties/tour-interior.jpg', '/properties/tour-kitchen.jpg'],
  Offices: ['/properties/commercial-02.jpg', '/properties/commercial-01.jpg', '/properties/tour-interior.jpg'],
  Equipment: ['/properties/equipment-01.jpg', '/properties/equipment-02.jpg', '/properties/equipment-03.jpg', '/properties/equipment-04.jpg', '/properties/equipment-05.jpg'],
  Hospitality: ['/properties/apartment-02.jpg', '/properties/apartment-01.jpg', '/properties/tour-living.jpg', '/properties/tour-bedroom-real.jpg'],
  Vehicles: ['/properties/vehicle-01.png', '/properties/vehicle-02.jpg', '/properties/vehicle-03.jpg', '/properties/vehicle-04.jpg', '/properties/vehicle-05.jpg'],
  Furniture: ['/properties/tour-living.jpg', '/properties/furniture-02.jpg', '/properties/furniture-03.jpg', '/properties/furniture-04.jpg'],
  Appliances: ['/properties/tour-kitchen.jpg', '/properties/appliance-02.jpg', '/properties/appliance-03.jpg', '/properties/appliance-04.jpg', '/properties/appliance-05.jpg'],
  'Other assets': ['/properties/story-detail.jpg', '/properties/other-02.jpg', '/properties/other-03.jpg', '/properties/other-04.jpg', '/properties/other-05.jpg'],
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

const categoryAliases: Record<string, string[]> = {
  houses: ['house', 'houses', 'residential house', 'residential houses', 'residential'],
  apartments: ['apartment', 'apartments', 'flat', 'flats'],
  land: ['land', 'plot', 'plots'],
  commercial: ['commercial', 'commercial building', 'commercial buildings'],
  offices: ['office', 'offices'],
  hospitality: ['hospitality', 'hotel', 'hotels', 'lodge', 'lodges'],
  vehicles: ['vehicle', 'vehicles', 'car', 'cars'],
  furniture: ['furniture'],
  appliances: ['appliance', 'appliances'],
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
  const images = item.images?.length ? item.images : item.sample ? Array.from(new Set([item.image, ...(viewerImages[category.name] ?? [])])) : [item.image];

  return { id: item.id, title: item.title, type, location: item.location.replace(/\s*Â·\s*/g, ' - '), price: item.price.replace(/\s*\/\s*(month|night|day)$/, ''), priceNote: priceMatch ? `/ ${priceMatch[1]}` : ' asking', bedrooms, bathrooms, area, accent: category.accent, image: item.image, images, listed: item.listed ?? 'Date unavailable', availableFor: item.intent === 'For sale' ? 'sale' : 'rent' };
};

type DatabaseListing = { id: string; category: string; transaction_type: string; title: string; description: string; price: number; currency: string; province: string; district: string; sector: string; cell?: string; village?: string; status: string; tags?: string[]; amenities?: string[]; images?: string[]; created_at?: string };

const toDatabaseListing = (item: DatabaseListing, category: CategoryConfig): Listing => {
  const intent: Listing['intent'] = item.transaction_type === 'rent_out' || item.transaction_type === 'rent' ? 'For rent' : item.transaction_type === 'book' ? 'Book' : 'For sale';
  const location = [item.sector, item.district, item.province].filter(Boolean).join(' Â· ');
  const dateLabel = item.created_at && !Number.isNaN(new Date(item.created_at).getTime()) ? `Listed on ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(item.created_at))}` : 'Date unavailable';
  const detail = [...[item.description, ...(item.amenities ?? [])].filter(Boolean), dateLabel].join(' Â· ') || 'Details available from the owner';
  const image = item.images?.[0] ?? '/properties/listing-placeholder.svg';
  return { ...listing(item.id, item.title, location, `${item.currency || 'RWF'} ${item.price.toLocaleString()}${intent === 'For rent' ? ' / month' : ''}`, intent, detail, image, 'New', true), images: item.images, listed: item.created_at ? `Listed on ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(item.created_at))}` : 'Date unavailable' };
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
    const aliases = categoryAliases[slug] ?? [normalizedCategory(rawCategory.name)];
    void publicUmutungoApi<{ items: DatabaseListing[] }>('/api/v1/listings')
      .then((result) => {
        if (cancelled) return;
        const matchingItems = (result?.items ?? []).filter((item) => aliases.includes(normalizedCategory(item.category)));
        setDatabaseListings(matchingItems.map((item) => toDatabaseListing(item, rawCategory)));
      })
      .catch(() => { if (!cancelled) setDatabaseListings([]); });
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
  const listings = useMemo(() => [...databaseListings, ...categoryConfigs[slug].listings].filter((item) => {
    const matchesQuery = `${item.title} ${item.location} ${item.detail}`.toLowerCase().includes(query.toLowerCase());
    const matchesLocation = !initialLocation || initialLocation === 'Kigali' || item.location.toLowerCase().includes(initialLocation.toLowerCase());
    const matchesDistrict = !initialDistrict || item.location.toLowerCase().includes(initialDistrict.toLowerCase());
    const matchesSector = !initialSector || item.location.toLowerCase().includes(initialSector.toLowerCase());
    const matchesIntent = !initialIntent || initialIntent === 'Buy or rent' || (initialIntent === 'Rent' && item.intent === 'For rent') || (initialIntent === 'Buy' && item.intent === 'For sale');
    const numericPrice = Number(item.price.replace(/[^0-9]/g, ''));
    const matchesPrice = !initialPriceRange || initialPriceRange === 'Any price' || (initialPriceRange === 'Under RWF 500,000' && numericPrice < 500000) || (initialPriceRange === 'RWF 500,000 - 1,000,000' && numericPrice >= 500000 && numericPrice <= 1000000) || (initialPriceRange === 'Over RWF 1,000,000' && numericPrice > 1000000);
    const matchesFilter = filter.startsWith('All') || (filter === 'For rent' && item.intent === 'For rent') || (filter === 'For sale' && item.intent === 'For sale') || (filter === 'Book now' && item.intent === 'Book') || ['Residential', 'Commercial', 'Private office', 'Open workspace'].includes(filter);
    return matchesQuery && matchesLocation && matchesDistrict && matchesSector && matchesIntent && matchesPrice && matchesFilter;
  }).map(normalizeListing), [category, databaseListings, filter, initialDistrict, initialIntent, initialLocation, initialPriceRange, initialSector, query, slug]);

  const toggleListingFavorite = (item: Listing) => {
    if (item.sample) return;
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
    <section className={`category-experience-hero ${slug === 'apartments' ? 'no-hero-copy' : ''}`} style={{ backgroundImage: `linear-gradient(90deg, rgba(8, 18, 10, .78), rgba(8, 18, 10, .2)), url(${category.cover})` }}>{slug !== 'apartments' && <div><span className="category-experience-eyebrow">{t(language, category.eyebrow)}</span><h1>{t(language, 'Find your next')}<br /><em>{translatedCategoryName.toLowerCase()} {t(language, 'space.')}</em></h1><p>{t(language, category.description)}</p></div>}<div className="category-search-box"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${t(language, 'Search')} ${translatedCategoryName.toLowerCase()} ${t(language, 'by location or feature')}`} /><button type="button" aria-label={t(language, 'Search category')} onClick={() => setQuery(query.trim())}><Icon name="arrow" size={15} /></button></div></section>
    <section className="category-experience-body"><div className="category-results-heading"><div><span className="category-experience-eyebrow">{listings.filter((item) => !item.sample).length} owner listings · {listings.filter((item) => item.sample).length} examples</span><h2>Explore {category.name.toLowerCase()}</h2></div><button className="category-map-button" type="button"><Icon name="pin" size={15} /> Map view</button></div><div className="category-filter-row">{category.filters.map((item) => <button className={filter === item ? 'active' : ''} key={item} type="button" onClick={() => setFilter(item)}>{item}</button>)}</div>{listings.length ? <div className="category-listing-grid">{listings.map((item) => <article className="category-listing-card" key={item.id}><div className="category-listing-image" style={{ backgroundImage: `linear-gradient(180deg, transparent 45%, rgba(5, 15, 8, .64)), url(${item.image})` }}><button className={`category-save ${saved.includes(item.id) ? 'saved' : ''}`} type="button" disabled={item.sample} aria-label={`Save ${item.title}`} onClick={() => toggleListingFavorite(item)}><Icon name="heart" size={16} filled={saved.includes(item.id)} /></button>{item.sample ? <span className="category-sample-badge">Illustrative example</span> : item.verified && <span className="category-verified"><Icon name="check" size={12} /> Verified</span>}</div><div className="category-listing-copy"><div className="category-listing-meta"><span className={`listing-intent ${item.intent === 'For sale' ? 'for-sale' : item.intent === 'For rent' ? 'for-rent' : ''}`}>{item.intent}</span>{!item.sample && <span className="category-stars" aria-label={`Rated ${item.rating} out of 5`}>{String.fromCharCode(9733)} {item.rating}</span>}</div><h3>{item.title}</h3><p><Icon name="pin" size={13} /> {item.location}</p><div className="category-listing-footer"><div><strong>{item.price}</strong><small>{item.detail}</small></div><button className="category-view-button" type="button" onClick={() => setActiveListing(item)}>{item.sample ? 'View example' : 'View property'} <Icon name="arrow" size={13} /></button></div></div></article>)}</div> : <div className="category-empty"><Icon name="search" size={21} /><h3>No listings match that search</h3><p>Try another neighbourhood, property type, or clear the filter.</p><button type="button" onClick={() => { setQuery(''); setFilter(category.filters[0]); }}>Clear search</button></div>}</section>
    {activeListing && <PropertyViewer language={language} property={toViewerProperty(activeListing, rawCategory)} onClose={() => setActiveListing(null)} readOnly={activeListing.sample} />}
  </main><AiChatbot language={language} /></div>;
}
