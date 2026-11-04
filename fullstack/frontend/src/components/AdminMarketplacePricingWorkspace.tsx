'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from './Icons';
import { umutungoApi } from '../lib/umutungoApi';

type FeeRule = { role: string; price_min: number; price_max: number | null; rate_percent: number; fixed_fee: number; expiry_days: number; enabled: boolean };
type UploadPackage = { key: string; label: string; slots: number; price: number; enabled: boolean; benefits?: string[] };
type PremiumOffer = { key: string; label: string; price: number; duration_days: number; enabled: boolean; benefits?: string[] };
type PaymentRow = { id: string; owner_id: string; related_type: string; related_id: string; amount: number; currency: string; provider: string; status: string; reference: string; created_at: string };
type PricingData = { fees: FeeRule[]; packages: UploadPackage[]; premium_offers: PremiumOffer[]; payments: PaymentRow[] };

export function AdminMarketplacePricingWorkspace() {
  const [data, setData] = useState<PricingData | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => { const result = await umutungoApi<PricingData>('/api/v1/admin/marketplace-pricing'); setData(result); }, []);
  useEffect(() => { void refresh().catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Could not load marketplace pricing.')); }, [refresh]);
  const updateFee = (index: number, patch: Partial<FeeRule>) => setData((current) => current ? { ...current, fees: current.fees.map((fee, i) => i === index ? { ...fee, ...patch } : fee) } : current);
  const updatePackage = (index: number, patch: Partial<UploadPackage>) => setData((current) => current ? { ...current, packages: current.packages.map((pkg, i) => i === index ? { ...pkg, ...patch } : pkg) } : current);
  const updateOffer = (index: number, patch: Partial<PremiumOffer>) => setData((current) => current ? { ...current, premium_offers: current.premium_offers.map((offer, i) => i === index ? { ...offer, ...patch } : offer) } : current);
  const addPackage = () => setData((current) => current ? { ...current, packages: [...current.packages, { key: `slots-${Date.now()}`, label: 'Upload slots', slots: 5, price: 0, enabled: false, benefits: [] }] } : current);
  const save = async () => {
    if (!data) return;
    setBusy(true); setNotice('');
    try { await umutungoApi('/api/v1/admin/marketplace-pricing', { method: 'PATCH', body: JSON.stringify(data) }); setNotice('Marketplace prices and offers saved.'); await refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not save marketplace pricing.'); }
    finally { setBusy(false); }
  };
  if (!data) return <section className="tenant-workspace-section"><p role="status">Loading payment configuration…</p>{notice && <p role="alert">{notice}</p>}</section>;
  return <section className="tenant-workspace-section admin-marketplace-pricing">
    <div className="tenant-workspace-heading"><div><span className="role-dashboard-eyebrow">Revenue configuration</span><h2>Marketplace pricing and payments</h2><p>Configure paid listing fees, Komisiyoneri upload slot packages, optional premium offers, and inspect payment history.</p></div><span className="tenant-workspace-icon"><Icon name="creditCard" size={22} /></span></div>
    <div className="admin-pricing-group"><h3>Marketplace posting fees</h3><div className="admin-pricing-table-wrap"><table><thead><tr><th>Account</th><th>Minimum price (RWF)</th><th>Maximum price (RWF)</th><th>Rate (%)</th><th>Fixed fee (RWF)</th><th>Expiry (days)</th><th>Enabled</th></tr></thead><tbody>{data.fees.map((fee,index)=><tr key={`${fee.role}-${fee.price_min}`}><td>{fee.role}</td><td><input type="number" min="0" value={fee.price_min} onChange={(e)=>updateFee(index,{price_min:Number(e.target.value)})}/></td><td><input type="number" min="0" value={fee.price_max??''} onChange={(e)=>updateFee(index,{price_max:e.target.value?Number(e.target.value):null})}/></td><td><input type="number" min="0" step="0.01" value={fee.rate_percent} onChange={(e)=>updateFee(index,{rate_percent:Number(e.target.value)})}/></td><td><input type="number" min="0" value={fee.fixed_fee} onChange={(e)=>updateFee(index,{fixed_fee:Number(e.target.value)})}/></td><td><input type="number" min="1" value={fee.expiry_days} onChange={(e)=>updateFee(index,{expiry_days:Number(e.target.value)})}/></td><td><input type="checkbox" checked={fee.enabled} onChange={(e)=>updateFee(index,{enabled:e.target.checked})}/></td></tr>)}</tbody></table></div></div>
    <div className="admin-pricing-group"><h3>Upload slot packages</h3>{data.packages.map((pkg,index)=><div className="admin-offer-row" key={pkg.key}><input aria-label="Package key" value={pkg.key} onChange={(e)=>updatePackage(index,{key:e.target.value})}/><input aria-label="Package label" value={pkg.label} onChange={(e)=>updatePackage(index,{label:e.target.value})}/><label>Slots<input type="number" min="1" value={pkg.slots} onChange={(e)=>updatePackage(index,{slots:Number(e.target.value)})}/></label><label>Price in RWF<input type="number" min="1" value={pkg.price} onChange={(e)=>updatePackage(index,{price:Number(e.target.value)})}/></label><label>Benefits<input value={pkg.benefits?.join(', ')??''} onChange={(e)=>updatePackage(index,{benefits:e.target.value.split(',').map((v)=>v.trim()).filter(Boolean)})}/></label><label>Active<input type="checkbox" checked={pkg.enabled} onChange={(e)=>updatePackage(index,{enabled:e.target.checked})}/></label></div>)}<button type="button" className="role-dashboard-outline" onClick={addPackage}>Add upload package</button></div>
    <div className="admin-pricing-group"><h3>Optional premium offers</h3>{data.premium_offers.map((offer,index)=><div className="admin-offer-row" key={offer.key}><strong>{offer.label}</strong><label>Price in RWF<input type="number" min="1" value={offer.price} onChange={(e)=>updateOffer(index,{price:Number(e.target.value)})}/></label><label>Duration in days<input type="number" min="0" value={offer.duration_days} onChange={(e)=>updateOffer(index,{duration_days:Number(e.target.value)})}/></label><label>Benefits<input value={offer.benefits?.join(', ')??''} onChange={(e)=>updateOffer(index,{benefits:e.target.value.split(',').map((v)=>v.trim()).filter(Boolean)})}/></label><label>Active<input type="checkbox" checked={offer.enabled} onChange={(e)=>updateOffer(index,{enabled:e.target.checked})}/></label></div>)}</div>
    <button className="role-dashboard-primary" type="button" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save payment configuration'} <Icon name="check" size={15}/></button>
    <div className="admin-pricing-group"><h3>Recent payment transactions</h3><div className="admin-pricing-table-wrap"><table><thead><tr><th>Date</th><th>Account ID</th><th>Payment type</th><th>Amount</th><th>Provider</th><th>Status</th><th>Reference</th></tr></thead><tbody>{data.payments.map((payment)=><tr key={payment.id}><td>{new Date(payment.created_at).toLocaleString()}</td><td>{payment.owner_id}</td><td>{payment.related_type}</td><td>{payment.currency} {payment.amount.toLocaleString()}</td><td>{payment.provider}</td><td>{payment.status}</td><td>{payment.reference}</td></tr>)}</tbody></table>{!data.payments.length&&<p>No marketplace payments recorded yet.</p>}</div></div>
    {notice && <p className="workspace-action-notice" role="status">{notice}</p>}
  </section>;
}
