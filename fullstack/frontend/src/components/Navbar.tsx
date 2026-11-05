import { ReactElement, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Language, t } from '../data/translations';
import { Icon, type IconName } from './Icons';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { AuthModal, AuthRole } from './AuthModal';
import { removeFavorite, umutungoApi, type ApiNotification, type FavoriteItem } from '../lib/umutungoApi';

type NavbarProps = {
  darkMode: boolean;
  onToggleTheme: () => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
  isSignedIn?: boolean;
  onSignIn?: () => void;
  onSignOut?: () => void;
  onAccount?: () => void;
  onLandingVisibilityChange?: (visible: boolean) => void;
};

const authRoles = ['Client', 'Tenant', 'Commissioner / Komisiyoneri', 'Landlord', 'Property Owner', 'Admin'];
const accountAuthRole = (role?: string, workspaceKind?: string): AuthRole | null => {
  const normalized = role?.toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'client') return 'Client';
  if (normalized === 'tenant') return 'Tenant';
  if (normalized?.includes('komisiyoneri')) return 'Commissioner / Komisiyoneri';
  if (normalized === 'landlord' || (normalized === 'property_owner' && workspaceKind?.toLowerCase() === 'landlord')) return 'Landlord';
  if (normalized === 'property_owner') return 'Property Owner';
  if (normalized === 'admin') return 'Admin';
  return null;
};
const joinOptions: Array<{ label: AuthRole; registerAs: string; description: string; icon: IconName }> = [
  { label: 'Client', registerAs: 'Client', description: 'Explore and compare properties.', icon: 'search' },
  { label: 'Tenant', registerAs: 'Tenant', description: 'Find a place to rent and manage applications.', icon: 'home' },
  { label: 'Commissioner / Komisiyoneri', registerAs: 'Komisiyoneri', description: 'Help clients find and manage property.', icon: 'users' },
  { label: 'Landlord', registerAs: 'Landlord', description: 'Manage rental properties and tenants.', icon: 'home' },
  { label: 'Property Owner', registerAs: 'Property Owner', description: 'Share property you own for sale or rent.', icon: 'building' },
];
const languages: Language[] = ['English', 'French', 'Kinyarwanda', 'Swahili'];
const languageCodes: Record<Language, string> = { English: 'EN', French: 'FR', Kinyarwanda: 'RW', Swahili: 'SW' };
const dashboardPaths: Record<AuthRole, string> = { Client: '/tenant', Tenant: '/tenant', 'Commissioner / Komisiyoneri': '/commissioner', Landlord: '/landlord', 'Property Owner': '/property-owner', Admin: '/admin' };
const dashboardPathForRole = (role?: string) => role && role in dashboardPaths ? dashboardPaths[role as AuthRole] : undefined;
const navCategories: { name: string; description: string; slug: string; icon: IconName }[] = [
  { name: 'Homes', description: 'Houses to buy or rent', slug: 'houses', icon: 'home' },
  { name: 'Apartments', description: 'City homes and flats', slug: 'apartments', icon: 'building' },
  { name: 'Land', description: 'Plots across Rwanda', slug: 'land', icon: 'leaf' },
  { name: 'Commercial spaces', description: 'Shops and business properties', slug: 'commercial', icon: 'building' },
  { name: 'Offices', description: 'Workspaces for teams', slug: 'offices', icon: 'building' },
  { name: 'Cars', description: 'Cars for sale or hire', slug: 'vehicles', icon: 'car' },
  { name: 'Car parts', description: 'Parts and car accessories', slug: 'car-parts', icon: 'wrench' },
  { name: 'Home appliances', description: 'Appliances for your home', slug: 'appliances', icon: 'appliance' },
  { name: 'Furniture', description: 'Furniture for every space', slug: 'furniture', icon: 'building' },
  { name: 'Equipment', description: 'Tools and equipment', slug: 'equipment', icon: 'wrench' },
  { name: 'Hospitality', description: 'Stays and accommodation', slug: 'hospitality', icon: 'home' },
  { name: 'Other assets', description: 'More useful listings', slug: 'other', icon: 'sparkles' },
];

