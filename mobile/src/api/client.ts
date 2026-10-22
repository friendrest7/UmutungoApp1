import * as SecureStore from 'expo-secure-store';
import type { ApiApplication, ApiListing, ApiMessage, ApiNotification, ApiProfile, ApiReview, ApiUser, FavoriteItem, ListingQuery, UserRole } from './types';
import { readFavoriteQueue, readOfflineFavorites, readPublicCache, writeFavoriteQueue, writeOfflineFavorites, writePublicCache, type FavoriteChange } from './offlineStore';

const TOKEN_KEY = 'umutungo-access-token';
const SESSION_KEY = 'umutungo-offline-session';
const DEFAULT_API_URL = 'https://umutungoapp1-backend.onrender.com';
const baseUrl = () => (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL).trim().replace(/\/$/, '');

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) { super(message); this.name = 'ApiError'; this.status = status; }
}

async function request<T>(path: string, init: RequestInit = {}, authenticated = false): Promise<T> {
  const base = baseUrl();
  if (!base) throw new ApiError('Set EXPO_PUBLIC_API_URL in mobile/.env before connecting to Umutungo.');
  const token = authenticated ? await SecureStore.getItemAsync(TOKEN_KEY) : null;
  const cacheKey = `${base}${path}`;
  const cacheable = !authenticated && (!init.method || init.method.toUpperCase() === 'GET');
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  } catch {
    if (cacheable) {
      const cached = await readPublicCache<T>(cacheKey);
      if (cached !== null) return cached;
    }
    throw new ApiError('Umutungo is unreachable. Check the API URL and your network connection.');
  }
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new ApiError(body.error ?? `Umutungo request failed (${response.status})`, response.status);
  if (cacheable) await writePublicCache(cacheKey, body);
  return body as T;
}

export const getApiBaseUrl = baseUrl;
export const getStoredToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export async function clearStoredToken() { await SecureStore.deleteItemAsync(TOKEN_KEY); await SecureStore.deleteItemAsync(SESSION_KEY); }
export async function cacheSession(user: ApiUser, profile: ApiProfile | null) { await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ user, profile })); }
export async function getCachedSession() {
  try { return JSON.parse((await SecureStore.getItemAsync(SESSION_KEY)) ?? 'null') as { user: ApiUser; profile: ApiProfile | null } | null; }
  catch { return null; }
}

