'use client';

import { FormEvent, useState } from 'react';
import { Icon } from './Icons';

export type AuthRole = 'Tenant' | 'Commissioner / Komisiyoneri' | 'Landlord' | 'Admin';

type AuthModalProps = { open: boolean; role?: AuthRole; onClose: () => void; onSuccess: (role: AuthRole) => void };
type SignInMethod = 'choose' | 'email' | 'phone' | 'otp';
type GoogleTokenResponse = { access_token?: string; error?: string; error_description?: string };
type GoogleApi = { accounts: { oauth2: { initTokenClient: (options: { client_id: string; scope: string; callback: (response: GoogleTokenResponse) => void }) => { requestAccessToken: (options?: { prompt?: string }) => void } } } };

const demoAccounts: Array<{ role: AuthRole; email: string; password: string }> = [
  { role: 'Tenant', email: 'tenant@umutungo.test', password: 'Tenant123!' },
  { role: 'Commissioner / Komisiyoneri', email: 'commissioner@umutungo.test', password: 'Commissioner123!' },
  { role: 'Landlord', email: 'landlord@umutungo.test', password: 'Landlord123!' },
  { role: 'Admin', email: 'admin@umutungo.test', password: 'Admin123!' },
];

function roleLabel(role?: AuthRole) {
  if (role === 'Tenant') return 'Client';
  if (role === 'Commissioner / Komisiyoneri') return 'Komisiyoneri';
  if (role === 'Landlord') return 'Property Owner';
  return role ?? 'your Umutungo account';
}