function HoverHint({ text, placement, children }: { text: string; placement: 'right' | 'bottom'; children: ReactElement }) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const showHint = (event: React.MouseEvent<HTMLSpanElement>) => {
    const target = event.currentTarget.firstElementChild as HTMLElement | null;
    if (!target) return;
    const bounds = target.getBoundingClientRect();
    setPosition(placement === 'right' ? { top: bounds.top + bounds.height / 2, left: bounds.right + 11 } : { top: bounds.bottom + 9, left: bounds.left + bounds.width / 2 });
  };
  return <span className="hover-hint" onMouseEnter={showHint} onMouseLeave={() => setPosition(null)}>{children}{position && createPortal(<span className={`nav-hover-panel ${placement}`} style={{ top: position.top, left: position.left }}>{text}</span>, document.body)}</span>;
}

function Dropdown({ label, items, onSelect, active, icon }: { label: string; items: string[]; onSelect: (value: string) => void; active?: string; icon?: 'users' | 'building' | 'leaf' | 'globe' }) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const toggleMenu = () => {
    if (!open) {
      const trigger = ref.current?.querySelector('button');
      if (trigger) {
        const bounds = trigger.getBoundingClientRect();
        setMenuPosition({ top: bounds.bottom + 10, right: window.innerWidth - bounds.right });
      }
    }
    setOpen(!open);
  };

  return <div className="nav-dropdown" ref={ref}><button className={`nav-link nav-dropdown-trigger ${open ? 'is-open' : ''}`} type="button" aria-expanded={open} onClick={toggleMenu}>{icon && <Icon name={icon} size={16} />}<span>{label}</span><Icon name="chevron" size={12} /></button>{open && <div className="dropdown-panel" style={menuPosition ? { position: 'fixed', top: menuPosition.top, right: menuPosition.right } : undefined}>{items.map((item) => <button key={item} className={active === item ? 'selected' : ''} type="button" onClick={() => { onSelect(item); setOpen(false); }}>{item}{active === item && <Icon name="check" size={15} />}</button>)}</div>}</div>;
}

export function FavoritesPanel({ language, items, onRemove, onClose }: { language: Language; items: FavoriteItem[]; onRemove: (propertyID: string) => void; onClose: () => void }) {
  return <div className="favorites-panel" role="dialog" aria-label={t(language, 'Favorites')}>
    <div className="favorites-panel-heading"><div><span className="favorites-panel-eyebrow">{t(language, 'Your shortlist')}</span><h2>{t(language, 'Favorites')}</h2></div><span className="favorites-panel-count">{items.length}</span></div>
    {items.length ? <div className="favorites-panel-list">{items.map((item) => <article className="favorites-panel-item" key={item.property_id}><img src={item.image} alt={t(language, item.title)} /><div><strong>{t(language, item.title)}</strong><small>{t(language, item.location)}</small><span>{item.price}</span><a href="/#properties" onClick={onClose}>{t(language, 'View property')} <Icon name="arrow" size={12} /></a></div><button type="button" aria-label={`${t(language, 'Remove property from favorites')}: ${t(language, item.title)}`} onClick={() => onRemove(item.property_id)}><Icon name="x" size={14} /></button></article>)}</div> : <div className="favorites-panel-empty"><Icon name="heart" size={20} /><strong>{t(language, 'No saved properties yet')}</strong><p>{t(language, 'Tap the heart on a property to keep it here.')}</p><a href="/#properties" onClick={onClose}>{t(language, 'Browse properties')} <Icon name="arrow" size={13} /></a></div>}
  </div>;
}

type NavNotification = { id?: string; type?: string; title?: string; message?: string; body?: string; createdAt?: string; created_at?: string; applicationId?: string; application_id?: string; propertyId?: string; listingId?: string; href?: string; url?: string; destination?: string; status?: string };

function NotificationsPanel({ language, items, onSelect }: { language: Language; items: NavNotification[]; onSelect: (item: NavNotification) => void }) {
  return <div className="notification-panel" role="dialog" aria-label={t(language, 'Notifications')}>
    <div className="notification-panel-heading"><div><span className="notification-panel-eyebrow">{t(language, 'Recent activity')}</span><h2>{t(language, 'Notifications')}</h2></div><span className="notification-panel-count">{items.length}</span></div>
    {items.length ? <div className="notification-panel-list">{items.slice(0, 6).map((item, index) => <button className="notification-panel-item" type="button" key={item.id ?? `${item.title ?? 'notification'}-${index}`} onClick={() => onSelect(item)} aria-label={`${item.title ?? t(language, 'New update')}: ${item.message ?? item.body ?? t(language, 'You have a new update.')}`}><span className="notification-panel-icon"><Icon name="bell" size={15} /></span><span className="notification-panel-item-copy"><strong>{item.title ?? t(language, 'New update')}</strong><span>{item.message ?? item.body ?? t(language, 'You have a new update.')}</span>{(item.createdAt ?? item.created_at) && <time>{new Date(item.createdAt ?? item.created_at ?? '').toLocaleString()}</time>}</span></button>)}</div> : <div className="notification-panel-empty"><Icon name="check" size={20} /><strong>{t(language, 'No new notifications')}</strong><p>{t(language, 'You are all caught up.')}</p></div>}
  </div>;
}

