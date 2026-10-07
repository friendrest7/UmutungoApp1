import { NextResponse } from 'next/server';

const defaultBackend = 'https://umutungoappbackend1.onrender.com';

function backendUrl() {
  const configured = (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/$/, '');
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured);
  return configured && !(process.env.NODE_ENV === 'production' && isLocal) ? configured : defaultBackend;
}

function backendRole(role?: string) {
  const normalized = (role ?? '').trim().toLowerCase();
  if (normalized.includes('komisiyoneri') || normalized === 'commissioner') return 'komisiyoneri';
  if (normalized === 'landlord' || normalized === 'property owner' || normalized === 'property_owner') return 'property_owner';
  return 'client';
}

function displayRole(role: unknown, requestedRole?: string): string {
  const normalized = typeof role === 'string' ? role.toLowerCase() : 'client';
  if (normalized === 'komisiyoneri') return 'Commissioner / Komisiyoneri';
  if (normalized === 'property_owner') return requestedRole?.trim().toLowerCase() === 'landlord' ? 'Landlord' : 'Property Owner';
  return 'Client';
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { accessToken?: string; credential?: string; role?: string };
    const accessToken = body.accessToken?.trim();
    const credential = body.credential?.trim();
    if ((!accessToken && !credential) || (accessToken && credential)) {
      return NextResponse.json({ error: 'A Google sign-in token is required.' }, { status: 400 });
    }

    const response = await fetch(`${backendUrl()}/api/v1/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(accessToken ? { access_token: accessToken } : { credential }),
        role: backendRole(body.role),
      }),
      cache: 'no-store',
    });
    const result = await response.json().catch(() => ({})) as { error?: string; user?: { role?: string }; access_token?: string; profile?: unknown };
    if (!response.ok) {
      return NextResponse.json({ error: result.error ?? 'Google sign-in could not be completed.' }, { status: response.status });
    }
    if (!result.user || !result.access_token) {
      return NextResponse.json({ error: 'Google sign-in did not return a Umutungo session.' }, { status: 502 });
    }
    return NextResponse.json({ ...result, role: displayRole(result.user.role, body.role) });
  } catch {
    return NextResponse.json({ error: 'Google sign-in could not reach the Umutungo service.' }, { status: 502 });
  }
}
