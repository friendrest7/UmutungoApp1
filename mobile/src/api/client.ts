import * as SecureStore from 'expo-secure-store';
import type { ApiApplication, ApiListing, ApiMessage, ApiNotification, ApiUser, FavoriteItem, ListingQuery, UserRole } from './types';

const TOKEN_KEY = 'umutungo-access-token';
const baseUrl = () => (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/$/, '');

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) { super(message); this.name = 'ApiError'; this.status = status; }
}

async function request<T>(path: string, init: RequestInit = {}, authenticated = false): Promise<T> {
  const base = baseUrl();
  if (!base) throw new ApiError('Set EXPO_PUBLIC_API_URL in mobile/.env before connecting to Umutungo.');
  const token = authenticated ? await SecureStore.getItemAsync(TOKEN_KEY) : null;
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new ApiError(body.error ?? `Umutungo request failed (${response.status})`, response.status);
  return body as T;
}

export const getApiBaseUrl = baseUrl;
export const getStoredToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const clearStoredToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);

export async function requestOtp(phone: string) { return request<{ message: string; development_code?: string }>('/api/v1/auth/request-otp', { method: 'POST', body: JSON.stringify({ phone }) }); }
export async function verifyOtp(phone: string, code: string) {
  const result = await request<{ user: ApiUser; access_token: string }>('/api/v1/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone, code }) });
  await SecureStore.setItemAsync(TOKEN_KEY, result.access_token);
  return result;
}
export async function registerAccount(input: { name: string; email: string; phone: string; role: UserRole }) { return request<{ user: ApiUser; message: string; development_code?: string }>('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(input) }); }
export async function getMe() { return request<{ user: ApiUser }>('/api/v1/me', {}, true); }

export async function listListings(query: ListingQuery = {}) {
  const params = new URLSearchParams(Object.entries(query).filter(([, value]) => Boolean(value)) as string[][]);
  return request<{ items: ApiListing[]; count: number }>(`/api/v1/listings${params.toString() ? `?${params}` : ''}`);
}
export async function getListing(id: string) { return request<ApiListing>(`/api/v1/listings/${encodeURIComponent(id)}`); }
export async function listFavorites() { return request<{ items: FavoriteItem[] }>('/api/v1/favorites', {}, true); }
export async function saveFavorite(item: FavoriteItem) { return request<{ id: string; property_id: string }>('/api/v1/favorites', { method: 'POST', body: JSON.stringify(item) }, true); }
export async function removeFavorite(id: string) { return request<{ property_id: string; status: string }>(`/api/v1/favorites/${encodeURIComponent(id)}`, { method: 'DELETE' }, true); }
export async function listMessages(listingId?: string) { return request<{ items: ApiMessage[] }>(`/api/v1/messages${listingId ? `?listing_id=${encodeURIComponent(listingId)}` : ''}`, {}, true); }
export async function sendMessage(input: { listing_id: string; recipient_id: string; body: string }) { return request<{ id: string; status: string }>('/api/v1/messages', { method: 'POST', body: JSON.stringify(input) }, true); }
export async function listNotifications() { return request<{ items: ApiNotification[] }>('/api/v1/notifications', {}, true); }
export async function listApplications() { return request<{ items: ApiApplication[] }>('/api/v1/applications', {}, true); }

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
export async function updateListing(id: string, input: { title?: string; description?: string; price?: number; status?: string }) { return request<{ id: string; status: string }>(`/api/v1/listings/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }, true); }
export async function deleteListing(id: string) { return request<{ id: string; status: string }>(`/api/v1/listings/${encodeURIComponent(id)}`, { method: 'DELETE' }, true); }
export async function listOwnerListings() { return request<{ items: ApiListing[]; count: number }>('/api/v1/owner/listings', {}, true); }
