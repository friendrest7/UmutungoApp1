'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../components/Icons';
import { InterfacePreferences } from '../../components/InterfacePreferences';
import { Logo } from '../../components/Logo';

type Plan = {
  name: string;
  description: string;
  price: string;
  note: string;
  popular?: boolean;
  features: string[];
};

const premiumServices = [
  { name: 'Post more houses', price: '$12', detail: 'Add 5 extra active property listings.', icon: 'home' as const },
  { name: 'Advertise a house', price: '$9', detail: 'Feature one listing in the property shop.', icon: 'sparkles' as const },
  { name: 'Promote your listing', price: '$18', detail: 'Boost visibility across Kigali searches.', icon: 'arrow' as const },
];

const plans: Plan[] = [
  { name: 'Starter', description: 'A simple way to publish your first property.', price: 'Free', note: '1 active listing', features: ['1 active property listing', 'Up to 6 photos', 'Basic enquiries', 'Standard listing visibility'] },
  { name: 'Growth', description: 'For people ready to reach more serious renters and buyers.', price: 'RWF 15,000', note: 'per month', popular: true, features: ['Up to 5 active listings', 'Unlimited photos and video', 'WhatsApp and SMS sharing', 'AI-assisted listing writing', 'Listing performance insights'] },
  { name: 'Professional', description: 'A fuller toolkit for a growing property business.', price: 'RWF 35,000', note: 'per month', features: ['Up to 20 active listings', 'Video and 3D tour support', 'Priority listing placement', 'Advanced activity analytics', 'Verified business profile'] },
];

