import type { PropertyPlaceholder } from '../components/PropertyCard';

export type ListingMedia = { type?: string; url: string; sort_order?: number };
export type ApiListing = {
  id: string;
  category: string;
  transaction_type: string;
  title: string;
  description?: string;
  price: number;
  currency?: string;
  province?: string;
  district?: string;
  sector?: string;
  cell?: string;
  village?: string;
  latitude?: number | null;
  longitude?: number | null;
  status: string;
  created_at: string;
  publish_at?: string | null;
  images?: string[];
  media?: ListingMedia[];
  owner?: { id?: string; name?: string; role?: string; business_name?: string; photo_url?: string; phone?: string; verified?: boolean };
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
  measurements?: Record<string, unknown>;
};

export function listedOn(value?: string | null) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return `Listed on ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)}`;
}

export function propertySlug(title: string) {
  return title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function supportsSpatialPreview(type: string) {
  const normalizedType = type.trim().toLowerCase().replace(/[_-]+/g, ' ');
  return !['vehicle', 'vehicles', 'furniture', 'appliance', 'appliances', 'equipment', 'other assets', 'car part', 'car parts'].includes(normalizedType);
}

function normalizeListingImageUrl(value: string) {
  const url = value.trim();
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(parsed.hostname)) {
      // Seeded listings can retain the local website origin in the database.
      // Their /properties files are served by the current frontend host.
      return parsed.pathname.startsWith('/properties/') ? `${parsed.pathname}${parsed.search}` : url;
    }
  } catch {
    // Relative paths are already valid frontend assets.
  }
  return url;
}

export function listingImages(item: ApiListing) {
  const media = item.media ?? [];
  const orderedPhotos = media.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .filter((entry) => entry.url && (!entry.type || entry.type.toLowerCase() === 'photo'))
    .map((entry) => entry.url);
  const sources = media.length ? orderedPhotos : item.images ?? [];
  return Array.from(new Set(sources.map(normalizeListingImageUrl).filter(Boolean)));
}

const listingImageFallbacks: Record<string, string[]> = {
  house: ['/properties/house-01.jpg', '/properties/rwanda-house-01.jpg'],
  houses: ['/properties/house-01.jpg', '/properties/rwanda-house-01.jpg'],
  apartment: ['/properties/apartment-01.jpg', '/properties/apartment-02.jpg'],
  apartments: ['/properties/apartment-01.jpg', '/properties/apartment-02.jpg'],
  land: ['/properties/land-01.jpg', '/properties/land-02.jpg'],
  commercial: ['/properties/commercial-01.jpg', '/properties/commercial-02.jpg'],
  office: ['/properties/office-03.jpg', '/properties/office-04.jpg'],
  offices: ['/properties/office-03.jpg', '/properties/office-04.jpg'],
  hospitality: ['/properties/hospitality-03.jpg', '/properties/hospitality-04.jpg'],
  hotel: ['/properties/hospitality-03.jpg', '/properties/hospitality-04.jpg'],
  vehicle: ['/properties/vehicle-02.jpg', '/properties/vehicle-03.jpg'],
  vehicles: ['/properties/vehicle-02.jpg', '/properties/vehicle-03.jpg'],
  car_part: ['/properties/vehicle-02.jpg', '/properties/vehicle-03.jpg'],
  car_parts: ['/properties/vehicle-02.jpg', '/properties/vehicle-03.jpg'],
  'car parts': ['/properties/vehicle-02.jpg', '/properties/vehicle-03.jpg'],
  'car-parts': ['/properties/vehicle-02.jpg', '/properties/vehicle-03.jpg'],
  furniture: ['/properties/furniture-02.jpg', '/properties/furniture-03.jpg'],
  appliance: ['/properties/appliance-02.jpg', '/properties/appliance-03.jpg'],
  appliances: ['/properties/appliance-02.jpg', '/properties/appliance-03.jpg'],
  equipment: ['/properties/equipment-01.jpg', '/properties/equipment-02.jpg'],
  other: ['/properties/other-02.jpg', '/properties/other-03.jpg'],
};

function fallbackListingImage(item: ApiListing) {
  const category = item.category.trim().toLowerCase();
  const options = listingImageFallbacks[category] ?? listingImageFallbacks.other;
  const variant = Array.from(item.id).reduce((sum, character) => sum + character.charCodeAt(0), 0) % options.length;
  return options[variant];
}

export function fallbackListingImages(item: ApiListing) {
  const category = item.category.trim().toLowerCase();
  return listingImageFallbacks[category] ?? listingImageFallbacks.other;
}

export function toProperty(item: ApiListing): PropertyPlaceholder {
  const images = listingImages(item);
  const category = item.category.toLowerCase();
  const type = ({ houses: 'House', house: 'House', apartments: 'Apartment', apartment: 'Apartment', vehicles: 'Vehicle', vehicle: 'Vehicle', appliances: 'Appliance', appliance: 'Appliance', offices: 'Office', office: 'Office', hospitality: 'Hospitality' } as Record<string, string>)[category] ?? item.category.replace(/\b\w/g, (letter) => letter.toUpperCase());
  const rent = ['rent', 'rent_out'].includes(item.transaction_type);
  const both = item.transaction_type === 'both';
  const book = item.transaction_type === 'book';
  const listingDate = item.status === 'scheduled' && item.publish_at
    ? `Available from ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(item.publish_at))}`
    : listedOn(item.created_at);
  return {
    id: item.id,
    title: item.title,
    type,
    location: [item.sector, item.district, item.province].filter(Boolean).join(' - ') || 'Rwanda',
    latitude: item.latitude,
    longitude: item.longitude,
    price: `${item.currency ?? 'RWF'} ${Number(item.price).toLocaleString()}`,
    priceNote: both ? ' for sale or rent' : book ? '/ night' : rent ? '/ month' : '',
    bedrooms: Number(item.bedrooms ?? item.measurements?.bedrooms ?? 0),
    bathrooms: Number(item.bathrooms ?? item.measurements?.bathrooms ?? 0),
    area: Number(item.area ?? item.measurements?.building_size ?? item.measurements?.plot_size ?? 0),
    accent: '#00a84f',
    image: images[0] ?? fallbackListingImage(item),
    images: images.length ? images : [fallbackListingImage(item)],
    listed: listingDate,
    availableFor: both ? 'both' : rent ? 'rent' : 'sale',
    description: item.description,
    poster: {
      name: item.owner?.name ?? 'Property owner',
      businessName: item.owner?.business_name,
      photoUrl: item.owner?.photo_url,
      phone: item.owner?.phone,
      role: item.owner?.role === 'komisiyoneri' ? 'Komisiyoneri' : item.owner?.role === 'property_owner' ? 'Property Owner' : 'Landlord',
      verified: item.owner?.verified,
      postedAt: listingDate,
    },
  };
}
