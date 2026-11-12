import type { AuthRole } from '../components/AuthModal';
import { dashboardPathForAccountRole } from './accountRouting';

// Every "please sign in" in the app goes to the full sign-in page at
// /sign-in, which returns the person to where they were afterwards.

/** Only same-site paths are allowed as a return target. */
export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\') || value.startsWith('/sign-in')) return null;
  return value;
}

export function signInHref(role?: AuthRole, next?: string, reason?: "expired") {
  const params = new URLSearchParams();
  if (role) params.set("role", role);
  if (reason) params.set("reason", reason);
  const target = safeNextPath(next ?? (typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}${window.location.hash}` : undefined));
  if (target && target !== '/') params.set('next', target);
  const query = params.toString();
  return `/sign-in${query ? `?${query}` : ''}`;
}

export function goToSignIn(role?: AuthRole, next?: string, reason?: "expired") {
  window.location.assign(signInHref(role, next, reason));
}

const workspacePaths = ['/landlord', '/property-owner', '/commissioner', '/tenant', '/admin'];

/**
 * Where to go after signing in: back to the page that asked, unless that
 * page is another role's workspace, in which case the person's own one.
 */
export function destinationAfterSignIn(role: AuthRole, next: string | null) {
  const own = role === 'Client' || role === 'Tenant' ? '/' : dashboardPathForAccountRole(role);
  if (!next) return own;
  const workspace = workspacePaths.find((path) => next === path || next.startsWith(`${path}?`) || next.startsWith(`${path}/`));
  if (workspace && workspace !== dashboardPathForAccountRole(role)) return dashboardPathForAccountRole(role);
  return next;
}

const roles: AuthRole[] = ['Client', 'Tenant', 'Commissioner / Komisiyoneri', 'Landlord', 'Property Owner', 'Admin'];

export function roleFromQuery(value: string | null): AuthRole | undefined {
  if (!value) return undefined;
  if (value === 'Komisiyoneri' || value === 'Commissioner') return 'Commissioner / Komisiyoneri';
  return roles.find((role) => role === value);
}
