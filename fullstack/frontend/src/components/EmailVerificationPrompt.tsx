'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Icon } from './Icons';
import { umutungoApi } from '../lib/umutungoApi';
import styles from './EmailVerificationPrompt.module.css';

type Me = { user?: { email?: string; email_verified?: boolean } };
type Step = 'idle' | 'code';

/**
 * Shown at the top of every dashboard. If the signed-in user's email isn't
 * verified, it walks them through: (add email) -> send code -> enter code.
 * Once verified it shrinks to a small badge. Nothing in the app is blocked
 * for unverified emails.
 */
export function EmailVerificationPrompt() {
  const [loaded, setLoaded] = useState(false);
  const [verified, setVerified] = useState(false);
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    let cancelled = false;
    umutungoApi<Me>('/api/v1/me').then((me) => {
      if (cancelled || !me?.user) return;
      setEmail(me.user.email ?? '');
      setVerified(Boolean(me.user.email_verified));
      setLoaded(true);
    }).catch(() => { /* not signed in or API unavailable: show nothing */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  if (!loaded) return null;
  if (verified) {
    return <div className={styles.wrap}><p className={styles.badge}><Icon name="check" size={14} /> Email verified<span>{email}</span></p></div>;
  }

  const sendCode = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (resendIn > 0 || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const path = step === 'code' ? '/api/v1/verification/resend' : '/api/v1/verification/send';
      const result = await umutungoApi<{ resend_after_seconds?: number; already_verified?: boolean; message?: string }>(path, { method: 'POST', body: JSON.stringify({ purpose: 'verify_email', destination: email.trim() }) });
      if (result?.already_verified) { setVerified(true); return; }
      setResendIn(result?.resend_after_seconds ?? 60);
      setStep('code'); setCode('');
      setMessage(`We sent a 6-digit code to ${email.trim()}. It expires in 10 minutes. Check your spam folder if you don't see it.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The code could not be sent.');
    } finally { setBusy(false); }
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) { setError('Enter the 6-digit code from the email.'); return; }
    setBusy(true); setError('');
    try {
      const result = await umutungoApi<{ user?: { email?: string; email_verified?: boolean } }>('/api/v1/verification/verify', { method: 'POST', body: JSON.stringify({ purpose: 'verify_email', destination: email.trim(), code }) });
      if (result?.user?.email_verified) { setEmail(result.user.email ?? email); setVerified(true); }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That code is not correct.');
    } finally { setBusy(false); }
  };

  return <div className={styles.wrap}>
    <section className={styles.card} aria-labelledby="email-verify-title">
      <span className={styles.icon}><Icon name="bookPen" size={18} /></span>
      <div className={styles.body}>
        <h2 id="email-verify-title">{email ? 'Verify your email address' : 'Add your email address'}</h2>
        {step === 'idle' ? <form className={styles.row} onSubmit={sendCode}>
          <label className={styles.field}><input aria-label="Email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required disabled={busy} /></label>
          <button className={styles.primary} type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button>
        </form> : <form className={styles.row} onSubmit={verifyCode}>
          <label className={styles.field}><input aria-label="Verification code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" required disabled={busy} /></label>
          <button className={styles.primary} type="submit" disabled={busy}>{busy ? 'Checking…' : 'Verify'}</button>
          <button className={styles.link} type="button" onClick={() => void sendCode()} disabled={busy || resendIn > 0}>{resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}</button>
          <button className={styles.link} type="button" onClick={() => { setStep('idle'); setError(''); setMessage(''); }} disabled={busy}>Use a different email</button>
        </form>}
        {message && !error && <p className={styles.note} role="status">{message}</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
    </section>
  </div>;
}
