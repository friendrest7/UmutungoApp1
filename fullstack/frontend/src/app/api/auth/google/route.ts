import { NextResponse } from 'next/server';

const allowedRoles = new Set(['Client', 'Tenant', 'Commissioner / Komisiyoneri', 'Landlord', 'Property Owner', 'Admin']);

export async function POST(request: Request) {
  try {
    const body = await request.json() as { accessToken?: string; credential?: string; role?: string };
    const accessToken = body.accessToken?.trim();
    const credential = body.credential?.trim();
    const role = allowedRoles.has(body.role ?? '') ? body.role : 'Client';
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if ((!accessToken && !credential) || !clientId) {
      return NextResponse.json({ error: 'Google sign-in is not configured.' }, { status: 400 });
    }

    const tokenResponse = await fetch(accessToken
      ? `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
      : `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential!)}`, { cache: 'no-store' });
    if (!tokenResponse.ok) return NextResponse.json({ error: 'Google sign-in token is invalid or expired.' }, { status: 401 });
    const tokenInfo = await tokenResponse.json() as { aud?: string; expires_in?: string; exp?: string; sub?: string; email?: string; email_verified?: string | boolean; name?: string; picture?: string };
    const idTokenExpired = credential ? Number(tokenInfo.exp ?? 0) * 1000 <= Date.now() : false;
    if (tokenInfo.aud !== clientId || idTokenExpired || (accessToken && Number(tokenInfo.expires_in ?? 0) <= 0)) {
      return NextResponse.json({ error: 'Google sign-in could not be verified.' }, { status: 401 });
    }

    let profile: { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string };
    if (credential) {
      profile = { sub: tokenInfo.sub, email: tokenInfo.email, email_verified: tokenInfo.email_verified === true || tokenInfo.email_verified === 'true', name: tokenInfo.name, picture: tokenInfo.picture };
    } else {
      const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
      if (!profileResponse.ok) return NextResponse.json({ error: 'Google profile could not be loaded.' }, { status: 401 });
      profile = await profileResponse.json() as { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string };
    }
    if (!profile.sub || !profile.email || profile.email_verified !== true) {
      return NextResponse.json({ error: 'A verified Google email is required.' }, { status: 403 });
    }

    return NextResponse.json({ role, user: { id: profile.sub, email: profile.email, name: profile.name ?? profile.email.split('@')[0], picture: profile.picture ?? '' } });
  } catch {
    return NextResponse.json({ error: 'Google sign-in could not be completed.' }, { status: 500 });
  }
}
