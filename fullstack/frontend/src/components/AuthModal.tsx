'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icons';
import { apiBaseUrl } from '../lib/umutungoApi';
import { usePersistentLanguage } from '../lib/language';
import { t } from '../data/translations';

export type AuthRole = 'Client' | 'Tenant' | 'Commissioner / Komisiyoneri' | 'Landlord' | 'Property Owner' | 'Admin';
type AuthModalProps = { open: boolean; role?: AuthRole; onClose: () => void; onSuccess: (role: AuthRole) => void; hideGoogle?: boolean };
type SignInMethod = 'choose' | 'email' | 'phone' | 'otp';
type GoogleTokenResponse = { access_token?: string; error?: string; error_description?: string };
type GoogleApi = { accounts: {
  oauth2: { initTokenClient: (options: { client_id: string; scope: string; callback: (response: GoogleTokenResponse) => void }) => { requestAccessToken: (options?: { prompt?: string }) => void } }
} };

function googleWebClientId() {
  const configured = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim();
  // A web OAuth client ID is public by design and must be available in the browser.
  return configured && configured !== 'null' ? configured : '947964372839-5mbve9eh4k07qpqkvm0h7cp35tm9rj8o.apps.googleusercontent.com';
}

const demoAccounts: Array<{ role: AuthRole; email: string; password: string }> = [
  { role: 'Client', email: 'client@umutungo.test', password: 'Client123!' },
  { role: 'Commissioner / Komisiyoneri', email: 'commissioner@umutungo.test', password: 'Commissioner123!' },
  { role: 'Landlord', email: 'landlord@umutungo.test', password: 'Landlord123!' },
  { role: 'Property Owner', email: 'owner@umutungo.test', password: 'Owner123!' },
  { role: 'Admin', email: 'admin@umutungo.test', password: 'Admin123!' },
];

function roleLabel(role?: AuthRole) { return role === 'Tenant' || role === 'Client' ? 'Client' : role ?? 'your Umutungo account'; }

function accountRoleFromApi(role?: string, requestedRole?: AuthRole): AuthRole {
  if (role === 'komisiyoneri') return 'Commissioner / Komisiyoneri';
  if (role === 'property_owner') return requestedRole === 'Landlord' ? 'Landlord' : 'Property Owner';
  if (role === 'admin') return 'Admin';
  if (role === 'tenant') return 'Tenant';
  return 'Client';
}