function AccountPanel({ language, role, darkMode, onToggleTheme, onLanguageChange, onAccount, onFavorites, onSignOut, showSettings = true }: { language: Language; role?: string; darkMode: boolean; onToggleTheme: () => void; onLanguageChange: (language: Language) => void; onAccount: () => void; onFavorites: () => void; onSignOut: () => void; showSettings?: boolean }) {
  return <div className="account-panel" role="menu">
    <div className="account-panel-heading"><Icon name="user" size={19} /><span><strong>{role ? t(language, role) : t(language, 'Account')}</strong><small>Umutungo account</small></span></div>
    <button className="account-panel-item" type="button" role="menuitem" onClick={onAccount}><Icon name="user" size={16} /><span>{t(language, 'Account')}</span><Icon name="arrow" size={14} /></button>
    <button className="account-panel-item" type="button" role="menuitem" onClick={onFavorites}><Icon name="heart" size={16} /><span>{t(language, 'Favorites')}</span><Icon name="arrow" size={14} /></button>
    {showSettings && <><div className="account-panel-divider" />
      <span className="account-panel-label">{t(language, 'Settings')}</span>
      <ThemeToggle darkMode={darkMode} onToggle={onToggleTheme} language={language} />
      <label className="account-panel-language"><span><Icon name="globe" size={16} />{t(language, 'Language')}</span><select value={language} onChange={(event) => onLanguageChange(event.target.value as Language)}>{languages.map((item) => <option key={item} value={item}>{languageCodes[item]}</option>)}</select></label>
      <div className="account-panel-divider" /></>}
    <button className="account-panel-item account-panel-logout" type="button" role="menuitem" onClick={onSignOut}><Icon name="arrow" size={16} /><span>{t(language, 'Log out')}</span></button>
  </div>;
}

