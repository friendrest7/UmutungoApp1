import type { ApiListing } from './listings';

const CACHE_KEY = 'umutungo-public-listings-cache-v1';

export function readCachedApiListings(): ApiListing[] {
  try {
    const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? 'null') as { items?: ApiListing[]; savedAt?: number } | null;
    if (!cached || !Array.isArray(cached.items) || Date.now() - (cached.savedAt ?? 0) > 7 * 24 * 60 * 60 * 1000) return [];
    return cached.items;
  } catch {
    return [];
  }
}

export function writeCachedApiListings(items: ApiListing[]) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ items, savedAt: Date.now() }));
  } catch {
    // Keep listing discovery available when browser storage is unavailable or full.
  }
}
