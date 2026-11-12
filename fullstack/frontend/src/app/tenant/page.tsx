'use client';

import { useEffect, useState } from 'react';
import { SignInPage } from '../../components/OwnerSignIn';
import { RoleDashboard } from '../../components/RoleDashboard';
import { dashboardPathForAccountRole } from '../../lib/accountRouting';

export default function TenantPage() {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [signedInElsewhere, setSignedInElsewhere] = useState(false);
  useEffect(() => {
    try {
      const role = JSON.parse(window.localStorage.getItem('umutungo-demo-user') ?? 'null')?.role;
      setAuthorized(role === 'Client' || role === 'Tenant');
      setSignedInElsewhere(Boolean(role) && role !== 'Client' && role !== 'Tenant');
    } catch { setAuthorized(false); }
    finally { setChecking(false); }
  }, []);
  if (checking) return <main className="landlord-access-page"><p>Checking your account…</p></main>;
  if (!authorized) return <SignInPage audience="Tenant" denied={signedInElsewhere} onSignedIn={(role) => { if (role === 'Client' || role === 'Tenant') setAuthorized(true); else window.location.assign(dashboardPathForAccountRole(role)); }} />;
  return <RoleDashboard role="tenant" />;
}
