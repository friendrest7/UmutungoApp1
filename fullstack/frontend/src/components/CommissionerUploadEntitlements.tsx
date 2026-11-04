'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from './Icons';
import { umutungoApi } from '../lib/umutungoApi';

type Entitlements = { purchased_slots: number; used_slots: number; remaining_slots: number; properties_posted: number; packages: Array<{ key: string; label: string; slots: number; price: number; currency: string }> };

export function CommissionerUploadEntitlements() {
  const [data, setData] = useState<Entitlements | null>(null);
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [busyPackage, setBusyPackage] = useState('');
  const refresh = useCallback(async () => {
    const result = await umutungoApi<Entitlements>('/api/v1/owner/listing-entitlements');
    setData(result);
  }, []);
  useEffect(() => { void refresh().catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Could not load upload slots.')); }, [refresh]);
  const buy = async (packageKey: string) => {
    setBusyPackage(packageKey);
    setNotice('');
    try {
      const result = await umutungoApi<{ checkout_url?: string; status?: string }>('/api/v1/owner/listing-upload-purchases', {
        method: 'POST',
        body: JSON.stringify({ package_key: packageKey, email: email.trim(), payment_method: 'mobilemoneyrwanda', idempotency_key: window.crypto.randomUUID() }),
      });
      if (!result) throw new Error('Sign in again to buy upload slots.');
      if (result.checkout_url) window.location.assign(result.checkout_url);
      else { setNotice('Your upload slots are active.'); await refresh(); }
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not start the upload slot payment.'); }
    finally { setBusyPackage(''); }
  };
  return <section className="commissioner-entitlements tenant-workspace-section" aria-label="Paid upload slots">
    <div className="tenant-workspace-heading"><div><span className="role-dashboard-eyebrow">Marketplace posting</span><h2>Paid upload slots</h2><p>Each slot covers one marketplace property upload. Premium visibility plans are optional and sold separately.</p></div><span className="tenant-workspace-icon"><Icon name="creditCard" size={22} /></span></div>
    <div className="commissioner-slot-stats"><article><small>Purchased upload slots</small><strong>{data?.purchased_slots ?? '—'}</strong></article><article><small>Properties posted</small><strong>{data?.properties_posted ?? '—'}</strong></article><article><small>Remaining slots</small><strong>{data?.remaining_slots ?? '—'}</strong></article></div>
    <div className="commissioner-entitlement-actions"><Link className="role-dashboard-primary" href="/post-property"><Icon name="bookPen" size={15} /> Post property</Link><Link className="role-dashboard-outline" href="/upgrade/owner"><Icon name="sparkles" size={15} /> Explore premium offers</Link></div>
    {data?.packages.length ? <div className="commissioner-slot-packages"><h3>Buy more upload slots</h3><label>Email for payment receipt<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></label><div>{data.packages.map((pkg) => <article key={pkg.key}><div><strong>{pkg.label}</strong><small>{pkg.slots} property upload{pkg.slots===1?'':'s'}</small></div><b>{pkg.currency} {pkg.price.toLocaleString('en-RW')}</b><button type="button" disabled={Boolean(busyPackage)||!email.includes('@')} onClick={() => void buy(pkg.key)}>{busyPackage===pkg.key?'Opening checkout…':'Buy slots'} <Icon name="arrow" size={14} /></button></article>)}</div></div> : <p className="commissioner-slot-empty">Upload slot packages will appear here when configured by Umutungo.</p>}
    {notice && <p className="workspace-action-notice" role="status">{notice}</p>}
  </section>;
}
