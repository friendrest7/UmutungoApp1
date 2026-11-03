'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { umutungoApi } from '../lib/umutungoApi';

export function ListingPaymentReturn({ status, listingId }: { status: string; listingId: string }) {
  const successful = status === 'successful';
  const [method, setMethod] = useState<'mobilemoneyrwanda' | 'card'>('mobilemoneyrwanda');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const retry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!listingId) return;
    setBusy(true);
    setMessage('');
    try {
      const checkout = await umutungoApi<{ checkout_url: string }>(`/api/v1/listings/${encodeURIComponent(listingId)}/subscription-payment`, {
        method: 'POST',
        body: JSON.stringify({ payment_method: method, email: email.trim(), requested_status: 'published' }),
      });
      if (!checkout?.checkout_url) throw new Error('Could not start a new checkout.');
      window.location.assign(checkout.checkout_url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start payment.');
      setBusy(false);
    }
  };

  return <main className="listing-payment-return"><section>
    <span aria-hidden="true" className={successful ? 'is-success' : 'is-failed'}>{successful ? '✓' : '!'}</span>
    <p>{successful ? 'PAYMENT CONFIRMED' : 'PAYMENT NOT COMPLETED'}</p>
    <h1>{successful ? 'Your listing is ready.' : 'Your listing is still a draft.'}</h1>
    <p>{successful ? 'Your monthly listing fee was received. Your listing is active for one month.' : 'Your listing was saved as a draft. You can try the secure checkout again below.'}</p>
    {successful ? <Link href="/property-owner">Go to dashboard</Link> : listingId ? <form onSubmit={(event) => void retry(event)}>
      <label>Email for your receipt<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
      <div role="group" aria-label="Choose payment method"><button type="button" className={method === 'mobilemoneyrwanda' ? 'is-selected' : ''} onClick={() => setMethod('mobilemoneyrwanda')}>Mobile money</button><button type="button" className={method === 'card' ? 'is-selected' : ''} onClick={() => setMethod('card')}>Visa or Mastercard</button></div>
      {message && <p role="alert">{message}</p>}
      <button type="submit" disabled={busy}>{busy ? 'Opening secure checkout…' : 'Try payment again'}</button>
    </form> : <Link href="/post-property">Return to listing form</Link>}
  </section></main>;
}
