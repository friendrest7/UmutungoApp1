import type { PropertyPlaceholder } from '../components/PropertyCard';

type ExampleCategory = { slug: string; type: string; title: string; locations: string[]; images: string[]; price: number; increment: number; note: string; mode: 'sale-rent' | 'sale-lease' | 'rent' | 'book' | 'sale-hire' };

const categories: ExampleCategory[] = [
  { slug: 'houses', type: 'House', title: 'Family home', locations: ['Kacyiru', 'Remera', 'Kicukiro', 'Kimihurura', 'Nyarutarama', 'Gacuriro', 'Kibagabaga', 'Kanombe', 'Gisozi', 'Kabeza'], images: ['/properties/rwanda-house-01.jpg', '/properties/rwanda-house-02.jpg', '/properties/rwanda-house-03.jpg'], price: 650000, increment: 125000, note: '/ month', mode: 'sale-rent' },
  { slug: 'apartments', type: 'Apartment', title: 'City apartment', locations: ['Kigali Heights', 'Kimihurura', 'Nyarutarama', 'Kacyiru', 'Remera', 'Kicukiro', 'Gacuriro', 'Gisozi', 'Kibagabaga', 'Kagarama'], images: ['/properties/apartment-01.jpg', '/properties/apartment-02.jpg', '/properties/tour-bedroom-real.jpg'], price: 350000, increment: 90000, note: '/ month', mode: 'sale-rent' },
  { slug: 'land', type: 'Land', title: 'Residential plot', locations: ['Kicukiro', 'Musanze', 'Rubavu', 'Rwamagana', 'Bugesera', 'Nyamata', 'Huye', 'Rusizi', 'Nyagatare', 'Kayonza'], images: ['/properties/land-01.jpg', '/properties/land-02.jpg', '/properties/land-03.jpg'], price: 8500000, increment: 1750000, note: ' asking', mode: 'sale-lease' },
  { slug: 'commercial', type: 'Commercial', title: 'Commercial property', locations: ['Kimihurura', 'Nyarugenge', 'Remera', 'Kigali CBD', 'Kacyiru', 'Gikondo', 'Muhima', 'Nyabugogo', 'Rubavu', 'Musanze'], images: ['/properties/commercial-01.jpg', '/properties/commercial-02.jpg', '/properties/commercial-03.jpg'], price: 950000, increment: 240000, note: '/ month', mode: 'sale-rent' },
  { slug: 'offices', type: 'Office', title: 'Professional office suite', locations: ['Kigali CBD', 'Kacyiru', 'Kimihurura', 'Nyarutarama', 'Remera', 'Nyarugenge', 'Kiyovu', 'Gikondo', 'Huye', 'Musanze'], images: ['/properties/office-03.jpg', '/properties/office-04.jpg', '/properties/commercial-03.jpg'], price: 600000, increment: 155000, note: '/ month', mode: 'rent' },
  { slug: 'hospitality', type: 'Hospitality', title: 'Guest stay', locations: ['Kigali City', 'Musanze', 'Rubavu', 'Huye', 'Karongi', 'Nyagatare', 'Rwamagana', 'Kayonza', 'Rusizi', 'Nyamata'], images: ['/properties/hospitality-03.jpg', '/properties/hospitality-04.jpg', '/properties/hospitality-05.jpg'], price: 28000, increment: 9500, note: '/ night', mode: 'book' },
  { slug: 'vehicles', type: 'Vehicle', title: 'Vehicle available', locations: ['Kigali', 'Musanze', 'Rubavu', 'Huye', 'Rusizi', 'Nyagatare', 'Rwamagana', 'Kayonza', 'Nyamata', 'Karongi'], images: ['/properties/vehicle-01.png', '/properties/vehicle-02.jpg', '/properties/vehicle-03.jpg', '/properties/vehicle-demo-06.jpg'], price: 18000, increment: 6500, note: '/ day', mode: 'sale-hire' },
  { slug: 'furniture', type: 'Furniture', title: 'Home furniture set', locations: ['Kigali', 'Remera', 'Kicukiro', 'Kacyiru', 'Kimihurura', 'Musanze', 'Rubavu', 'Huye', 'Nyamata', 'Rusizi'], images: ['/properties/furniture-02.jpg', '/properties/furniture-03.jpg', '/properties/furniture-04.jpg', '/properties/furniture-demo-05.jpg'], price: 85000, increment: 35000, note: ' asking', mode: 'sale-rent' },
  { slug: 'appliances', type: 'Appliance', title: 'Household appliance', locations: ['Kigali', 'Remera', 'Kicukiro', 'Kacyiru', 'Kimihurura', 'Musanze', 'Rubavu', 'Huye', 'Nyamata', 'Rusizi'], images: ['/properties/appliance-02.jpg', '/properties/appliance-03.jpg', '/properties/appliance-04.jpg', '/properties/appliance-05.jpg', '/properties/appliance-demo-06.jpg'], price: 95000, increment: 42000, note: ' asking', mode: 'sale-rent' },
  { slug: 'equipment', type: 'Equipment', title: 'Project equipment', locations: ['Kigali', 'Gikondo', 'Musanze', 'Rubavu', 'Huye', 'Kicukiro', 'Rusizi', 'Nyagatare', 'Rwamagana', 'Kayonza'], images: ['/properties/equipment-01.jpg', '/properties/equipment-02.jpg', '/properties/equipment-03.jpg', '/properties/equipment-04.jpg', '/properties/equipment-05.jpg', '/properties/equipment-demo-06.jpg', '/properties/equipment-demo-07.jpg'], price: 22000, increment: 11500, note: '/ day', mode: 'sale-rent' },
  { slug: 'other', type: 'Other', title: 'Useful local asset', locations: ['Kigali', 'Huye', 'Rubavu', 'Musanze', 'Rusizi', 'Nyagatare', 'Rwamagana', 'Kayonza', 'Nyamata', 'Karongi'], images: ['/properties/other-02.jpg', '/properties/other-03.jpg', '/properties/other-04.jpg', '/properties/other-05.jpg', '/properties/other-demo-06.jpg'], price: 55000, increment: 20000, note: ' asking', mode: 'sale-rent' },
];

