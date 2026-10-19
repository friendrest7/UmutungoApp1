import type { PropertyPlaceholder } from '../components/PropertyCard';

type ExampleCategory = { slug: string; type: string; title: string; locations: string[]; images: string[]; price: number; increment: number; note: string; mode: 'sale-rent' | 'sale-lease' | 'rent' | 'book' | 'sale-hire' };

const categories: ExampleCategory[] = [
  { slug: 'houses', type: 'House', title: 'Family home', locations: ['Kacyiru', 'Remera', 'Kicukiro'], images: ['/properties/rwanda-house-01.jpg', '/properties/rwanda-house-02.jpg', '/properties/rwanda-house-03.jpg'], price: 650000, increment: 125000, note: '/ month', mode: 'sale-rent' },
  { slug: 'apartments', type: 'Apartment', title: 'City apartment', locations: ['Kigali Heights', 'Kimihurura', 'Nyarutarama'], images: ['/properties/apartment-01.jpg', '/properties/apartment-02.jpg', '/properties/tour-bedroom-real.jpg'], price: 350000, increment: 90000, note: '/ month', mode: 'sale-rent' },
  { slug: 'land', type: 'Land', title: 'Residential plot', locations: ['Kicukiro', 'Musanze', 'Rubavu'], images: ['/properties/land-01.jpg', '/properties/land-02.jpg', '/properties/land-03.jpg'], price: 8500000, increment: 1750000, note: ' asking', mode: 'sale-lease' },
  { slug: 'commercial', type: 'Commercial', title: 'Commercial property', locations: ['Kimihurura', 'Nyarugenge', 'Remera'], images: ['/properties/commercial-01.jpg', '/properties/commercial-02.jpg', '/properties/commercial-03.jpg'], price: 950000, increment: 240000, note: '/ month', mode: 'sale-rent' },
  { slug: 'offices', type: 'Office', title: 'Professional office suite', locations: ['Kigali CBD', 'Kacyiru', 'Kimihurura'], images: ['/properties/office-03.jpg', '/properties/office-04.jpg', '/properties/commercial-03.jpg'], price: 600000, increment: 155000, note: '/ month', mode: 'rent' },
  { slug: 'hospitality', type: 'Hospitality', title: 'Guest stay', locations: ['Kigali City', 'Musanze', 'Rubavu'], images: ['/properties/hospitality-03.jpg', '/properties/hospitality-04.jpg', '/properties/hospitality-05.jpg'], price: 28000, increment: 9500, note: '/ night', mode: 'book' },
  { slug: 'vehicles', type: 'Vehicle', title: 'Vehicle available', locations: ['Kigali', 'Musanze', 'Rubavu'], images: ['/properties/vehicle-01.png', '/properties/vehicle-02.jpg', '/properties/vehicle-03.jpg'], price: 18000, increment: 6500, note: '/ day', mode: 'sale-hire' },
  { slug: 'furniture', type: 'Furniture', title: 'Home furniture set', locations: ['Kigali', 'Remera', 'Kicukiro'], images: ['/properties/furniture-02.jpg', '/properties/furniture-03.jpg', '/properties/furniture-04.jpg'], price: 85000, increment: 35000, note: ' asking', mode: 'sale-rent' },
  { slug: 'appliances', type: 'Appliance', title: 'Household appliance', locations: ['Kigali', 'Remera', 'Kicukiro'], images: ['/properties/appliance-02.jpg', '/properties/appliance-03.jpg', '/properties/appliance-04.jpg'], price: 95000, increment: 42000, note: ' asking', mode: 'sale-rent' },
  { slug: 'equipment', type: 'Equipment', title: 'Project equipment', locations: ['Kigali', 'Gikondo', 'Musanze'], images: ['/properties/equipment-01.jpg', '/properties/equipment-02.jpg', '/properties/equipment-03.jpg'], price: 22000, increment: 11500, note: '/ day', mode: 'sale-rent' },
  { slug: 'other', type: 'Other', title: 'Useful local asset', locations: ['Kigali', 'Huye', 'Rubavu'], images: ['/properties/other-02.jpg', '/properties/other-03.jpg', '/properties/other-04.jpg'], price: 55000, increment: 20000, note: ' asking', mode: 'sale-rent' },
];

export type TestingListing = PropertyPlaceholder & { categorySlug: string; testingOnly: true };

export const testingListings: TestingListing[] = categories.flatMap((category) => category.locations.map((location, index) => {
  const saleOrRent = category.mode !== 'rent' && category.mode !== 'book';
  const isRent = category.mode === 'rent' || category.mode === 'book' || (saleOrRent && index % 2 === 1);
  const bedrooms = ['houses', 'apartments', 'hospitality'].includes(category.slug) ? 2 + index % 3 : 0;
  const bathrooms = bedrooms ? 1 + index % 2 : 0;
  const area = category.slug === 'land' ? 300 + index * 65 : bedrooms ? 85 + index * 30 : 0;
  const image = category.images[index];
  return {
    id: `test-${category.slug}-${index + 1}`, categorySlug: category.slug, testingOnly: true as const,
    title: `${category.title} in ${location}`, type: category.type, location: `${location}, Rwanda`,
    price: `RWF ${(category.price + category.increment * index).toLocaleString('en-RW')}`,
    priceNote: category.mode === 'book' ? '/ night' : category.mode === 'sale-lease' && isRent ? ' lease price' : category.mode === 'sale-hire' && isRent ? '/ day' : saleOrRent ? isRent ? '/ month' : '' : category.note.replace(' asking', ''),
    bedrooms, bathrooms, area, accent: '#39734b', image, images: [image], listed: 'Testing account listing',
    availableFor: category.mode === 'book' || isRent ? 'rent' : 'sale',
    description: `Testing account listing for ${category.type.toLowerCase()} in ${location}.`,
  };
}));
