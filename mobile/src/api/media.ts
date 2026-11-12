import { getApiBaseUrl } from './client';

const DEFAULT_WEB_URL = 'https://umutungodeals.com';

function isLocalHost(hostname: string) {
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(hostname);
}

/** Resolve seeded local URLs and relative property assets for real devices. */
export function resolveMediaUrl(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return '';
  const webBase = (process.env.EXPO_PUBLIC_WEB_URL?.trim() || DEFAULT_WEB_URL).replace(/\/$/, '');

  try {
    const parsed = new URL(raw, webBase);
    if (isLocalHost(parsed.hostname)) {
      if (parsed.pathname.startsWith('/properties/')) return `${webBase}${parsed.pathname}${parsed.search}`;
      if (parsed.pathname.startsWith('/uploads/')) return `${getApiBaseUrl()}${parsed.pathname}${parsed.search}`;
      return raw;
    }
    if (!/^https?:$/.test(parsed.protocol)) return raw;
    return parsed.href;
  } catch {
    if (raw.startsWith('/properties/')) return `${webBase}${raw}`;
    return raw;
  }
}
