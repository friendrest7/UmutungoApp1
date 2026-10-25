'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthModal } from '../../components/AuthModal';
import { Icon } from '../../components/Icons';
import { RoleDashboard } from '../../components/RoleDashboard';
import { dashboardPathForAccountRole } from '../../lib/accountRouting';

export default function PropertyOwnerPage() {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [signInOpen, setSignInOpen] = useState(false);

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
  if (!authorized) return <main className="landlord-access-page"><section><span className="post-eyebrow">Property Owner dashboard</span><h1>Join as a property owner<br /><em>and share your property.</em></h1><p>Create a property owner account to list a property for sale or rent and manage your enquiries.</p><div className="landlord-access-actions"><Link className="post-primary-button" href="/register?role=Property%20Owner">Create property owner account <Icon name="arrow" size={15} /></Link><button className="post-secondary-button" type="button" onClick={() => setSignInOpen(true)}>Already have an account? Sign in</button><Link className="landlord-access-back" href="/">Back to marketplace</Link></div></section><AuthModal open={signInOpen} role="Property Owner" onClose={() => setSignInOpen(false)} onSuccess={(role) => { setSignInOpen(false); if (role === 'Property Owner') setAuthorized(true); else if (role === 'Landlord') window.location.assign('/landlord'); else window.location.assign(dashboardPathForAccountRole(role)); }} /></main>;
  return <><div className="owner-upgrade-dashboard-link"><Link href="/upgrade/owner">View Gold, Silver and Platinum plans <span>One-time payments</span></Link></div><RoleDashboard role="landlord" /></>;
}
