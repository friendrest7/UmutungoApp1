const DEFAULT_BACKEND_URL = 'https://umutungoapp1-backend.onrender.com';

function backendUrl() {
  const configured = (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/$/, '');
  const localBackend = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured);
  return configured && !(process.env.NODE_ENV === 'production' && localBackend) ? configured : DEFAULT_BACKEND_URL;
}

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(`/api/v1/${path.map(encodeURIComponent).join('/')}${sourceUrl.search}`, backendUrl());
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    // @ts-expect-error Node fetch accepts streaming request bodies with duplex.
    duplex: 'half',
    cache: 'no-store',
  });
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
