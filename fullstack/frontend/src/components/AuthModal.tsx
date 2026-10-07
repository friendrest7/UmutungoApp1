'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icons';
import { apiBaseUrl } from '../lib/umutungoApi';

export type AuthRole = 'Client' | 'Tenant' | 'Commissioner / Komisiyoneri' | 'Landlord' | 'Property Owner' | 'Admin';
type AuthModalProps = { open: boolean; role?: AuthRole; onClose: () => void; onSuccess: (role: AuthRole) => void };
type SignInMethod = 'choose' | 'email' | 'phone' | 'otp';
type GoogleTokenResponse = { access_token?: string; error?: string; error_description?: string };
type GoogleCredentialResponse = { credential?: string };
type GooglePromptMoment = { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean };
type GoogleApi = { accounts: {
  id: { initialize: (options: { client_id: string; callback: (response: GoogleCredentialResponse) => void; auto_select: boolean; cancel_on_tap_outside: boolean; use_fedcm_for_prompt: boolean }) => void; prompt: (callback?: (moment: GooglePromptMoment) => void) => void };
  oauth2: { initTokenClient: (options: { client_id: string; scope: string; callback: (response: GoogleTokenResponse) => void }) => { requestAccessToken: (options?: { prompt?: string }) => void } }
} };

