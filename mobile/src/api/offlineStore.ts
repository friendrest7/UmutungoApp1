import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'umutungo-public-cache-v1:';
const FAVORITES_PREFIX = 'umutungo-offline-favorites-v1:';
const QUEUE_PREFIX = 'umutungo-offline-queue-v1:';

export async function readPublicCache<T>(key: string): Promise<T | null> {
  try {
    const value = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    return value ? JSON.parse(value) as T : null;
  } catch { return null; }
}

export async function writePublicCache(key: string, value: unknown) {
  try { await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(value)); } catch { /* Cache failures must not block the API. */ }
}

function accountKey(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) hash = Math.imul(hash ^ token.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

export async function readOfflineFavorites<T>(token: string): Promise<T[]> {
  try { return JSON.parse(await AsyncStorage.getItem(`${FAVORITES_PREFIX}${accountKey(token)}`) ?? '[]') as T[]; }
  catch { return []; }
}

export async function writeOfflineFavorites<T>(token: string, items: T[]) {
  await AsyncStorage.setItem(`${FAVORITES_PREFIX}${accountKey(token)}`, JSON.stringify(items));
}

export type FavoriteChange = { method: 'POST'; item: { property_id: string; title: string; type: string; location: string; price: string; image: string } } | { method: 'DELETE'; propertyId: string };

export async function readFavoriteQueue(token: string): Promise<FavoriteChange[]> {
  try { return JSON.parse(await AsyncStorage.getItem(`${QUEUE_PREFIX}${accountKey(token)}`) ?? '[]') as FavoriteChange[]; }
  catch { return []; }
}

export async function writeFavoriteQueue(token: string, changes: FavoriteChange[]) {
  const key = `${QUEUE_PREFIX}${accountKey(token)}`;
  if (changes.length) await AsyncStorage.setItem(key, JSON.stringify(changes));
  else await AsyncStorage.removeItem(key);
}
