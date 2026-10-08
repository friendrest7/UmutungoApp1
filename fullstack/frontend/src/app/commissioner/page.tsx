'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthModal } from '../../components/AuthModal';
import { RoleDashboard } from '../../components/RoleDashboard';
import { dashboardPathForAccountRole } from '../../lib/accountRouting';

export default function CommissionerPage() {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    try { setAuthorized(JSON.parse(window.localStorage.getItem('umutungo-demo-user') ?? 'null')?.role === 'Commissioner / Komisiyoneri'); }
    catch { setAuthorized(false); }
    finally { setChecking(false); }
  }, []);
  if (checking) return <main className="landlord-access-page"><p>Checking your Komisiyoneri account…</p></main>;
  if (!authorized) return <main className="landlord-access-page"><section><span className="post-eyebrow">Komisiyoneri workspace</span><h1>Sign in to open<br /><em>your workspace.</em></h1><p>Sign in as a Komisiyoneri to manage listings, enquiries, messages, and visits.</p><Link className="post-secondary-button" href="/">Back to marketplace</Link></section><AuthModal open role="Commissioner / Komisiyoneri" onClose={() => window.location.assign('/')} onSuccess={(role) => { if (role === 'Commissioner / Komisiyoneri') setAuthorized(true); else window.location.assign(dashboardPathForAccountRole(role)); }} /></main>;
  return <RoleDashboard role="commissioner" />;
}
