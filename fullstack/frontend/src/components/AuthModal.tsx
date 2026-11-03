'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icons';
import { apiBaseUrl } from '../lib/umutungoApi';
import { usePersistentLanguage } from '../lib/language';
import { t } from '../data/translations';

export type AuthRole = 'Client' | 'Tenant' | 'Commissioner / Komisiyoneri' | 'Landlord' | 'Property Owner' | 'Admin';
type AuthModalProps = { open: boolean; role?: AuthRole; onClose: () => void; onSuccess: (role: AuthRole) => void; hideGoogle?: boolean };
type SignInMethod = 'choose' | 'role-options' | 'email' | 'phone' | 'otp' | 'signup';
type GoogleTokenResponse = { access_token?: string; error?: string; error_description?: string };
type GoogleApi = { accounts: {
  oauth2: { initTokenClient: (options: { client_id: string; scope: string; callback: (response: GoogleTokenResponse) => void }) => { requestAccessToken: (options?: { prompt?: string }) => void } }
} };
let hostedAuthBackendWarmupStarted = false;

function googleWebClientId() {
  const configured = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim();
  // A web OAuth client ID is public by design and must be available in the browser.
  return configured && configured !== 'null' ? configured : '947964372839-5mbve9eh4k07qpqkvm0h7cp35tm9rj8o.apps.googleusercontent.com';
}

const demoAccounts: Array<{ role: AuthRole; email: string; password: string }> = [
  { role: 'Tenant', email: 'tenant@umutungo.test', password: 'Tenant123!' },
  { role: 'Client', email: 'client@umutungo.test', password: 'Client123!' },
  { role: 'Commissioner / Komisiyoneri', email: 'commissioner@umutungo.test', password: 'Commissioner123!' },
  { role: 'Landlord', email: 'landlord@umutungo.test', password: 'Landlord123!' },
  { role: 'Property Owner', email: 'owner@umutungo.test', password: 'Owner123!' },
  { role: 'Admin', email: 'admin@umutungo.test', password: 'Admin123!' },
];

function roleLabel(role?: AuthRole) { return role === 'Tenant' || role === 'Client' ? 'Client' : role ?? 'your Umutungo account'; }
function workspaceKindForRole(role: AuthRole) { return role === 'Landlord' ? 'landlord' : role === 'Property Owner' ? 'property_owner' : ''; }

async function developmentListingFixtures() {
  const { testingListings } = await import('../data/testingListings');
  const categoryNames: Record<string, string> = { houses: 'house', apartments: 'apartment', land: 'land', commercial: 'commercial', offices: 'office', hospitality: 'hospitality', vehicles: 'vehicle', 'car-parts': 'car-parts', furniture: 'furniture', appliances: 'appliance', equipment: 'equipment', other: 'other' };
  return testingListings.map((property) => ({
    fixture_id: property.id,
    category: categoryNames[property.categorySlug] ?? 'other',
    title: property.title,
    description: (property.description ?? '').replace(/^Demo\s+/i, ''),
    price: Number(property.price.replace(/[^0-9.]/g, '')) || 0,
    province: 'Rwanda',
    district: property.location.split(',')[0].trim(),
    sector: '',
    transaction_type: property.type === 'Hospitality' ? 'book' : property.availableFor === 'rent' ? 'rent_out' : 'sell',
    images: (property.images?.length ? property.images : [property.image]).map((imagePath) => new URL(imagePath, window.location.origin).toString()),
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    area: property.area,
  }));
}

