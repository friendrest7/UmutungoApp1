'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthModal } from '../../components/AuthModal';
import { RoleDashboard } from '../../components/RoleDashboard';
import { dashboardPathForAccountRole } from '../../lib/accountRouting';

export default function LandlordPage() {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
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
  if (!authorized) return <main className="landlord-access-page"><section><span className="post-eyebrow">Landlord dashboard</span><h1>Sign in to open<br /><em>your workspace.</em></h1><p>Sign in as a landlord to view uploaded properties, enquiries, income, and promotion tools.</p><Link className="post-secondary-button" href="/">Back to marketplace</Link></section><AuthModal open role="Landlord" onClose={() => window.location.assign('/')} onSuccess={(role) => { if (role === 'Landlord' || role === 'Property Owner') setAuthorized(true); else window.location.assign(dashboardPathForAccountRole(role)); }} /></main>;
  return <RoleDashboard role="landlord" />;
}
