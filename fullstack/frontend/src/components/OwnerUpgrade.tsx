'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { umutungoApi } from '../lib/umutungoApi';

type PlanName = 'silver' | 'gold' | 'platinum';
type Purchase = { id: string; plan: PlanName; amount: number; currency: string; status: string; payment_status: string; transaction_reference: string; receipt_number?: string; purchased_at?: string | null; activated_at?: string | null; expires_at?: string | null };
type UpgradeResponse = { prices: Record<PlanName, number>; purchases: Purchase[] };
const plans: Array<{ id: PlanName; label: string; detail: string }> = [
  { id: 'silver', label: 'Silver', detail: '90 day Owner entitlement' },
  { id: 'gold', label: 'Gold', detail: '180 day Owner entitlement' },
  { id: 'platinum', label: 'Platinum', detail: '365 day Owner entitlement' },
];

const localDate = (value?: string | null) => value ? new Date(value).toLocaleString() : 'Not available';

export function OwnerUpgrade() {
  const [data, setData] = useState<UpgradeResponse | null>(null);
  const [selected, setSelected] = useState<PlanName>('silver');
  const [provider, setProvider] = useState('mtn_momo');
  const [phone, setPhone] = useState('');
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    const result = await umutungoApi<UpgradeResponse>('/api/v1/owner/upgrades');
    if (result) {
      setData(result);
      setMessage('');
      const latest = result.purchases[0];
      if (latest) setPurchase(latest);
    } else {
      setMessage('Sign in as a Property Owner to view plans and payment status.');
    }
  }, []);

  useEffect(() => { void refresh().catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not load upgrade plans.')); }, [refresh]);
  useEffect(() => {
    if (!purchase || purchase.status !== 'pending') return;
    const timer = window.setInterval(() => { void refresh().catch(() => undefined); }, 8000);
    return () => window.clearInterval(timer);
  }, [purchase, refresh]);

  const startPayment = async () => {
    setBusy(true);
    setMessage('');
    try {
      const keyStorage = `umutungo-owner-upgrade-key-${selected}`;
      let key = window.localStorage.getItem(keyStorage);
      if (!key || (purchase?.plan === selected && purchase.status === 'active')) {
        key = window.crypto.randomUUID();
        window.localStorage.setItem(keyStorage, key);
      }
      const result = await umutungoApi<Purchase>('/api/v1/owner/upgrades', {
        method: 'POST',
        body: JSON.stringify({ plan: selected, provider, phone: phone.trim(), idempotency_key: key }),
      });
      if (!result) throw new Error('Sign in as a Property Owner before starting a payment.');
      setPurchase(result);
      setMessage('Payment request saved. No charge is initiated by this environment; your plan stays inactive until an administrator verifies the provider transaction.');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start this payment.');
    } finally {
      setBusy(false);
    }
  };

  return <main className="owner-upgrade-page">
    <header><Link href="/property-owner">Back to Owner dashboard</Link><h1>Owner premium plans</h1><p>One-time payment. Entitlement activates after payment verification.</p></header>
    {message && <p role="status" className="owner-upgrade-status">{message}</p>}
    <section className="owner-upgrade-plans" aria-label="Choose a premium plan">
      {plans.map((plan) => <button type="button" key={plan.id} aria-pressed={selected === plan.id} className={selected === plan.id ? 'is-selected' : ''} onClick={() => setSelected(plan.id)}>
        <img src={`/premium/${plan.id}.svg`} alt={`${plan.label} premium plan badge`} />
        <strong>{plan.label}</strong><span>{plan.detail}</span>
        <b>{(data?.prices?.[plan.id] ?? 0) > 0 ? `RWF ${data?.prices?.[plan.id]?.toLocaleString()}` : 'Price not configured'}</b>
      </button>)}
    </section>
    <section className="owner-upgrade-checkout">
      <h2>One-time payment</h2>
      <label>Payment method<select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="mtn_momo">MTN MoMo</option><option value="airtel_money">Airtel Money</option><option value="card">Bank card</option></select></label>
      {provider !== 'card' && <label>Mobile number<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+250 7XX XXX XXX" required /></label>}
      <button type="button" disabled={busy || !data || (data.prices?.[selected] ?? 0) <= 0 || (!!purchase && purchase.status === 'pending' && purchase.plan === selected)} onClick={() => void startPayment()}>{busy ? 'Starting…' : `Create RWF ${(data?.prices?.[selected] ?? 0).toLocaleString()} one-time payment request`}</button>
    </section>
    {purchase && <section className="owner-upgrade-receipt" aria-live="polite"><h2>Payment status: {purchase.payment_status}</h2><p>Plan: {purchase.plan}</p><p>Amount: {purchase.currency} {purchase.amount.toLocaleString()}</p><p>Reference: {purchase.transaction_reference}</p>{purchase.receipt_number && <p>Receipt: {purchase.receipt_number}</p>}<p>Purchase date: {localDate(purchase.purchased_at)}</p><p>Activated: {localDate(purchase.activated_at)}</p><p>Expires: {localDate(purchase.expires_at)}</p>{purchase.status !== 'active' && <p>Your entitlement is not active while verification is pending.</p>}</section>}
  </main>;
}