export function Navbar({ darkMode, onToggleTheme, language, onLanguageChange, isSignedIn = false, onSignIn, onSignOut, onAccount, onLandingVisibilityChange }: NavbarProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [viewMoreOpen, setViewMoreOpen] = useState(false);
  const categoryMenuRootRef = useRef<HTMLElement>(null);
  const categoryMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [landingVisible, setLandingVisible] = useState(true);
  const [roleKey, setRoleKey] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [getStartedOpen, setGetStartedOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const mobileAccountMenuRef = useRef<HTMLDivElement>(null);
  const [pendingRole, setPendingRole] = useState<AuthRole | undefined>();
  const [intendedPath, setIntendedPath] = useState<string | undefined>();
  const [demoSignedIn, setDemoSignedIn] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState<NavNotification[]>([]);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  useEffect(() => {
    if (!categoryMenuOpen && !viewMoreOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!categoryMenuRootRef.current?.contains(event.target as Node)) { setCategoryMenuOpen(false); setViewMoreOpen(false); }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setCategoryMenuOpen(false);
      setViewMoreOpen(false);
      categoryMenuTriggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [categoryMenuOpen, viewMoreOpen]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [favoritesPanelOpen, setFavoritesPanelOpen] = useState(false);
  const favoritesRef = useRef<HTMLDivElement>(null);
  const signedIn = isSignedIn || demoSignedIn;
  useEffect(() => {
    if (signedIn) setViewMoreOpen(false);
  }, [signedIn]);
  const isTenant = roleKey === 'Tenant' || roleKey === 'Client';
  const postActionLabel = 'Post a Property';
  const postActionHint = 'Share a property with people looking.';
  const dashboardPath = dashboardPathForRole(roleKey);
  const goTo = (id: string) => { setMobileOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };
  const openFavorites = () => { setFavoritesPanelOpen((open) => !open); setAccountMenuOpen(false); setMobileOpen(false); };
  useEffect(() => {
    ['/tenant', '/commissioner', '/landlord', '/admin'].forEach((path) => router.prefetch(path));
  }, [router]);

  useEffect(() => {
    const storedUser = window.localStorage.getItem('umutungo-demo-user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser) as { role?: string; workspace_kind?: string };
        const normalizedRole = accountAuthRole(parsed.role, parsed.workspace_kind);
        if (normalizedRole && authRoles.includes(normalizedRole)) {
          setDemoSignedIn(true);
          setRoleKey(normalizedRole === 'Tenant' ? 'Client' : normalizedRole);
        }
      } catch {
        window.localStorage.removeItem('umutungo-demo-user');
      }
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const readNotificationCount = async () => {
      if (!signedIn) {
        setNotifications([]);
        setNotificationCount(0);
        return;
      }
      try {
        const remote = await umutungoApi<{ items: ApiNotification[] }>('/api/v1/notifications');
        if (cancelled) return;
        if (remote?.items) {
          const unread = remote.items.filter((item) => !item.read_at);
          setNotifications(unread.map((item) => ({ id: item.id, type: item.type, title: item.title, body: item.body, created_at: item.created_at, application_id: item.application_id, status: item.status } as NavNotification)));
          setNotificationCount(unread.length);
          return;
        }
        const keys = ['umutungo-notifications'];
        if (roleKey === 'Landlord') keys.push('umutungo-landlord-notifications');
        if (roleKey === 'Commissioner / Komisiyoneri') keys.push('umutungo-commissioner-notifications');
        if (roleKey === 'Tenant' || roleKey === 'Client') keys.push('umutungo-tenant-notifications');
        const items = keys.flatMap((key) => {
          const stored = JSON.parse(window.localStorage.getItem(key) ?? '[]');
          return Array.isArray(stored) ? stored : [];
        });
        setNotifications(items);
        setNotificationCount(items.length);
      } catch {
        // Retain the browser queue when the API is temporarily unavailable.
        try {
          const keys = ['umutungo-notifications', ...(roleKey === 'Landlord' ? ['umutungo-landlord-notifications'] : []), ...(roleKey === 'Commissioner / Komisiyoneri' ? ['umutungo-commissioner-notifications'] : []), ...(roleKey === 'Tenant' || roleKey === 'Client' ? ['umutungo-tenant-notifications'] : [])];
          const items = keys.flatMap((key) => { const stored = JSON.parse(window.localStorage.getItem(key) ?? '[]'); return Array.isArray(stored) ? stored : []; });
          if (!cancelled) { setNotifications(items); setNotificationCount(items.length); }
        } catch { if (!cancelled) { setNotifications([]); setNotificationCount(0); } }
      }
    };
    void readNotificationCount();
    const timer = window.setInterval(() => { void readNotificationCount(); }, 20000);
    const refresh = () => { void readNotificationCount(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('umutungo:notifications-changed', refresh);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('umutungo:notifications-changed', refresh); };
  }, [roleKey, signedIn]);

  useEffect(() => {
    const label = notificationCount > 99 ? '99+' : String(notificationCount);
    document.querySelectorAll('.nav-notifications b, .notification-action b').forEach((badge) => {
      const element = badge as HTMLElement;
      element.textContent = label;
      element.style.setProperty('display', notificationCount > 0 ? 'grid' : 'none', 'important');
    });
  }, [notificationCount]);

  useEffect(() => {
    const readFavorites = () => {
      try {
        const stored = JSON.parse(window.localStorage.getItem('umutungo-favorites') ?? '[]') as FavoriteItem[];
        setFavoriteItems(Array.isArray(stored) ? stored : []);
      } catch {
        setFavoriteItems([]);
      }
    };
    readFavorites();
    window.addEventListener('umutungo:favorites-changed', readFavorites);
    return () => window.removeEventListener('umutungo:favorites-changed', readFavorites);
  }, []);

  useEffect(() => {
    if (!favoritesPanelOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => { if (!favoritesRef.current?.contains(event.target as Node)) setFavoritesPanelOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setFavoritesPanelOpen(false); };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('mousedown', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape); };
  }, [favoritesPanelOpen]);

  useEffect(() => {
    if (!notificationPanelOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.nav-notifications-wrap, .notification-action, .notification-panel')) setNotificationPanelOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setNotificationPanelOpen(false); };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('mousedown', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape); };
  }, [notificationPanelOpen]);

  useEffect(() => {
    const landing = document.getElementById('home');
    if (!landing) return;
    const observer = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting;
      setLandingVisible(visible);
      onLandingVisibilityChange?.(visible);
    }, { threshold: 0.15 });
    observer.observe(landing);
    return () => observer.disconnect();
  }, [onLandingVisibilityChange]);

  useEffect(() => {
    if (!accountMenuOpen && !getStartedOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => { const target = event.target as Node; if (!accountMenuRef.current?.contains(target) && !mobileAccountMenuRef.current?.contains(target)) { setAccountMenuOpen(false); setGetStartedOpen(false); } };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setAccountMenuOpen(false); setGetStartedOpen(false); } };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('mousedown', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape); };
  }, [accountMenuOpen, getStartedOpen]);

  const showSignInModal = (requestedRole?: AuthRole, returnTo?: string) => {
    setPendingRole(requestedRole);
    setIntendedPath(returnTo);
    setAuthOpen(true);
  };

  const openSignIn = (requestedRole?: AuthRole, returnTo?: string) => {
    showSignInModal(requestedRole ?? 'Client', returnTo);
  };

  const chooseJoinRole = (registerAs: string) => {
    setGetStartedOpen(false);
    setViewMoreOpen(false);
    setMobileOpen(false);
    router.push(`/register?role=${encodeURIComponent(registerAs)}`);
  };

  const getStartedPanel = <div className="get-started-panel" role="dialog" aria-label="Explore the marketplace">
    <div className="get-started-panel-heading"><span>GET STARTED</span><strong>Explore Umutungo</strong></div>
    <div className="get-started-options">
      <a className="get-started-option" href="/categories/properties?intent=Rent" onClick={() => setGetStartedOpen(false)}><span className="get-started-option-icon"><Icon name="home" size={17} /></span><span><strong>Rent a property</strong><small>Browse homes and other listings to rent.</small></span><Icon name="arrow" size={14} /></a>
      <a className="get-started-option" href="/categories/properties?intent=Buy" onClick={() => setGetStartedOpen(false)}><span className="get-started-option-icon"><Icon name="building" size={17} /></span><span><strong>Buy a property</strong><small>Explore properties available for sale.</small></span><Icon name="arrow" size={14} /></a>
      <a className="get-started-option" href="/categories/commercial" onClick={() => setGetStartedOpen(false)}><span className="get-started-option-icon"><Icon name="building" size={17} /></span><span><strong>Commercial properties</strong><small>Find shops, offices, and business spaces.</small></span><Icon name="arrow" size={14} /></a>
      <button className="get-started-option" type="button" onClick={() => { setGetStartedOpen(false); setCategoryMenuOpen(true); }}><span className="get-started-option-icon"><Icon name="building" size={17} /></span><span><strong>Browse categories</strong><small>See every type of property and product.</small></span><Icon name="arrow" size={14} /></button>
    </div>
    <div className="get-started-signin">Need help? <a href="/#contact" onClick={() => setGetStartedOpen(false)}>Contact Umutungo</a></div>
  </div>;

  useEffect(() => {
    const requestSignIn = (event: Event) => {
      const detail = (event as CustomEvent<{ role?: AuthRole; returnTo?: string }>).detail;
      const requestedRole = detail?.role;
      const returnTo = detail?.returnTo;
      if (signedIn) {
        if (requestedRole === 'Commissioner / Komisiyoneri' && roleKey === requestedRole) router.push('/commissioner');
        return;
      }
      showSignInModal(requestedRole ?? 'Client', returnTo);
    };
    window.addEventListener('umutungo:request-sign-in', requestSignIn);
    return () => window.removeEventListener('umutungo:request-sign-in', requestSignIn);
  }, [signedIn]);

  const signOut = async () => {
    const token = window.localStorage.getItem('umutungo-api-token');
    if (token) { try { await fetch('/api/v1/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); } catch { /* Clear the local credential even if offline. */ } }
    window.localStorage.removeItem('umutungo-demo-user');
    window.localStorage.removeItem('umutungo-api-token');
    ['umutungo-notifications', 'umutungo-landlord-notifications', 'umutungo-commissioner-notifications', 'umutungo-tenant-notifications'].forEach((key) => window.localStorage.removeItem(key));
    setDemoSignedIn(false);
    setRoleKey('');
    setNotifications([]);
    setNotificationCount(0);
    setNotificationPanelOpen(false);
    setAccountMenuOpen(false);
    setMobileOpen(false);
    window.dispatchEvent(new Event('umutungo:notifications-changed'));
    window.dispatchEvent(new Event('umutungo:auth-changed'));
    router.replace('/');
    onSignOut?.();
  };

  useEffect(() => {
    if (!signedIn) return;
    const idleLimit = 5 * 60 * 1000;
    let timer = 0;
    let lastActivity = Date.now();
    const expireSession = () => {
      if (Date.now() - lastActivity < idleLimit) {
        timer = window.setTimeout(expireSession, idleLimit - (Date.now() - lastActivity));
        return;
      }
      const previousRole = roleKey as AuthRole | '';
      signOut();
      setPendingRole(previousRole || undefined);
      setAuthOpen(true);
    };
    const resetTimer = () => {
      lastActivity = Date.now();
      window.clearTimeout(timer);
      timer = window.setTimeout(expireSession, idleLimit);
    };
    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'mousemove'];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }));
    const checkWhenVisible = () => { if (!document.hidden) expireSession(); };
    document.addEventListener('visibilitychange', checkWhenVisible);
    resetTimer();
    return () => {
      window.clearTimeout(timer);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
      document.removeEventListener('visibilitychange', checkWhenVisible);
    };
  }, [signedIn]);

  const removeFromFavorites = (propertyID: string) => {
    const next = favoriteItems.filter((item) => item.property_id !== propertyID);
    setFavoriteItems(next);
    window.localStorage.setItem('umutungo-favorites', JSON.stringify(next));
    window.dispatchEvent(new Event('umutungo:favorites-changed'));
    void removeFavorite(propertyID).catch(() => undefined);
  };

  const openAccount = () => {
    setAccountMenuOpen(false);
    if (onAccount) { onAccount(); return; }
    const destination = dashboardPathForRole(roleKey);
    if (destination) router.push(destination);
  };

  const openNotification = (item: NavNotification) => {
    setNotificationPanelOpen(false);
    const directPath = item.href ?? item.url ?? (item.destination?.startsWith('/') ? item.destination : undefined);
    if (directPath?.startsWith('/') && !directPath.startsWith('//')) { router.push(directPath); return; }
    const detail = `${item.type ?? ''} ${item.title ?? ''} ${item.message ?? item.body ?? ''}`.toLowerCase();
    const isTenant = roleKey === 'Tenant' || roleKey === 'Client';
    const section = detail.includes('message') || detail.includes('reply') ? 'Messages'
      : detail.includes('application') || detail.includes('enquir') ? isTenant ? 'Applications' : 'Enquiries'
      : detail.includes('visit') || detail.includes('viewing') || detail.includes('booking') ? isTenant ? 'Viewings' : roleKey === 'Commissioner / Komisiyoneri' ? 'Visits' : 'Enquiries'
      : detail.includes('maintenance') || detail.includes('repair') ? 'Maintenance'
      : detail.includes('payment') || detail.includes('rent') ? isTenant ? 'Rent & utilities' : 'Income'
      : detail.includes('listing') || detail.includes('property') ? roleKey === 'Commissioner / Komisiyoneri' ? 'My listings' : 'My properties'
      : 'Overview';
    const dashboardPath = dashboardPathForRole(roleKey as AuthRole) ?? '/tenant';
    const requestedSection = item.destination && !item.destination.startsWith('/') ? item.destination : section;
    router.push(`${dashboardPath}?section=${encodeURIComponent(requestedSection)}`);
  };

  const postAction = <a className="nav-link nav-post" href="/post-property" onClick={() => setMobileOpen(false)} aria-label={t(language, postActionHint)}><span className="nav-post-label">{t(language, postActionLabel)}</span></a>;

  return <>
    <aside className={`site-header ${scrolled ? 'is-scrolled' : ''} ${landingVisible ? '' : 'is-hidden'}`}>
      <div className="sidebar-shell"><nav className="sidebar-nav" aria-label="Property navigation">
        <a className="sidebar-nav-link sidebar-home-link" href="/"><Icon name="home" size={17} /><span>{t(language, 'Home')}</span></a>
       </nav></div>
    </aside>

    <header className={`topbar ${scrolled ? 'is-scrolled' : ''}`} ref={categoryMenuRootRef}>
      <div className="topbar-inner">
        <div className="topbar-brand-group">
          <a className="topbar-brand" href="/" aria-label="Umutungo home"><Logo darkMode /></a>
        </div>
        <nav className={`desktop-nav${signedIn && dashboardPath ? ' is-signed-in' : ''}`} aria-label="Primary navigation">
          <a className="nav-link topbar-home-link" href="/"><span>{t(language, 'Home')}</span></a>
          {!signedIn && <div className="account-menu-wrap nav-get-started-nav" ref={accountMenuRef}>
            <button className="nav-link nav-sign-in" type="button" title="Get started" aria-label="Get started" aria-haspopup="dialog" aria-expanded={getStartedOpen} onClick={() => { setAccountMenuOpen(false); setGetStartedOpen((open) => !open); }}>Get started<Icon name="chevron" size={13} /></button>
            {getStartedOpen && getStartedPanel}
          </div>}
          {!signedIn && <><a className="nav-join-role" href="/register?role=Komisiyoneri">For Komisiyoneri</a><a className="nav-join-role" href="/register?role=Property%20Owner">For Property Owners</a><a className="nav-join-role" href="/register?role=Landlord">For Landlords</a><a className="nav-join-role" href="/about">{t(language, 'About us')}</a></>}
          {signedIn && dashboardPath && <a className="nav-dashboard-link" href={dashboardPath} onClick={() => setMobileOpen(false)}>{t(language, 'Dashboard')}</a>}
        </nav>

        <div className="nav-actions">
          {!isTenant && <HoverHint text={t(language, postActionHint)} placement="bottom">{postAction}</HoverHint>}
          <div className="nav-favorites-wrap" ref={favoritesRef}><button className="nav-saved" type="button" title={t(language, 'Favorites')} aria-label={t(language, 'Favorites')} aria-expanded={favoritesPanelOpen} onClick={openFavorites}><Icon name="heart" size={17} />{favoriteItems.length > 0 && <b>{favoriteItems.length > 9 ? '9+' : favoriteItems.length}</b>}</button>{favoritesPanelOpen && <FavoritesPanel language={language} items={favoriteItems} onRemove={removeFromFavorites} onClose={() => setFavoritesPanelOpen(false)} />}</div>
           <div className="nav-notifications-wrap"><button className="nav-notifications" type="button" title={t(language, 'Notifications')} aria-label={t(language, 'Notifications')} aria-expanded={notificationPanelOpen} onClick={() => setNotificationPanelOpen((open) => !open)}><Icon name="bell" size={17} /><b>0</b></button>{notificationPanelOpen && <NotificationsPanel language={language} items={notifications} onSelect={openNotification} />}</div>
          <div className="nav-utility-group" aria-label="Site preferences"><Dropdown label={languageCodes[language]} items={languages} active={language} onSelect={(value) => onLanguageChange(value as Language)} icon="globe" /><ThemeToggle darkMode={darkMode} onToggle={onToggleTheme} language={language} /></div>
          {!signedIn && <button className={`nav-link nav-view-more-trigger ${viewMoreOpen ? 'is-open' : ''}`} type="button" aria-expanded={viewMoreOpen} aria-controls="nav-view-more-panel" onClick={() => { setCategoryMenuOpen(false); setViewMoreOpen((open) => !open); }}><span>Log in</span><Icon name="chevron" size={13} /></button>}
          {signedIn ? <div className="account-menu-wrap" ref={accountMenuRef}>
            <button className="nav-sign-in nav-account" type="button" title={t(language, 'Account')} aria-label={t(language, 'Account')} aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen((open) => !open)}><Icon name="user" size={16} />{t(language, 'Account')}<Icon name="chevron" size={12} /></button>
            {accountMenuOpen && <AccountPanel language={language} role={roleKey} darkMode={darkMode} onToggleTheme={onToggleTheme} onLanguageChange={onLanguageChange} onAccount={openAccount} onFavorites={() => { setAccountMenuOpen(false); openFavorites(); }} onSignOut={signOut} />}
          </div> : null}
          {!isTenant && <span className="mobile-post-action">{postAction}</span>}
          <button className="mobile-menu-button" type="button" aria-expanded={mobileOpen} aria-controls="mobile-menu" aria-label={mobileOpen ? 'Close menu' : 'Open menu'} onClick={() => setMobileOpen(!mobileOpen)}><Icon name={mobileOpen ? 'x' : 'menu'} size={22} /></button>
        </div>
      </div>

      {viewMoreOpen && <nav className="nav-view-more-panel nav-join-panel" id="nav-view-more-panel" aria-label="Choose an account type">
        <div className="nav-join-panel-heading"><span>JOIN UMUTUNGO</span><strong>Choose your account</strong></div>
        {joinOptions.map((option) => <button type="button" key={option.label} onClick={() => chooseJoinRole(option.registerAs)}><Icon name={option.icon} size={14} /><span>{option.label === 'Commissioner / Komisiyoneri' ? 'Komisiyoneri' : option.label}</span></button>)}
        <div className="nav-join-panel-signin">Already have an account? <button type="button" onClick={() => { setViewMoreOpen(false); openSignIn('Client'); }}>Sign in</button></div>
      </nav>}

      {categoryMenuOpen && <nav className="nav-category-panel" id="nav-category-panel" aria-label={t(language, 'Property categories')}>
        <div className="nav-category-panel-heading"><div><span>UMUTUNGO CATEGORIES</span><strong>What are you looking for?</strong></div><button type="button" aria-label={t(language, 'Close categories')} onClick={() => setCategoryMenuOpen(false)}><Icon name="x" size={17} /></button></div>
        <div className="nav-category-grid">{navCategories.map((category) => <a className="nav-category-item" href={`/categories/${category.slug}`} key={category.slug} onClick={() => { setCategoryMenuOpen(false); setMobileOpen(false); }}><span className="nav-category-icon"><Icon name={category.icon} size={20} /></span><span className="nav-category-copy"><strong>{t(language, category.name)}</strong><small>{category.description}</small></span><Icon name="arrow" size={14} /></a>)}</div>
      </nav>}

      {mobileOpen && <div className="mobile-menu" id="mobile-menu">
        <a className="mobile-menu-link" href="/" onClick={() => setMobileOpen(false)}>{t(language, 'Home')}<Icon name="home" size={15} /></a>
        {signedIn && dashboardPath && <a className="mobile-menu-link" href={dashboardPath} onClick={() => setMobileOpen(false)}>{t(language, 'Dashboard')}<Icon name="user" size={15} /></a>}
        <button className="mobile-menu-link" type="button" aria-expanded={categoryMenuOpen} aria-controls="nav-category-panel" onClick={() => { setMobileOpen(false); setCategoryMenuOpen((open) => !open); }}>{t(language, 'Categories')}<Icon name={categoryMenuOpen ? 'chevron' : 'arrow'} size={14} /></button>
        {!signedIn && <button className="mobile-menu-link" type="button" aria-expanded={viewMoreOpen} aria-controls="nav-view-more-panel" onClick={() => setViewMoreOpen((open) => !open)}>Log in<Icon name="chevron" size={14} /></button>}
        <a className="mobile-menu-link" href="/about" onClick={() => setMobileOpen(false)}>{t(language, 'About us')}</a>
        <a className="mobile-menu-link mobile-contact-link" href="/#contact" onClick={() => setMobileOpen(false)}>{t(language, 'Contact us')} <Icon name="arrow" size={14} /></a>
        <div className="mobile-account-menu-wrap" ref={mobileAccountMenuRef}>
          <button className="mobile-menu-link mobile-sign-in-link" type="button" aria-haspopup={signedIn ? undefined : 'dialog'} aria-expanded={signedIn ? accountMenuOpen : getStartedOpen} onClick={signedIn ? () => setAccountMenuOpen((open) => !open) : () => { setAccountMenuOpen(false); setGetStartedOpen((open) => !open); }}>{signedIn ? t(language, 'Account') : 'Get started'}<Icon name={signedIn && accountMenuOpen ? 'chevron' : signedIn ? 'user' : 'chevron'} size={15} /></button>
          {signedIn && accountMenuOpen && <AccountPanel language={language} role={roleKey} darkMode={darkMode} onToggleTheme={onToggleTheme} onLanguageChange={onLanguageChange} onAccount={openAccount} onFavorites={() => { setAccountMenuOpen(false); openFavorites(); }} onSignOut={signOut} showSettings={false} />}
          {!signedIn && getStartedOpen && getStartedPanel}
        </div>
      </div>}
    </header>
    <AuthModal open={authOpen} role={pendingRole} onClose={() => { setAuthOpen(false); setIntendedPath(undefined); }} onSuccess={(accountRole) => { setDemoSignedIn(true); setRoleKey(accountRole); setAuthOpen(false); window.dispatchEvent(new Event('umutungo:auth-changed')); const isMarketplaceAudience = accountRole === 'Client' || accountRole === 'Tenant'; const destination = accountRole === 'Landlord' ? '/landlord' : intendedPath ?? (isMarketplaceAudience ? '/' : dashboardPaths[accountRole]); setIntendedPath(undefined); router.push(destination); }} />
  </>;
}


