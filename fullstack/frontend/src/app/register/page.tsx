'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Icon } from '../../components/Icons';
import { AuthModal, type AuthRole } from '../../components/AuthModal';
import { InterfacePreferences } from '../../components/InterfacePreferences';
import { Logo } from '../../components/Logo';
import { t } from '../../data/translations';
import { usePersistentLanguage } from '../../lib/language';
import { apiBaseUrl } from '../../lib/umutungoApi';

type RegistrationRole = 'Client' | 'Komisiyoneri' | 'Landlord' | 'Property Owner';

const roleOptions: Array<{ role: RegistrationRole; detail: string; storageRole: 'Client' | 'Commissioner / Komisiyoneri' | 'Landlord' | 'Property Owner' }> = [
  { role: 'Client', detail: 'I want to find or rent property.', storageRole: 'Client' },
  { role: 'Komisiyoneri', detail: 'I help clients buy, sell, or rent property.', storageRole: 'Commissioner / Komisiyoneri' },
  { role: 'Landlord', detail: 'I manage rental property and tenants.', storageRole: 'Landlord' },
  { role: 'Property Owner', detail: 'I own property and want to sell or rent it.', storageRole: 'Property Owner' },
];

export default function RegisterPage() {
  const { language } = usePersistentLanguage();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<RegistrationRole>('Client');
  const [roleReady, setRoleReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [otp, setOtp] = useState('');
  const [pendingPhone, setPendingPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('role') as RegistrationRole | null;
    if (requested && roleOptions.some((item) => item.role === requested)) {
      setRole(requested);
    }
    setRoleReady(true);
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (phone.replace(/\D/g, '').length < 9) { setError('Enter a valid Rwanda phone number.'); return; }
    const selected = roleOptions.find((item) => item.role === role) ?? roleOptions[0];
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${apiBaseUrl()}/api/v1/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim(), role: selected.role === 'Komisiyoneri' ? 'komisiyoneri' : selected.role === 'Client' ? 'client' : 'property_owner' }) });
      const result = await response.json() as { error?: string; development_code?: string; message?: string };
      if (!response.ok) throw new Error(result.error ?? 'Account registration could not be completed.');
      setPendingPhone(phone.trim());
      if (result.development_code) setOtp(result.development_code);
      setNotice(result.development_code ? `Enter the development verification code: ${result.development_code}` : 'Enter the verification code sent to your phone.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The Umutungo service could not be reached.');
    } finally { setBusy(false); }
  };

  const verifyRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!otp.trim()) { setError('Enter the verification code.'); return; }
    const selected = roleOptions.find((item) => item.role === role) ?? roleOptions[0];
    setBusy(true); setError('');
    try {
      const response = await fetch(`${apiBaseUrl()}/api/v1/auth/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: pendingPhone, code: otp.trim() }) });
      const result = await response.json() as { error?: string; access_token?: string };
      if (!response.ok || !result.access_token) throw new Error(result.error ?? 'Phone verification could not be completed.');
      window.localStorage.setItem('umutungo-api-token', result.access_token);
      window.localStorage.setItem('umutungo-demo-user', JSON.stringify({ role: selected.storageRole, name: name.trim(), phone: pendingPhone, email: email.trim(), kycStatus: selected.storageRole === 'Client' ? 'not_required' : 'pending', signedInAt: new Date().toISOString() }));
      window.dispatchEvent(new Event('umutungo:auth-changed'));
      const dashboardPaths = { Client: '/tenant', 'Commissioner / Komisiyoneri': '/commissioner', Landlord: '/landlord', 'Property Owner': '/property-owner' } as const;
      window.location.assign(dashboardPaths[selected.storageRole]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Phone verification could not be completed.');
    } finally { setBusy(false); }
  };

  const backgroundClass = role === 'Komisiyoneri' ? 'registration-komisiyoneri' : role === 'Landlord' ? 'registration-landlord' : role === 'Property Owner' ? 'registration-property-owner' : '';
  const visibleRoleOptions = roleReady ? roleOptions.filter((item) => item.role === role) : [];
  const authRole: AuthRole = role === 'Komisiyoneri' ? 'Commissioner / Komisiyoneri' : role;
  const dashboardFor = (accountRole: AuthRole) => accountRole === 'Client' || accountRole === 'Tenant' ? '/tenant' : accountRole === 'Commissioner / Komisiyoneri' ? '/commissioner' : accountRole === 'Landlord' ? '/landlord' : accountRole === 'Admin' ? '/admin' : '/property-owner';

  return <main className={`registration-page ${backgroundClass}`}><header className="registration-header"><Link href="/" aria-label="Umutungo home"><Logo /></Link><div className="standalone-header-actions"><InterfacePreferences /><Link className="post-home-link" href="/">{t(language, 'Back to marketplace')} <Icon name="arrow" size={14} /></Link></div></header><section className="registration-shell"><div className="registration-intro"><span className="post-eyebrow">{t(language, 'Umutungo account')}</span><h1>{t(language, 'Start with the role')}<br /><em>{t(language, 'that fits you.')}</em></h1><p>{t(language, 'Choose the words that describe what you need today. You can request an upgrade later from your account.')}</p></div>{pendingPhone ? <form className="registration-form" onSubmit={verifyRegistration}><h2>Verify your phone</h2><p className="auth-notice">{notice} Sent to {pendingPhone}.</p><label>Verification code<input inputMode="numeric" value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="Enter code" maxLength={6} required disabled={busy} /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="post-primary-button registration-submit" type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify and create account'} <Icon name="arrow" size={15} /></button></form> : <form className="registration-form" onSubmit={submit}><label>{t(language, 'Full name')}<input value={name} onChange={(event) => setName(event.target.value)} placeholder={t(language, 'Your full name')} required disabled={busy} /></label><label>{t(language, 'Phone number')}<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+250 7XX XXX XXX" required disabled={busy} /></label><label>{t(language, 'Email address')}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required disabled={busy} /></label><fieldset><legend>{t(language, 'I am a:')}</legend><div className="registration-role-grid">{visibleRoleOptions.map((item) => <button className={role === item.role ? 'is-selected' : ''} type="button" key={item.role} onClick={() => setRole(item.role)} disabled={busy}><strong>{t(language, item.role)}</strong><small>{t(language, item.detail)}</small></button>)}</div></fieldset>{error && <p className="auth-error" role="alert">{error}</p>}<button className="post-primary-button registration-submit" type="submit" disabled={busy}>{busy ? 'Creating account…' : t(language, 'Create account')} <Icon name="arrow" size={15} /></button><button className="registration-signin-link" type="button" onClick={() => setSignInOpen(true)} disabled={busy}>{t(language, 'Sign in')}</button></form>}</section><AuthModal open={signInOpen} role={authRole} onClose={() => setSignInOpen(false)} onSuccess={(accountRole) => window.location.assign(dashboardFor(accountRole))} /></main>;
}
