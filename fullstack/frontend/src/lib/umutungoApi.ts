export type ApiApplication = {
  id: string;
  listing_id: string;
  listing_title: string;
  applicant_id?: string;
  applicant_name?: string;
  status: string;
  message: string;
  viewed_at?: string | null;
  created_at: string;
};

export type ApiNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  read_at?: string | null;
  created_at: string;
  application_id?: string;
  status?: string;
};

export type ApiPayment = {
  id: string;
  related_type: string;
  related_id: string;
  amount: number;
  currency: string;
  provider: string;
  status: string;
  receipt_number?: string;
  created_at: string;
};

export type ApiMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  recipient_id: string;
  recipient_name: string;
  listing_id: string;
  body: string;
  created_at: string;
};

export type TenantBooking = {
  id: string;
  property_id: string;
  property_title: string;
  location: string;
  price: string;
  payment_status: 'paid' | 'pending';
  created_at: string;
};

export type TenantDashboardData = {
  properties: Array<Record<string, unknown>>;
  applications: ApiApplication[];
  notifications?: ApiNotification[];
  payments: ApiPayment[];
  messages: ApiMessage[];
  bookings: TenantBooking[];
  reviews: Array<{ id: string; listing_id: string; listing_title: string; rating: number; body: string; created_at: string }>;
};

export type DirectoryProfile = {
  id: string;
  name: string;
  role: 'property_owner' | 'komisiyoneri';
  business_name: string;
  physical_address: string;
  verified: boolean;
  published_listings: number;
};

export type FavoriteItem = {
  property_id: string;
  title: string;
  type: string;
  location: string;
  price: string;
  image: string;
  saved_at?: string;
};

export type AdminReport = {
  id: string;
  listing_id: string;
  listing_title: string;
  reporter_name: string;
  reported_user_name: string;
  reason: string;
  details: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  created_at: string;
};

export type AdminReportsResponse = {
  items: AdminReport[];
  count: number;
  summary: Record<'pending' | 'reviewing' | 'resolved' | 'dismissed', number>;
};

export type AboutVideo = {
  url: string;
  title: string;
  filename: string;
  original_name: string;
  size_bytes: number;
  updated_at: string;
};

const DEFAULT_API_URL = 'https://umutungoapp1-backend.onrender.com';

export function apiBaseUrl() {
  const configured = (process.env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/$/, '');
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) return '';
  return configured || DEFAULT_API_URL;
}

function apiIsAvailable() {
  return process.env.NODE_ENV === 'production' || Boolean(apiBaseUrl());
}

export function apiToken() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem('umutungo-api-token') ?? '';
}

export async function umutungoApi<T>(path: string, init: RequestInit = {}) {
  const token = apiToken();
  if (!token || !apiIsAvailable()) return null;
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Umutungo request failed');
  return body as T;
}

export async function publicUmutungoApi<T>(path: string, init: RequestInit = {}) {
  const base = apiBaseUrl();
  if (!apiIsAvailable()) return null;
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Umutungo request failed');
  return body as T;
}

export async function getAboutVideo() {
  const result = await publicUmutungoApi<{ video: AboutVideo | null }>('/api/v1/about-video', { cache: 'no-store' });
  return result?.video ?? null;
}

export async function uploadListingImage(listingId: string, file: File) {
  const base = apiBaseUrl();
  const token = apiToken();
  if (!apiIsAvailable() || !token) throw new Error('Connect to the Umutungo API and sign in before uploading listing photos.');
  const form = new FormData();
  form.set('file', file);
  const response = await fetch(`${base}/api/v1/listings/${encodeURIComponent(listingId)}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = await response.json().catch(() => ({})) as { id?: string; type?: string; url?: string; error?: string };
  if (!response.ok || !body.url) throw new Error(body.error ?? 'The listing photo could not be uploaded.');
  return body;
}

export async function uploadAboutVideo(file: File, title: string) {
  const base = apiBaseUrl();
  const token = apiToken();
  if (!apiIsAvailable() || !token) throw new Error('Connect to the Umutungo API and sign in as an administrator to publish this video.');
  const form = new FormData();
  form.set('file', file);
  form.set('title', title);
  const response = await fetch(`${base}/api/v1/about-video`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  const body = await response.json().catch(() => ({})) as { video?: AboutVideo; error?: string };
  if (!response.ok || !body.video) throw new Error(body.error ?? 'The About video could not be published.');
  return body.video;
}

export async function deleteAboutVideo() {
  const result = await umutungoApi<{ video: AboutVideo | null }>('/api/v1/about-video', { method: 'DELETE' });
  if (!result) throw new Error('Connect to the Umutungo API and sign in as an administrator to remove this video.');
  return result.video;
}

export async function listFavorites() {
  const result = await umutungoApi<{ items: FavoriteItem[] }>('/api/v1/favorites');
  return result?.items ?? null;
}

export async function saveFavorite(item: FavoriteItem) {
  return umutungoApi<{ id: string; property_id: string }>('/api/v1/favorites', { method: 'POST', body: JSON.stringify(item) });
}

export async function removeFavorite(propertyID: string) {
  return umutungoApi<{ property_id: string; status: string }>(`/api/v1/favorites/${encodeURIComponent(propertyID)}`, { method: 'DELETE' });
}
