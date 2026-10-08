'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthModal } from '../../components/AuthModal';
import { RoleDashboard } from '../../components/RoleDashboard';

export default function PropertyOwnerPage() {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    try {
      const user = JSON.parse(window.localStorage.getItem('umutungo-demo-user') ?? 'null') as { role?: string } | null;
      setAuthorized(user?.role === 'Property Owner');
    } catch {
      setAuthorized(false);
    } finally {
      setChecking(false);
    }
  }, []);

  if (checking) return <main className="landlord-access-page"><p>Checking your owner account…</p></main>;
  if (!authorized) return <main className="landlord-access-page"><section><span className="post-eyebrow">Property Owner dashboard</span><h1>Manage what<br /><em>you own.</em></h1><p>Sign in as a property owner to manage your listings, enquiries, and property activity.</p><Link className="post-secondary-button" href="/">Back to marketplace</Link></section><AuthModal open role="Property Owner" onClose={() => window.location.assign('/')} onSuccess={() => setAuthorized(true)} /></main>;
  return <><div className="owner-upgrade-dashboard-link"><Link href="/upgrade/owner">View Gold, Silver and Platinum plans <span>One-time payments</span></Link></div><RoleDashboard role="landlord" /></>;
}