function accountRoleFromApi(role?: string, workspaceKind?: string): AuthRole {
  if (role === 'komisiyoneri') return 'Commissioner / Komisiyoneri';
  if (role === 'property_owner') return workspaceKind === 'landlord' ? 'Landlord' : 'Property Owner';
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
  const [signupName, setSignupName] = useState('');
  const [signupRole, setSignupRole] = useState<AuthRole>(role ?? 'Client');
  const [isRegistering, setIsRegistering] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const modalRef = useRef<HTMLElement>(null);
  const googleRoleRef = useRef<AuthRole>('Client');
  const googleSignInRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setSignupRole(role ?? 'Client'); }, [role]);

  useEffect(() => {
    if (!open || typeof window === 'undefined' || hostedAuthBackendWarmupStarted) return;
    if (['localhost', '127.0.0.1'].includes(window.location.hostname)) return;
    hostedAuthBackendWarmupStarted = true;
    void fetch('/api/readyz', { cache: 'no-store' }).then((response) => {
      if (!response.ok) hostedAuthBackendWarmupStarted = false;
    }).catch(() => { hostedAuthBackendWarmupStarted = false; });
  }, [open]);


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

  const reset = () => { setMethod('choose'); setEmail(''); setPassword(''); setPhone(''); setSignupName(''); setSignupRole(role ?? 'Client'); setCode(''); setIsRegistering(false); setError(''); setNotice(''); setBusy(false); };
  const close = () => { if (!busy) { reset(); onClose(); } };
  const complete = (accountRole: AuthRole, testingAccount = false, accountName?: string) => { window.localStorage.setItem('umutungo-demo-user', JSON.stringify({ role: accountRole, testingAccount, testingFirstName: accountName?.trim().split(/\s+/)[0] || 'Umutungo', signedInAt: new Date().toISOString() })); reset(); onSuccess(accountRole); };
  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const account = demoAccounts.find((item) => item.email.toLowerCase() === email.trim().toLowerCase() && item.password === password);
    if (!account) { setError('That email or password is not recognized.'); setBusy(false); return; }
    setError('');
    try {
      const ownerDemo = ['Landlord', 'Property Owner'].includes(account.role);
      const fixtureSeedKey = `umutungo-demo-listings-seeded:${account.email}`;
      const shouldSeedFixtures = ownerDemo && window.localStorage.getItem(fixtureSeedKey) !== 'true';
      const loginPayload = { email: account.email, password: account.password, ...(shouldSeedFixtures ? { listings: await developmentListingFixtures() } : {}) };
      let response = await fetch(`${apiBaseUrl()}/api/v1/auth/dev-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(loginPayload) });
      let result = await response.json() as { error?: string; access_token?: string; user?: { role?: string; workspace_kind?: string; name?: string } };
      if (account.role === 'Tenant' && response.status === 401) {
        response = await fetch(`${apiBaseUrl()}/api/v1/auth/dev-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'client@umutungo.test', password: 'Client123!' }) });
        result = await response.json() as { error?: string; access_token?: string; user?: { role?: string; workspace_kind?: string; name?: string } };
      }
      if (response.status === 404) throw new Error('These testing credentials are only enabled on a development backend. On the live site, sign in with your registered account using Google or phone verification.');
      if (!response.ok || !result.access_token) throw new Error(result.error ?? 'A database session could not be created. Use a verified Umutungo account.');
      const sessionRole = account.role === 'Tenant' ? 'Tenant' : accountRoleFromApi(result.user?.role, result.user?.workspace_kind);
      if (shouldSeedFixtures) window.localStorage.setItem(fixtureSeedKey, 'true');
      window.localStorage.setItem('umutungo-api-token', result.access_token);
      window.dispatchEvent(new Event('umutungo:listings-changed'));
      complete(sessionRole, true, result.user?.name);
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
        setNotice(`Verification code sent${result.development_code ? ` â€” development code: ${result.development_code}` : ''}.`);
      }
      setMethod('otp');
    } catch { setError('The Umutungo API could not be reached.'); } finally { setBusy(false); }
  };
  const submitRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signupName.trim()) { setError('Enter your full name.'); return; }
    if (phone.trim().length < 8) { setError('Enter a valid Rwanda phone number.'); return; }
    setBusy(true); setError('');
    const workspaceKind = signupRole === 'Landlord' ? 'landlord' : signupRole === 'Property Owner' ? 'property_owner' : '';
    const apiRole = signupRole === 'Commissioner / Komisiyoneri' ? 'komisiyoneri' : ['Landlord', 'Property Owner'].includes(signupRole) ? 'property_owner' : signupRole.toLowerCase();
    try {
      const apiUrl = apiBaseUrl();
      if (apiUrl || process.env.NODE_ENV === 'production') {
        const response = await fetch(`${apiUrl}/api/v1/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: signupName.trim(), phone: phone.trim(), email: email.trim(), role: apiRole, workspace_kind: workspaceKind }) });
        const result = await response.json() as { error?: string; development_code?: string };
        if (!response.ok) { setError(result.error ?? 'Your account could not be created.'); return; }
        setNotice(result.development_code ? `Verification code sent. Development code: ${result.development_code}` : 'Verification code sent to your phone.');
      } else {
        setNotice('Testing mode: enter 111111 to verify your phone number.');
      }
      setIsRegistering(true); setCode(''); setMethod('otp');
    } catch { setError('The Umutungo API could not be reached.'); } finally { setBusy(false); }
  };
  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const apiUrl = apiBaseUrl();
      if (apiUrl || process.env.NODE_ENV === 'production') {
        const response = await fetch(`${apiUrl}/api/v1/auth/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phone.trim(), code: code.trim() }) });
        const result = await response.json() as { error?: string; access_token?: string; user?: { role?: string; workspace_kind?: string; name?: string; email?: string; phone?: string } };
        if (!response.ok || !result.access_token) { setError(result.error ?? 'That code is not correct.'); return; }
        window.localStorage.setItem('umutungo-api-token', result.access_token);
        if (isRegistering) {
          const accountRole = accountRoleFromApi(result.user?.role, result.user?.workspace_kind) === 'Client' ? signupRole : accountRoleFromApi(result.user?.role, result.user?.workspace_kind);
          window.localStorage.setItem('umutungo-demo-user', JSON.stringify({ ...result.user, name: result.user?.name ?? signupName.trim(), email: result.user?.email ?? email.trim(), phone: result.user?.phone ?? phone.trim(), role: accountRole, workspace_kind: workspaceKindForRole(accountRole), signedInAt: new Date().toISOString() }));
          window.dispatchEvent(new Event('umutungo:auth-changed'));
          reset(); onSuccess(accountRole); return;
        }
        complete(accountRoleFromApi(result.user?.role, result.user?.workspace_kind));
        return;
      } else if (code.trim() !== '111111') { setError('That code is not correct. Use 111111 in this testing environment.'); return; }
      if (isRegistering) {
        window.localStorage.setItem('umutungo-demo-user', JSON.stringify({ role: signupRole, name: signupName.trim(), email: email.trim(), phone: phone.trim(), signedInAt: new Date().toISOString() }));
        window.dispatchEvent(new Event('umutungo:auth-changed'));
        reset(); onSuccess(signupRole);
      } else complete(role ?? 'Client');
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
            const accountRole = accountRoleFromApi(result.user?.role ?? result.role, result.user?.workspace_kind);
            if (result.access_token) window.localStorage.setItem('umutungo-api-token', result.access_token);
            window.localStorage.setItem('umutungo-demo-user', JSON.stringify({ ...result.user, role: accountRole, signedInAt: new Date().toISOString() }));
            reset(); onSuccess(accountRole);
          } catch { setError('Google sign-in could not be completed.'); } finally { setBusy(false); }
        },
      });
      client.requestAccessToken({ prompt: 'select_account' });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Google sign-in could not be completed.');
      setBusy(false);
    }
  };
  googleSignInRef.current = handleGoogleSignIn;

  return createPortal(<div className="auth-overlay" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="auth-backdrop" type="button" aria-label="Close sign in" onClick={close} disabled={busy} /><section ref={modalRef} className="auth-modal"><button className="auth-close" type="button" onClick={close} aria-label="Close sign in" disabled={busy}><Icon name="x" size={18} /></button><div className="auth-modal-heading"><span className="auth-eyebrow">Sign in to get more access to the platform</span><h2 id="auth-title">{method === 'signup' ? 'Create your account.' : 'Sign in to continue.'}</h2><p>Keep your properties, messages, applications, and activity in one secure place.</p></div>{busy && <p className="auth-notice" role="status">Working securelyâ€¦</p>}{method === 'role-options' && <div className="auth-choice-view auth-role-options"><button className="auth-email-switch" type="button" onClick={() => { setError(''); setMethod('email'); }} disabled={busy}><Icon name="bookPen" size={16} /> Sign in with email</button><button className="auth-method-button" type="button" onClick={() => { setError(''); setMethod('phone'); }} disabled={busy}><Icon name="user" size={17} /><span><strong>Sign in with phone number</strong><small>Get a verification code by SMS</small></span><Icon name="arrow" size={15} /></button>{!hideGoogle && <><div className="auth-divider"><span>Or continue with</span></div><button className="auth-google-button" type="button" onClick={handleGoogleSignIn} disabled={busy}><Icon name="google" size={17} /> Sign in with Google</button></>}</div>}{method === 'choose' && <div className="auth-choice-view">{!hideGoogle && <><button className="auth-google-button" type="button" onClick={handleGoogleSignIn} disabled={busy}><Icon name="google" size={17} /> Continue with Google</button><div className="auth-divider"><span>Choose a sign-in method</span></div></>}<button className="auth-method-button" type="button" onClick={() => { setError(''); setMethod('email'); }} disabled={busy}><Icon name="bookPen" size={17} /><span><strong>Email and password</strong><small>Sign in with your Umutungo account</small></span><Icon name="arrow" size={15} /></button><button className="auth-method-button" type="button" onClick={() => { setError(''); setMethod('phone'); }} disabled={busy}><Icon name="user" size={17} /><span><strong>Phone number</strong><small>Get a verification code by SMS</small></span><Icon name="arrow" size={15} /></button></div>}{method === 'email' && <form className="auth-form" onSubmit={submitEmail}><button className="auth-form-back" type="button" onClick={() => setMethod('choose')} disabled={busy}><Icon name="arrow" size={14} /> Back to sign-in methods</button><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required disabled={busy} /></label><label>Password<span className="auth-password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required disabled={busy} /><button className="auth-password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)} disabled={busy}><Icon name={showPassword ? 'eyeOff' : 'eye'} size={17} /></button></span></label><button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Signing inâ€¦' : 'Sign in'} <Icon name="arrow" size={15} /></button></form>}{method === 'phone' && <><form className="auth-form" onSubmit={sendCode}><button className="auth-form-back" type="button" onClick={() => setMethod('choose')} disabled={busy}><Icon name="arrow" size={14} /> Back to sign-in methods</button><label>Rwanda phone number<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+250 7XX XXX XXX" autoComplete="tel" required disabled={busy} /></label><button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Sendingâ€¦' : 'Send verification code'} <Icon name="arrow" size={15} /></button></form>{!hideGoogle && <><div className="auth-divider"><span>Or continue with</span></div><button className="auth-google-button" type="button" onClick={handleGoogleSignIn} disabled={busy}><Icon name="google" size={17} /> Sign in with Google</button></>}</>}{method === 'signup' && <form className="auth-form" onSubmit={submitRegistration}><button className="auth-form-back" type="button" onClick={() => { setError(''); setMethod('choose'); }} disabled={busy}><Icon name="arrow" size={14} /> Back to sign in</button><label>Full name<input type="text" value={signupName} onChange={(event) => setSignupName(event.target.value)} placeholder="Your full name" autoComplete="name" required disabled={busy} /></label><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required disabled={busy} /></label><label>Rwanda phone number<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+250 7XX XXX XXX" autoComplete="tel" required disabled={busy} /></label><label>I am a:<select value={signupRole} onChange={(event) => setSignupRole(event.target.value as AuthRole)} disabled={busy}><option value="Client">Client</option><option value="Tenant">Tenant</option><option value="Commissioner / Komisiyoneri">Komisiyoneri</option><option value="Landlord">Landlord</option><option value="Property Owner">Property Owner</option></select></label><button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Creating account...' : 'Create account'} <Icon name="arrow" size={15} /></button></form>}{method === 'otp' && <form className="auth-form" onSubmit={verifyCode}><button className="auth-form-back" type="button" onClick={() => { setMethod(isRegistering ? 'signup' : 'phone'); setError(''); }} disabled={busy}><Icon name="arrow" size={14} /> {isRegistering ? 'Back to account details' : 'Change phone number'}</button><p className="auth-notice">{notice}</p><label>Verification code<input inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} placeholder="111111" maxLength={6} autoComplete="one-time-code" required disabled={busy} /></label><button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Verifying...' : 'Verify and continue'} <Icon name="check" size={15} /></button></form>}{error && <p className="auth-error" role="alert">{error}</p>}<p className="auth-signup-prompt">No account? <button type="button" onClick={() => { setError(''); setSignupRole(role ?? 'Client'); setMethod('signup'); }} disabled={busy}>Sign up</button></p><small className="auth-legal">By continuing, you agree to Umutungoâ€™s terms and privacy policy.</small></section></div>, document.body);
}



