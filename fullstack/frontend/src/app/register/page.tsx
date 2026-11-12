'use client';

import { useEffect, useState } from 'react';
import type { AuthRole } from '../../components/AuthModal';
import { SignInPage } from '../../components/OwnerSignIn';
import { destinationAfterSignIn, roleFromQuery } from '../../lib/signIn';

// /register?role=... (the "For Landlords", "For Komisiyoneri" links) uses the
// same full sign-in page; new accounts are created from its "Sign up" link.
export default function RegisterPage() {
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<AuthRole | undefined>();

  useEffect(() => {
    setRole(roleFromQuery(new URLSearchParams(window.location.search).get('role')));
    setReady(true);
  }, []);

  if (!ready) return null;
  return <SignInPage audience={role} onSignedIn={(accountRole) => window.location.assign(destinationAfterSignIn(accountRole, null))} />;
}
