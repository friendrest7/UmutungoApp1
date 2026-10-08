'use client';

import Image from 'next/image';
import { FormEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';
import { Language, t } from '../data/translations';
import { PropertyPlaceholder } from './PropertyCard';
import { AuthModal } from './AuthModal';
import { umutungoApi } from '../lib/umutungoApi';

type ViewerMode = 'photos' | 'tour' | 'plan';
type PropertyViewerProps = { language: Language; property: PropertyPlaceholder; onClose: () => void; initialMode?: ViewerMode };
type TransactionType = 'rent' | 'buy';
type TransactionStep = 'choose' | 'application' | 'security' | 'payment' | 'success';
type PaymentMethod = 'momo' | 'airtel' | 'mastercard' | 'visa' | 'other';
type PaymentReceipt = { receiptNumber: string; propertyTitle: string; location: string; amount: number; currency: string; paymentMethod: string; status: 'successful' | 'pending'; transactionType: TransactionType; createdAt: string };

function PaymentLogo({ method }: { method: PaymentMethod }) {
  if (method === 'momo') return <span className="payment-brand payment-brand-momo"><b>m</b><small>MoMo</small></span>;
  if (method === 'airtel') return <span className="payment-brand payment-brand-airtel"><b>a</b></span>;
  if (method === 'mastercard') return <span className="payment-brand payment-brand-mastercard"><i /><i /></span>;
  if (method === 'visa') return <span className="payment-brand payment-brand-visa">VISA</span>;
  return <span className="payment-brand payment-brand-other"><Icon name="creditCard" size={17} /></span>;
}

function propertyPriceAmount(value: string) {
  const normalized = value.replace(/[^0-9.]/g, '');
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return 1;
  return value.toLowerCase().includes('m') ? amount * 1000000 : amount;
}

function paymentMethodLabel(method: PaymentMethod) {
  return { momo: 'MTN MoMo', airtel: 'Airtel Money', mastercard: 'Mastercard', visa: 'Visa card', other: 'Other bank card' }[method];
}

function escapeReceiptValue(value: string | number) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character);
}

