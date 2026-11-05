'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { umutungoApi } from '../lib/umutungoApi';

export function ListingPaymentReturn({ status, listingId, purchaseId = '', packageKey = '', txRef, transactionId, paidDraft = false }: { status: string; listingId: string; purchaseId?: string; packageKey?: string; txRef: string; transactionId: string; paidDraft?: boolean }) {
  const successful = status === 'successful';
  const pending = status === 'pending';
  const [method, setMethod] = useState<'mobilemoneyrwanda' | 'card'>('mobilemoneyrwanda');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const checkStatusUrl = txRef && transactionId
    ? `/api/v1/${purchaseId ? 'listing-upload-payments' : 'listing-subscription-payments'}/verify?tx_ref=${encodeURIComponent(txRef)}&transaction_id=${encodeURIComponent(transactionId)}&status=pending`
    : '';

  const retry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!listingId && !packageKey) return;
    setBusy(true);
    setMessage('');
    try {
      const checkout = listingId
        ? await umutungoApi<{ checkout_url: string }>(`/api/v1/listings/${encodeURIComponent(listingId)}/subscription-payment`, { method: 'POST', body: JSON.stringify({ payment_method: method, email: email.trim(), phone: phone.trim(), requested_status: paidDraft ? 'draft' : 'published' }) })
        : await umutungoApi<{ checkout_url: string }>('/api/v1/owner/listing-upload-purchases', { method: 'POST', body: JSON.stringify({ package_key: packageKey, payment_method: method, email: email.trim(), idempotency_key: window.crypto.randomUUID() }) });
      if (!checkout?.checkout_url) throw new Error('Could not start a new checkout.');
      window.location.assign(checkout.checkout_url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start payment.');
      setBusy(false);
    }
  };

  return <main className="listing-payment-return"><section className={pending ? 'is-pending' : ''}>
    <span aria-hidden="true" className={successful ? 'is-success' : pending ? 'is-pending' : 'is-failed'}>{successful ? '✓' : pending ? '…' : '!'}</span>
    <p>{successful ? 'PAYMENT CONFIRMED' : pending ? 'PAYMENT PENDING' : 'PAYMENT NOT COMPLETED'}</p>
    <h1>{successful ? (purchaseId ? 'Your upload slots are ready.' : paidDraft ? 'Payment complete. Continue your listing.' : 'Your listing is ready.') : pending ? 'Approve the payment on your phone.' : 'Your payment was not completed.'}</h1>
    <p>{successful ? (purchaseId ? 'Your upload slot package payment was confirmed. The slots are now available in your Komisiyoneri workspace.' : paidDraft ? 'Your one-time payment is confirmed. Your listing remains private while you finish adding its details.' : 'Your one-time listing upload fee was received. Your property listing is now active.') : pending ? 'The Flutterwave payment is waiting for confirmation. Approve it in the secure checkout flow to finish.' : purchaseId ? 'No upload slots were activated. You can retry this package payment below.' : 'Your listing was saved as a draft. You can try the secure checkout again below.'}</p>
    {pending ? <div className="listing-payment-pending-actions">{checkStatusUrl && <a href={checkStatusUrl}>Check payment status</a>}<Link href="/">Return to Umutungo</Link></div> : successful ? <Link href={paidDraft ? `/post-property?paid_draft=${encodeURIComponent(listingId)}` : purchaseId ? '/commissioner' : '/property-owner'}>{paidDraft ? 'Continue editing listing' : 'Go to dashboard'}</Link> : listingId || packageKey ? <form onSubmit={(event) => void retry(event)}>
      <label>Email for your receipt<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
      <div role="group" aria-label="Choose payment method"><button type="button" className={method === 'mobilemoneyrwanda' ? 'is-selected' : ''} onClick={() => setMethod('mobilemoneyrwanda')}>Mobile money</button><button type="button" className={method === 'card' ? 'is-selected' : ''} onClick={() => setMethod('card')}>Visa or Mastercard</button></div>
      {method === 'mobilemoneyrwanda' && <label>Mobile money phone number<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+250 78 123 4567" required /></label>}
      {message && <p role="alert">{message}</p>}
      <button type="submit" disabled={busy}>{busy ? 'Opening secure checkout…' : 'Try payment again'}</button>
    </form> : <Link href="/post-property">Return to listing form</Link>}
  </section></main>;
}