export async function requestOtp(phone: string) { return request<{ message: string; development_code?: string }>('/api/v1/auth/request-otp', { method: 'POST', body: JSON.stringify({ phone }) }); }
export async function signInWithPassword(email: string, password: string) {
  const result = await request<{ user: ApiUser; access_token: string }>('/api/v1/auth/dev-login', { method: 'POST', body: JSON.stringify({ email, password }) });
  await SecureStore.setItemAsync(TOKEN_KEY, result.access_token);
  await cacheSession(result.user, null);
  return result;
}
export async function verifyOtp(phone: string, code: string) {
  const result = await request<{ user: ApiUser; access_token: string }>('/api/v1/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone, code }) });
  await SecureStore.setItemAsync(TOKEN_KEY, result.access_token);
  await cacheSession(result.user, null);
  return result;
}
export async function registerAccount(input: { name: string; email: string; phone: string; role: UserRole }) { return request<{ user: ApiUser; message: string; development_code?: string }>('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(input) }); }
export async function getMe() { return request<{ user: ApiUser; profile: ApiProfile }>('/api/v1/me', {}, true); }
export async function updateProfile(input: { name?: string; email?: string; bio?: string; photo_url?: string; language?: string }) {
  const result = await request<{ user: ApiUser; profile: ApiProfile }>('/api/v1/me', { method: 'PATCH', body: JSON.stringify(input) }, true);
  await cacheSession(result.user, result.profile);
  return result;
}
export async function signInWithGoogle(input: { access_token?: string; credential?: string; client_id?: string; role?: 'client' | 'tenant' }) {
  const result = await request<{ user: ApiUser; profile: ApiProfile; access_token: string }>('/api/v1/auth/google', { method: 'POST', body: JSON.stringify(input) });
  await SecureStore.setItemAsync(TOKEN_KEY, result.access_token);
  await cacheSession(result.user, result.profile);
  return result;
}

export async function listListings(query: ListingQuery = {}) {
  const params = new URLSearchParams(Object.entries(query).filter(([, value]) => Boolean(value)) as string[][]);
  const path = `/api/v1/listings${params.toString() ? `?${params}` : ''}`;
  try { return await request<{ items: ApiListing[]; count: number }>(path); }
  catch (error) {
    if (!(error instanceof ApiError) || error.status !== undefined) throw error;
    const base = await readPublicCache<{ items: ApiListing[]; count: number }>(`${baseUrl()}/api/v1/listings`);
    if (!base) throw error;
    const contains = (value: string | undefined, filter: string | undefined) => !filter || (value ?? '').toLocaleLowerCase().includes(filter.toLocaleLowerCase());
    const items = base.items.filter((item) => contains(item.title, query.search) || contains(`${item.district} ${item.sector} ${item.province}`, query.search))
      .filter((item) => contains(item.category, query.category) && contains(item.transaction_type, query.transaction_type)
        && contains(item.province, query.province) && contains(item.district, query.district) && contains(item.sector, query.sector));
    return { items, count: items.length };
  }
}
export async function getCachedListings() {
  return await readPublicCache<{ items: ApiListing[]; count: number }>(`${baseUrl()}/api/v1/listings`);
}
export async function getListing(id: string) { return request<ApiListing>(`/api/v1/listings/${encodeURIComponent(id)}`); }
async function sendFavoriteChange(change: FavoriteChange) {
  if (change.method === 'POST') return request<{ id: string; property_id: string }>('/api/v1/favorites', { method: 'POST', body: JSON.stringify(change.item) }, true);
  return request<{ property_id: string; status: string }>(`/api/v1/favorites/${encodeURIComponent(change.propertyId)}`, { method: 'DELETE' }, true);
}
function applyFavoriteChanges(items: FavoriteItem[], changes: FavoriteChange[]) {
  return changes.reduce((current, change) => change.method === 'POST'
    ? [...current.filter((item) => item.property_id !== change.item.property_id), change.item]
    : current.filter((item) => item.property_id !== change.propertyId), items);
}
export async function syncOfflineChanges() {
  const token = await getStoredToken();
  if (!token) return;
  const changes = await readFavoriteQueue(token);
  const remaining: FavoriteChange[] = [];
  for (const change of changes) {
    try { await sendFavoriteChange(change); }
    catch (error) { if (!(error instanceof ApiError) || error.status !== 404) remaining.push(change); }
  }
  await writeFavoriteQueue(token, remaining);
  if (!remaining.length) {
    try { const latest = await request<{ items: FavoriteItem[] }>('/api/v1/favorites', {}, true); await writeOfflineFavorites(token, latest.items); }
    catch { /* Keep the last local snapshot when the connection drops during sync. */ }
  }
}
export async function listFavorites() {
  const token = await getStoredToken();
  if (!token) return request<{ items: FavoriteItem[] }>('/api/v1/favorites', {}, true);
  await syncOfflineChanges();
  try {
    const result = await request<{ items: FavoriteItem[] }>('/api/v1/favorites', {}, true);
    const changes = await readFavoriteQueue(token);
    const items = applyFavoriteChanges(result.items, changes);
    await writeOfflineFavorites(token, items);
    return { items };
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== undefined) throw error;
    return { items: applyFavoriteChanges(await readOfflineFavorites<FavoriteItem>(token), await readFavoriteQueue(token)) };
  }
}
export async function saveFavorite(item: FavoriteItem) {
  const token = await getStoredToken();
  if (!token) return request<{ id: string; property_id: string }>('/api/v1/favorites', { method: 'POST', body: JSON.stringify(item) }, true);
  const local = await readOfflineFavorites<FavoriteItem>(token);
  await writeOfflineFavorites(token, [...local.filter((saved) => saved.property_id !== item.property_id), item]);
  try { return await sendFavoriteChange({ method: 'POST', item }); }
  catch (error) {
    if (!(error instanceof ApiError) || error.status !== undefined) throw error;
    const queue = await readFavoriteQueue(token);
    await writeFavoriteQueue(token, [...queue.filter((change) => !(change.method === 'DELETE' && change.propertyId === item.property_id) && !(change.method === 'POST' && change.item.property_id === item.property_id)), { method: 'POST', item }]);
    return { id: `offline-${item.property_id}`, property_id: item.property_id };
  }
}
export async function removeFavorite(id: string) {
  const token = await getStoredToken();
  if (!token) return request<{ property_id: string; status: string }>(`/api/v1/favorites/${encodeURIComponent(id)}`, { method: 'DELETE' }, true);
  await writeOfflineFavorites(token, (await readOfflineFavorites<FavoriteItem>(token)).filter((item) => item.property_id !== id));
  try { return await sendFavoriteChange({ method: 'DELETE', propertyId: id }); }
  catch (error) {
    if (!(error instanceof ApiError) || error.status !== undefined) throw error;
    const queue = await readFavoriteQueue(token);
    await writeFavoriteQueue(token, [...queue.filter((change) => !(change.method === 'POST' && change.item.property_id === id) && !(change.method === 'DELETE' && change.propertyId === id)), { method: 'DELETE', propertyId: id }]);
    return { property_id: id, status: 'queued_offline' };
  }
}
export async function listMessages(listingId?: string) { return request<{ items: ApiMessage[] }>(`/api/v1/messages${listingId ? `?listing_id=${encodeURIComponent(listingId)}` : ''}`, {}, true); }
export async function sendMessage(input: { listing_id: string; recipient_id: string; body: string }) { return request<{ id: string; status: string }>('/api/v1/messages', { method: 'POST', body: JSON.stringify(input) }, true); }
export async function listNotifications() { return request<{ items: ApiNotification[] }>('/api/v1/notifications', {}, true); }
export async function listApplications() { return request<{ items: ApiApplication[] }>('/api/v1/applications', {}, true); }
export async function applyToListing(listingId: string, message: string) { return request<{ id: string; status: string }>(`/api/v1/listings/${encodeURIComponent(listingId)}/applications`, { method: 'POST', body: JSON.stringify({ message }) }, true); }
export async function createBooking(input: { listing_id: string; check_in: string; check_out: string; guests: number }) { return request<{ id: string; status: string }>('/api/v1/bookings', { method: 'POST', body: JSON.stringify(input) }, true); }
export async function listListingReviews(listingId: string) { return request<{ items: ApiReview[] }>(`/api/v1/listings/${encodeURIComponent(listingId)}/reviews`); }
export async function createListingReview(input: { listing_id: string; rating: number; body: string }) { return request<{ id: string; status: string }>('/api/v1/reviews', { method: 'POST', body: JSON.stringify(input) }, true); }
export async function markApplicationViewed(id: string) { return request<{ id: string; status: string }>(`/api/v1/applications/${encodeURIComponent(id)}/viewed`, { method: 'POST', body: '{}' }, true); }
export async function decideApplication(id: string, status: 'accepted' | 'rejected' | 'more_info', note = '') { return request<{ id: string; status: string }>(`/api/v1/applications/${encodeURIComponent(id)}/decision`, { method: 'POST', body: JSON.stringify({ status, note }) }, true); }
export async function startMomoPayment(input: { related_type: 'listing'; related_id: string; transaction_type: 'buy' | 'rent'; phone: string }) {
  return request<{ id: string; status: string; amount: number; currency: string }>('/api/v1/payments', { method: 'POST', body: JSON.stringify({ ...input, provider: 'mtn_momo' }) }, true);
}
export async function getPayment(id: string) { return request<{ id: string; status: 'pending' | 'successful' | 'failed' }>(`/api/v1/payments/${encodeURIComponent(id)}/confirm`, { method: 'POST', body: '{}' }, true); }
export type OwnerPlan = 'silver' | 'gold' | 'platinum';
export type OwnerPurchase = { id: string; plan: OwnerPlan; amount: number; currency: string; status: string; payment_status: string; transaction_reference: string; activated_at?: string | null; expires_at?: string | null };
export async function getOwnerUpgrades() { return request<{ prices: Record<OwnerPlan, number>; purchases: OwnerPurchase[] }>('/api/v1/owner/upgrades', {}, true); }
export async function startOwnerUpgrade(input: { plan: OwnerPlan; phone: string; idempotency_key: string }) {
  return request<OwnerPurchase & { provider?: string; idempotent_replay?: boolean }>('/api/v1/owner/upgrades', { method: 'POST', body: JSON.stringify({ ...input, provider: 'mtn_momo' }) }, true);
}

export type CreateListingInput = {
  category: string;
  transaction_type: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  province: string;
  district: string;
  sector: string;
  cell?: string;
  village?: string;
  amenities?: string[];
  tags?: string[];
  contact_method?: string;
  media?: Array<{ type: string; url: string }>;
};
export async function createListing(input: CreateListingInput) { return request<{ id: string; status: string; expires_at: string }>('/api/v1/listings', { method: 'POST', body: JSON.stringify(input) }, true); }
export async function uploadListingMedia(listingId: string, input: { uri: string; name: string; type: string }) {
  const base = baseUrl();
  if (!base) throw new ApiError('Set EXPO_PUBLIC_API_URL in mobile/.env before connecting to Umutungo.');
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) throw new ApiError('Sign in is required before uploading listing photos.', 401);
  const form = new FormData();
  form.append('file', { uri: input.uri, name: input.name, type: input.type } as unknown as Blob);
  const response = await fetch(`${base}/api/v1/listings/${encodeURIComponent(listingId)}/media`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = await response.json().catch(() => ({})) as { error?: string; url?: string; id?: string };
  if (!response.ok) throw new ApiError(body.error ?? `Image upload failed (${response.status})`, response.status);
  return body as { id: string; type: string; url: string; size_bytes: number };
}
export async function updateListing(id: string, input: { title?: string; description?: string; price?: number; status?: string }) { return request<{ id: string; status: string }>(`/api/v1/listings/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }, true); }
export async function deleteListing(id: string) { return request<{ id: string; status: string }>(`/api/v1/listings/${encodeURIComponent(id)}`, { method: 'DELETE' }, true); }
export async function listOwnerListings() { return request<{ items: ApiListing[]; count: number }>('/api/v1/owner/listings', {}, true); }