function googleWebClientId() {
  return (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim();
}

const demoAccounts: Array<{ role: AuthRole; email: string; password: string }> = [
  { role: 'Client', email: 'client@umutungo.test', password: 'Client123!' },
  { role: 'Commissioner / Komisiyoneri', email: 'commissioner@umutungo.test', password: 'Commissioner123!' },
  { role: 'Landlord', email: 'landlord@umutungo.test', password: 'Landlord123!' },
  { role: 'Property Owner', email: 'owner@umutungo.test', password: 'Owner123!' },
  { role: 'Admin', email: 'admin@umutungo.test', password: 'Admin123!' },
];

function roleLabel(role?: AuthRole) { return role === 'Tenant' || role === 'Client' ? 'Client' : role ?? 'your Umutungo account'; }

export function AuthModal({ open, role, onClose, onSuccess }: AuthModalProps) {
  const [method, setMethod] = useState<SignInMethod>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const modalRef = useRef<HTMLElement>(null);
  const googleRoleRef = useRef<AuthRole>('Client');
  const pendingGoogleRoleRef = useRef<AuthRole | null>(null);
  const googlePromptRef = useRef<((requestedRole: AuthRole) => void) | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: PointerEvent) => {
      if (busy || !modalRef.current || modalRef.current.contains(event.target as Node)) return;
      setMethod('choose'); setEmail(''); setPassword(''); setPhone(''); setCode(''); setError(''); setNotice('');
      onClose();
    };
    document.addEventListener('pointerdown', dismissOutside, true);
    return () => document.removeEventListener('pointerdown', dismissOutside, true);
  }, [open, busy, onClose]);

  useEffect(() => {
    const clientId = googleWebClientId();
    const openSignInFallback = (requestedRole: AuthRole = 'Client') => window.dispatchEvent(new CustomEvent('umutungo:request-sign-in', { detail: { role: requestedRole } }));
    const requestGoogleSignIn = (event: Event) => {
      const requestedRole = (event as CustomEvent<{ role?: AuthRole }>).detail?.role ?? 'Client';
      googleRoleRef.current = requestedRole;
      if (!clientId || clientId === 'null') { openSignInFallback(requestedRole); return; }
      if (googlePromptRef.current) googlePromptRef.current(requestedRole);
      else pendingGoogleRoleRef.current = requestedRole;
    };
    window.addEventListener('umutungo:request-google-sign-in', requestGoogleSignIn);
    if (!clientId || clientId === 'null') {
      const timer = window.localStorage.getItem('umutungo-demo-user') ? undefined : window.setTimeout(() => openSignInFallback(), 0);
      return () => { window.clearTimeout(timer); window.removeEventListener('umutungo:request-google-sign-in', requestGoogleSignIn); };
    }
    let cancelled = false;
    const scriptId = 'google-gsi-script';
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    const loadScript = existingScript
      ? existingScript.dataset.loaded === 'true' ? Promise.resolve() : new Promise<void>((resolve, reject) => { existingScript.addEventListener('load', () => resolve(), { once: true }); existingScript.addEventListener('error', () => reject(new Error('Google sign-in could not be loaded.')), { once: true }); })
      : new Promise<void>((resolve, reject) => {
        const script = document.createElement('script'); script.id = scriptId; script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.defer = true;
        script.onload = () => { script.dataset.loaded = 'true'; resolve(); }; script.onerror = () => reject(new Error('Google sign-in could not be loaded.')); document.head.appendChild(script);
      });
    void loadScript.then(() => {
      if (cancelled) return;
      const google = (window as unknown as { google?: GoogleApi }).google;
      if (!google) { openSignInFallback(); return; }
      google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: true,
        callback: async (response) => {
          if (cancelled || !response.credential) return;
          try {
            const authResponse = await fetch('/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: response.credential, role: googleRoleRef.current }) });
            const result = await authResponse.json();
            if (!authResponse.ok) return;
            const accountRole = (result.role ?? googleRoleRef.current) as AuthRole;
            if (result.access_token) window.localStorage.setItem('umutungo-api-token', result.access_token);
            window.localStorage.setItem('umutungo-demo-user', JSON.stringify({ ...result.user, role: accountRole, signedInAt: new Date().toISOString() }));
            onSuccess(accountRole);
          } catch { /* Keep the marketplace available if Google sign-in is unavailable. */ }
        },
      });
      googlePromptRef.current = (requestedRole) => {
        googleRoleRef.current = requestedRole;
        google.accounts.id.prompt((moment) => { if (moment.isNotDisplayed() || moment.isSkippedMoment()) openSignInFallback(requestedRole); });
      };
      const pendingRole = pendingGoogleRoleRef.current;
      pendingGoogleRoleRef.current = null;
      if (pendingRole) googlePromptRef.current(pendingRole);
      else if (!window.localStorage.getItem('umutungo-demo-user')) googlePromptRef.current('Client');
    }).catch(() => { googlePromptRef.current = openSignInFallback; if (!window.localStorage.getItem('umutungo-demo-user')) openSignInFallback(); });
    return () => { cancelled = true; googlePromptRef.current = null; window.removeEventListener('umutungo:request-google-sign-in', requestGoogleSignIn); };
  }, []);

  if (!open || !mounted) return null;

  const reset = () => { setMethod('choose'); setEmail(''); setPassword(''); setPhone(''); setCode(''); setError(''); setNotice(''); setBusy(false); };
  const close = () => { if (!busy) { reset(); onClose(); } };
  const complete = (accountRole: AuthRole) => { window.localStorage.setItem('umutungo-demo-user', JSON.stringify({ role: accountRole, signedInAt: new Date().toISOString() })); reset(); onSuccess(accountRole); };
  const submitEmail = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const account = demoAccounts.find((item) => item.email.toLowerCase() === email.trim().toLowerCase() && item.password === password);
    if (!account) { setError('That email or password is not recognized.'); setBusy(false); return; }
    if (role && (account.role === 'Client' ? 'Client' : account.role) !== (role === 'Tenant' ? 'Client' : role)) { setError(`This account is for ${roleLabel(account.role)}. Choose that role to continue.`); setBusy(false); return; }
    complete(account.role);
  };
  const sendCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (phone.trim().length < 8) { setError('Enter a valid Rwanda phone number.'); return; }
    setBusy(true); setError('');
    try {
      const apiUrl = apiBaseUrl();
      if (apiUrl || process.env.NODE_ENV === 'production') {
        const response = await fetch(`${apiUrl}/api/v1/auth/request-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phone.trim() }) });
        const result = await response.json() as { error?: string; development_code?: string };
        if (!response.ok) { setError(result.error ?? 'Verification code could not be sent.'); return; }
        setNotice(`Verification code sent${result.development_code ? ` — development code: ${result.development_code}` : ''}.`);
      }
      setMethod('otp');
    } catch { setError('The Umutungo API could not be reached.'); } finally { setBusy(false); }
  };
  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const apiUrl = apiBaseUrl();
      if (apiUrl || process.env.NODE_ENV === 'production') {
        const response = await fetch(`${apiUrl}/api/v1/auth/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phone.trim(), code: code.trim() }) });
        const result = await response.json() as { error?: string; access_token?: string };
        if (!response.ok || !result.access_token) { setError(result.error ?? 'That code is not correct.'); return; }
        window.localStorage.setItem('umutungo-api-token', result.access_token);
      } else if (code.trim() !== '111111') { setError('That code is not correct. Use 111111 in this testing environment.'); return; }
      complete(role ?? 'Client');
    } catch { setError('The Umutungo API could not be reached.'); } finally { setBusy(false); }
  };
  const handleGoogleSignIn = async () => {
    const clientId = googleWebClientId();
    if (!clientId || clientId === 'null') { setError('Google sign-in is not configured for this website yet. Please use email or phone sign-in.'); return; }
    setBusy(true); setError('');
    try {
      await new Promise<void>((resolve, reject) => {
        const existing = document.getElementById('google-gsi-script');
        if (existing) {
          const existingScript = existing as HTMLScriptElement;
          if (existingScript.dataset.loaded === 'true') { resolve(); return; }
          existingScript.addEventListener('load', () => resolve(), { once: true }); existingScript.addEventListener('error', () => reject(new Error('Google sign-in could not be loaded.')), { once: true }); return;
        }
        const script = document.createElement('script'); script.id = 'google-gsi-script'; script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.defer = true; script.onload = () => { script.dataset.loaded = 'true'; resolve(); }; script.onerror = () => reject(new Error('Google sign-in could not be loaded.')); document.head.appendChild(script);
      });
      const google = (window as unknown as { google?: GoogleApi }).google;
      if (!google) throw new Error('Google sign-in could not be loaded.');
      // Start the account chooser directly from this user click. The One Tap prompt is
      // browser- and privacy-setting-dependent, so it must not gate an explicit sign-in.
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        callback: async (token) => {
          try {
            if (!token.access_token) { setError(token.error_description ?? 'Google sign-in was cancelled.'); return; }
            const response = await fetch('/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken: token.access_token, role: role ?? 'Client' }) });
            const result = await response.json();
            if (!response.ok) { setError(result.error ?? 'Google sign-in could not be completed.'); return; }
            const accountRole = (result.role ?? role ?? 'Client') as AuthRole;
            if (result.access_token) window.localStorage.setItem('umutungo-api-token', result.access_token);
            window.localStorage.setItem('umutungo-demo-user', JSON.stringify({ ...result.user, role: accountRole, signedInAt: new Date().toISOString() }));
            reset(); onSuccess(accountRole);
          } catch { setError('Google sign-in could not be completed.'); } finally { setBusy(false); }
        },
      });
      client.requestAccessToken({ prompt: 'select_account' });
      // Avoid leaving the interface disabled forever if the browser blocks the popup.
      window.setTimeout(() => setBusy((current) => {
        if (current) setError('Google sign-in did not open. Allow pop-ups for this site, then try again.');
        return false;
      }), 20000);
    } catch (googleError) { setError(googleError instanceof Error ? googleError.message : 'Google sign-in could not be completed.'); setBusy(false); }
  };

  return createPortal(<div className="auth-overlay" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="auth-backdrop" type="button" aria-label="Close sign in" onClick={close} disabled={busy} /><section ref={modalRef} className="auth-modal"><button className="auth-close" type="button" onClick={close} aria-label="Close sign in" disabled={busy}><Icon name="x" size={18} /></button><div className="auth-modal-heading"><span className="auth-eyebrow">Umutungo account</span><h2 id="auth-title">Sign in to continue{role ? ` as ${roleLabel(role)}` : ''}.</h2><p>Keep your properties, messages, applications, and activity in one secure place.</p></div>{busy && <p className="auth-notice" role="status">Working securely…</p>}{method === 'choose' && <div className="auth-choice-view"><button className="auth-google-button" type="button" onClick={handleGoogleSignIn} disabled={busy}><Icon name="google" size={17} /> Continue with Google</button><div className="auth-divider"><span>or use your account</span></div><button className="auth-method-button" type="button" onClick={() => { setError(''); setMethod('email'); }} disabled={busy}><Icon name="bookPen" size={17} /><span><strong>Email and password</strong><small>Sign in with your Umutungo account</small></span><Icon name="arrow" size={15} /></button><button className="auth-method-button" type="button" onClick={() => { setError(''); setMethod('phone'); }} disabled={busy}><Icon name="user" size={17} /><span><strong>Phone number</strong><small>Get a verification code by SMS</small></span><Icon name="arrow" size={15} /></button></div>}{method === 'email' && <form className="auth-form" onSubmit={submitEmail}><button className="auth-form-back" type="button" onClick={() => setMethod('choose')} disabled={busy}><Icon name="arrow" size={14} /> Back to sign-in methods</button><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required disabled={busy} /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required disabled={busy} /></label><button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <Icon name="arrow" size={15} /></button></form>}{method === 'phone' && <form className="auth-form" onSubmit={sendCode}><button className="auth-form-back" type="button" onClick={() => setMethod('choose')} disabled={busy}><Icon name="arrow" size={14} /> Back to sign-in methods</button><label>Rwanda phone number<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+250 7XX XXX XXX" autoComplete="tel" required disabled={busy} /></label><button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send verification code'} <Icon name="arrow" size={15} /></button></form>}{method === 'otp' && <form className="auth-form" onSubmit={verifyCode}><button className="auth-form-back" type="button" onClick={() => setMethod('phone')} disabled={busy}><Icon name="arrow" size={14} /> Change phone number</button><p className="auth-notice">{notice}</p><label>Verification code<input inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} placeholder="111111" maxLength={6} autoComplete="one-time-code" required disabled={busy} /></label><button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify and continue'} <Icon name="check" size={15} /></button></form>}{error && <p className="auth-error" role="alert">{error}</p>}<small className="auth-legal">By continuing, you agree to Umutungo’s terms and privacy policy.</small></section></div>, document.body);
}
