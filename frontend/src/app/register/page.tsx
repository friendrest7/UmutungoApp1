'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Icon } from '../../components/Icons';
import { InterfacePreferences } from '../../components/InterfacePreferences';
import { Logo } from '../../components/Logo';

type RegistrationRole = 'Client' | 'Tenant' | 'Komisiyoneri' | 'Landlord' | 'Property Owner';

const roleOptions: Array<{ role: RegistrationRole; detail: string; storageRole: 'Tenant' | 'Commissioner / Komisiyoneri' | 'Landlord' | 'Property Owner' }> = [
  { role: 'Client', detail: 'I want to find or rent property.', storageRole: 'Tenant' },
  { role: 'Tenant', detail: 'I currently rent or occupy a property.', storageRole: 'Tenant' },
  { role: 'Komisiyoneri', detail: 'I help clients buy, sell, or rent property.', storageRole: 'Commissioner / Komisiyoneri' },
  { role: 'Landlord', detail: 'I manage rental property and tenants.', storageRole: 'Landlord' },
  { role: 'Property Owner', detail: 'I own property and want to sell or rent it.', storageRole: 'Property Owner' },
];

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<RegistrationRole>('Client');
  const [error, setError] = useState('');

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('role') as RegistrationRole | null;
    if (requested && roleOptions.some((item) => item.role === requested)) setRole(requested);
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (phone.replace(/\D/g, '').length < 9) { setError('Enter a valid Rwanda phone number.'); return; }
    const selected = roleOptions.find((item) => item.role === role) ?? roleOptions[0];
    window.localStorage.setItem('umutungo-demo-user', JSON.stringify({ role: selected.storageRole, name: name.trim(), phone: phone.trim(), email: email.trim(), kycStatus: selected.storageRole === 'Tenant' ? 'not_required' : 'pending', signedInAt: new Date().toISOString() }));
    // Keep the new account on the marketplace. The navbar account menu provides the dashboard entry point.
    window.location.assign('/');
  };

  const backgroundClass = role === 'Komisiyoneri' ? 'registration-komisiyoneri' : role === 'Landlord' ? 'registration-landlord' : role === 'Property Owner' ? 'registration-property-owner' : '';

  return <main className={`registration-page ${backgroundClass}`}><header className="registration-header"><Link href="/" aria-label="Umutungo home"><Logo /></Link><div className="standalone-header-actions"><InterfacePreferences /><Link className="post-home-link" href="/">Back to marketplace <Icon name="arrow" size={14} /></Link></div></header><section className="registration-shell"><div className="registration-intro"><span className="post-eyebrow">Umutungo account</span><h1>Start with the role<br /><em>that fits you.</em></h1><p>Choose the words that describe what you need today. You can request an upgrade later from your account.</p></div><form className="registration-form" onSubmit={submit}><label>Full name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" required /></label><label>Phone number<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+250 7XX XXX XXX" required /></label><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label><fieldset><legend>I am a:</legend><div className="registration-role-grid">{roleOptions.map((item) => <button className={role === item.role ? 'is-selected' : ''} type="button" key={item.role} onClick={() => setRole(item.role)}><strong>{item.role}</strong><small>{item.detail}</small></button>)}</div></fieldset>{error && <p className="auth-error" role="alert">{error}</p>}<button className="post-primary-button registration-submit" type="submit">Create account <Icon name="arrow" size={15} /></button></form></section></main>;
}
