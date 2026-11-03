'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthModal, type AuthRole } from '../../components/AuthModal';

function roleFromQuery(value: string | null): AuthRole | undefined {
  if (!value) return undefined;
  if (value === 'Komisiyoneri' || value === 'Commissioner / Komisiyoneri') return 'Commissioner / Komisiyoneri';
  if (value === 'Client' || value === 'Tenant' || value === 'Landlord' || value === 'Property Owner' || value === 'Admin') return value;
  return undefined;
}

function destinationFor(role: AuthRole) {
  if (role === 'Landlord') return '/landlord';
  if (role === 'Property Owner') return '/property-owner';
  if (role === 'Commissioner / Komisiyoneri') return '/commissioner';
  if (role === 'Admin') return '/admin';
  return '/';
}

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<AuthRole | undefined>();

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setRole(roleFromQuery(query.get('role')));
  }, []);

  return <main className="registration-page registration-auth-only" aria-label="Umutungo sign in">
    <AuthModal
      open
      role={role}
      onClose={() => router.replace('/')}
      onSuccess={(accountRole) => router.replace(destinationFor(accountRole))}
    />
  </main>;
}



