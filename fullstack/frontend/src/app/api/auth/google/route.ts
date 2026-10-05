import { NextResponse } from 'next/server';

const allowedRoles = new Set(['Tenant', 'Commissioner / Komisiyoneri', 'Landlord', 'Property Owner', 'Admin']);

export async function POST(request: Request) {
  try {
    const body = await request.json() as { accessToken?: string; role?: string };
    const accessToken = body.accessToken?.trim();
    const role = allowedRoles.has(body.role ?? '') ? body.role : 'Tenant';
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!accessToken || !clientId) {
      return NextResponse.json({ error: 'Google sign-in is not configured.' }, { status: 400 });
    }

    const tokenResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`, { cache: 'no-store' });
    if (!tokenResponse.ok) return NextResponse.json({ error: 'Google sign-in token is invalid or expired.' }, { status: 401 });
    const tokenInfo = await tokenResponse.json() as { aud?: string; expires_in?: string };
    if (tokenInfo.aud !== clientId || Number(tokenInfo.expires_in ?? 0) <= 0) {
      return NextResponse.json({ error: 'Google sign-in could not be verified.' }, { status: 401 });
    }

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
    if (!profileResponse.ok) return NextResponse.json({ error: 'Google profile could not be loaded.' }, { status: 401 });
    const profile = await profileResponse.json() as { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string };
    if (!profile.sub || !profile.email || profile.email_verified !== true) {
      return NextResponse.json({ error: 'A verified Google email is required.' }, { status: 403 });
    }

    return NextResponse.json({ role, user: { id: profile.sub, email: profile.email, name: profile.name ?? profile.email.split('@')[0], picture: profile.picture ?? '' } });
  } catch {
    return NextResponse.json({ error: 'Google sign-in could not be completed.' }, { status: 500 });
  }
}
