'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icons';
import { apiBaseUrl } from '../lib/umutungoApi';
import { usePersistentLanguage } from '../lib/language';
import { t } from '../data/translations';

export type AuthRole = 'Client' | 'Tenant' | 'Commissioner / Komisiyoneri' | 'Landlord' | 'Property Owner' | 'Admin';
type AuthModalProps = { open: boolean; role?: AuthRole; autoPrompt?: boolean; showGoogle?: boolean; onClose: () => void; onSuccess: (role: AuthRole) => void };
type SignInMethod = 'choose' | 'email' | 'phone' | 'otp';
type GoogleTokenResponse = { access_token?: string; error?: string; error_description?: string };
type GoogleCredentialResponse = { credential?: string };

function authRoleFromGoogleResponse(result: { role?: string; user?: { role?: string } }): AuthRole {
  const role = (result.user?.role ?? result.role ?? 'Client').trim().toLowerCase();
  if (role === 'komisiyoneri' || role === 'commissioner') return 'Commissioner / Komisiyoneri';
  if (role === 'property_owner' || role === 'property owner') return 'Property Owner';
  if (role === 'landlord') return 'Landlord';
  if (role === 'tenant') return 'Tenant';
  if (role === 'admin') return 'Admin';
  return 'Client';
}
type GooglePromptMoment = { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean };
type GoogleApi = { accounts: {
  id: { initialize: (options: { client_id: string; callback: (response: GoogleCredentialResponse) => void; auto_select: boolean; cancel_on_tap_outside: boolean; use_fedcm_for_prompt: boolean }) => void; prompt: (callback?: (moment: GooglePromptMoment) => void) => void };
  oauth2: { initTokenClient: (options: { client_id: string; scope: string; callback: (response: GoogleTokenResponse) => void }) => { requestAccessToken: (options?: { prompt?: string }) => void } }
} };

function googleWebClientId() {
  const configured = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim();
  // A web OAuth client ID is public by design and must be available in the browser.
  return configured && configured !== 'null' ? configured : '947964372839-5mbve9eh4k07qpqkvm0h7cp35tm9rj8o.apps.googleusercontent.com';
}

const demoAccounts: Array<{ role: AuthRole; email: string; password: string }> = [
  { role: 'Client', email: 'client@umutungo.test', password: 'Client123!' },
  { role: 'Tenant', email: 'tenant@umutungo.test', password: 'Tenant123!' },
  { role: 'Commissioner / Komisiyoneri', email: 'commissioner@umutungo.test', password: 'Commissioner123!' },
  { role: 'Landlord', email: 'landlord@umutungo.test', password: 'Landlord123!' },
  { role: 'Property Owner', email: 'owner@umutungo.test', password: 'Owner123!' },
  { role: 'Admin', email: 'admin@umutungo.test', password: 'Admin123!' },
];

function roleLabel(role?: AuthRole) { return role === 'Tenant' || role === 'Client' ? 'Client' : role ?? 'your Umutungo account'; }

