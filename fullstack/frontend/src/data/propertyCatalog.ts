import type { PropertyPlaceholder } from '../components/PropertyCard';

const poster = {
  name: 'Aline Mukamana',
  businessName: 'Kigali Property Link',
  phone: '+250 788 214 600',
  location: 'Kigali, Rwanda',
  role: 'Komisiyoneri' as const,
  verified: true,
  postedAt: 'Listed recently',
  rating: '4.8',
};

export const demoPropertyCatalog: Record<string, PropertyPlaceholder> = {
  'gisozi-home': { id: 'gisozi-home', title: 'Four-bedroom home with garden', type: 'House', location: 'Gisozi - Kigali', price: 'RWF 1,250,000', priceNote: '/ month', bedrooms: 4, bathrooms: 3, area: 220, accent: '#087d3d', image: '/properties/house-01.jpg', images: ['/properties/house-01.jpg', '/properties/house-02.jpg', '/properties/tour-living.jpg'], listed: 'Listed 4 days ago', description: 'A bright family home with generous living areas, a garden, and secure access close to everyday services.', poster },
  'nyarutarama-home': { id: 'nyarutarama-home', title: 'Five-bedroom family residence', type: 'House', location: 'Nyarutarama - Kigali', price: 'RWF 2,400,000', priceNote: '/ month', bedrooms: 5, bathrooms: 4, area: 310, accent: '#6d8d6f', image: '/properties/house-02.jpg', images: ['/properties/house-02.jpg', '/properties/house-01.jpg'], listed: 'Listed 2 weeks ago', description: 'A spacious residence designed for family life in a quiet, well-connected Kigali neighbourhood.', poster: { ...poster, role: 'Landlord' } },
  'kacyiru-apartment': { id: 'kacyiru-apartment', title: 'Light-filled Kacyiru apartment', type: 'Apartment', location: 'Kacyiru - Kigali', price: 'RWF 1,100,000', priceNote: '/ month', bedrooms: 2, bathrooms: 2, area: 118, accent: '#b17c5b', image: '/properties/apartment-01.jpg', images: ['/properties/apartment-01.jpg', '/properties/tour-living.jpg'], listed: 'Listed yesterday', description: 'A comfortable city apartment with natural light and quick access to offices, dining, and transport.', poster },
  'kimihurura-apartment': { id: 'kimihurura-apartment', title: 'Modern apartment near Kimihurura', type: 'Apartment', location: 'Kimihurura - Kigali', price: 'RWF 1,650,000', priceNote: '/ month', bedrooms: 3, bathrooms: 2, area: 145, accent: '#7f8f77', image: '/properties/apartment-02.jpg', images: ['/properties/apartment-02.jpg', '/properties/apartment-01.jpg'], listed: 'Listed 3 days ago', description: 'A modern apartment near restaurants, offices, and the centre of Kimihurura.', poster },
  'gacuriro-land': { id: 'gacuriro-land', title: 'Residential plot in Gacuriro', type: 'Land', location: 'Gacuriro - Kigali', price: 'RWF 85,000,000', priceNote: ' asking', bedrooms: 0, bathrooms: 0, area: 620, accent: '#788f55', image: '/properties/land-01.jpg', images: ['/properties/land-01.jpg'], listed: 'Listed 5 days ago', description: 'A residential plot with road access and a clear opportunity for a thoughtfully planned build.', poster: { ...poster, role: 'Property Owner' } },
  'remera-commercial': { id: 'remera-commercial', title: 'Street-facing commercial space', type: 'Commercial', location: 'Remera - Kigali', price: 'RWF 1,900,000', priceNote: '/ month', bedrooms: 0, bathrooms: 1, area: 180, accent: '#8a674d', image: '/properties/commercial-01.jpg', images: ['/properties/commercial-01.jpg', '/properties/commercial-02.jpg'], listed: 'Listed 1 week ago', description: 'A visible commercial space suited to retail, services, or a customer-facing business.', poster },
  'kicukiro-workspace': { id: 'kicukiro-workspace', title: 'Flexible office in Kicukiro', type: 'Office', location: 'Kicukiro - Kigali', price: 'RWF 2,250,000', priceNote: '/ month', bedrooms: 0, bathrooms: 2, area: 240, accent: '#516d75', image: '/properties/commercial-02.jpg', images: ['/properties/commercial-02.jpg', '/properties/commercial-01.jpg'], listed: 'Listed 2 weeks ago', description: 'A flexible office layout with room for teams, meetings, and productive work.', poster: { ...poster, role: 'Property Owner' } },
  'house-1': { id: 'house-1', title: 'Four-bedroom home with garden', type: 'House', location: 'Gisozi - Kigali', price: 'RWF 1,250,000', priceNote: '/ month', bedrooms: 4, bathrooms: 3, area: 220, accent: '#39734b', image: '/properties/house-01.jpg', listed: 'Listed recently', description: 'A bright family home with generous living areas and a garden.', poster },
  'house-2': { id: 'house-2', title: 'Nyarutarama family residence', type: 'House', location: 'Nyarutarama - Kigali', price: 'RWF 2,400,000', priceNote: '/ month', bedrooms: 5, bathrooms: 4, area: 310, accent: '#39734b', image: '/properties/house-02.jpg', listed: 'Listed recently', description: 'A spacious family residence in Nyarutarama.', poster: { ...poster, role: 'Landlord' } },
  'apt-1': { id: 'apt-1', title: 'Light-filled Kacyiru apartment', type: 'Apartment', location: 'Kacyiru - Kigali', price: 'RWF 1,100,000', priceNote: '/ month', bedrooms: 2, bathrooms: 2, area: 118, accent: '#527b83', image: '/properties/apartment-01.jpg', listed: 'Listed recently', description: 'A light-filled apartment close to offices and city services.', poster },
  'land-1': { id: 'land-1', title: 'Residential plot in Gacuriro', type: 'Land', location: 'Gacuriro - Kigali', price: 'RWF 85,000,000', priceNote: ' asking', bedrooms: 0, bathrooms: 0, area: 620, accent: '#788f55', image: '/properties/land-01.jpg', listed: 'Listed recently', description: 'A ready-to-plan residential plot in Gacuriro.', poster: { ...poster, role: 'Property Owner' } },
  'commercial-1': { id: 'commercial-1', title: 'Street-facing commercial space', type: 'Commercial', location: 'Remera - Kigali', price: 'RWF 1,900,000', priceNote: '/ month', bedrooms: 0, bathrooms: 1, area: 180, accent: '#9a6f4d', image: '/properties/commercial-01.jpg', listed: 'Listed recently', description: 'A visible commercial space with room for retail or services.', poster },
  'office-1': { id: 'office-1', title: 'Flexible office in Kicukiro', type: 'Office', location: 'Kicukiro - Kigali', price: 'RWF 2,250,000', priceNote: '/ month', bedrooms: 0, bathrooms: 2, area: 240, accent: '#527b83', image: '/properties/commercial-02.jpg', listed: 'Listed recently', description: 'A flexible office for teams building in Kigali.', poster: { ...poster, role: 'Property Owner' } },
};

export function getDemoProperty(id: string) {
  return demoPropertyCatalog[id];
}
