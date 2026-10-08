'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthModal } from '../../components/AuthModal';
import { RoleDashboard } from '../../components/RoleDashboard';
import { dashboardPathForAccountRole } from '../../lib/accountRouting';

export default function TenantPage() {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    try { const role = JSON.parse(window.localStorage.getItem('umutungo-demo-user') ?? 'null')?.role; setAuthorized(role === 'Client' || role === 'Tenant'); }
    catch { setAuthorized(false); }
    finally { setChecking(false); }
  }, []);
  if (checking) return <main className="landlord-access-page"><p>Checking your account…</p></main>;
  if (!authorized) return <main className="landlord-access-page"><section><span className="post-eyebrow">Client workspace</span><h1>Sign in to open<br /><em>your account.</em></h1><p>Keep saved places, applications, viewings, and conversations together.</p><Link className="post-secondary-button" href="/">Back to marketplace</Link></section><AuthModal open role="Client" onClose={() => window.location.assign('/')} onSuccess={(role) => { if (role === 'Client' || role === 'Tenant') setAuthorized(true); else window.location.assign(dashboardPathForAccountRole(role)); }} /></main>;
  return <RoleDashboard role="tenant" />;
}
