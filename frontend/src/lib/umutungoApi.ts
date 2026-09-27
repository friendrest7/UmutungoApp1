export type ApiApplication = {
  id: string;
  listing_id: string;
  listing_title: string;
  status: string;
  message: string;
  viewed_at?: string | null;
  created_at: string;
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

export type TenantDashboardData = {
  properties: Array<Record<string, unknown>>;
  applications: ApiApplication[];
  payments: ApiPayment[];
  messages: ApiMessage[];
  reviews: Array<{ id: string; listing_id: string; listing_title: string; rating: number; body: string; created_at: string }>;
};

export function apiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
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

