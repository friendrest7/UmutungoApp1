'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '../../../components/Icons';

const plans = [
  { id: 'komisiyoneri', title: 'Komisiyoneri', amount: '10,000', period: 'per month', detail: 'For property agents and Komisiyoneri' },
  { id: 'landlord', title: 'Normal houses · Landlord', amount: '20,000', period: 'per month', detail: 'Post normal house listings as a landlord' },
  { id: 'apartments', title: 'Apartments', amount: '50,000', period: 'per month', detail: 'Post apartment listings' },
  { id: 'single-property', title: 'One property', amount: '100,000', period: 'one-time payment', detail: 'A one-time fee to post one property' },
];

export default function TenantPostUpgradePage() {
  const [selectedPlan, setSelectedPlan] = useState('');
  const continueHref = selectedPlan ? `/post-property?plan=${selectedPlan}` : '#pricing-plans';

  return <main className="tenant-post-upgrade-page">
    <header><Link href="/tenant">← Back to tenant account</Link><strong>Umutungo</strong></header>
    <section className="tenant-post-upgrade-card">
      <span className="role-dashboard-eyebrow">TENANT ACCOUNT</span>
      <h1>Choose a posting plan</h1>
      <p className="tenant-post-upgrade-lead">Select the plan that fits the property you want to post. You can continue to listing setup after choosing.</p>
      <div className="tenant-post-plan-grid" id="pricing-plans" role="radiogroup" aria-label="Posting plans">
        {plans.map((plan) => <button type="button" key={plan.id} role="radio" aria-checked={selectedPlan === plan.id} className={`tenant-post-plan ${selectedPlan === plan.id ? 'is-selected' : ''}`} onClick={() => setSelectedPlan(plan.id)}>
          <span className="tenant-post-plan-check" aria-hidden="true">{selectedPlan === plan.id ? '✓' : ''}</span>
          <strong>{plan.title}</strong>
          <span className="tenant-post-plan-price">{plan.amount} <small>RWF</small></span>
          <span className="tenant-post-plan-period">{plan.period}</span>
          <small className="tenant-post-plan-detail">{plan.detail}</small>
        </button>)}
      </div>
      <p className="tenant-post-upgrade-note">Prices are shown in Rwandan francs (RWF).</p>
      <Link className={`role-dashboard-primary tenant-post-continue ${selectedPlan ? '' : 'is-disabled'}`} aria-disabled={!selectedPlan} href={continueHref} onClick={(event) => { if (!selectedPlan) { event.preventDefault(); document.getElementById('pricing-plans')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }}>
        Continue to posting setup <Icon name="arrow" size={16} />
      </Link>
    </section>
  </main>;
}