export function AuthModal({ open, role, autoPrompt = false, showGoogle = true, onClose, onSuccess }: AuthModalProps) {
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
  const pendingGoogleRoleRef = useRef<AuthRole | null>(null);
  const googlePromptRef = useRef<((requestedRole: AuthRole, fallback?: boolean) => void) | null>(null);

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
    googleRoleRef.current = role ?? 'Client';
    const clientId = googleWebClientId();
    const openSignInFallback = (requestedRole: AuthRole = 'Client') => window.dispatchEvent(new CustomEvent('umutungo:request-sign-in', { detail: { role: requestedRole, fallback: true } }));
    const requestGoogleSignIn = (event: Event) => {
      const requestedRole = (event as CustomEvent<{ role?: AuthRole }>).detail?.role ?? 'Client';
      googleRoleRef.current = requestedRole;
      if (!clientId || clientId === 'null') { openSignInFallback(requestedRole); return; }
      if (googlePromptRef.current) googlePromptRef.current(requestedRole, true);
      else pendingGoogleRoleRef.current = requestedRole;
    };
    window.addEventListener('umutungo:request-google-sign-in', requestGoogleSignIn);
    if (!clientId || clientId === 'null') {
      return () => { window.removeEventListener('umutungo:request-google-sign-in', requestGoogleSignIn); };
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
            const requestedRole = googleRoleRef.current;
            const authResponse = await fetch('/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: response.credential, role: requestedRole }) });
            const result = await authResponse.json();
            if (!authResponse.ok) { setError(result.error ?? 'Google sign-in could not be completed.'); return; }
            const accountRole = authRoleFromGoogleResponse(result);
            if (result.access_token) window.localStorage.setItem('umutungo-api-token', result.access_token);
            window.localStorage.setItem('umutungo-demo-user', JSON.stringify({ ...result.user, role: accountRole, signedInAt: new Date().toISOString() }));
            onSuccess(accountRole);
          } catch { setError('Google sign-in could not reach the Umutungo service. Check the API connection and try again.'); }
        },
      });
      googlePromptRef.current = (requestedRole, fallback = true) => {
        googleRoleRef.current = requestedRole;
        google.accounts.id.prompt((moment) => { if (fallback && (moment.isNotDisplayed() || moment.isSkippedMoment())) openSignInFallback(requestedRole); });
      };
      const pendingRole = pendingGoogleRoleRef.current;
      pendingGoogleRoleRef.current = null;
      if (pendingRole) googlePromptRef.current(pendingRole, true);
      else if (autoPrompt && !window.localStorage.getItem('umutungo-demo-user') && !window.sessionStorage.getItem('umutungo-google-one-tap-shown')) {
        window.sessionStorage.setItem('umutungo-google-one-tap-shown', '1');
        googlePromptRef.current('Client', false);
      }
    }).catch(() => { googlePromptRef.current = openSignInFallback; });
    return () => { cancelled = true; googlePromptRef.current = null; window.removeEventListener('umutungo:request-google-sign-in', requestGoogleSignIn); };
  }, [role, autoPrompt]);

  if (!open || !mounted) return null;

  const reset = () => { setMethod('choose'); setEmail(''); setPassword(''); setShowPassword(false); setPhone(''); setCode(''); setError(''); setNotice(''); setBusy(false); };
  const close = () => { if (!busy) { reset(); onClose(); } };
  const complete = (accountRole: AuthRole) => { window.localStorage.setItem('umutungo-demo-user', JSON.stringify({ role: accountRole, signedInAt: new Date().toISOString() })); reset(); onSuccess(accountRole); };
  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const account = demoAccounts.find((item) => item.email.toLowerCase() === email.trim().toLowerCase() && item.password === password);
    if (!account) { setError('That email or password is not recognized.'); setBusy(false); return; }
    if (role && role !== 'Client' && (account.role === 'Client' ? 'Client' : account.role) !== (role === 'Tenant' ? 'Client' : role)) { setError(`This account is for ${roleLabel(account.role)}. Choose that role to continue.`); setBusy(false); return; }
    if (account.role === 'Admin') {
      try {
        const response = await fetch(`${apiBaseUrl()}/api/v1/auth/dev-admin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: account.email, password: account.password }) });
        const result = await response.json().catch(() => ({})) as { user?: Record<string, unknown>; access_token?: string; error?: string };
        if (!response.ok || !result.user || !result.access_token) throw new Error(result.error ?? 'Admin sign-in requires the development API or a provisioned Admin Google account.');
        window.localStorage.setItem('umutungo-api-token', result.access_token);
        window.localStorage.setItem('umutungo-demo-user', JSON.stringify({ ...result.user, role: 'Admin', signedInAt: new Date().toISOString() }));
        reset(); onSuccess('Admin');
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Admin sign-in could not reach the Umutungo API.');
      } finally { setBusy(false); }
      return;
    }
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
            const accountRole = authRoleFromGoogleResponse(result);
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

  return createPortal(<div className="auth-overlay" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="auth-backdrop" type="button" aria-label="Close sign in" onClick={close} disabled={busy} /><section ref={modalRef} className="auth-modal"><button className="auth-close" type="button" onClick={close} aria-label="Close sign in" disabled={busy}><Icon name="x" size={18} /></button><div className="auth-modal-heading"><span className="auth-eyebrow">Umutungo account</span><h2 id="auth-title">Sign in to continue{role ? ` as ${roleLabel(role)}` : ''}.</h2><p>Keep your properties, messages, applications, and activity in one secure place.</p></div>{busy && <p className="auth-notice" role="status">Working securely…</p>}{method === 'choose' && <div className="auth-choice-view">{showGoogle && <button className="auth-google-button" type="button" onClick={handleGoogleSignIn} disabled={busy}><Icon name="google" size={17} /> Continue with Google</button>}{showGoogle && <div className="auth-divider"><span>Choose a sign-in method</span></div>}<button className="auth-method-button" type="button" onClick={() => { setError(''); setMethod('email'); }} disabled={busy}><Icon name="bookPen" size={17} /><span><strong>Email and password</strong><small>Sign in with your Umutungo account</small></span><Icon name="arrow" size={15} /></button><button className="auth-method-button" type="button" onClick={() => { setError(''); setMethod('phone'); }} disabled={busy}><Icon name="user" size={17} /><span><strong>Phone number</strong><small>Get a verification code by SMS</small></span><Icon name="arrow" size={15} /></button></div>}{method === 'email' && <form className="auth-form" onSubmit={submitEmail}><button className="auth-form-back" type="button" onClick={() => setMethod('choose')} disabled={busy}><Icon name="arrow" size={14} /> Back to sign-in methods</button><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required disabled={busy} /></label><label>Password<span className="auth-password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required disabled={busy} /><button className="auth-password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} disabled={busy}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.6" />{showPassword && <path d="m4 4 16 16" />}</svg></button></span></label><button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <Icon name="arrow" size={15} /></button></form>}{method === 'phone' && <form className="auth-form" onSubmit={sendCode}><button className="auth-form-back" type="button" onClick={() => setMethod('choose')} disabled={busy}><Icon name="arrow" size={14} /> Back to sign-in methods</button><label>Rwanda phone number<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+250 7XX XXX XXX" autoComplete="tel" required disabled={busy} /></label><button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send verification code'} <Icon name="arrow" size={15} /></button></form>}{method === 'otp' && <form className="auth-form" onSubmit={verifyCode}><button className="auth-form-back" type="button" onClick={() => setMethod('phone')} disabled={busy}><Icon name="arrow" size={14} /> Change phone number</button><p className="auth-notice">{notice}</p><label>Verification code<input inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} placeholder="111111" maxLength={6} autoComplete="one-time-code" required disabled={busy} /></label><button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify and continue'} <Icon name="check" size={15} /></button></form>}{error && <p className="auth-error" role="alert">{error}</p>}<small className="auth-legal">By continuing, you agree to Umutungo’s terms and privacy policy.</small></section></div>, document.body);
}