export function AuthModal({ open, role, onClose, onSuccess }: AuthModalProps) {
  const [method, setMethod] = useState<SignInMethod>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  if (!open) return null;

  const reset = () => { setMethod('choose'); setEmail(''); setPassword(''); setPhone(''); setCode(''); setError(''); setNotice(''); };
  const close = () => { reset(); onClose(); };
  const complete = (accountRole: AuthRole) => {
    window.localStorage.setItem('umutungo-demo-user', JSON.stringify({ role: accountRole, signedInAt: new Date().toISOString() }));
    reset();
    onSuccess(accountRole);
  };

  const submitEmail = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const account = demoAccounts.find((item) => item.email.toLowerCase() === email.trim().toLowerCase() && item.password === password);
    if (!account) { setError('That email or password is not recognized.'); return; }
    if (role && account.role !== role) { setError(`This account is for ${roleLabel(account.role)}. Choose that role to continue.`); return; }
    complete(account.role);
  };

  const sendCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (phone.trim().length < 8) { setError('Enter a valid Rwanda phone number.'); return; }
    setError('');
    const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
    if (apiUrl) {
      try {
        const response = await fetch(`${apiUrl}/api/v1/auth/request-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phone.trim() }) });
        const result = await response.json() as { error?: string; development_code?: string };
        if (!response.ok) { setError(result.error ?? 'Verification code could not be sent.'); return; }
        setNotice(`Verification code sent${result.development_code ? ` — development code: ${result.development_code}` : ''}.`);
      } catch { setError('The Umutungo API could not be reached.'); return; }
    } else setNotice('Verification code sent. For development, use 111111.');
    setMethod('otp');
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
    if (apiUrl) {
      try {
        const response = await fetch(`${apiUrl}/api/v1/auth/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phone.trim(), code: code.trim() }) });
        const result = await response.json() as { error?: string; access_token?: string };
        if (!response.ok || !result.access_token) { setError(result.error ?? 'That code is not correct.'); return; }
        window.localStorage.setItem('umutungo-api-token', result.access_token);
        complete(role ?? 'Tenant');
        return;
      } catch { setError('The Umutungo API could not be reached.'); return; }
    }
    if (code.trim() !== '111111') { setError('That code is not correct. Use 111111 in this testing environment.'); return; }
    complete(role ?? 'Tenant');
  };

  const handleGoogleSignIn = async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || clientId === 'null') { setError('Google sign-in is not configured yet.'); return; }
    setError('');
    try {
      await new Promise<void>((resolve, reject) => {
        const existing = document.getElementById('google-gsi-script');
        if (existing) { resolve(); return; }
        const script = document.createElement('script');
        script.id = 'google-gsi-script';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Google sign-in could not be loaded.'));
        document.head.appendChild(script);
      });
      const google = (window as unknown as { google?: GoogleApi }).google;
      if (!google) throw new Error('Google sign-in could not be loaded.');
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        callback: async (token) => {
          if (!token.access_token) { setError(token.error_description ?? 'Google sign-in was cancelled.'); return; }
          const response = await fetch('/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken: token.access_token, role: role ?? 'Tenant' }) });
          const result = await response.json();
          if (!response.ok) { setError(result.error ?? 'Google sign-in could not be completed.'); return; }
          const accountRole = (result.role ?? role ?? 'Tenant') as AuthRole;
          window.localStorage.setItem('umutungo-demo-user', JSON.stringify({ ...result.user, role: accountRole, signedInAt: new Date().toISOString() }));
          reset();
          onSuccess(accountRole);
        },
      });
      client.requestAccessToken({ prompt: 'select_account' });
    } catch (googleError) {
      setError(googleError instanceof Error ? googleError.message : 'Google sign-in could not be completed.');
    }
  };

  return <div className="auth-overlay" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="auth-backdrop" type="button" aria-label="Close sign in" onClick={close} /><section className="auth-modal"><button className="auth-close" type="button" onClick={close} aria-label="Close sign in"><Icon name="x" size={18} /></button><div className="auth-modal-heading"><span className="auth-eyebrow">Umutungo account</span><h2 id="auth-title">Sign in to continue{role ? ` as ${roleLabel(role)}` : ''}.</h2><p>Keep your properties, messages, applications, and activity in one secure place.</p></div>{method === 'choose' && <div className="auth-choice-view"><button className="auth-google-button" type="button" onClick={handleGoogleSignIn}><svg className="auth-google-mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.23c0-.79-.07-1.55-.22-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42Z" /><path fill="#34A853" d="M12 21.6c2.63 0 4.84-.87 6.45-2.35l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.55 0-4.71-1.72-5.49-4.03H3.27v2.53A9.74 9.74 0 0 0 12 21.6Z" /><path fill="#FBBC05" d="M6.51 13.69A5.86 5.86 0 0 1 6.2 12c0-.59.11-1.16.31-1.69V7.78H3.27A9.72 9.72 0 0 0 2.24 12c0 1.57.38 3.05 1.03 4.22l3.24-2.53Z" /><path fill="#EA4335" d="M12 6.28c1.43 0 2.72.49 3.73 1.46l2.8-2.8C16.84 3.38 14.63 2.4 12 2.4a9.74 9.74 0 0 0-8.73 5.38l3.24 2.53c.78-2.31 2.94-4.03 5.49-4.03Z" /></svg><span>Continue with Google</span></button><div className="auth-divider"><span>or use your account</span></div><button className="auth-method-button" type="button" onClick={() => { setError(''); setMethod('email'); }}><Icon name="bookPen" size={17} /><span><strong>Email and password</strong><small>Sign in with your Umutungo account</small></span><Icon name="arrow" size={15} /></button><button className="auth-method-button" type="button" onClick={() => { setError(''); setMethod('phone'); }}><Icon name="user" size={17} /><span><strong>Phone number</strong><small>Get a verification code by SMS</small></span><Icon name="arrow" size={15} /></button></div>}{method === 'email' && <form className="auth-form" onSubmit={submitEmail}><button className="auth-form-back" type="button" onClick={() => setMethod('choose')}><Icon name="arrow" size={14} /> Back to sign-in methods</button><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required /></label><button className="auth-submit" type="submit">Sign in <Icon name="arrow" size={15} /></button></form>}{method === 'phone' && <form className="auth-form" onSubmit={sendCode}><button className="auth-form-back" type="button" onClick={() => setMethod('choose')}><Icon name="arrow" size={14} /> Back to sign-in methods</button><label>Rwanda phone number<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+250 7XX XXX XXX" autoComplete="tel" required /></label><button className="auth-submit" type="submit">Send verification code <Icon name="arrow" size={15} /></button></form>}{method === 'otp' && <form className="auth-form" onSubmit={verifyCode}><button className="auth-form-back" type="button" onClick={() => setMethod('phone')}><Icon name="arrow" size={14} /> Change phone number</button><p className="auth-notice">{notice}</p><label>Verification code<input inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} placeholder="11111" maxLength={5} autoComplete="one-time-code" required /></label><button className="auth-submit" type="submit">Verify and continue <Icon name="check" size={15} /></button></form>}{error && <p className="auth-error" role="alert">{error}</p>}<small className="auth-legal">By continuing, you agree to Umutungo’s terms and privacy policy.</small></section></div>;
}
