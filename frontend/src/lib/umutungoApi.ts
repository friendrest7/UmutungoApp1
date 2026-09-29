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

export function apiBaseUrl() {
  const configured = (process.env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/$/, '');
  if (configured) return configured;
  return process.env.NODE_ENV === 'production' ? 'https://umutungoappbackend1.onrender.com' : '';
}

export function apiToken() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem('umutungo-api-token') ?? '';
}

export async function umutungoApi<T>(path: string, init: RequestInit = {}) {
  const token = apiToken();
  if (!token || !apiBaseUrl()) return null;
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
  if (!base) return null;
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Umutungo request failed');
  return body as T;
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