export default function UpgradePage() {
  const [selectedPlan, setSelectedPlan] = useState('Growth');
  const [checkout, setCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('MTN MoMo');
  const [selectedPremium, setSelectedPremium] = useState('');

  const basePlan = plans.find((item) => item.name === selectedPlan) ?? plans[1];
  const selectedService = premiumServices.find((item) => item.name === selectedPremium);
  const plan: Plan = selectedService ? { name: selectedService.name, description: selectedService.detail, price: selectedService.price, note: 'one-time promotion', features: [selectedService.detail, 'Property shop visibility', 'Promotion receipt'] } : basePlan;

  return <main className="upgrade-page">
    <header className="upgrade-header"><Link href="/" aria-label="Return to Umutungo home"><Logo /></Link><div className="upgrade-header-actions"><InterfacePreferences /><div><span>Tenant account</span><Link href="/">Home <Icon name="home" size={14} /></Link></div></div></header>
    <div className="upgrade-content">
      <section className="upgrade-intro"><span className="upgrade-eyebrow">Upgrade to post</span><h1>Choose the right way<br /><em>to share your property.</em></h1><p>Publish a clear listing, reach the right people, and manage enquiries from one trusted Rwanda property platform.</p><div className="upgrade-trust"><span><Icon name="check" size={14} /> Secure checkout</span><span><Icon name="check" size={14} /> Cancel anytime</span><span><Icon name="check" size={14} /> Receipt included</span></div></section>
      {!checkout ? <section className="upgrade-plan-section" aria-label="Choose a posting plan"><div className="upgrade-section-heading"><div><span className="upgrade-eyebrow">Posting plans</span><h2>Start with what<br />fits your needs.</h2></div><p>Plans are designed around active listings, media, reach, and the tools you need to turn interest into real conversations.</p></div><div className="upgrade-plan-grid">{plans.map((item) => <button className={`upgrade-plan-card ${selectedPlan === item.name ? 'selected' : ''}`} type="button" key={item.name} onClick={() => setSelectedPlan(item.name)}>{item.popular && <span className="upgrade-popular">Most chosen</span>}<span className="upgrade-plan-check">{selectedPlan === item.name ? <Icon name="check" size={15} /> : null}</span><h3>{item.name}</h3><p>{item.description}</p><strong>{item.price}</strong><small>{item.note}</small><span className="upgrade-plan-divider" /> <ul>{item.features.map((feature) => <li key={feature}><Icon name="check" size={14} />{feature}</li>)}</ul><span className="upgrade-select-label">{selectedPlan === item.name ? 'Selected plan' : 'Choose plan'} <Icon name="arrow" size={14} /></span></button>)}</div><div className="upgrade-action-row"><div><strong>{plan.name}</strong><span>{plan.price === 'Free' ? 'Ready to publish' : `${plan.price} · ${plan.note}`}</span></div><button className="upgrade-primary" type="button" onClick={() => setCheckout(true)}>Continue with {plan.name} <Icon name="arrow" size={16} /></button></div></section> : <section className="upgrade-checkout"><div className="upgrade-section-heading"><div><span className="upgrade-eyebrow">Secure checkout</span><h2>Finish setting up<br /><em>{plan.name}.</em></h2></div><p>Your plan is ready. Choose a payment method to activate posting tools on your tenant account.</p></div><div className="upgrade-checkout-grid"><div className="upgrade-payment-panel"><h3>Payment method</h3><button className={`upgrade-payment-option ${paymentMethod === 'MTN MoMo' ? 'selected' : ''}`} type="button" onClick={() => setPaymentMethod('MTN MoMo')}><span className="upgrade-payment-logo mtn">M</span><span><strong>MTN MoMo</strong><small>Pay securely with Mobile Money</small></span><Icon name="check" size={16} /></button><button className={`upgrade-payment-option ${paymentMethod === 'Airtel Money' ? 'selected' : ''}`} type="button" onClick={() => setPaymentMethod('Airtel Money')}><span className="upgrade-payment-logo airtel">A</span><span><strong>Airtel Money</strong><small>Pay securely with Mobile Money</small></span><Icon name="check" size={16} /></button><button className={`upgrade-payment-option ${paymentMethod === 'Card' ? 'selected' : ''}`} type="button" onClick={() => setPaymentMethod('Card')}><span className="upgrade-payment-logo card">▰</span><span><strong>Bank card</strong><small>Visa or Mastercard via PSP</small></span><Icon name="check" size={16} /></button><label className="upgrade-phone-label">{paymentMethod === 'Card' ? 'Card or account details' : 'Mobile number'}<input type={paymentMethod === 'Card' ? 'text' : 'tel'} placeholder={paymentMethod === 'Card' ? 'Enter your card details' : '+250 7XX XXX XXX'} /></label><button className="upgrade-primary upgrade-pay-button" type="button">Pay {plan.price === 'Free' ? 'RWF 0' : plan.price} <Icon name="arrow" size={16} /></button><button className="upgrade-back-button" type="button" onClick={() => setCheckout(false)}>Back to plans</button></div><aside className="upgrade-order-summary"><span className="upgrade-eyebrow">Your selection</span><h3>{plan.name}</h3><p>{plan.description}</p><div><span>Plan price</span><strong>{plan.price}</strong></div><div><span>Billing</span><strong>{plan.price === 'Free' ? 'No charge' : 'Monthly'}</strong></div><hr /><ul>{plan.features.slice(0, 4).map((feature) => <li key={feature}><Icon name="check" size={14} />{feature}</li>)}</ul><small>By continuing, you agree to Umutungo’s terms and subscription policy. A receipt will be available in your account after payment.</small></aside></div></section>}
     </div>
     {!checkout && <section className="upgrade-premium-tools" aria-label="Premium promotion tools"><div><span className="upgrade-eyebrow">Premium visibility</span><h2>Reach more people<br /><em>when it matters.</em></h2><p>Choose an optional paid boost for your property shop listing.</p></div><div className="upgrade-premium-grid">{premiumServices.map((service) => <button className={`upgrade-premium-card ${selectedPremium === service.name ? 'selected' : ''}`} type="button" key={service.name} onClick={() => { setSelectedPremium(service.name); setCheckout(true); }}><span className="upgrade-premium-icon"><Icon name={service.icon} size={18} /></span><span><strong>{service.name}</strong><small>{service.detail}</small></span><b>{service.price}<small> one time</small></b></button>)}</div></section>}
   </main>;
}
