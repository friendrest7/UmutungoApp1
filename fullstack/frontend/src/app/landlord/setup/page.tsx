'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../../../components/Icons';
import { InterfacePreferences } from '../../../components/InterfacePreferences';
import { Logo } from '../../../components/Logo';
import { apiToken, umutungoApi } from '../../../lib/umutungoApi';
import { listingPriceBands } from '../../../lib/listingPricing';

type AccountRecord = {
  role?: string;
  workspace_kind?: string;
  name?: string;
  email?: string;
  phone?: string;
  landlordSetupComplete?: boolean;
  landlordListingPriceBand?: string;
  [key: string]: unknown;
};

function isPostingAccount(account: AccountRecord | null) {
  const role = account?.role?.toLowerCase().replace(/[\s-]+/g, '_');
  return role === 'landlord' || role === 'property_owner' || role?.includes('komisiyoneri') === true;
}

function setupDashboardPath(account: AccountRecord | null) {
  const role = account?.role?.toLowerCase().replace(/[\s-]+/g, '_');
  if (role?.includes('komisiyoneri')) return '/commissioner';
  if (role === 'property_owner' && account?.workspace_kind?.toLowerCase() !== 'landlord') return '/property-owner';
  return '/';
}

export default function LandlordAccountSetupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [phoneNotice, setPhoneNotice] = useState('');
  const [listingPriceBand, setListingPriceBand] = useState('');
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const selectedListingBand = listingPriceBands.find((band) => band.id === listingPriceBand);
  const maximumMonthlyFee = selectedListingBand?.maximum === null || !selectedListingBand ? null : Math.round(selectedListingBand.maximum * selectedListingBand.rate);
  const formatRwf = (amount: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);

  useEffect(() => {
    let cancelled = false;
    const editingSetup = new URLSearchParams(window.location.search).get('edit') === '1';
    let account: AccountRecord | null = null;
    try {
      account = JSON.parse(window.localStorage.getItem('umutungo-demo-user') ?? 'null') as AccountRecord | null;
    } catch {
      account = null;
    }

    const continueSetup = async () => {
      if (apiToken()) {
        try {
          const result = await umutungoApi<{ user: AccountRecord; profile?: { listing_price_band?: string } }>('/api/v1/me');
          if (result?.user) account = { ...account, ...result.user, landlordListingPriceBand: result.profile?.listing_price_band || account?.landlordListingPriceBand };
        } catch {
          // Keep the locally signed-in account so the form can show a useful recovery message on save.
        }
      }
      if (cancelled) return;
      if (!isPostingAccount(account)) {
        router.replace('/');
        return;
      }
      window.localStorage.setItem('umutungo-demo-user', JSON.stringify(account));
      setName(account?.name?.trim() ?? '');
      setEmail(account?.email?.trim() ?? '');
      setPhone(account?.phone?.trim() ?? '');
      setVerifiedPhone(account?.phone?.trim() ?? '');
      setListingPriceBand(account?.landlordListingPriceBand ?? '');
      if (!editingSetup && account?.landlordSetupComplete && listingPriceBands.some((band) => band.id === account?.landlordListingPriceBand)) {
        router.replace(setupDashboardPath(account));
        return;
      }
      setChecking(false);
    };

    void continueSetup();
    return () => { cancelled = true; };
  }, [router]);

  const requestPhoneCode = async () => {
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setPhoneError('Enter the new phone number first.');
      return;
    }
    if (cleanPhone === verifiedPhone) return;
    if (!apiToken()) {
      setPhoneError('Sign in with your Umutungo account before changing your phone number.');
      return;
    }
    setPhoneBusy(true);
    setPhoneError('');
    setPhoneNotice('');
    try {
      const result = await umutungoApi<{ message?: string; development_code?: string }>('/api/v1/me/phone', {
        method: 'POST',
        body: JSON.stringify({ phone: cleanPhone }),
      });
      if (!result) throw new Error('Sign in again before changing your phone number.');
      setPhoneCode(result.development_code ?? '');
      setPhoneCodeSent(true);
      setPhoneNotice(result.development_code ? `Development verification code: ${result.development_code}` : result.message ?? 'Verification code sent by SMS.');
    } catch (cause) {
      setPhoneError(cause instanceof Error ? cause.message : 'Could not send the verification code. Try again.');
    } finally {
      setPhoneBusy(false);
    }
  };

  const verifyPhoneCode = async () => {
    if (phoneCode.trim().length !== 6) {
      setPhoneError('Enter the six-digit verification code.');
      return;
    }
    setPhoneBusy(true);
    setPhoneError('');
    try {
      const result = await umutungoApi<{ user: AccountRecord }>('/api/v1/me/phone', {
        method: 'PUT',
        body: JSON.stringify({ phone: phone.trim(), code: phoneCode.trim() }),
      });
      const confirmedPhone = result?.user?.phone?.trim();
      if (!confirmedPhone) throw new Error('The phone number could not be confirmed. Request a new code and try again.');
      const account = JSON.parse(window.localStorage.getItem('umutungo-demo-user') ?? 'null') as AccountRecord | null;
      if (!isPostingAccount(account)) throw new Error('Your posting account could not be confirmed. Sign in again to continue.');
      window.localStorage.setItem('umutungo-demo-user', JSON.stringify({ ...account, phone: confirmedPhone }));
      window.dispatchEvent(new Event('umutungo:auth-changed'));
      setPhone(confirmedPhone);
      setVerifiedPhone(confirmedPhone);
      setPhoneCode('');
      setPhoneCodeSent(false);
      setPhoneNotice('Phone number verified and updated.');
    } catch (cause) {
      setPhoneError(cause instanceof Error ? cause.message : 'Could not verify this phone number. Try again.');
    } finally {
      setPhoneBusy(false);
    }
  };

  const saveSetup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    if (!phone.trim() || phone.trim() !== verifiedPhone) {
      setError('Verify your phone number before continuing.');
      return;
    }
    if (!listingPriceBands.some((band) => band.id === listingPriceBand)) {
      setError("Select the price range that covers the properties you'll post.");
      return;
    }
    if (!cleanName) {
      setError('Enter your full name to continue.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (apiToken()) {
        await umutungoApi('/api/v1/me', {
          method: 'PATCH',
          body: JSON.stringify({ name: cleanName, ...(cleanEmail ? { email: cleanEmail } : {}), listing_price_band: listingPriceBand }),
        });
      }
      const account = JSON.parse(window.localStorage.getItem('umutungo-demo-user') ?? 'null') as AccountRecord | null;
      if (!isPostingAccount(account)) {
        throw new Error('Your posting account could not be confirmed. Sign in again to continue.');
      }
      window.localStorage.setItem('umutungo-demo-user', JSON.stringify({ ...account, name: cleanName, email: cleanEmail, landlordListingPriceBand: listingPriceBand, landlordSetupComplete: true }));
      window.dispatchEvent(new Event('umutungo:auth-changed'));
      router.replace(setupDashboardPath(account));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your account details could not be saved. Try again.');
      setSaving(false);
    }
  };

  if (checking) return <main className="landlord-setup-page"><p className="landlord-setup-loading">Preparing your account…</p></main>;

  return <main className="landlord-setup-page">
    <header className="landlord-setup-header">
      <Link href="/" aria-label="Umutungo home"><Logo /></Link>
      <div><InterfacePreferences /><Link href="/">Exit setup <Icon name="x" size={14} /></Link></div>
    </header>
    <section className="landlord-setup-shell">
      <div className="landlord-setup-intro">
        <span className="landlord-setup-eyebrow">LANDLORD WORKSPACE</span>
        <h1>Let’s set up<br /><em>your account.</em></h1>
        <p>Confirm your details so your property workspace is ready for listings, tenants, rent records, and everyday management.</p>
        <p>We’ve set monthly subscription rates for each property price range to help you advertise at a suitable rate and reach more clients. Choose the ranges you expect to list, then continue to a personalized workspace for managing your properties and tenants.</p>
        <div className="landlord-setup-benefits">
          <span><Icon name="building" size={17} /> Organize properties and units</span>
          <span><Icon name="users" size={17} /> Keep tenant details together</span>
          <span><Icon name="creditCard" size={17} /> Track rent and payments</span>
        </div>
      </div>
      <form className="landlord-setup-card" onSubmit={saveSetup}>
        <div className="landlord-setup-card-heading"><span>ACCOUNT SETUP</span><h2>Your contact details</h2><p>You can update these details later in your account.</p></div>
        <label>Full name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your full name" required disabled={saving} /></label>
        <label>Email address <small>Optional</small><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" disabled={saving} /></label>
        <label>Phone number<input type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setPhoneCode(''); setPhoneCodeSent(false); setPhoneError(''); setPhoneNotice(''); }} placeholder="+250 7XX XXX XXX" required disabled={saving || phoneBusy} aria-describedby="landlord-setup-phone-note" /></label>
        <small id="landlord-setup-phone-note" className="landlord-setup-note">{phone.trim() === verifiedPhone ? 'Verified phone number. Changing it requires a new verification code.' : 'Verify this number before continuing.'}</small>
        {phone.trim() !== verifiedPhone && <div className="landlord-phone-verification"><button className="landlord-phone-code-button" type="button" onClick={() => void requestPhoneCode()} disabled={saving || phoneBusy}>{phoneBusy ? 'Please wait…' : phoneCodeSent ? 'Send a new code' : 'Send verification code'}</button>{phoneCodeSent && <div className="landlord-phone-code-row"><input aria-label="Six-digit verification code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={phoneCode} onChange={(event) => setPhoneCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter 6-digit code" disabled={phoneBusy} /><button className="landlord-phone-code-button is-verify" type="button" onClick={() => void verifyPhoneCode()} disabled={phoneBusy || phoneCode.length !== 6}>{phoneBusy ? 'Verifying…' : 'Verify phone'}</button></div>}</div>}
        {phoneNotice && <p className="landlord-setup-note" role="status">{phoneNotice}</p>}
        {phoneError && <p className="landlord-setup-error" role="alert">{phoneError}</p>}
        <label className="landlord-setup-price-band">Select your properties’ price range<select value={listingPriceBand} onChange={(event) => setListingPriceBand(event.target.value)} required disabled={saving}><option value="">Choose the highest range you expect to post</option>{listingPriceBands.map((band) => <option key={band.id} value={band.id}>{band.label}</option>)}</select><small>Listings priced above this range will need a higher range selected here before you can publish them.</small></label>
        {selectedListingBand && <aside className="landlord-setup-fees" aria-live="polite"><div className="landlord-setup-fees-heading"><h3>Monthly Payment Fees</h3><strong>{selectedListingBand.percent}</strong></div><p>Monthly subscription rate for the selected price range: <b>{selectedListingBand.percent}</b>.</p><div className="landlord-setup-fees-range"><small>Maximum monthly subscription in this range</small><strong>{maximumMonthlyFee === null ? 'No fixed maximum' : `RWF ${formatRwf(maximumMonthlyFee)}`} {maximumMonthlyFee !== null && <small>/ month</small>}</strong></div><small className="landlord-setup-fees-note">The exact monthly payment is calculated from the price entered in the listing form.</small></aside>}
        {error && <p className="landlord-setup-error" role="alert">{error}</p>}
        <button className="landlord-setup-submit" type="submit" disabled={saving}>{saving ? 'Saving your account…' : 'Continue to your dashboard'} {!saving && <Icon name="arrow" size={16} />}</button>
        <p className="landlord-setup-privacy">Your account details stay private to your workspace.</p>
      </form>
    </section>
  </main>;
}