export function AuthModal({ open, role, onClose, onSuccess, hideGoogle = false }: AuthModalProps) {
  const { language } = usePersistentLanguage();
  const copy = (key: string) => t(language, key);
  const [method, setMethod] = useState<SignInMethod>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const modalRef = useRef<HTMLElement>(null);
  const googleRoleRef = useRef<AuthRole>('Client');
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

  if (!open || !mounted) return null;

  const reset = () => { setMethod('choose'); setEmail(''); setPassword(''); setPhone(''); setCode(''); setError(''); setNotice(''); setBusy(false); };
  const close = () => { if (!busy) { reset(); onClose(); } };
  const complete = (accountRole: AuthRole) => { window.localStorage.setItem('umutungo-demo-user', JSON.stringify({ role: accountRole, signedInAt: new Date().toISOString() })); reset(); onSuccess(accountRole); };
  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const account = demoAccounts.find((item) => item.email.toLowerCase() === email.trim().toLowerCase() && item.password === password);
    if (!account) { setError('That email or password is not recognized.'); setBusy(false); return; }
    setError('');
    try {
      const response = await fetch(`${apiBaseUrl()}/api/v1/auth/dev-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: account.email, password: account.password }) });
      const result = await response.json() as { error?: string; access_token?: string; user?: { role?: string } };
      if (response.status === 404) throw new Error('These testing credentials are only enabled on a development backend. On the live site, sign in with your registered account using Google or phone verification.');
      if (!response.ok || !result.access_token) throw new Error(result.error ?? 'A database session could not be created. Use a verified Umutungo account.');
      const sessionRole = accountRoleFromApi(result.user?.role, account.role);
      window.localStorage.setItem('umutungo-api-token', result.access_token);
      complete(sessionRole);
    } catch (caught) {
      setError(caught instanceof TypeError ? 'The Umutungo backend is unreachable. Check your connection and try again.' : caught instanceof Error ? caught.message : 'A database session could not be created.');
      setBusy(false);
    }
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
        const result = await response.json() as { error?: string; access_token?: string; user?: { role?: string } };
        if (!response.ok || !result.access_token) { setError(result.error ?? 'That code is not correct.'); return; }
        window.localStorage.setItem('umutungo-api-token', result.access_token);
        complete(accountRoleFromApi(result.user?.role, role));
        return;
      } else if (code.trim() !== '111111') { setError('That code is not correct. Use 111111 in this testing environment.'); return; }
      complete(role ?? 'Client');
    } catch { setError('The Umutungo API could not be reached.'); } finally { setBusy(false); }
  };
  const handleGoogleSignIn = async () => {
    const clientId = googleWebClientId();
    if (!clientId || clientId === 'null') { setError('Google sign-in is not configured for this website yet. Please use email or phone sign-in.'); return; }
    setBusy(true); setError('');
    googleRoleRef.current = role ?? 'Client';
    try {
      const existingScript = document.getElementById('google-gsi-script') as HTMLScriptElement | null;
      if (existingScript?.dataset.loaded !== 'true') {
        await new Promise<void>((resolve, reject) => {
          if (existingScript) {
            existingScript.addEventListener('load', () => resolve(), { once: true });
            existingScript.addEventListener('error', () => reject(new Error('Google sign-in could not be loaded.')), { once: true });
          } else {
            const script = document.createElement('script');
            script.id = 'google-gsi-script'; script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.defer = true;
            script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
            script.onerror = () => reject(new Error('Google sign-in could not be loaded.'));
            document.head.appendChild(script);
          }
        });
      }
      const google = (window as unknown as { google?: GoogleApi }).google;
      if (!google) throw new Error('Google sign-in could not be loaded.');
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        callback: async (token) => {
          try {
            if (!token.access_token) { setError(token.error_description ?? 'Google sign-in was cancelled.'); return; }
            const requestedRole = googleRoleRef.current;
            const response = await fetch('/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken: token.access_token, role: requestedRole }) });
            const result = await response.json();
            if (!response.ok) { setError(result.error ?? 'Google sign-in could not be completed.'); return; }
            const accountRole = accountRoleFromApi(result.user?.role ?? result.role, requestedRole);
            if (result.access_token) window.localStorage.setItem('umutungo-api-token', result.access_token);
            window.localStorage.setItem('umutungo-demo-user', JSON.stringify({ ...result.user, role: accountRole, signedInAt: new Date().toISOString() }));
            reset(); onSuccess(accountRole);
          } catch { setError('Google sign-in could not be completed.'); } finally { setBusy(false); }
        },
      });
      client.requestAccessToken({ prompt: 'select_account' });
      window.setTimeout(() => setBusy((current) => {
        if (current) setError('Google sign-in did not open. Allow pop-ups for this site, then try again.');
        return false;
      }), 20000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Google sign-in could not be completed.');
      setBusy(false);
    }
  };

  return createPortal(<div className="auth-overlay" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="auth-backdrop" type="button" aria-label="Close sign in" onClick={close} disabled={busy} /><section ref={modalRef} className="auth-modal"><button className="auth-close" type="button" onClick={close} aria-label="Close sign in" disabled={busy}><Icon name="x" size={18} /></button><div className="auth-modal-heading"><span className="auth-eyebrow">Umutungo account</span><h2 id="auth-title">Sign in to continue{role ? ` as ${roleLabel(role)}` : ''}.</h2><p>Keep your properties, messages, applications, and activity in one secure place.</p></div>{busy && <p className="auth-notice" role="status">Working securely…</p>}{method === 'choose' && <div className="auth-choice-view">{!hideGoogle && <><button className="auth-google-button" type="button" onClick={handleGoogleSignIn} disabled={busy}><Icon name="google" size={17} /> Continue with Google</button><div className="auth-divider"><span>Choose a sign-in method</span></div></>}<button className="auth-method-button" type="button" onClick={() => { setError(''); setMethod('email'); }} disabled={busy}><Icon name="bookPen" size={17} /><span><strong>Email and password</strong><small>Sign in with your Umutungo account</small></span><Icon name="arrow" size={15} /></button><button className="auth-method-button" type="button" onClick={() => { setError(''); setMethod('phone'); }} disabled={busy}><Icon name="user" size={17} /><span><strong>Phone number</strong><small>Get a verification code by SMS</small></span><Icon name="arrow" size={15} /></button></div>}{method === 'email' && <form className="auth-form" onSubmit={submitEmail}><button className="auth-form-back" type="button" onClick={() => setMethod('choose')} disabled={busy}><Icon name="arrow" size={14} /> Back to sign-in methods</button><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required disabled={busy} /></label><label>Password<span className="auth-password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required disabled={busy} /><button className="auth-password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)} disabled={busy}><Icon name={showPassword ? 'eyeOff' : 'eye'} size={17} /></button></span></label><button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <Icon name="arrow" size={15} /></button></form>}{method === 'phone' && <form className="auth-form" onSubmit={sendCode}><button className="auth-form-back" type="button" onClick={() => setMethod('choose')} disabled={busy}><Icon name="arrow" size={14} /> Back to sign-in methods</button><label>Rwanda phone number<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+250 7XX XXX XXX" autoComplete="tel" required disabled={busy} /></label><button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send verification code'} <Icon name="arrow" size={15} /></button></form>}{method === 'otp' && <form className="auth-form" onSubmit={verifyCode}><button className="auth-form-back" type="button" onClick={() => setMethod('phone')} disabled={busy}><Icon name="arrow" size={14} /> Change phone number</button><p className="auth-notice">{notice}</p><label>Verification code<input inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} placeholder="111111" maxLength={6} autoComplete="one-time-code" required disabled={busy} /></label><button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify and continue'} <Icon name="check" size={15} /></button></form>}{error && <p className="auth-error" role="alert">{error}</p>}<small className="auth-legal">By continuing, you agree to Umutungo’s terms and privacy policy.</small></section></div>, document.body);
}