const demoCopy: Record<string, { titles: string[]; description: (location: string) => string }> = {
  houses: { titles: ['Family home', 'Standalone home', 'Townhouse'], description: (location) => `Demo home listing in ${location}. Ask about the rooms, utilities, access, and current availability.` },
  apartments: { titles: ['City apartment', 'Modern flat', 'Furnished apartment'], description: (location) => `Demo apartment listing in ${location}. Ask about furnishings, building services, lease terms, and availability.` },
  land: { titles: ['Residential plot', 'Development plot', 'Land for a project'], description: (location) => `Demo land listing in ${location}. Confirm the plot boundaries, title documents, zoning, road access, and services with the owner.` },
  commercial: { titles: ['Retail space', 'Commercial building', 'Business premises'], description: (location) => `Demo commercial listing in ${location}. Ask about permitted use, floor area, access, lease terms, and availability.` },
  offices: { titles: ['Office suite', 'Shared workspace', 'Private office'], description: (location) => `Demo office listing in ${location}. Ask about the workspace layout, included services, access, and rental terms.` },
  hospitality: { titles: ['Guest room', 'Short stay suite', 'Lodge accommodation'], description: (location) => `Demo hospitality listing in ${location}. Confirm guest capacity, included amenities, booking dates, and nightly rate.` },
  vehicles: { titles: ['Family SUV', 'Sports coupe', 'Executive sedan', 'City hatchback', 'Performance car', 'White SUV'], description: (location) => `Demo vehicle listing in ${location}. Ask the owner for the make, model year, mileage, condition, and sale or hire terms.` },
  furniture: { titles: ['Velvet sofa', 'Bedroom furniture set', 'Living room furniture', 'Sofa and dining set'], description: (location) => `Demo furniture listing in ${location}. Ask about dimensions, materials, condition, delivery, and whether the pictured pieces are included.` },
  appliances: { titles: ['Kitchen appliance', 'Kitchen appliance set', 'Washing machine', 'Retro refrigerator', 'Fridge and washer set'], description: (location) => `Demo appliance listing in ${location}. Ask for the brand, model, working condition, power requirements, and any warranty.` },
  equipment: { titles: ['Circuit repair equipment', 'CAD workstation', 'Workshop tool set', 'Construction materials', 'Precision screwdriver set', 'Cordless hammer drill', 'Excavator'], description: (location) => `Demo equipment listing in ${location}. Ask for the make, model, operating condition, included accessories, and hire or sale terms.` },
  other: { titles: ['Banquet hall', 'Event venue', 'Event table setup', 'Restaurant fixtures', 'City bicycle'], description: (location) => `Demo asset listing in ${location}. Confirm the exact item or service, condition, included accessories, and availability with the owner.` },
};

export type TestingListing = PropertyPlaceholder & { categorySlug: string; testingOnly: true };