export function PropertyViewer({ language, property, onClose, initialMode = 'photos' }: PropertyViewerProps) {
  const images = property.images?.length ? property.images : [property.image];
  const [activeImage, setActiveImage] = useState(0);
  const [mode, setMode] = useState<ViewerMode>(initialMode);
  const [tourStop, setTourStop] = useState(0);
  const [turn, setTurn] = useState(0);
  const [tourZoom, setTourZoom] = useState(0);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<TransactionType>('rent');
  const [transactionStep, setTransactionStep] = useState<TransactionStep>('choose');
  const [securityChallenge, setSecurityChallenge] = useState({ first: 4, second: 3, answer: '7' });
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [humanConfirmed, setHumanConfirmed] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('momo');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [paymentReceipt, setPaymentReceipt] = useState<PaymentReceipt | null>(null);
  const [applicationName, setApplicationName] = useState('');
  const [applicationPhone, setApplicationPhone] = useState('');
  const [applicationMessage, setApplicationMessage] = useState('');
  const [landlordVisible, setLandlordVisible] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [houseSeen, setHouseSeen] = useState(false);
  const [viewingRequested, setViewingRequested] = useState(false);
  const [applicationId, setApplicationId] = useState('');
  const dragStart = useRef<{ x: number; y: number; turn: number; pointerType: string } | null>(null);
  const photoSwipeStart = useRef<{ x: number; pointerId: number } | null>(null);

  useEffect(() => {
    setSignedIn(Boolean(window.localStorage.getItem('umutungo-demo-user')));
    const first = 2 + Math.floor(Math.random() * 7);
    const second = 1 + Math.floor(Math.random() * 6);
    setSecurityChallenge({ first, second, answer: String(first + second) });
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !authOpen) onClose(); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', closeOnEscape); };
  }, [authOpen, onClose]);

  const changeImage = (direction: number) => setActiveImage((current) => (current + direction + images.length) % images.length);
  const startPhotoSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    photoSwipeStart.current = { x: event.clientX, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const stopPhotoSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = photoSwipeStart.current;
    if (start && event.pointerId === start.pointerId && Math.abs(event.clientX - start.x) > 42) {
      changeImage(event.clientX < start.x ? 1 : -1);
    }
    photoSwipeStart.current = null;
  };
  const isLand = property.type === 'Land';
  const isCommercial = property.type === 'Commercial';
  const availableFor = property.availableFor ?? (property.priceNote.includes('/ month') || property.priceNote.includes('/ night') ? 'rent' : 'sale');
  const availableActions: TransactionType[] = availableFor === 'both' ? ['rent', 'buy'] : [availableFor === 'rent' ? 'rent' : 'buy'];
  const openTransaction = () => {
    setTransactionType(availableActions[0]);
    setTransactionStep('choose');
    setPaymentMethod('momo');
    setPaymentPhone('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setPaymentError('');
    setPaymentReceipt(null);
    setApplicationName('');
    setApplicationPhone('');
    setApplicationMessage('');
    setLandlordVisible(false);
    setContactOpen(false);
    setMessageSent(false);
    setContactMessage('');
    setReviewOpen(false);
    setReviewRating(5);
    setReviewMessage('');
    setReviewSubmitted(false);
    setHouseSeen(false);
    setViewingRequested(false);
    setApplicationId('');
    setTransactionOpen(true);
  };
  const handleTransactionContinue = () => {
    if (!signedIn) { setAuthOpen(true); return; }
    setPaymentError('');
    setTransactionStep(transactionType === 'rent' ? 'application' : 'security');
  };
  const openPaymentSecurity = () => {
    setSecurityAnswer('');
    setHumanConfirmed(false);
    setPaymentError('');
    setTransactionStep('security');
  };
  const handleSecuritySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!humanConfirmed) { setPaymentError('Confirm that you are human before continuing.'); return; }
    if (securityAnswer.trim() !== securityChallenge.answer) { setPaymentError('That answer is not correct. Please try again.'); return; }
    setPaymentError('');
    setTransactionStep('payment');
  };
  const handleApplicationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (applicationPhone.replace(/\D/g, '').length < 9) { setPaymentError('Enter a valid Rwanda phone number.'); return; }
    const application = { id: `${property.id}-${Date.now()}`, propertyId: property.id, propertyTitle: property.title, applicant: applicationName, phone: applicationPhone, message: applicationMessage, status: 'pending', viewedAt: null, createdAt: new Date().toISOString() };
    setApplicationId(application.id);
    const existing = JSON.parse(window.localStorage.getItem('umutungo-rental-applications') ?? '[]') as typeof application[];
    window.localStorage.setItem('umutungo-rental-applications', JSON.stringify([application, ...existing]));
    const notification = { id: `notification-${application.id}`, type: 'application_received', title: 'New rental application', body: `${applicationName || 'A tenant'} applied for ${property.title}`, applicationId: application.id, status: 'pending', createdAt: application.createdAt };
    const commissionerListings = JSON.parse(window.localStorage.getItem('umutungo-commissioner-properties') ?? '[]') as Array<{ id?: string }>;
    const ownerNotificationKey = commissionerListings.some((item) => item.id === property.id) ? 'umutungo-commissioner-notifications' : 'umutungo-landlord-notifications';
    const storedNotifications = JSON.parse(window.localStorage.getItem(ownerNotificationKey) ?? '[]') as typeof notification[];
    window.localStorage.setItem(ownerNotificationKey, JSON.stringify([notification, ...storedNotifications]));
    window.dispatchEvent(new CustomEvent(ownerNotificationKey.includes('commissioner') ? 'umutungo:commissioner-data-changed' : 'umutungo:landlord-data-changed'));
    try {
      const result = await umutungoApi<{ id: string }>('/api/v1/listings/' + encodeURIComponent(property.id) + '/applications', { method: 'POST', body: JSON.stringify({ message: applicationMessage, applicant_info: { name: applicationName, phone: applicationPhone } }) });
      if (result?.id) {
        setApplicationId(result.id);
        const applications = JSON.parse(window.localStorage.getItem('umutungo-rental-applications') ?? '[]') as Array<Record<string, unknown>>;
        window.localStorage.setItem('umutungo-rental-applications', JSON.stringify(applications.map((item) => item.id === application.id ? { ...item, id: result.id } : item)));
        const notifications = JSON.parse(window.localStorage.getItem(ownerNotificationKey) ?? '[]') as Array<Record<string, unknown>>;
        window.localStorage.setItem(ownerNotificationKey, JSON.stringify(notifications.map((item) => item.applicationId === application.id ? { ...item, applicationId: result.id } : item)));
        window.dispatchEvent(new CustomEvent(ownerNotificationKey.includes('commissioner') ? 'umutungo:commissioner-data-changed' : 'umutungo:landlord-data-changed'));
      }
    } catch { /* Keep the local application available for the demo workspace. */ }
    setPaymentError('');
    setTransactionStep('success');
  };
  const saveTenantBooking = (paymentStatus: 'paid' | 'pending') => {
    const booking = { id: `booking-${property.id}`, property_id: property.id, property_title: property.title, location: property.location, price: property.price, payment_status: paymentStatus, created_at: new Date().toISOString() };
    const stored = JSON.parse(window.localStorage.getItem('umutungo-tenant-bookings') ?? '[]') as typeof booking[];
    window.localStorage.setItem('umutungo-tenant-bookings', JSON.stringify([booking, ...stored.filter((item) => item.property_id !== property.id)]));
    window.dispatchEvent(new CustomEvent('umutungo:tenant-data-changed'));
  };
  const handlePaymentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isMobileMoney = paymentMethod === 'momo' || paymentMethod === 'airtel';
    if (isMobileMoney && paymentPhone.trim().replace(/\D/g, '').length < 9) { setPaymentError('Enter a valid Rwanda phone number to continue.'); return; }
    if (!isMobileMoney && cardNumber.replace(/\D/g, '').length < 12) { setPaymentError('Enter a valid card number to continue.'); return; }
    if (!isMobileMoney && (!cardExpiry.trim() || cardCvv.trim().length < 3)) { setPaymentError('Enter your card expiry date and security code.'); return; }
    setPaymentError('');
    let paymentStatus: 'paid' | 'pending' = 'paid';
    try {
      const result = await umutungoApi<{ id?: string; status?: string }>('/api/v1/payments', { method: 'POST', body: JSON.stringify({ related_type: applicationId ? 'application' : 'listing', related_id: applicationId || property.id, transaction_type: transactionType, amount: propertyPriceAmount(property.price), currency: 'RWF', provider: paymentMethod === 'momo' ? 'mtn_momo' : paymentMethod === 'airtel' ? 'airtel_money' : 'card', phone: paymentPhone }) });
      paymentStatus = result?.status?.toLowerCase() === 'successful' || result?.status?.toLowerCase() === 'paid' ? 'paid' : 'pending';
      if (result) window.localStorage.setItem('umutungo-last-payment', JSON.stringify({ ...result, propertyId: property.id, createdAt: new Date().toISOString() }));
    } catch { /* The API can be enabled with a token; keep the local demo payment available. */ }
    const localPayment: { id: string; related_type: string; related_id: string; amount: number; currency: string; provider: string; status: 'successful' | 'pending'; created_at: string } = { id: `payment-${property.id}-${Date.now()}`, related_type: applicationId ? 'application' : 'listing', related_id: applicationId || property.id, amount: propertyPriceAmount(property.price), currency: 'RWF', provider: paymentMethod === 'momo' ? 'mtn_momo' : paymentMethod === 'airtel' ? 'airtel_money' : 'card', status: paymentStatus === 'paid' ? 'successful' : 'pending', created_at: new Date().toISOString() };
    const storedPayments = JSON.parse(window.localStorage.getItem('umutungo-payments') ?? '[]') as typeof localPayment[];
    window.localStorage.setItem('umutungo-payments', JSON.stringify([localPayment, ...storedPayments.filter((item) => item.related_id !== localPayment.related_id)]));
    saveTenantBooking(paymentStatus);
    setPaymentPhone('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setPaymentReceipt({ receiptNumber: `UM-${localPayment.id.replace(/^payment-/, '').toUpperCase()}`, propertyTitle: property.title, location: property.location, amount: localPayment.amount, currency: localPayment.currency, paymentMethod: paymentMethodLabel(paymentMethod), status: localPayment.status, transactionType, createdAt: localPayment.created_at });
    setTransactionStep('success');
  };
  const downloadReceipt = () => {
    if (!paymentReceipt) return;
    const receipt = paymentReceipt;
    const formattedAmount = `${receipt.currency} ${receipt.amount.toLocaleString()}`;
    const formattedDate = new Date(receipt.createdAt).toLocaleString();
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Umutungo receipt ${escapeReceiptValue(receipt.receiptNumber)}</title><style>body{margin:0;background:#eef4ef;color:#172219;font-family:Arial,sans-serif}.page{width:min(680px,calc(100% - 32px));margin:42px auto}.receipt{background:#fff;border:1px solid #d6e4d8;border-radius:20px;box-shadow:0 18px 50px rgba(25,65,37,.12);overflow:hidden}.top{padding:30px 34px;background:linear-gradient(135deg,#0f4a36,#23734a);color:#fff}.brand{font-size:13px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.top h1{margin:26px 0 6px;font-size:30px;font-weight:600}.top p{margin:0;color:rgba(255,255,255,.78);font-size:13px}.body{padding:30px 34px}.meta{display:flex;justify-content:space-between;gap:18px;padding-bottom:24px;border-bottom:1px solid #e1ebe2}.meta span{display:grid;gap:5px;color:#6d7d70;font-size:11px}.meta strong{color:#172219;font-size:13px}.line{display:flex;justify-content:space-between;gap:20px;padding:18px 0;border-bottom:1px solid #e1ebe2}.line span{color:#6d7d70;font-size:12px}.line strong{max-width:55%;color:#172219;font-size:13px;text-align:right}.total{display:flex;justify-content:space-between;gap:20px;padding:24px 0 8px}.total span{color:#51705b;font-size:12px;font-weight:700}.total strong{color:#0f4a36;font-size:22px}.status{display:inline-flex;margin-top:22px;padding:7px 11px;border-radius:999px;background:#e5f4e8;color:#0f4a36;font-size:11px;font-weight:800;text-transform:capitalize}.foot{padding:18px 34px;background:#f5faf5;color:#6d7d70;font-size:11px;line-height:1.6}.print{margin:22px auto 0;display:block;border:0;border-radius:999px;padding:11px 18px;background:#0f4a36;color:#fff;cursor:pointer;font-weight:700}@media print{body{background:#fff}.page{width:100%;margin:0}.receipt{border:0;box-shadow:none}.print{display:none}}</style></head><body><main class="page"><section class="receipt"><header class="top"><div class="brand">Umutungo</div><h1>Payment receipt</h1><p>Thank you for choosing a trusted property journey.</p></header><div class="body"><div class="meta"><span>Receipt number<strong>${escapeReceiptValue(receipt.receiptNumber)}</strong></span><span>Date<strong>${escapeReceiptValue(formattedDate)}</strong></span></div><div class="line"><span>Property</span><strong>${escapeReceiptValue(receipt.propertyTitle)}</strong></div><div class="line"><span>Location</span><strong>${escapeReceiptValue(receipt.location)}</strong></div><div class="line"><span>Request type</span><strong>${escapeReceiptValue(receipt.transactionType === 'rent' ? 'Rental request' : 'Purchase request')}</strong></div><div class="line"><span>Payment method</span><strong>${escapeReceiptValue(receipt.paymentMethod)}</strong></div><div class="total"><span>Total paid</span><strong>${escapeReceiptValue(formattedAmount)}</strong></div><span class="status">${escapeReceiptValue(receipt.status)}</span></div><footer class="foot">This receipt confirms the payment recorded by Umutungo. Keep it for your records. You can print this page or choose â€œSave as PDFâ€ from your browser.</footer></section><button class="print" onclick="window.print()">Print / Save as PDF</button></main></body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `umutungo-receipt-${receipt.receiptNumber}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const handleReviewSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reviewMessage.trim()) return;
    try { await umutungoApi('/api/v1/reviews', { method: 'POST', body: JSON.stringify({ listing_id: property.id, rating: reviewRating, body: reviewMessage }) }); } catch { /* Local/demo review */ }
    const storedReviews = JSON.parse(window.localStorage.getItem('umutungo-property-reviews') ?? '[]') as Array<Record<string, unknown>>;
    window.localStorage.setItem('umutungo-property-reviews', JSON.stringify([{ id: `review-${property.id}-${Date.now()}`, listing_id: property.id, listing_title: property.title, rating: reviewRating, body: reviewMessage.trim(), created_at: new Date().toISOString() }, ...storedReviews]));
    setReviewSubmitted(true);
    setReviewOpen(false);
  };
  const handleLandlordMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contactMessage.trim()) return;
    try { await umutungoApi('/api/v1/messages', { method: 'POST', body: JSON.stringify({ listing_id: property.id, body: contactMessage }) }); } catch { /* Local/demo message */ }
    const storedPayments = JSON.parse(window.localStorage.getItem('umutungo-payments') ?? '[]') as Array<{ related_id?: string; status?: string }>;
    const payment = storedPayments.find((item) => item.related_id === property.id || item.related_id === applicationId);
    saveTenantBooking(payment?.status === 'successful' || payment?.status === 'paid' ? 'paid' : 'pending');
    const storedMessages = JSON.parse(window.localStorage.getItem('umutungo-tenant-messages') ?? '[]') as Array<Record<string, string>>;
    const commissionerListings = JSON.parse(window.localStorage.getItem('umutungo-commissioner-properties') ?? '[]') as Array<{ id?: string }>;
    const ownerNotificationKey = commissionerListings.some((item) => item.id === property.id) ? 'umutungo-commissioner-notifications' : 'umutungo-landlord-notifications';
    const storedLandlordNotifications = JSON.parse(window.localStorage.getItem(ownerNotificationKey) ?? '[]') as Array<Record<string, unknown>>;
    window.localStorage.setItem(ownerNotificationKey, JSON.stringify([{ id: `notification-message-${Date.now()}`, type: 'message_received', title: 'New tenant message', body: `${applicationName || 'A tenant'} sent a message about ${property.title}`, createdAt: new Date().toISOString(), readAt: null }, ...storedLandlordNotifications]));
    window.localStorage.setItem('umutungo-tenant-messages', JSON.stringify([{ id: `message-${Date.now()}`, sender_id: 'me', sender_name: 'You', recipient_id: '', recipient_name: 'Eric N.', listing_id: property.id, listing_title: property.title, body: contactMessage, created_at: new Date().toISOString() }, ...storedMessages]));
    window.dispatchEvent(new CustomEvent('umutungo:notifications-changed'));
    window.dispatchEvent(new CustomEvent(ownerNotificationKey.includes('commissioner') ? 'umutungo:commissioner-data-changed' : 'umutungo:landlord-data-changed'));
    setMessageSent(true);
    window.location.assign('/tenant?view=Messages');
  };
  const handleReport = async () => {
    const reasonInput = window.prompt('Report reason: fraud, duplicate, incorrect information, sold/unavailable, offensive content, or other.');
    if (!reasonInput?.trim()) return;
    const normalized = reasonInput.trim().toLowerCase().replace(/\s+/g, '_');
    const reason = ['fraud', 'duplicate', 'incorrect_information', 'sold_unavailable', 'offensive_content'].includes(normalized) ? normalized : 'other';
    window.localStorage.setItem('umutungo-listing-report', JSON.stringify({ listingId: property.id, reason, createdAt: new Date().toISOString() }));
    try {
      const listingId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(property.id) ? property.id : '';
      const result = await umutungoApi('/api/v1/reports', { method: 'POST', body: JSON.stringify({ listing_id: listingId, reason, details: `${reasonInput.trim()} (property: ${property.id})` }) });
      window.alert(result ? 'Report sent to the Umutungo admin team.' : 'Report saved locally. Sign in with a connected account to send it to the admin team.');
    } catch {
      window.alert('Report saved locally. Sign in with a connected account to send it to the admin team.');
    }
  };
  const markHouseSeen = async () => {
    setHouseSeen(true);
    const applications = JSON.parse(window.localStorage.getItem('umutungo-rental-applications') ?? '[]') as Array<Record<string, unknown>>;
    window.localStorage.setItem('umutungo-rental-applications', JSON.stringify(applications.map((item) => item.propertyId === property.id ? { ...item, viewedAt: new Date().toISOString() } : item)));
    if (applicationId) { try { await umutungoApi(`/api/v1/applications/${applicationId}/viewed`, { method: 'POST', body: '{}' }); } catch { /* local/demo application */ } }
    openPaymentSecurity();
  };
  const openPropertyMap = () => {
    const query = encodeURIComponent(`${property.location}, Rwanda`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank', 'noopener,noreferrer');
    setViewingRequested(true);
  };
  const paymentOptions: Array<{ id: PaymentMethod; label: string; detail: string; mark: string }> = [
    { id: 'momo', label: 'MTN MoMo', detail: 'Approve securely on your MoMo phone', mark: 'MoMo' },
    { id: 'airtel', label: 'Airtel Money', detail: 'Pay from your Airtel Money wallet', mark: 'A' },
    { id: 'mastercard', label: 'Mastercard', detail: 'Debit or credit card', mark: 'MC' },
    { id: 'visa', label: 'Visa card', detail: 'Debit or credit card', mark: 'VISA' },
    { id: 'other', label: 'Other bank card', detail: 'Other supported cards in Rwanda', mark: 'â€¢â€¢â€¢' },
  ];
  const tourNames = isLand ? [t(language, 'Site entrance'), t(language, 'Buildable area'), t(language, 'Access road')] : isCommercial ? [t(language, 'Open workspace'), t(language, 'Meeting room'), t(language, 'Reception')] : [t(language, 'Living room'), t(language, 'Kitchen'), t(language, 'Bedroom')];
  const planNames = isLand ? [t(language, 'Plot frontage'), t(language, 'Buildable area'), t(language, 'Access road'), t(language, 'Green buffer')] : isCommercial ? [t(language, 'Open workspace'), t(language, 'Meeting room'), t(language, 'Reception'), t(language, 'Staff area')] : [t(language, 'Living room'), t(language, 'Kitchen'), t(language, 'Bedroom'), t(language, 'Garden')];
  const roomImages = images.filter((image) => /(?:^|\/)tour-[^/]+$/i.test(image.split('?')[0]));
  const tourImages = (roomImages.length ? roomImages : images).slice(0, 3);
  const roomPositions = [{ x: 50, y: 62 }, { x: 71, y: 35 }, { x: 31, y: 29 }];
  const walkTo = (index: number) => { const nextIndex = Math.max(0, Math.min(index, tourImages.length - 1)); setTourStop(nextIndex); setTourZoom(0); };
  const handleGameKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); walkTo(tourStop + 1); }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); walkTo(tourStop - 1); }
  };
  const startLook = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    dragStart.current = { x: event.clientX, y: event.clientY, turn, pointerType: event.pointerType };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const dragLook = (event: ReactPointerEvent<HTMLDivElement>) => { if (dragStart.current) setTurn(dragStart.current.turn + (event.clientX - dragStart.current.x) * .8); };
  const stopLook = () => { dragStart.current = null; };
  const handleTourWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setTourZoom((current) => Math.max(0, Math.min(3, current + (event.deltaY < 0 ? 1 : -1))));
  };

  return <div className="property-viewer-overlay" role="dialog" aria-modal="true" aria-labelledby="property-viewer-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="property-viewer">
      <header className="property-viewer-header">
        <div><span className="eyebrow">{t(language, 'Verified listing')}</span><h2 id="property-viewer-title">{t(language, property.title)}</h2><p><Icon name="pin" size={14} /> {t(language, property.location)}</p><button className="property-report-link" type="button" onClick={handleReport}>Report this listing</button></div>
        <button className="property-viewer-close" type="button" onClick={onClose} aria-label={t(language, 'Close property viewer')}><Icon name="x" size={20} /></button>
      </header>

      <div className="property-viewer-tabs" role="tablist" aria-label={t(language, 'Property media')}>
        <button className={mode === 'photos' ? 'is-active' : ''} type="button" role="tab" aria-selected={mode === 'photos'} onClick={() => setMode('photos')}><Icon name="building" size={15} /> {t(language, 'Photos')}</button>
        <button className={mode === 'tour' ? 'is-active' : ''} type="button" role="tab" aria-selected={mode === 'tour'} onClick={() => setMode('tour')}><Icon name="sparkles" size={15} /> {t(language, '3D tour')}</button>
        <button className={mode === 'plan' ? 'is-active' : ''} type="button" role="tab" aria-selected={mode === 'plan'} onClick={() => setMode('plan')}><Icon name="home" size={15} /> {t(language, 'Floor plan')}</button>
      </div>

      <div className="property-viewer-grid">
        <div className="property-viewer-media">
          {mode === 'photos' && <div className="viewer-photo-stage" onPointerDown={startPhotoSwipe} onPointerUp={stopPhotoSwipe} onPointerCancel={() => { photoSwipeStart.current = null; }}><Image src={images[activeImage]} alt={t(language, property.title)} fill sizes="(max-width: 900px) 100vw, 62vw" priority className="viewer-main-image" /><span className="viewer-media-count">{activeImage + 1} / {images.length}</span><button className="viewer-arrow viewer-arrow-prev" type="button" onClick={() => changeImage(-1)} aria-label={t(language, 'Previous property image')}><Icon name="chevron" size={21} /></button><button className="viewer-arrow viewer-arrow-next" type="button" onClick={() => changeImage(1)} aria-label={t(language, 'Next property image')}><Icon name="chevron" size={21} /></button></div>}

          {mode === 'tour' && <div className="viewer-tour-stage viewer-game-stage" tabIndex={0} onKeyDown={handleGameKey} onWheel={handleTourWheel} onPointerDown={startLook} onPointerMove={dragLook} onPointerUp={stopLook} onPointerCancel={stopLook} style={{ backgroundImage: `linear-gradient(180deg, rgba(8, 22, 12, .02), rgba(8, 22, 12, .04) 45%, rgba(8, 22, 12, .76)), url(${tourImages[tourStop] ?? images[0]})`, backgroundPosition: `${Math.max(0, Math.min(100, 50 + turn * .6))}% center`, backgroundSize: tourZoom ? `${100 + tourZoom * 18}% auto` : '120% auto' }}>
            <div className="viewer-tour-topline"><span><Icon name="sparkles" size={15} /> {t(language, '3D home tour')}</span><small>Drag to look around · select a room to move through the home</small></div>
            <div className="viewer-tour-label"><strong>{tourNames[tourStop]}</strong><span>{t(language, 'Walk through the home and explore each stop')}</span></div>
            <div className="viewer-mini-map" aria-label={t(language, 'Interactive floor plan')}><div className="viewer-mini-map-heading"><span>{t(language, 'FLOOR PLAN')}</span><small>{tourStop + 1} / {tourImages.length}</small></div><div className="viewer-mini-map-canvas">{tourNames.slice(0, tourImages.length).map((name, index) => <button key={name} className={tourStop === index ? 'is-active' : ''} type="button" style={{ left: `${roomPositions[index].x}%`, top: `${roomPositions[index].y}%` }} onClick={() => walkTo(index)} aria-label={`${t(language, 'Walk to')} ${name}`}><span>{index + 1}</span></button>)}<i style={{ left: `${roomPositions[tourStop].x}%`, top: `${roomPositions[tourStop].y}%` }} /></div></div>
            {tourStop > 0 && <button className="viewer-tour-door viewer-tour-door-back" type="button" onClick={() => walkTo(tourStop - 1)} aria-label={`Back to ${tourNames[tourStop - 1]}`}><Icon name="chevron" size={17} /><span>{tourNames[tourStop - 1]}</span></button>}
            {tourStop < tourImages.length - 1 && <button className="viewer-tour-door viewer-tour-door-next" type="button" onClick={() => walkTo(tourStop + 1)} aria-label={`Walk to ${tourNames[tourStop + 1]}`}><span>{tourNames[tourStop + 1]}</span><Icon name="chevron" size={17} /></button>}
            <div className="viewer-tour-controls"><button type="button" onClick={() => setTurn((current) => current - 18)} aria-label={t(language, 'Turn view left')}><Icon name="chevron" size={17} /></button><div>{tourNames.slice(0, tourImages.length).map((name, index) => <button className={tourStop === index ? 'is-active' : ''} type="button" key={name} onClick={() => walkTo(index)}>{name}</button>)}</div><button type="button" onClick={() => setTurn((current) => current + 18)} aria-label={t(language, 'Turn view right')}><Icon name="chevron" size={17} /></button></div>
            <div className="viewer-tour-zoom" aria-label={t(language, 'Tour zoom controls')}><button type="button" onClick={() => setTourZoom((current) => Math.max(0, current - 1))} aria-label={t(language, 'Zoom out')}>{String.fromCharCode(8722)}</button><span>{100 + tourZoom * 18}%</span><button type="button" onClick={() => setTourZoom((current) => Math.min(3, current + 1))} aria-label={t(language, 'Zoom in')}>+</button></div>
          </div>}

          {mode === 'plan' && <div className="viewer-plan-stage"><div className="viewer-plan-heading"><span>{t(language, isLand ? 'Interactive site plan' : 'Interactive floor plan')}</span><small>{t(language, 'Tap a room to preview it')}</small></div><div className="viewer-floor-plan"><button className="viewer-plan-room plan-living" type="button" onClick={() => { setMode('tour'); walkTo(0); }}>{planNames[0]}<small>{isLand ? '620 m2' : isCommercial ? '82 m2' : '38 m2'}</small></button><button className="viewer-plan-room plan-kitchen" type="button" onClick={() => { setMode('tour'); walkTo(1); }}>{planNames[1]}<small>{isLand ? 'North side' : isCommercial ? '24 m2' : '14 m2'}</small></button><button className="viewer-plan-room plan-bedroom" type="button" onClick={() => { setMode('tour'); walkTo(2); }}>{planNames[2]}<small>{isLand ? 'Street edge' : isCommercial ? 'Front desk' : `${property.bedrooms} rooms`}</small></button><button className="viewer-plan-room plan-garden" type="button" onClick={() => { setMode('tour'); walkTo(2); }}>{planNames[3]}<small>{isLand ? 'Setback' : isCommercial ? 'Back of house' : 'Outdoor'}</small></button><span className="plan-door plan-door-one" /><span className="plan-door plan-door-two" /></div></div>}

          <div className="viewer-thumbnails">{images.map((image, index) => <button className={mode === 'photos' && activeImage === index ? 'is-active' : ''} type="button" key={`${image}-thumb-${index}`} onClick={() => { setMode('photos'); setActiveImage(index); }}><Image src={image} alt="" fill sizes="90px" /></button>)}</div>
        </div>

        <aside className="property-viewer-details"><div className="viewer-price-row"><div><span className="property-type">{t(language, property.type)}</span><strong>{property.price}</strong><small>{t(language, property.priceNote)}</small></div><button className="viewer-share" type="button" onClick={() => navigator.clipboard?.writeText(window.location.href)} aria-label={t(language, 'Copy property link')}><Icon name="arrow" size={16} /></button></div><div className="viewer-stats"><span><strong>{property.bedrooms}</strong>{t(language, 'beds')}</span><span><strong>{property.bathrooms}</strong>{t(language, 'baths')}</span><span><strong>{property.area}</strong>m{String.fromCharCode(178)}</span></div><p className="viewer-description">{t(language, 'A carefully presented property with clear details, flexible spaces and a location worth exploring in person.')}</p><div className="viewer-highlights"><span><Icon name="check" size={15} /> {t(language, 'Verified owner')}</span><span><Icon name="check" size={15} /> {t(language, 'Secure enquiries')}</span><span><Icon name="check" size={15} /> {t(language, 'Virtual tour ready')}</span></div><button className="viewer-request-button" type="button" onClick={openTransaction}>{t(language, 'Buy or rent this property')} <Icon name="arrow" size={16} /></button><small className="viewer-listed">{t(language, property.listed)}</small></aside>
      </div>
    </section>
    {transactionOpen && (
      <div className="property-action-overlay" role="dialog" aria-modal="true" aria-labelledby="property-action-title">
        <button className="property-action-backdrop" type="button" aria-label="Close buy or rent options" onClick={() => setTransactionOpen(false)} />
        <section className={"property-action-panel " + (transactionStep === 'payment' ? 'is-payment-step' : '')}>
          <button className="property-action-close" type="button" aria-label="Close buy or rent options" onClick={() => setTransactionOpen(false)}><Icon name="x" size={18} /></button>

          {transactionStep === 'choose' && <>
            <span className="eyebrow">Next step</span>
            <h2 id="property-action-title">Buy or rent this property</h2>
            <p className="property-action-intro">Choose how you would like to continue with this listing.</p>
            <span className="property-availability-badge">{availableFor === 'both' ? 'Available to buy or rent' : availableFor === 'rent' ? 'Available to rent only' : 'Available to buy only'}</span>
            <div className="property-action-options">
              {availableActions.map((option) => <button className={"property-action-option " + (transactionType === option ? 'is-selected' : '')} type="button" key={option} onClick={() => { setTransactionType(option); setPaymentError(''); }}>
                <span className="property-action-option-icon"><Icon name={option === 'rent' ? 'home' : 'building'} size={17} /></span>
                <span><strong>{option === 'rent' ? 'Rent this property' : 'Buy this property'}</strong><small>{option === 'rent' ? 'Discuss the monthly terms and a viewing.' : 'Discuss the asking price and purchase process.'}</small></span>
                <Icon name={transactionType === option ? 'check' : 'arrow'} size={15} />
              </button>)}
            </div>
            <button className="property-action-continue" type="button" onClick={handleTransactionContinue}>
              Continue to {transactionType === 'rent' ? 'rent' : 'buy'} this property <Icon name="arrow" size={16} />
            </button>
            <p className="property-action-signin-note"><Icon name="user" size={14} /> Sign in is required before you make a payment or contact the landlord.</p>
            <div className="property-success-actions">
              {paymentReceipt && <button className="property-receipt-button" type="button" onClick={downloadReceipt}><Icon name="download" size={15} /> Download receipt</button>}
              <button className="property-success-back" type="button" onClick={() => setTransactionOpen(false)}>Go back</button>
            </div>
          </>}

          {transactionStep === 'application' && <>
            <span className="eyebrow">Rental application</span>
            <h2 id="property-action-title">Apply to rent this property</h2>
            <p className="property-action-intro">Send your details to the landlord. No payment is required to submit an application.</p>
            <form className="payment-form" onSubmit={handleApplicationSubmit}>
              <label>Full name<input value={applicationName} onChange={(event) => setApplicationName(event.target.value)} placeholder="Your full name" required /></label>
              <label>Rwanda phone number<input type="tel" value={applicationPhone} onChange={(event) => setApplicationPhone(event.target.value)} placeholder="+250 7XX XXX XXX" required /></label>
              <label>Message <small>Optional</small><textarea value={applicationMessage} onChange={(event) => setApplicationMessage(event.target.value)} placeholder="Tell the landlord a little about your move or preferred viewing time." rows={4} /></label>
              {paymentError && <p className="payment-error" role="alert">{paymentError}</p>}
              <button className="property-action-continue" type="submit">Submit rental application <Icon name="arrow" size={16} /></button>
            </form>
            <button className="property-flow-back" type="button" onClick={() => setTransactionStep('choose')}><Icon name="arrow" size={13} /> Back to request options</button>
          </>}

          {transactionStep === 'security' && <>
            <span className="eyebrow">Security check</span>
            <h2 id="property-action-title">Verify you are human</h2>
            <p className="property-action-intro">Complete this quick check before we connect you to the payment system.</p>
            <form className="payment-form security-check-form" onSubmit={handleSecuritySubmit}>
              <label className="human-check-label"><input type="checkbox" checked={humanConfirmed} onChange={(event) => { setHumanConfirmed(event.target.checked); setPaymentError(''); }} /> <span>I am human and I am ready to continue.</span></label>
              <label>Security question <span className="registration-captcha-question">{securityChallenge.first} + {securityChallenge.second} = ?</span><input inputMode="numeric" value={securityAnswer} onChange={(event) => { setSecurityAnswer(event.target.value); setPaymentError(''); }} placeholder="Enter the answer" autoComplete="off" required /></label>
              {paymentError && <p className="payment-error" role="alert">{paymentError}</p>}
              <button className="property-action-continue" type="submit">Continue to secure payment <Icon name="arrow" size={16} /></button>
            </form>
          </>}

          {transactionStep === 'payment' && <>
            <span className="eyebrow">Secure payment</span>
            <h2 id="property-action-title">Pay to continue</h2>
            <p className="property-action-intro">Choose a payment option available in Rwanda for this {transactionType === 'rent' ? 'rental request' : 'property request'}.</p>
            <div className="payment-summary"><span>{property.title}</span><strong>{property.price} <small>{property.priceNote}</small></strong></div>
            <div className="payment-method-grid" aria-label="Payment options">
              {paymentOptions.map((option) => <button className={"payment-method-card " + (paymentMethod === option.id ? 'is-selected' : '')} type="button" key={option.id} onClick={() => { setPaymentMethod(option.id); setPaymentError(''); }}>
                <PaymentLogo method={option.id} />
                <span><strong>{option.label}</strong><small>{option.detail}</small></span>
                <Icon name={paymentMethod === option.id ? 'check' : 'chevron'} size={14} />
              </button>)}
            </div>
            <form className="payment-form" onSubmit={handlePaymentSubmit}>
              {(paymentMethod === 'momo' || paymentMethod === 'airtel') && <label>Rwanda phone number<input type="tel" value={paymentPhone} onChange={(event) => setPaymentPhone(event.target.value)} placeholder="+250 7XX XXX XXX" autoComplete="tel" required /></label>}
              {paymentMethod !== 'momo' && paymentMethod !== 'airtel' && <label>Card number<input inputMode="numeric" value={cardNumber} onChange={(event) => setCardNumber(event.target.value)} placeholder="1234 5678 9012 3456" autoComplete="cc-number" required /></label>}
              {paymentMethod !== 'momo' && paymentMethod !== 'airtel' && <div className="payment-card-fields"><label>Expiry date<input value={cardExpiry} onChange={(event) => setCardExpiry(event.target.value)} placeholder="MM / YY" autoComplete="cc-exp" required /></label><label>CVV<input inputMode="numeric" value={cardCvv} onChange={(event) => setCardCvv(event.target.value)} placeholder="123" maxLength={4} autoComplete="cc-csc" required /></label></div>}
              {paymentError && <p className="payment-error" role="alert">{paymentError}</p>}
              <button className="property-action-continue" type="submit">Pay {property.price} securely <Icon name="arrow" size={16} /></button>
            </form>
            <p className="payment-demo-note"><Icon name="check" size={13} /> Demo checkout: no money is charged in this interface.</p>
            <button className="property-flow-back" type="button" onClick={() => setTransactionStep('choose')}><Icon name="arrow" size={13} /> Back to request options</button>
          </>}

          {transactionStep === 'success' && <>
            <span className="payment-success-mark"><Icon name="check" size={23} /></span>
            <span className="eyebrow">Request received</span>
            <h2 id="property-action-title">You are on your way</h2>
            <p className="property-action-intro">Your {transactionType === 'rent' ? 'rental' : 'property'} request for <strong>{property.title}</strong> has been recorded. You can now speak with the landlord directly.</p>
            {transactionType === 'rent' && !houseSeen && <div className="property-seen-card"><strong>Have you finished exploring?</strong><span>{viewingRequested ? 'Visit the property first, then return here and confirm when you are ready to pay.' : 'Choose whether you have visited the property or want to open its location before paying.'}</span><div className="property-seen-actions"><button className="property-contact-button" type="button" onClick={markHouseSeen}>I finished exploring <Icon name="check" size={14} /></button><button className="property-map-button" type="button" onClick={openPropertyMap}><Icon name="pin" size={14} /> No, I want to view it</button></div></div>}
            <div className="property-landlord-card">
              <div className="property-landlord-heading"><span className="property-landlord-avatar"><Icon name="user" size={18} /></span><span><strong>Eric N.</strong><small>Verified landlord {String.fromCharCode(183)} {property.location}</small></span></div>
              <button className="property-landlord-view" type="button" onClick={() => setLandlordVisible((current) => !current)}>{landlordVisible ? 'Hide details' : 'View landlord'} <Icon name="arrow" size={14} /></button>
              {landlordVisible && <div className="property-landlord-details"><span><b>Phone</b> +250 788 214 600</span><span><b>Email</b> eric.n@umutungo.rw</span><small>Ask about availability, viewing times, deposit terms, and anything else you need to know.</small></div>}
              <button className="property-contact-button" type="button" onClick={() => setContactOpen(true)}><Icon name="bookPen" size={15} /> Open chat with landlord</button>
            </div>
            {houseSeen && <div className="property-review-card">
              <div><span className="eyebrow">After your request</span><h3>How was this property experience?</h3><p>Share a quick review to help other renters make a confident choice.</p></div>
              {reviewSubmitted ? <p className="property-review-success" role="status"><Icon name="check" size={14} /> Thank you {String.fromCharCode(8212)} your review was submitted.</p> : reviewOpen ? <form className="property-review-form" onSubmit={handleReviewSubmit}><div className="property-review-stars" aria-label="Choose a rating">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" className={value <= reviewRating ? 'is-selected' : ''} aria-label={value + ' stars'} onClick={() => setReviewRating(value)}>{String.fromCharCode(9733)}</button>)}</div><textarea value={reviewMessage} onChange={(event) => setReviewMessage(event.target.value)} placeholder="Tell us about the listing and landlord experience" rows={3} required /><button className="property-review-submit" type="submit">Submit review <Icon name="arrow" size={14} /></button></form> : <button className="property-review-open" type="button" onClick={() => setReviewOpen(true)}>Leave a review <Icon name="arrow" size={14} /></button>}
            </div>}
          </>}
        </section>
        {contactOpen && <div className="landlord-contact-overlay" role="dialog" aria-modal="true" aria-labelledby="landlord-contact-title">
          <button className="landlord-contact-backdrop" type="button" aria-label="Close landlord chat" onClick={() => setContactOpen(false)} />
          <section className="landlord-contact-panel">
            <header className="landlord-contact-header"><div className="property-landlord-heading"><span className="property-landlord-avatar"><Icon name="user" size={18} /></span><span><strong id="landlord-contact-title">Eric N.</strong><small>Verified landlord {String.fromCharCode(183)} Usually replies within an hour</small></span></div><button className="property-action-close" type="button" aria-label="Close landlord chat" onClick={() => setContactOpen(false)}><Icon name="x" size={18} /></button></header>
            <p className="landlord-contact-intro">Ask about viewing times, availability, deposit terms, or any detail about {property.title}.</p>
            <div className="landlord-chat-messages"><div className="landlord-chat-bubble landlord-chat-received">Hello, I can help you with this property. What would you like to know?</div>{messageSent && <div className="landlord-chat-bubble landlord-chat-sent">{contactMessage}</div>}</div>
            {!messageSent ? <form className="landlord-contact-form" onSubmit={handleLandlordMessage}><textarea value={contactMessage} onChange={(event) => setContactMessage(event.target.value)} placeholder="Write your message to the landlord" rows={4} required /><button className="property-contact-button" type="submit">Send message <Icon name="arrow" size={15} /></button></form> : <div className="landlord-contact-sent"><Icon name="check" size={15} /> Message sent. The landlord can reply in this conversation.</div>}
          </section>
        </div>}
      </div>
    )}
    <AuthModal open={authOpen} role="Client" onClose={() => setAuthOpen(false)} onSuccess={() => { setSignedIn(true); setAuthOpen(false); setPaymentError(''); setTransactionStep(transactionType === 'rent' ? 'application' : 'security'); }} />
  </div>;
}
