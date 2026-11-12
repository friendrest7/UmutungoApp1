'use client';

import { useEffect, useState } from 'react';
import { SignInPage } from '../../components/OwnerSignIn';
import { RoleDashboard } from '../../components/RoleDashboard';
import { dashboardPathForAccountRole } from '../../lib/accountRouting';

export default function CommissionerPage() {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [signedInElsewhere, setSignedInElsewhere] = useState(false);
  useEffect(() => {
    try {
      const role = JSON.parse(window.localStorage.getItem('umutungo-demo-user') ?? 'null')?.role;
      setAuthorized(role === 'Commissioner / Komisiyoneri');
      setSignedInElsewhere(Boolean(role) && role !== 'Commissioner / Komisiyoneri');
    } catch { setAuthorized(false); }
    finally { setChecking(false); }
  }, []);
  if (checking) return <main className="landlord-access-page"><p>Checking your Komisiyoneri account…</p></main>;
  if (!authorized) return <SignInPage audience="Commissioner / Komisiyoneri" denied={signedInElsewhere} onSignedIn={(role) => { if (role === 'Commissioner / Komisiyoneri') setAuthorized(true); else window.location.assign(dashboardPathForAccountRole(role)); }} />;
  return <RoleDashboard role="commissioner" />;
}
