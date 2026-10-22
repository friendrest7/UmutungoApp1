import type { PropertyPlaceholder } from '../components/PropertyCard';
import { testingListings } from '../data/testingListings';

const LOCAL_LISTINGS_KEY = 'umutungo-local-property-listings';

export function isLocalDevelopmentHost() {
  return typeof window !== 'undefined' && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

export function readLocalPropertyListings(): PropertyPlaceholder[] {
  if (!isLocalDevelopmentHost()) return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(LOCAL_LISTINGS_KEY) ?? 'null');
    if (Array.isArray(stored) && stored.length > 0) return stored as PropertyPlaceholder[];
  } catch {
    // Replace invalid local cache with the bundled demo listings below.
  }

  const demos = testingListings as PropertyPlaceholder[];
  writeLocalPropertyListings(demos);
  return demos;
}

export function writeLocalPropertyListings(listings: PropertyPlaceholder[]) {
  if (!isLocalDevelopmentHost()) return;
  try {
    window.localStorage.setItem(LOCAL_LISTINGS_KEY, JSON.stringify(listings));
  } catch {
    // The bundled project listings remain available even if browser storage is full.
  }
}
