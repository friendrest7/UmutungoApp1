'use client';

import { useEffect, useState } from 'react';
import { SignInPage } from '../../components/OwnerSignIn';
import type { AuthRole } from '../../components/AuthModal';
import { destinationAfterSignIn, roleFromQuery, safeNextPath } from '../../lib/signIn';

export default function SignInRoute() {
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<AuthRole | undefined>();
  const [next, setNext] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setRole(roleFromQuery(query.get('role')));
    setNext(safeNextPath(query.get('next')));
    if (query.get('reason') === 'expired') setNotice('You were signed out after a period of inactivity. Sign in again to continue.');
    setReady(true);
  }, []);

  if (!ready) return null;
  return <SignInPage
    audience={role}
    notice={notice}
    onSignedIn={(accountRole) => {
      window.dispatchEvent(new Event('umutungo:auth-changed'));
      // A full navigation so every part of the app picks up the new session.
      window.location.assign(destinationAfterSignIn(accountRole, next));
    }}
  />;
}
