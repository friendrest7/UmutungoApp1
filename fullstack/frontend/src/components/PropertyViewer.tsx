'use client';

import Image from 'next/image';
import { createPortal } from 'react-dom';
import { FormEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';
import { Language, t } from '../data/translations';
import { PropertyPlaceholder } from './PropertyCard';
import { AuthModal } from './AuthModal';
import { umutungoApi } from '../lib/umutungoApi';
import { dashboardPathForAccountRole } from '../lib/accountRouting';
import { propertySlug } from '../lib/listings';

type ViewerMode = 'photos' | 'tour' | 'plan';
type PropertyViewerProps = { language: Language; property: PropertyPlaceholder; onClose: () => void; initialMode?: ViewerMode; initialImageIndex?: number; initialRequest?: boolean; initialContact?: boolean; embedded?: boolean };
type TransactionType = 'rent' | 'buy';
type TransactionStep = 'choose' | 'application' | 'security' | 'payment' | 'pending' | 'success';
type PaymentMethod = 'momo' | 'airtel' | 'mastercard' | 'visa' | 'other';
type PaymentReceipt = { receiptNumber: string; propertyTitle: string; location: string; amount: number; currency: string; paymentMethod: string; status: 'successful'; transactionType: TransactionType; createdAt: string; demo: boolean };
type PendingPayment = { id: string; status: string; amount: number; currency: string; provider_reference?: string };

function PaymentLogo({ method }: { method: PaymentMethod }) {
  if (method === 'momo') return <span className="payment-brand payment-brand-momo"><b>m</b><small>MoMo</small></span>;
  if (method === 'airtel') return <span className="payment-brand payment-brand-airtel"><b>a</b></span>;
  if (method === 'mastercard') return <span className="payment-brand payment-brand-mastercard"><i /><i /></span>;
  if (method === 'visa') return <span className="payment-brand payment-brand-visa">VISA</span>;
  return <span className="payment-brand payment-brand-other"><Icon name="creditCard" size={17} /></span>;
}

function propertyPriceAmount(value: string) {
  const amount = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function paymentMethodLabel(method: PaymentMethod) {
  return { momo: 'MTN MoMo', airtel: 'Airtel Money', mastercard: 'Mastercard', visa: 'Visa card', other: 'Other bank card' }[method];
}

function buildReceiptPdf(receipt: PaymentReceipt, propertyUrl: string) {
  const clean = (value: string | number) => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '?');
  const literal = (value: string | number) => clean(value).replace(/([\\()])/g, '\\$1');
  const commands: string[] = [];
  const textAt = (x: number, y: number, value: string | number, size = 11, bold = false, color = '0.12 0.18 0.14') => {
    commands.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color} rg ${x} ${y} Td (${literal(value)}) Tj ET`);
  };
  const rectangle = (x: number, y: number, width: number, height: number, color: string) => commands.push(`${color} rg ${x} ${y} ${width} ${height} re f`);
  const rule = (y: number) => commands.push(`0.86 0.90 0.87 RG 40 ${y} m 555 ${y} l S`);
  const wrap = (value: string, max = 88) => {
    const words = clean(value).split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      if (line && `${line} ${word}`.length > max) { lines.push(line); line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
    return lines;
  };

  rectangle(0, 690, 595, 152, '0.04 0.42 0.23');
  textAt(40, 795, 'UMUTUNGO', 11, true, '1 1 1');
  textAt(40, 754, 'Payment receipt', 24, true, '1 1 1');
  textAt(40, 730, 'Thank you for choosing a trusted property journey.', 10, false, '0.9 1 0.92');
  textAt(40, 657, 'Receipt number', 9, false, '0.37 0.46 0.39');
  textAt(40, 638, receipt.receiptNumber, 11, true);
  textAt(330, 657, 'Date', 9, false, '0.37 0.46 0.39');
  textAt(330, 638, new Date(receipt.createdAt).toLocaleString(), 10, true);
  rule(620);
  textAt(40, 594, 'Property', 9, false, '0.37 0.46 0.39');
  textAt(175, 594, receipt.propertyTitle, 11, true, '0.04 0.42 0.23');
  textAt(40, 550, 'Location', 9, false, '0.37 0.46 0.39');
  textAt(175, 550, receipt.location, 11, true);
  rule(528);
  textAt(40, 500, 'Request type', 9, false, '0.37 0.46 0.39');
  textAt(175, 500, receipt.transactionType === 'rent' ? 'Rental request' : 'Purchase request', 11, true);
  rule(478);
  textAt(40, 450, 'Payment method', 9, false, '0.37 0.46 0.39');
  textAt(175, 450, receipt.paymentMethod, 11, true);
  rectangle(40, 370, 515, 58, '0.93 0.97 0.94');
  textAt(55, 404, 'Total paid', 10, true, '0.25 0.43 0.3');
  textAt(55, 382, `${receipt.currency} ${receipt.amount.toLocaleString()}`, 17, true, '0.04 0.55 0.25');
  textAt(40, 340, 'PAYMENT SUCCESSFUL', 9, true, '0.04 0.55 0.25');
  const notice = receipt.demo
    ? 'Prototype demo receipt: no real money was charged. In live checkout, your provider will send a secure approval prompt to your phone.'
    : 'This receipt confirms the payment recorded by Umutungo. Keep it for your records.';
  wrap(notice).forEach((line, index) => textAt(40, 313 - index * 14, line, 9, false, '0.37 0.46 0.39'));
  rectangle(40, 220, 515, 42, '0.04 0.42 0.23');
  textAt(228, 236, 'Continue exploring', 11, true, '1 1 1');

  const stream = `${commands.join('\n')}\n`;
  const safeUri = clean(propertyUrl).replace(/([\\()])/g, '\\$1');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 7 0 R /F2 8 0 R >> >> /Contents 4 0 R /Annots [5 0 R 6 0 R] >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
    `<< /Type /Annot /Subtype /Link /Rect [165 584 555 607] /Border [0 0 0] /A << /S /URI /URI (${safeUri}) >> >>`,
    `<< /Type /Annot /Subtype /Link /Rect [40 220 555 262] /Border [0 0 0] /A << /S /URI /URI (${safeUri}) >> >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

export function PropertyViewer({ language, property, onClose, initialMode = 'photos', initialImageIndex = 0, initialRequest = false, initialContact = false, embedded = false }: PropertyViewerProps) {
  const demoPaymentsEnabled = process.env.NODE_ENV === 'development';
  const images = property.images?.length ? property.images : [property.image];
  const isHouse = property.type.trim().toLowerCase() === 'house';
  const hasPropertyMeasurements = property.bedrooms > 0 || property.bathrooms > 0 || property.area > 0;
  const isProductListing = ['Vehicles', 'Furniture', 'Appliances', 'Equipment', 'Other assets'].includes(property.type);
  const hasSpatialView = !isProductListing && !['vehicle', 'furniture', 'appliance', 'equipment'].includes(property.type.trim().toLowerCase());
  const [activeImage, setActiveImage] = useState(() => Math.max(0, Math.min(initialImageIndex, images.length - 1)));
  const [mode, setMode] = useState<ViewerMode>(hasSpatialView ? initialMode : 'photos');
  const [tourStop, setTourStop] = useState(0);
  const [turn, setTurn] = useState(0);
  const [tilt, setTilt] = useState(0);
  const [tourZoom, setTourZoom] = useState(0);
  const [navigationMode, setNavigationMode] = useState(false);
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
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [applicationName, setApplicationName] = useState('');
  const [applicationPhone, setApplicationPhone] = useState('');
  const [applicationMessage, setApplicationMessage] = useState('');
  const [landlordVisible, setLandlordVisible] = useState(false);
  const [contactOpen, setContactOpen] = useState(initialContact);
  const [messageSent, setMessageSent] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [contactError, setContactError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [houseSeen, setHouseSeen] = useState(false);
  const [viewingRequested, setViewingRequested] = useState(false);
  const [tourSatisfaction, setTourSatisfaction] = useState<'yes' | 'no' | ''>('');
  const [directionsMapUrl, setDirectionsMapUrl] = useState('');
  const [applicationId, setApplicationId] = useState('');
  const dragStart = useRef<{ x: number; y: number; turn: number; tilt: number; pointerType: string } | null>(null);
  const photoSwipeStart = useRef<{ x: number; pointerId: number } | null>(null);

  useEffect(() => {
    setSignedIn(Boolean(window.localStorage.getItem('umutungo-demo-user')));
    const first = 2 + Math.floor(Math.random() * 7);
    const second = 1 + Math.floor(Math.random() * 6);
    setSecurityChallenge({ first, second, answer: String(first + second) });
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !authOpen) onClose(); };
    const previousOverflow = document.body.style.overflow;
    if (!embedded) document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => { if (!embedded) document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', closeOnEscape); };
  }, [authOpen, embedded, onClose]);

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
  const isCommercial = property.type === 'Commercial' || property.type === 'Offices';
  const availableFor = property.availableFor ?? (property.priceNote.includes('/ month') || property.priceNote.includes('/ night') ? 'rent' : 'sale');
  const availableActions: TransactionType[] = availableFor === 'both' ? ['rent', 'buy'] : [availableFor === 'rent' ? 'rent' : 'buy'];
  useEffect(() => {
    if (!initialRequest) return;
    setTransactionType(availableFor === 'rent' ? 'rent' : 'buy');
    setTransactionOpen(true);
  }, [initialRequest, availableFor, property.id]);
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
    setPendingPayment(null);
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
      } else if (process.env.NODE_ENV === 'production') {
        throw new Error('The hosted service did not save your application. Please sign in again and retry.');
      }
    } catch (cause) {
      if (process.env.NODE_ENV === 'production') {
        setApplicationId('');
        const applications = JSON.parse(window.localStorage.getItem('umutungo-rental-applications') ?? '[]') as Array<Record<string, unknown>>;
        window.localStorage.setItem('umutungo-rental-applications', JSON.stringify(applications.filter((item) => item.id !== application.id)));
        const notifications = JSON.parse(window.localStorage.getItem(ownerNotificationKey) ?? '[]') as Array<Record<string, unknown>>;
        window.localStorage.setItem(ownerNotificationKey, JSON.stringify(notifications.filter((item) => item.id !== notification.id)));
        window.dispatchEvent(new CustomEvent(ownerNotificationKey.includes('commissioner') ? 'umutungo:commissioner-data-changed' : 'umutungo:landlord-data-changed'));
        setPaymentError(cause instanceof Error ? cause.message : 'Your application could not be sent. Please retry.');
        return;
      }
    }
    setPaymentError('');
    setTransactionStep('success');
  };
  const saveTenantBooking = (paymentStatus: 'paid' | 'pending') => {
    const booking = { id: `booking-${property.id}`, property_id: property.id, property_title: property.title, location: property.location, price: property.price, payment_status: paymentStatus, created_at: new Date().toISOString() };
    const stored = JSON.parse(window.localStorage.getItem('umutungo-tenant-bookings') ?? '[]') as typeof booking[];
    window.localStorage.setItem('umutungo-tenant-bookings', JSON.stringify([booking, ...stored.filter((item) => item.property_id !== property.id)]));
    window.dispatchEvent(new CustomEvent('umutungo:tenant-data-changed'));
  };
  const completeSuccessfulPayment = (payment: PendingPayment) => {
    const createdAt = new Date().toISOString();
    const providerReference = payment.provider_reference || payment.id;
    const localPayment = { id: payment.id, related_type: applicationId ? 'application' : 'listing', related_id: applicationId || property.id, amount: payment.amount, currency: payment.currency, provider: 'mtn_momo', provider_reference: providerReference, status: 'successful', created_at: createdAt };
    const storedPayments = JSON.parse(window.localStorage.getItem('umutungo-payments') ?? '[]') as typeof localPayment[];
    window.localStorage.setItem('umutungo-payments', JSON.stringify([localPayment, ...storedPayments.filter((item) => item.id !== localPayment.id)]));
    window.localStorage.setItem('umutungo-last-payment', JSON.stringify({ ...localPayment, propertyId: property.id }));
    saveTenantBooking('paid');
    setPaymentReceipt({ receiptNumber: providerReference, propertyTitle: property.title, location: property.location, amount: payment.amount, currency: payment.currency, paymentMethod: 'MTN MoMo', status: 'successful', transactionType, createdAt, demo: false });
    setPendingPayment(null);
    setPaymentPhone('');
    setTransactionStep('success');
  };
  const checkPendingPayment = async () => {
    if (!pendingPayment || checkingPayment) return;
    setCheckingPayment(true);
    setPaymentError('');
    try {
      const check = await umutungoApi<{ status: string }>(`/api/v1/payments/${encodeURIComponent(pendingPayment.id)}/confirm`, { method: 'POST', body: '{}' });
      if (!check) throw new Error('Please sign in again to check the MTN MoMo payment.');
      if (check.status === 'successful') {
        completeSuccessfulPayment({ ...pendingPayment, status: check.status });
      } else if (check.status === 'failed') {
        setPaymentError('MTN MoMo reports that this payment was not completed. You can retry the payment.');
        setTransactionStep('payment');
      }
    } catch (cause) {
      setPaymentError(cause instanceof Error ? cause.message : 'We could not check the payment status. Please try again shortly.');
    } finally {
      setCheckingPayment(false);
    }
  };
  const handlePaymentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isMobileMoney = paymentMethod === 'momo' || paymentMethod === 'airtel';
    if (isMobileMoney && paymentPhone.trim().replace(/\D/g, '').length < 9) { setPaymentError('Enter a valid Rwanda phone number to continue.'); return; }
    if (!isMobileMoney && (!cardNumber.trim() || !cardExpiry.trim() || !cardCvv.trim())) { setPaymentError('Enter the card details to continue.'); return; }
    setPaymentError('');
    if (demoPaymentsEnabled) {
      const amount = propertyPriceAmount(property.price);
      if (!amount) { setPaymentError('The property price is missing, so a demo receipt cannot be created.'); return; }
      const createdAt = new Date().toISOString();
      const reference = `UM-DEMO-${Date.now()}`;
      const localPayment = { id: reference, related_type: applicationId ? 'application' : 'listing', related_id: applicationId || property.id, amount, currency: 'RWF', provider: paymentMethod, provider_reference: reference, status: 'successful', created_at: createdAt };
      const storedPayments = JSON.parse(window.localStorage.getItem('umutungo-payments') ?? '[]') as typeof localPayment[];
      window.localStorage.setItem('umutungo-payments', JSON.stringify([localPayment, ...storedPayments]));
      window.localStorage.setItem('umutungo-last-payment', JSON.stringify({ ...localPayment, propertyId: property.id, demo: true }));
      saveTenantBooking('paid');
      setPaymentReceipt({ receiptNumber: reference, propertyTitle: property.title, location: property.location, amount, currency: 'RWF', paymentMethod: paymentMethodLabel(paymentMethod), status: 'successful', transactionType, createdAt, demo: true });
      setPaymentPhone('');
      setCardNumber('');
      setCardExpiry('');
      setCardCvv('');
      setTransactionStep('success');
      return;
    }
    if (paymentMethod !== 'momo') {
      setPaymentError('This payment option is not connected yet. Please choose MTN MoMo.');
      return;
    }
    let startedPayment: PendingPayment | null = null;
    try {
      const result = await umutungoApi<PendingPayment>('/api/v1/payments', { method: 'POST', body: JSON.stringify({ related_type: applicationId ? 'application' : 'listing', related_id: applicationId || property.id, transaction_type: transactionType, provider: 'mtn_momo', phone: paymentPhone }) });
      if (!result) throw new Error('Sign in before starting an MTN MoMo payment.');
      startedPayment = result;
      setPendingPayment(result);
      let status = result.status;
      for (let attempt = 0; status === 'pending' && attempt < 15; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 4000));
        const check = await umutungoApi<{ status: string }>(`/api/v1/payments/${encodeURIComponent(result.id)}/confirm`, { method: 'POST', body: '{}' });
        if (!check) throw new Error('Sign in again to check your MTN payment.');
        status = check.status;
      }
      if (status === 'successful') {
        completeSuccessfulPayment({ ...result, status });
        return;
      }
      if (status === 'failed') {
        setPaymentError('MTN MoMo reports that this payment was not completed. You can retry the payment.');
        setTransactionStep('payment');
        return;
      }
      if (status !== 'successful') {
        setTransactionStep('pending');
        return;
      }
    } catch (cause) {
      if (startedPayment) {
        setPendingPayment(startedPayment);
        setTransactionStep('pending');
      } else {
        setPaymentError(cause instanceof Error ? cause.message : 'We could not start the MTN MoMo payment. Please try again.');
      }
      return;
    }
  };
  const downloadReceipt = () => {
    if (!paymentReceipt) return;
    const propertyUrl = `${window.location.origin}/property/${encodeURIComponent(propertySlug(paymentReceipt.propertyTitle))}`;
    const blob = buildReceiptPdf(paymentReceipt, propertyUrl);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `umutungo-receipt-${paymentReceipt.receiptNumber}.pdf`;
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
    setContactError('');
    try {
      const result = await umutungoApi('/api/v1/messages', { method: 'POST', body: JSON.stringify({ listing_id: property.id, body: contactMessage.trim() }) });
      if (!result) throw new Error('Sign in to send a message to the property owner.');
      setMessageSent(true);
    } catch (cause) {
      setContactError(cause instanceof Error ? cause.message : 'Your message could not be sent. Please try again.');
    }
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
  const openDirectionsFromCurrentLocation = () => {
    const destination = property.latitude != null && property.longitude != null
      ? `${property.latitude},${property.longitude}`
      : `${property.location}, Rwanda`;
    const showDirections = (origin?: string) => {
      const query = new URLSearchParams({ output: 'embed', daddr: destination });
      if (origin) query.set('saddr', origin);
      setDirectionsMapUrl(`https://www.google.com/maps?${query.toString()}`);
    };
    if (!navigator.geolocation) { showDirections(); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => showDirections(`${position.coords.latitude},${position.coords.longitude}`),
      () => showDirections(),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };
  const paymentOptions: Array<{ id: PaymentMethod; label: string; detail: string; mark: string; available: boolean }> = [
    { id: 'momo', label: 'MTN MoMo', detail: 'Approve securely on your MoMo phone', mark: 'MoMo', available: true },
    { id: 'airtel', label: 'Airtel Money', detail: 'Pay from your Airtel Money wallet', mark: 'A', available: demoPaymentsEnabled },
    { id: 'mastercard', label: 'Mastercard', detail: 'Debit or credit card', mark: 'MC', available: demoPaymentsEnabled },
    { id: 'visa', label: 'Visa card', detail: 'Debit or credit card', mark: 'VISA', available: demoPaymentsEnabled },
    { id: 'other', label: 'Other bank card', detail: 'Other supported cards in Rwanda', mark: 'Other', available: demoPaymentsEnabled },
  ];  const isVehicle = property.type === 'Vehicles';
  const isFurniture = property.type === 'Furniture';
  const isAppliance = property.type === 'Appliances';
  const isEquipment = property.type === 'Equipment';
  const isOtherAsset = property.type === 'Other assets';
  const isOtherProperty = property.type.trim().toLowerCase() === 'other';
  const tourNames = isLand ? [t(language, 'Site entrance'), t(language, 'Buildable area'), t(language, 'Access road')] : isCommercial ? [t(language, 'Open workspace'), t(language, 'Meeting room'), t(language, 'Reception')] : isOtherProperty ? ['Main hall', 'Event space', 'Entrance'] : isVehicle ? ['Exterior', 'Interior', 'Detail view'] : isFurniture ? ['Room view', 'Furniture detail', 'In context'] : isAppliance ? ['Product view', 'Controls', 'In context'] : isEquipment ? ['Equipment view', 'Controls', 'In use'] : isOtherAsset ? ['Main view', 'Details', 'In context'] : [t(language, 'Living room'), t(language, 'Kitchen'), t(language, 'Bedroom')];
  const planNames = isLand ? [t(language, 'Plot frontage'), t(language, 'Buildable area'), t(language, 'Access road'), t(language, 'Green buffer')] : isCommercial ? [t(language, 'Open workspace'), t(language, 'Meeting room'), t(language, 'Reception'), t(language, 'Staff area')] : isOtherProperty ? ['Main hall', 'Dining area', 'Stage', 'Entrance'] : [t(language, 'Living room'), t(language, 'Kitchen'), t(language, 'Bedroom'), t(language, 'Garden')];
  const roomImages = images.filter((image) => /(?:^|\/)tour-[^/]+$/i.test(image.split('?')[0]));
  const tourImages = (roomImages.length >= 3 ? roomImages : images).slice(0, 3);
  const roomPositions = [{ x: 50, y: 62 }, { x: 71, y: 35 }, { x: 31, y: 29 }];
  const walkTo = (index: number) => { const nextIndex = Math.max(0, Math.min(index, tourImages.length - 1)); setTourStop(nextIndex); setTourZoom(0); };
  const handleGameKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && navigationMode) { event.preventDefault(); setNavigationMode(false); return; }
    if (event.key === 'ArrowRight') { event.preventDefault(); setTurn((current) => current + 18); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); setTurn((current) => current - 18); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setTilt((current) => Math.max(-35, current - 8)); }
    if (event.key === 'ArrowDown') { event.preventDefault(); setTilt((current) => Math.min(35, current + 8)); }
  };
  const startLook = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!navigationMode || (event.target as HTMLElement).closest('button')) return;
    dragStart.current = { x: event.clientX, y: event.clientY, turn, tilt, pointerType: event.pointerType };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const dragLook = (event: ReactPointerEvent<HTMLDivElement>) => { if (dragStart.current) { setTurn(dragStart.current.turn + (event.clientX - dragStart.current.x) * .8); setTilt(Math.max(-45, Math.min(45, dragStart.current.tilt + (event.clientY - dragStart.current.y) * .35))); } };
  const enterNavigationMode = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    setNavigationMode(true);
  };
  const stopLook = () => { dragStart.current = null; };
  const handleTourWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setTourZoom((current) => Math.max(0, Math.min(3, current + (event.deltaY < 0 ? 1 : -1))));
  };

  return <div className={`property-viewer-overlay${embedded ? ' is-embedded' : ''}`} role="dialog" aria-modal={!embedded} aria-labelledby="property-viewer-title" onMouseDown={(event) => { if (!embedded && event.target === event.currentTarget) onClose(); }}>
    <section className={`property-viewer ${isAppliance ? 'is-appliance-viewer' : ''}`}>
      <header className="property-viewer-header">
        <div>{embedded ? <h2 id="property-viewer-title">3D property view</h2> : <><h2 id="property-viewer-title">{t(language, property.title)}</h2><p><Icon name="pin" size={14} /> {t(language, property.location)}</p><button className="property-report-link" type="button" onClick={handleReport}>Report this listing</button></>}</div>
        {embedded && <div className="property-viewer-tabs embedded-property-viewer-tabs" role="tablist" aria-label={t(language, 'Property media')}>
          <button className={mode === 'photos' ? 'is-active' : ''} type="button" role="tab" aria-selected={mode === 'photos'} onClick={() => setMode('photos')}><Icon name="building" size={15} /> {t(language, 'Photos')}</button>
          {hasSpatialView && <>
            <button className={mode === 'tour' ? 'is-active' : ''} type="button" role="tab" aria-selected={mode === 'tour'} onClick={() => setMode('tour')}><Icon name="sparkles" size={15} /> {t(language, '3D tour')}</button>
            <button className={mode === 'plan' ? 'is-active' : ''} type="button" role="tab" aria-selected={mode === 'plan'} onClick={() => setMode('plan')}><Icon name="home" size={15} /> {t(language, 'Floor plan')}</button>
          </>}
        </div>}
        <button className="property-viewer-close" type="button" onClick={onClose} aria-label={embedded ? 'Close 3D view' : t(language, 'Close property viewer')}><Icon name="x" size={20} /></button>
      </header>

      {!embedded && <div className="property-viewer-tabs" role="tablist" aria-label={t(language, 'Property media')}>
        <button className={mode === 'photos' ? 'is-active' : ''} type="button" role="tab" aria-selected={mode === 'photos'} onClick={() => setMode('photos')}><Icon name="building" size={15} /> {t(language, 'Photos')}</button>
        {hasSpatialView && <>
          <button className={mode === 'tour' ? 'is-active' : ''} type="button" role="tab" aria-selected={mode === 'tour'} onClick={() => setMode('tour')}><Icon name="sparkles" size={15} /> {t(language, '3D tour')}</button>
          <button className={mode === 'plan' ? 'is-active' : ''} type="button" role="tab" aria-selected={mode === 'plan'} onClick={() => setMode('plan')}><Icon name="home" size={15} /> {t(language, 'Floor plan')}</button>
        </>}
      </div>}

      <div className="property-viewer-grid">
        <div className="property-viewer-media">
          {mode === 'photos' && <div className="viewer-photo-stage" onPointerDown={startPhotoSwipe} onPointerUp={stopPhotoSwipe} onPointerCancel={() => { photoSwipeStart.current = null; }}><Image src={images[activeImage]} alt={t(language, property.title)} fill sizes="(max-width: 900px) 100vw, 62vw" priority unoptimized={images[activeImage].startsWith('http')} className="viewer-main-image" /><span className="viewer-media-count">{activeImage + 1} / {images.length}</span><button className="viewer-arrow viewer-arrow-prev" type="button" onClick={() => changeImage(-1)} aria-label={t(language, 'Previous property image')}><Icon name="chevron" size={21} /></button><button className="viewer-arrow viewer-arrow-next" type="button" onClick={() => changeImage(1)} aria-label={t(language, 'Next property image')}><Icon name="chevron" size={21} /></button></div>}

          {mode === 'tour' && <div className={`viewer-tour-stage viewer-game-stage ${navigationMode ? 'is-navigating' : ''}`} tabIndex={0} onDoubleClick={enterNavigationMode} onKeyDown={handleGameKey} onWheel={handleTourWheel} onPointerDown={startLook} onPointerMove={dragLook} onPointerUp={stopLook} onPointerCancel={stopLook} style={{ backgroundImage: `linear-gradient(180deg, rgba(8, 22, 14, .02), rgba(8, 22, 14, .04) 45%, rgba(8, 22, 14, .76)), url(${tourImages[tourStop] ?? images[0]})`, backgroundPosition: `${Math.max(0, Math.min(100, 50 + turn * .6))}% ${Math.max(0, Math.min(100, 50 + tilt))}%`, backgroundSize: `${navigationMode ? 220 + tourZoom * 20 : 120 + tourZoom * 14}% auto` }}>
            <div className="viewer-tour-topline"><span><Icon name="sparkles" size={15} /> {t(language, 'Interactive walkthrough')}</span><small>{navigationMode ? 'Look-around mode · drag to pan · press Esc to exit' : 'Double-click to look around · scroll to zoom · choose a view'}</small></div>
            <button className="viewer-navigation-exit" type="button" onClick={() => { setNavigationMode((current) => !current); dragStart.current = null; }}>{navigationMode ? 'Exit look-around' : 'Look around'} <Icon name={navigationMode ? 'x' : 'sparkles'} size={13} /></button>
            <div className="viewer-tour-label"><strong>{tourNames[tourStop]}</strong><span>{isOtherProperty ? 'Explore this property and its key areas' : t(language, 'Walk through the home and explore each stop')}</span></div>
            <div className="viewer-mini-map" aria-label={t(language, 'Interactive floor plan')}><div className="viewer-mini-map-heading"><span>{(isVehicle || isFurniture || isAppliance || isEquipment || isOtherAsset ? 'VIEWS' : t(language, 'FLOOR PLAN'))}</span><small>{tourStop + 1} / {tourImages.length}</small></div><div className="viewer-mini-map-canvas">{tourNames.slice(0, tourImages.length).map((name, index) => <button key={name} className={tourStop === index ? 'is-active' : ''} type="button" style={{ left: `${roomPositions[index].x}%`, top: `${roomPositions[index].y}%` }} onClick={() => walkTo(index)} aria-label={`${t(language, 'Walk to')} ${name}`}><span>{index + 1}</span></button>)}<i style={{ left: `${roomPositions[tourStop].x}%`, top: `${roomPositions[tourStop].y}%` }} /></div></div>
            {tourStop > 0 && <button className="viewer-tour-door viewer-tour-door-back" type="button" onClick={() => walkTo(tourStop - 1)} aria-label={`Back to ${tourNames[tourStop - 1]}`}><Icon name="chevron" size={17} /><span>{tourNames[tourStop - 1]}</span></button>}
            {tourStop < tourImages.length - 1 && <button className="viewer-tour-door viewer-tour-door-next" type="button" onClick={() => walkTo(tourStop + 1)} aria-label={`Walk to ${tourNames[tourStop + 1]}`}><span>{tourNames[tourStop + 1]}</span><Icon name="chevron" size={17} /></button>}
            <div className="viewer-tour-controls"><button type="button" onClick={() => setTurn((current) => current - 18)} aria-label={t(language, 'Turn view left')}><Icon name="chevron" size={17} /></button><div>{tourNames.slice(0, tourImages.length).map((name, index) => <button className={tourStop === index ? 'is-active' : ''} type="button" key={name} onClick={() => walkTo(index)}>{name}</button>)}</div><button type="button" onClick={() => setTurn((current) => current + 18)} aria-label={t(language, 'Turn view right')}><Icon name="chevron" size={17} /></button></div>
            <div className="viewer-tour-zoom" aria-label={t(language, 'Tour zoom controls')}><button type="button" onClick={() => setTourZoom((current) => Math.max(0, current - 1))} aria-label={t(language, 'Zoom out')}>{String.fromCharCode(8722)}</button><span>{100 + tourZoom * 18}%</span><button type="button" onClick={() => setTourZoom((current) => Math.min(3, current + 1))} aria-label={t(language, 'Zoom in')}>+</button></div>
          </div>}

          {mode === 'tour' && !embedded && <section className="viewer-tour-feedback" aria-labelledby="viewer-tour-feedback-title"><div><strong id="viewer-tour-feedback-title">Are you satisfied with the 3D view to continue checkout?</strong><span>Choose what you would like to do next.</span></div><div className="viewer-tour-feedback-options"><button type="button" className={tourSatisfaction === 'yes' ? 'is-selected' : ''} aria-pressed={tourSatisfaction === 'yes'} onClick={() => { setTourSatisfaction('yes'); openTransaction(); }}>Yes, I’m satisfied</button><button type="button" className={tourSatisfaction === 'no' ? 'is-selected' : ''} aria-pressed={tourSatisfaction === 'no'} onClick={() => { setTourSatisfaction('no'); openDirectionsFromCurrentLocation(); }}>No, I’d like to visit</button></div><button className="property-contact-button" type="button" onClick={() => { setContactError(''); setContactOpen(true); }}><Icon name="bookPen" size={15} /> Message the landlord</button>{tourSatisfaction === 'no' && directionsMapUrl && <><div className="property-inline-directions"><div><strong>Directions to this property</strong><button type="button" onClick={() => setDirectionsMapUrl('')} aria-label="Close directions"><Icon name="x" size={14} /></button></div><iframe src={directionsMapUrl} title={`Directions to ${property.title}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div><button className="property-contact-button" type="button" onClick={openTransaction}><Icon name="arrow" size={15} /> Continue to get this property</button></>}</section>}

          {mode === 'plan' && <div className="viewer-plan-stage"><div className="viewer-plan-heading"><span>{t(language, isLand ? 'Interactive site plan' : 'Interactive floor plan')}</span><small>{t(language, 'Tap a room to preview it')}</small></div><div className="viewer-floor-plan"><button className="viewer-plan-room plan-living" type="button" onClick={() => { setMode('tour'); walkTo(0); }}>{planNames[0]}<small>{isLand ? '620 m2' : isCommercial ? '82 m2' : '38 m2'}</small></button><button className="viewer-plan-room plan-kitchen" type="button" onClick={() => { setMode('tour'); walkTo(1); }}>{planNames[1]}<small>{isLand ? 'North side' : isCommercial ? '24 m2' : '14 m2'}</small></button><button className="viewer-plan-room plan-bedroom" type="button" onClick={() => { setMode('tour'); walkTo(2); }}>{planNames[2]}<small>{isLand ? 'Street edge' : isCommercial ? 'Front desk' : `${property.bedrooms} rooms`}</small></button><button className="viewer-plan-room plan-garden" type="button" onClick={() => { setMode('tour'); walkTo(2); }}>{planNames[3]}<small>{isLand ? 'Setback' : isCommercial ? 'Back of house' : 'Outdoor'}</small></button><span className="plan-door plan-door-one" /><span className="plan-door plan-door-two" /></div></div>}

          <div className="viewer-thumbnails">{images.map((image, index) => <button className={mode === 'photos' && activeImage === index ? 'is-active' : ''} type="button" key={`${image}-thumb-${index}`} onClick={() => { setMode('photos'); setActiveImage(index); }}><Image src={image} alt="" fill sizes="90px" unoptimized={image.startsWith('http')} /></button>)}</div>
        </div>

        {!embedded && <aside className="property-viewer-details"><div className="viewer-price-row"><div><strong>{property.price}</strong>{property.priceNote && !/^\s*asking\s*$/i.test(property.priceNote) && <small>{t(language, property.priceNote)}</small>}</div><button className="viewer-share" type="button" onClick={() => navigator.clipboard?.writeText(window.location.href)} aria-label={t(language, 'Copy property link')}><Icon name="arrow" size={16} /></button></div><div className="viewer-stats">{isHouse && property.bedrooms > 0 && <span><strong>{property.bedrooms}</strong>{t(language, "beds")}</span>}{isHouse && property.bathrooms > 0 && <span><strong>{property.bathrooms}</strong>{t(language, "baths")}</span>}{property.area > 0 && <span><strong>{property.area}</strong>m{String.fromCharCode(178)}</span>}</div><p className="viewer-description">{property.description?.trim() || 'Contact the owner for more information about this property.'}</p><div className="viewer-highlights"><span><Icon name="check" size={15} /> {t(language, 'Secure enquiries')}</span></div><button className="viewer-request-button" type="button" onClick={openTransaction}>{t(language, 'Buy or rent this property')} <Icon name="arrow" size={16} /></button><small className="viewer-listed">{t(language, property.listed)}</small></aside>}
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
            <p className="property-action-intro">Choose how you would like to continue. Purchase requests continue to the MTN MoMo payment prompt. Rental applications are sent first; payment follows owner acceptance.</p>
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
            <h2 id="property-action-title">A quick check before payment</h2>
            <p className="property-action-intro">Confirm it’s you to continue to secure payment.</p>
            <div className="security-check-intro"><span className="security-check-icon"><Icon name="sparkles" size={19} /></span><span><small>PAYMENT PROTECTION</small><strong>Human verification</strong><em>This helps protect your checkout.</em></span><b>1 step</b></div>
            <form className="payment-form security-check-form" onSubmit={handleSecuritySubmit}>
              <label className={`human-check-label${humanConfirmed ? ' is-confirmed' : ''}`}><input type="checkbox" checked={humanConfirmed} onChange={(event) => { setHumanConfirmed(event.target.checked); setPaymentError(''); }} /><span><strong>I’m here and ready to continue</strong><small>Confirm this is a person using the checkout</small></span>{humanConfirmed && <Icon name="check" size={18} />}</label>
              <label className="security-answer-label"><span>Answer this quick question</span><span className="security-answer-row"><span className="registration-captcha-question">{securityChallenge.first} + {securityChallenge.second} = ?</span><input aria-label="Answer to security question" inputMode="numeric" value={securityAnswer} onChange={(event) => { setSecurityAnswer(event.target.value); setPaymentError(''); }} placeholder="Your answer" autoComplete="off" required /></span></label>
              {paymentError && <p className="payment-error" role="alert">{paymentError}</p>}
              <button className="property-action-continue" type="submit">Continue to secure payment <Icon name="arrow" size={16} /></button>
            </form>
          </>}

          {transactionStep === 'payment' && <>
            <span className="eyebrow">Secure payment</span>
            <h2 id="property-action-title">Pay to continue</h2>
            <p className="property-action-intro">Choose a payment option available in Rwanda for this {transactionType === 'rent' ? 'rental request' : 'property request'}.</p>
            <div className="payment-summary"><span>{property.title}</span><strong>{property.price}{property.priceNote && !/^\s*asking\s*$/i.test(property.priceNote) && <> <small>{property.priceNote}</small></>}</strong></div>
            <div className="payment-method-grid" aria-label="Payment options">
              {paymentOptions.map((option) => <button className={`payment-method-card ${paymentMethod === option.id ? 'is-selected' : ''} ${!option.available ? 'is-unavailable' : ''}`} type="button" key={option.id} disabled={!option.available} aria-label={`${option.label}${option.available ? '' : ', coming soon'}`} onClick={() => { setPaymentMethod(option.id); setPaymentError(''); }}>
                <PaymentLogo method={option.id} />
                <span><strong>{option.label}</strong><small>{option.available ? option.detail : 'Coming soon'}</small></span>
                <Icon name={paymentMethod === option.id ? 'check' : 'chevron'} size={14} />
              </button>)}
            </div>
            <p className="payment-demo-note">{demoPaymentsEnabled ? 'Demo mode: all payment choices simulate a successful payment for presentation. No charge or phone PIN prompt is sent.' : 'MTN MoMo is available now. Other options will be enabled after their payment services are connected.'}</p>
            <form className="payment-form" onSubmit={handlePaymentSubmit}>
              {(paymentMethod === 'momo' || paymentMethod === 'airtel') && <label>Rwanda phone number<input type="tel" value={paymentPhone} onChange={(event) => setPaymentPhone(event.target.value)} placeholder="+250 7XX XXX XXX" autoComplete="tel" required /></label>}
              {paymentMethod !== 'momo' && paymentMethod !== 'airtel' && <label>Card number<input inputMode="numeric" value={cardNumber} onChange={(event) => setCardNumber(event.target.value)} placeholder="1234 5678 9012 3456" autoComplete="cc-number" required /></label>}
              {paymentMethod !== 'momo' && paymentMethod !== 'airtel' && <div className="payment-card-fields"><label>Expiry date<input value={cardExpiry} onChange={(event) => setCardExpiry(event.target.value)} placeholder="MM / YY" autoComplete="cc-exp" required /></label><label>CVV<input inputMode="numeric" value={cardCvv} onChange={(event) => setCardCvv(event.target.value)} placeholder="123" maxLength={4} autoComplete="cc-csc" required /></label></div>}
              {paymentError && <p className="payment-error" role="alert">{paymentError}</p>}
              <button className="property-action-continue" type="submit">Pay {property.price} securely <Icon name="arrow" size={16} /></button>
            </form>
            <button className="property-flow-back" type="button" onClick={() => setTransactionStep('choose')}><Icon name="arrow" size={13} /> Back to request options</button>
          </>}

          {transactionStep === 'pending' && <>
            <span className="eyebrow">Payment pending</span>
            <h2 id="property-action-title">Waiting for MTN MoMo</h2>
            <p className="property-action-intro">Approve the payment on your phone. We’ll show your confirmation and receipt here as soon as MTN confirms it.</p>
            {paymentError && <p className="payment-error" role="alert">{paymentError}</p>}
            <button className="property-action-continue" type="button" onClick={() => void checkPendingPayment()} disabled={checkingPayment || !pendingPayment}>{checkingPayment ? 'Checking payment…' : 'Check payment status'} <Icon name="arrow" size={15} /></button>
            <button className="property-action-continue" type="button" onClick={onClose}>Close</button>
          </>}

          {transactionStep === 'success' && <>
            <span className="payment-success-mark"><Icon name="check" size={23} /></span>
            <span className="eyebrow">{paymentReceipt ? 'Payment successful' : 'Request received'}</span>
            <h2 id="property-action-title">{paymentReceipt ? paymentReceipt.demo ? 'Your demo payment was successful' : 'Your MTN MoMo payment is confirmed' : 'You are on your way'}</h2>
            <p className="property-action-intro">{paymentReceipt ? paymentReceipt.demo ? <>Demo payment for <strong>{paymentReceipt.propertyTitle}</strong> was successful. No money was charged. In live checkout, your provider will send a prompt to your phone to approve the payment with your PIN. Never enter your PIN on Umutungo.</> : <>Your payment for <strong>{paymentReceipt.propertyTitle}</strong> was successful. Keep your receipt for your records.</> : <>Your {transactionType === 'rent' ? 'rental' : 'property'} request for <strong>{property.title}</strong> has been recorded.</>}</p>
            {paymentReceipt && <div className="property-receipt-summary"><span>Receipt number<strong>{paymentReceipt.receiptNumber}</strong></span><span>Amount paid<strong>{paymentReceipt.currency} {paymentReceipt.amount.toLocaleString()}</strong></span><button className="property-receipt-button" type="button" onClick={downloadReceipt}><Icon name="download" size={15} /> Download receipt</button></div>}
            {transactionType === 'rent' && !houseSeen && <div className="property-seen-card"><strong>Have you finished exploring?</strong><span>{viewingRequested ? 'Visit the property first, then return here and confirm when you are ready to pay.' : 'Choose whether you have visited the property or want to open its location before paying.'}</span><div className="property-seen-actions"><button className="property-contact-button" type="button" onClick={markHouseSeen}>I finished exploring <Icon name="check" size={14} /></button><button className="property-map-button" type="button" onClick={openPropertyMap}><Icon name="pin" size={14} /> No, I want to view it</button></div></div>}
            {property.poster && <div className="property-landlord-card">
              <div className="property-landlord-heading"><span className="property-landlord-avatar"><Icon name="user" size={18} /></span><span><strong>{property.poster.businessName || property.poster.name || 'Property owner'}</strong><small>{property.poster.verified ? 'Verified owner' : 'Property owner'} {String.fromCharCode(183)} {property.location}</small></span></div>
              {property.poster.phone && <><button className="property-landlord-view" type="button" onClick={() => setLandlordVisible((current) => !current)}>{landlordVisible ? 'Hide phone number' : 'View phone number'} <Icon name="arrow" size={14} /></button>{landlordVisible && <div className="property-landlord-details"><span><b>Phone</b> <a href={`tel:${property.poster.phone}`}>{property.poster.phone}</a></span></div>}</>}
              <button className="property-contact-button" type="button" onClick={() => { setContactError(''); setContactOpen(true); }}><Icon name="bookPen" size={15} /> Message owner</button>
            </div>}
            {houseSeen && <div className="property-review-card">
              <div><span className="eyebrow">After your request</span><h3>How was this property experience?</h3><p>Share a quick review to help other renters make a confident choice.</p></div>
              {reviewSubmitted ? <p className="property-review-success" role="status"><Icon name="check" size={14} /> Thank you {String.fromCharCode(8212)} your review was submitted.</p> : reviewOpen ? <form className="property-review-form" onSubmit={handleReviewSubmit}><div className="property-review-stars" aria-label="Choose a rating">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" className={value <= reviewRating ? 'is-selected' : ''} aria-label={value + ' stars'} onClick={() => setReviewRating(value)}>{String.fromCharCode(9733)}</button>)}</div><textarea value={reviewMessage} onChange={(event) => setReviewMessage(event.target.value)} placeholder="Tell us about the listing and landlord experience" rows={3} required /><button className="property-review-submit" type="submit">Submit review <Icon name="arrow" size={14} /></button></form> : <button className="property-review-open" type="button" onClick={() => setReviewOpen(true)}>Leave a review <Icon name="arrow" size={14} /></button>}
            </div>}
          </>}
        </section>
        {contactOpen && createPortal(<div className="landlord-contact-overlay" role="dialog" aria-modal="true" aria-labelledby="landlord-contact-title">
          <button className="landlord-contact-backdrop" type="button" aria-label="Close landlord chat" onClick={() => setContactOpen(false)} />
          <section className="landlord-contact-panel">
            <header className="landlord-contact-header"><div className="property-landlord-heading"><span className="property-landlord-avatar"><Icon name="user" size={18} /></span><span><strong id="landlord-contact-title">{property.poster?.businessName || property.poster?.name || 'Property owner'}</strong><small>{property.poster?.verified ? 'Verified owner' : 'Property owner'}</small></span></div><button className="property-action-close" type="button" aria-label="Close owner chat" onClick={() => setContactOpen(false)}><Icon name="x" size={18} /></button></header>
            <p className="landlord-contact-intro">Ask about viewing times, availability, deposit terms, or any detail about {property.title}.</p>
            <div className="landlord-chat-messages">{messageSent && <div className="landlord-chat-bubble landlord-chat-sent">{contactMessage}</div>}</div>
            {!messageSent ? <form className="landlord-contact-form" onSubmit={handleLandlordMessage}><textarea value={contactMessage} onChange={(event) => setContactMessage(event.target.value)} placeholder="Write your message to the owner" rows={4} required />{contactError && <p className="payment-error" role="alert">{contactError}</p>}<button className="property-contact-button" type="submit">Send message <Icon name="arrow" size={15} /></button></form> : <div className="landlord-contact-sent"><Icon name="check" size={15} /> Message sent to the listing owner. They’ll receive a dashboard notification.</div>}
          </section>
        </div>, document.body)}
      </div>
    )}
    <AuthModal open={authOpen} role="Client" onClose={() => setAuthOpen(false)} onSuccess={(accountRole) => { if (accountRole !== 'Client' && accountRole !== 'Tenant') { window.location.assign(dashboardPathForAccountRole(accountRole)); return; } setSignedIn(true); setAuthOpen(false); setPaymentError(''); setTransactionStep(transactionType === 'rent' ? 'application' : 'security'); }} />
  </div>;
}
