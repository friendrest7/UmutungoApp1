'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { umutungoApi } from '../lib/umutungoApi';

type PlanName = 'silver' | 'gold' | 'platinum' | 'diamond';
type Purchase = { id: string; plan: PlanName; amount: number; currency: string; status: string; payment_status: string; transaction_reference: string; receipt_number?: string; purchased_at?: string | null; activated_at?: string | null; expires_at?: string | null; is_demo?: boolean; listing_id?: string };
type OwnerListing = { id: string; category: string; transaction_type: string; title: string; status: string };
type UpgradeResponse = { prices: Record<PlanName, number>; purchases: Purchase[] };
const plans: Array<{ id: PlanName; label: string; detail: string }> = [
  { id: 'silver', label: 'Silver', detail: '90 day Owner entitlement' },
  { id: 'gold', label: 'Gold', detail: '180 day Owner entitlement' },
  { id: 'platinum', label: 'Platinum', detail: '365 day Owner entitlement' },
  { id: 'diamond', label: 'Diamond', detail: 'One-time promotion for one land listing' },
];
const localDate = (value?: string | null) => value ? new Date(value).toLocaleString() : 'No expiry';

export function OwnerUpgrade() {
  const router = useRouter();
  const [data, setData] = useState<UpgradeResponse | null>(null);
  const [listings, setListings] = useState<OwnerListing[]>([]);
  const [selected, setSelected] = useState<PlanName>('silver');
  const [selectedListing, setSelectedListing] = useState('');
  const [phone, setPhone] = useState('');
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [busy, setBusy] = useState(false);
  const [isDemoAccount, setIsDemoAccount] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    const [result, ownerListings] = await Promise.all([
      umutungoApi<UpgradeResponse>('/api/v1/owner/upgrades'),
      umutungoApi<{ items: OwnerListing[] }>('/api/v1/owner/listings'),
    ]);
    if (result) {
      setData(result);
      const latest = result.purchases[0];
      if (latest) setPurchase(latest);
      setListings(ownerListings?.items ?? []);
      return result;
    }
    setMessage('Sign in as a Property Owner to view plans and payment status.');
    return null;
  }, []);

  useEffect(() => {
    try {
      const account = JSON.parse(window.localStorage.getItem('umutungo-demo-user') ?? 'null') as { testingAccount?: boolean } | null;
      setIsDemoAccount(account?.testingAccount === true);
    } catch { setIsDemoAccount(false); }
    void refresh().catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not load upgrade plans.'));
  }, [refresh]);
  useEffect(() => {
    if (!purchase || purchase.status !== 'pending') return;
    const timer = window.setInterval(() => { void refresh().catch(() => undefined); }, 8000);
    return () => window.clearInterval(timer);
  }, [purchase, refresh]);

  const diamondListings = listings.filter((listing) => listing.status === 'published' && listing.category.toLowerCase() === 'land' && listing.transaction_type.toLowerCase() === 'sell');
  const startUpgrade = async () => {
    setBusy(true);
    setMessage('');
    const storageKey = `umutungo-owner-upgrade-key-${selected}-${selected === 'diamond' ? selectedListing : ''}`;
    try {
      let key = window.localStorage.getItem(storageKey);
      if (!key || (purchase?.plan === selected && ['active', 'failed'].includes(purchase.status))) {
        key = window.crypto.randomUUID();
        window.localStorage.setItem(storageKey, key);
      }
      const result = await umutungoApi<Purchase>('/api/v1/owner/upgrades', {
        method: 'POST',
        body: JSON.stringify({ plan: selected, provider: isDemoAccount ? 'demo' : 'mtn_momo', phone: phone.trim(), listing_id: selected === 'diamond' ? selectedListing : undefined, idempotency_key: key }),
      });
      if (!result) throw new Error('Sign in as a Property Owner before starting an upgrade.');
      setPurchase(result);
      if (result.is_demo) {
        router.replace('/property-owner?section=Advertise%20property');
        return;
      } else if (result.status === 'failed' || result.payment_status === 'failed') {
        window.localStorage.removeItem(storageKey);
        setMessage('MTN could not start this payment. Check your number and balance, then try again.');
      } else if (result.payment_status === 'successful' || result.status === 'active') setMessage('MTN confirmed your payment and the plan is active.');
      else setMessage(`Payment request sent to ${phone.trim()}. Check your phone for the MTN MoMo prompt, confirm the amount, and enter your MoMo PIN in that official MTN prompt. Umutungo never asks for or stores your PIN. This page will check the payment status.`);
      void refresh().catch(() => undefined);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start this upgrade.');
      void refresh().then((latest) => {
        if (latest?.purchases[0]?.plan === selected && latest.purchases[0].status === 'failed') window.localStorage.removeItem(storageKey);
      }).catch(() => undefined);
    } finally { setBusy(false); }
  };
  const selectedPrice = data?.prices?.[selected] ?? 0;
  const hasPendingPurchase = !!purchase && purchase.status === 'pending' && purchase.plan === selected;
  const requiresLandSelection = selected === 'diamond';
  const canSubmit = isDemoAccount || (selectedPrice > 0 && (selected === 'diamond' || phone.trim().length > 0));

  return <main className="owner-upgrade-page">
    <header><Link href="/property-owner">Back to Owner dashboard</Link><h1>Owner plans</h1><p>Choose a promotion plan. Silver, Gold, and Platinum renew after their listed period; Diamond is a one-time payment for one published land listing.</p></header>
    {message && <p role="status" className="owner-upgrade-status">{message}</p>}
    <section className="owner-upgrade-plans" aria-label="Choose a plan">
      {plans.map((plan) => <button type="button" key={plan.id} aria-pressed={selected === plan.id} className={`${selected === plan.id ? 'is-selected' : ''} ${plan.id === 'diamond' ? 'is-diamond' : ''}`} onClick={() => setSelected(plan.id)}>
        <img src={`/premium/${plan.id}.svg`} alt={`${plan.label} plan badge`} />
        <strong>{plan.label}</strong><span>{plan.detail}</span>
        <b>RWF {(data?.prices?.[plan.id] ?? (plan.id === 'silver' ? 10000 : plan.id === 'gold' ? 20000 : plan.id === 'platinum' ? 30000 : 100000)).toLocaleString()}</b>
      </button>)}
    </section>
    <section className="owner-upgrade-checkout">
      <h2>{selected === 'diamond' ? 'Diamond land promotion' : isDemoAccount ? 'Activate Owner plan' : 'One-time plan payment'}</h2>
      {isDemoAccount ? <p>Activate premium tools for your property workspace.</p> : <p>Payment method: MTN MoMo</p>}
      {requiresLandSelection && <label>Published land listing<select value={selectedListing} onChange={(event) => setSelectedListing(event.target.value)} required><option value="">Choose a land listing</option>{diamondListings.map((listing) => <option key={listing.id} value={listing.id}>{listing.title}</option>)}</select>{diamondListings.length === 0 && <small>Diamond is for published land listings that are available for sale. Publish a land listing first.</small>}</label>}
      {!isDemoAccount && selected !== 'diamond' && <label>MTN Rwanda number<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+250 7XX XXX XXX" required /></label>}
      {!isDemoAccount && <p>{selected === 'diamond' ? 'This one-time payment promotes the selected land listing without a monthly or annual renewal.' : 'After you pay, check this number for the MTN MoMo approval prompt. Review the amount and enter your PIN in the official MTN prompt. Do not enter your PIN on Umutungo.'}</p>}
      <button type="button" disabled={busy || !data || !canSubmit || (requiresLandSelection && !selectedListing) || hasPendingPurchase} onClick={() => void startUpgrade()}>{busy ? 'Processing…' : isDemoAccount ? `Activate ${plans.find((plan) => plan.id === selected)?.label} plan` : `Pay RWF ${selectedPrice.toLocaleString()} with MTN MoMo`}</button>
    </section>
    {purchase && !purchase.is_demo && <section className={`owner-upgrade-receipt is-${purchase.payment_status}`} aria-live="polite"><h2>Payment {purchase.payment_status}</h2><p>Plan: {purchase.plan}</p><p>Amount: {purchase.currency} {purchase.amount.toLocaleString()}</p>{purchase.listing_id && <p>Land listing: {diamondListings.find((listing) => listing.id === purchase.listing_id)?.title ?? purchase.listing_id}</p>}<p>Reference: {purchase.transaction_reference}</p>{purchase.receipt_number && <p>Receipt: {purchase.receipt_number}</p>}<p>Purchase date: {localDate(purchase.purchased_at)}</p><p>Activated: {localDate(purchase.activated_at)}</p><p>Expires: {localDate(purchase.expires_at)}</p>{purchase.payment_status === 'pending' && <p>On your phone, open the MTN MoMo prompt, check the amount, and enter your PIN there. This page checks MTN for confirmation every few seconds. Your plan activates only after MTN confirms payment.</p>}{purchase.payment_status === 'failed' && <p>The plan is not active. Check your number or balance, then start a new payment request.</p>}</section>}
  </main>;
}