const generatedListings: TestingListing[] = categories.flatMap((category) => category.locations.map((location, index) => {
  const saleOrRent = category.mode !== 'rent' && category.mode !== 'book';
  const isMacBook = category.slug === 'appliances' && index === 0;
  const isRent = !isMacBook && (category.mode === 'rent' || category.mode === 'book' || (saleOrRent && index % 2 === 1));
  const bedrooms = ['houses', 'apartments', 'hospitality'].includes(category.slug) ? 2 + index % 3 : 0;
  const bathrooms = bedrooms ? 1 + index % 2 : 0;
  const area = category.slug === 'land' ? 300 + index * 65 : bedrooms ? 85 + index * 30 : 0;
  const image = isMacBook ? '/properties/macbook-demo.jpg' : category.images[index % category.images.length];
  const images = isMacBook
    ? [image, '/properties/macbook-demo-02.jpg', '/properties/macbook-demo-03.jpg', '/properties/macbook-demo-04.jpg', '/properties/macbook-demo-05.jpg', '/properties/macbook-demo-06.jpg']
    : category.images.map((_, imageIndex) => category.images[(index + imageIndex) % category.images.length]);
  const listingCopy = demoCopy[category.slug];
  const title = isMacBook ? 'MacBook laptop' : listingCopy?.titles[index % (listingCopy.titles.length || 1)] ?? category.title;
  const price = isMacBook ? 850000 : category.price + category.increment * index;
  return {
    id: `test-${category.slug}-${index + 1}`, categorySlug: category.slug, testingOnly: true as const,
    title: `${title} in ${location}`, type: category.type, location: `${location}, Rwanda`,
    price: `RWF ${price.toLocaleString('en-RW')}`,
    priceNote: isMacBook ? '' : category.mode === 'book' ? '/ night' : category.mode === 'sale-lease' && isRent ? ' lease price' : category.mode === 'sale-hire' && isRent ? '/ day' : saleOrRent ? isRent ? '/ month' : '' : category.note.replace(' asking', ''),
    bedrooms, bathrooms, area, accent: '#39734b', image, images, listed: 'Demo listing',
    availableFor: !isMacBook && (category.mode === 'book' || isRent) ? 'rent' : 'sale',
    description: isMacBook
      ? `Demo MacBook laptop listing in ${location}. Ask the seller for the exact model, year, specifications, battery condition, and included accessories.`
      : listingCopy?.description(location) ?? `Demo ${category.type.toLowerCase()} listing in ${location}. Ask the owner for details and availability.`,
  };
}));

// Keep downloaded, category-specific demo photos visible as their own listings
// in the all-properties shop instead of hiding them several slides into a gallery.
const downloadedImageDemos: TestingListing[] = [
  { id: 'test-vehicles-downloaded-1', categorySlug: 'vehicles', testingOnly: true, title: 'White SUV', type: 'Vehicle', location: 'Kigali, Rwanda', price: 'RWF 18,000', priceNote: '/ day', bedrooms: 0, bathrooms: 0, area: 0, accent: '#39734b', image: '/properties/vehicle-demo-06.jpg', images: ['/properties/vehicle-demo-06.jpg'], listed: 'Demo listing', availableFor: 'rent', description: 'Demo vehicle listing. Ask the owner for the make, model year, mileage, condition, and sale or hire terms.' },
  { id: 'test-furniture-downloaded-1', categorySlug: 'furniture', testingOnly: true, title: 'Living and dining room furniture', type: 'Furniture', location: 'Kigali, Rwanda', price: 'RWF 85,000', priceNote: '', bedrooms: 0, bathrooms: 0, area: 0, accent: '#39734b', image: '/properties/furniture-demo-05.jpg', images: ['/properties/furniture-demo-05.jpg'], listed: 'Demo listing', availableFor: 'sale', description: 'Demo furniture listing. Ask about the pictured pieces, dimensions, condition, and delivery.' },
  { id: 'test-appliances-downloaded-1', categorySlug: 'appliances', testingOnly: true, title: 'Refrigerator and washing machine', type: 'Appliance', location: 'Kigali, Rwanda', price: 'RWF 95,000', priceNote: '', bedrooms: 0, bathrooms: 0, area: 0, accent: '#39734b', image: '/properties/appliance-demo-06.jpg', images: ['/properties/appliance-demo-06.jpg'], listed: 'Demo listing', availableFor: 'sale', description: 'Demo appliance listing. Ask for the brands, model numbers, working condition, power requirements, and delivery options.' },
  { id: 'test-equipment-drill-downloaded-1', categorySlug: 'equipment', testingOnly: true, title: 'Cordless hammer drill', type: 'Equipment', location: 'Kigali, Rwanda', price: 'RWF 22,000', priceNote: '/ day', bedrooms: 0, bathrooms: 0, area: 0, accent: '#39734b', image: '/properties/equipment-demo-06.jpg', images: ['/properties/equipment-demo-06.jpg'], listed: 'Demo listing', availableFor: 'rent', description: 'Demo equipment listing. Ask about the drill model, battery condition, included accessories, and hire terms.' },
  { id: 'test-equipment-excavator-downloaded-1', categorySlug: 'equipment', testingOnly: true, title: 'Excavator', type: 'Equipment', location: 'Kigali, Rwanda', price: 'RWF 22,000', priceNote: '/ day', bedrooms: 0, bathrooms: 0, area: 0, accent: '#39734b', image: '/properties/equipment-demo-07.jpg', images: ['/properties/equipment-demo-07.jpg'], listed: 'Demo listing', availableFor: 'rent', description: 'Demo equipment listing. Ask for the excavator model, operating condition, operator availability, and hire terms.' },
  { id: 'test-other-bicycle-downloaded-1', categorySlug: 'other', testingOnly: true, title: 'City bicycle', type: 'Other', location: 'Kigali, Rwanda', price: 'RWF 55,000', priceNote: '', bedrooms: 0, bathrooms: 0, area: 0, accent: '#39734b', image: '/properties/other-demo-06.jpg', images: ['/properties/other-demo-06.jpg'], listed: 'Demo listing', availableFor: 'sale', description: 'Demo bicycle listing. Ask about the frame size, gears, brakes, condition, and pickup arrangements.' },
];

export const testingListings: TestingListing[] = [...downloadedImageDemos, ...generatedListings];
