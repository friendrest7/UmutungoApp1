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

export function listingImages(item: ApiListing) {
  const ordered = item.media?.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((media) => media.url) ?? [];
  return item.images?.length ? item.images : ordered;
}

export function toProperty(item: ApiListing): PropertyPlaceholder {
  const images = listingImages(item);
  const category = item.category.toLowerCase();
  const type = ({ houses: 'House', house: 'House', apartments: 'Apartment', apartment: 'Apartment', vehicles: 'Vehicle', vehicle: 'Vehicle', appliances: 'Appliance', appliance: 'Appliance', offices: 'Office', office: 'Office', hospitality: 'Hospitality' } as Record<string, string>)[category] ?? item.category.replace(/\b\w/g, (letter) => letter.toUpperCase());
  const rent = ['rent', 'rent_out'].includes(item.transaction_type);
  const book = item.transaction_type === 'book';
  const listingDate = item.status === 'scheduled' && item.publish_at
    ? `Available from ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(item.publish_at))}`
    : listedOn(item.created_at);
  return {
    id: item.id,
    title: item.title,
    type,
    location: [item.sector, item.district, item.province].filter(Boolean).join(' - ') || 'Rwanda',
    price: `${item.currency ?? 'RWF'} ${Number(item.price).toLocaleString()}`,
    priceNote: book ? '/ night' : rent ? '/ month' : ' asking',
    bedrooms: Number(item.bedrooms ?? item.measurements?.bedrooms ?? 0),
    bathrooms: Number(item.bathrooms ?? item.measurements?.bathrooms ?? 0),
    area: Number(item.area ?? item.measurements?.building_size ?? item.measurements?.plot_size ?? 0),
    accent: '#0f4a36',
    image: images[0] ?? '/properties/listing-placeholder.svg',
    images,
    listed: listingDate,
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
