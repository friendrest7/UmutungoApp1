'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthModal } from '../../components/AuthModal';
import { Icon } from '../../components/Icons';
import { RoleDashboard } from '../../components/RoleDashboard';
import { dashboardPathForAccountRole } from '../../lib/accountRouting';

export default function LandlordPage() {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [signInOpen, setSignInOpen] = useState(false);
  useEffect(() => {
    try {
      const user = JSON.parse(window.localStorage.getItem('umutungo-demo-user') ?? 'null') as { role?: string } | null;
      setAuthorized(user?.role === 'Landlord' || user?.role === 'Property Owner');
    } catch {
      setAuthorized(false);
    } finally {
      setChecking(false);
    }
  }, []);
  if (checking) return <main className="landlord-access-page"><p>Checking your landlord account…</p></main>;
  if (!authorized) return <main className="landlord-access-page"><section><span className="post-eyebrow">Landlord dashboard</span><h1>Join as a landlord<br /><em>and grow your rentals.</em></h1><p>Create a landlord account to list rental properties, manage tenants, and receive enquiries.</p><div className="landlord-access-actions"><Link className="post-primary-button" href="/register?role=Landlord">Create landlord account <Icon name="arrow" size={15} /></Link><button className="post-secondary-button" type="button" onClick={() => setSignInOpen(true)}>Already have an account? Sign in</button><Link className="landlord-access-back" href="/">Back to marketplace</Link></div></section><AuthModal open={signInOpen} role="Landlord" onClose={() => setSignInOpen(false)} onSuccess={(role) => { setSignInOpen(false); if (role === 'Landlord' || role === 'Property Owner') setAuthorized(true); else window.location.assign(dashboardPathForAccountRole(role)); }} /></main>;
  return <RoleDashboard role="landlord" />;
}
