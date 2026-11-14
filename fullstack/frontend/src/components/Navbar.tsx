import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Language, t } from '../data/translations';
import { Icon, type IconName } from './Icons';
import { Logo } from './Logo';
import type { AuthRole } from './AuthModal';
import { goToSignIn } from '../lib/signIn';
import { removeFavorite, umutungoApi, type ApiNotification, type FavoriteItem } from '../lib/umutungoApi';
import styles from './Navbar.module.css';

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
  /** 'overlay' sits transparently on top of a hero photo (landing page); 'island' is the floating bar used everywhere else. */
  variant?: 'island' | 'overlay';
  /** Highlights the matching pill. */
  active?: 'home' | 'explore' | 'about';
};

type MenuView = 'main' | 'favorites' | 'notifications' | 'categories';

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
const joinOptions: Array<{ label: string; registerAs: string; description: string; icon: IconName }> = [
  { label: 'Client', registerAs: 'Client', description: 'Explore and compare properties.', icon: 'search' },
  { label: 'Tenant', registerAs: 'Tenant', description: 'Find a place to rent and manage applications.', icon: 'home' },
  { label: 'Komisiyoneri', registerAs: 'Komisiyoneri', description: 'Help clients find and manage property.', icon: 'users' },
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

// Still used by the tenant dashboard.
export function FavoritesPanel({ language, items, onRemove, onClose }: { language: Language; items: FavoriteItem[]; onRemove: (propertyID: string) => void; onClose: () => void }) {
  return <div className="favorites-panel" role="dialog" aria-label={t(language, 'Favorites')}>
    <div className="favorites-panel-heading"><div><span className="favorites-panel-eyebrow">{t(language, 'Your shortlist')}</span><h2>{t(language, 'Favorites')}</h2></div><span className="favorites-panel-count">{items.length}</span></div>
    {items.length ? <div className="favorites-panel-list">{items.map((item) => <article className="favorites-panel-item" key={item.property_id}><img src={item.image} alt={t(language, item.title)} /><div><strong>{t(language, item.title)}</strong><small>{t(language, item.location)}</small><span>{item.price}</span><a href={`/property/${encodeURIComponent(item.property_id)}`} onClick={onClose}>{t(language, 'View property')} <Icon name="arrow" size={12} /></a></div><button type="button" aria-label={`${t(language, 'Remove property from favorites')}: ${t(language, item.title)}`} onClick={() => onRemove(item.property_id)}><Icon name="x" size={14} /></button></article>)}</div> : <div className="favorites-panel-empty"><Icon name="heart" size={20} /><strong>{t(language, 'No saved properties yet')}</strong><p>{t(language, 'Tap the heart on a property to keep it here.')}</p><a href="/categories/properties" onClick={onClose}>{t(language, 'Browse properties')} <Icon name="arrow" size={13} /></a></div>}
  </div>;
}

type NavNotification = { id?: string; type?: string; title?: string; message?: string; body?: string; createdAt?: string; created_at?: string; applicationId?: string; application_id?: string; propertyId?: string; listingId?: string; href?: string; url?: string; destination?: string; status?: string };

export function Navbar({ darkMode, onToggleTheme, language, onLanguageChange, isSignedIn = false, onSignOut, onAccount, onLandingVisibilityChange, variant = 'island', active }: NavbarProps) {
  const router = useRouter();
  const copy = (key: string) => t(language, key);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<MenuView>('main');
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [scrolled, setScrolled] = useState(false);
  // The bar is always fixed to the top of the screen. On the landing hero it starts transparent
  // and becomes the floating island once the visitor scrolls.
  const floating = variant === 'island' || scrolled;
  const barRef = useRef<HTMLElement>(null);
  const [slotHeight, setSlotHeight] = useState<number>();
  const [roleKey, setRoleKey] = useState('');
  const [demoSignedIn, setDemoSignedIn] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState<NavNotification[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const signedIn = isSignedIn || demoSignedIn;
  const isTenant = roleKey === 'Tenant' || roleKey === 'Client';
  const dashboardPath = dashboardPathForRole(roleKey);

  const openMenu = (view: MenuView = 'main') => { setMenuView(view); setMenuOpen(true); };
  const closeMenu = () => { setMenuOpen(false); setMenuView('main'); };
  const toggleMenu = () => { if (menuOpen) closeMenu(); else openMenu('main'); };

  useEffect(() => {
    ['/tenant', '/commissioner', '/landlord', '/admin'].forEach((path) => router.prefetch(path));
  }, [router]);

  useEffect(() => {
    const readUser = () => {
      const storedUser = window.localStorage.getItem('umutungo-demo-user');
      if (!storedUser) { setDemoSignedIn(false); setRoleKey(''); return; }
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
    };
    readUser();
    window.addEventListener('umutungo:auth-changed', readUser);
    return () => window.removeEventListener('umutungo:auth-changed', readUser);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const measure = () => {
      if (variant === 'island') {
        const top = parseFloat(window.getComputedStyle(bar).top) || 0;
        setSlotHeight(bar.offsetHeight + top);
      } else if (!floating) {
        setSlotHeight(bar.offsetHeight);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [variant, floating]);

  // Close the menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) closeMenu(); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { closeMenu(); menuButtonRef.current?.focus(); } };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOnOutsidePointer); document.removeEventListener('keydown', closeOnEscape); };
  }, [menuOpen]);

  useEffect(() => {
    let cancelled = false;
    const notificationKeys = () => ['umutungo-notifications', ...(roleKey === 'Landlord' ? ['umutungo-landlord-notifications'] : []), ...(roleKey === 'Commissioner / Komisiyoneri' ? ['umutungo-commissioner-notifications'] : []), ...(roleKey === 'Tenant' || roleKey === 'Client' ? ['umutungo-tenant-notifications'] : [])];
    const readLocal = () => notificationKeys().flatMap((key) => { const stored = JSON.parse(window.localStorage.getItem(key) ?? '[]'); return Array.isArray(stored) ? stored : []; }) as NavNotification[];
    const readNotificationCount = async () => {
      if (!signedIn) { setNotifications([]); setNotificationCount(0); return; }
      try {
        const remote = await umutungoApi<{ items: ApiNotification[] }>('/api/v1/notifications');
        if (cancelled) return;
        if (remote?.items) {
          const unread = remote.items.filter((item) => !item.read_at);
          setNotifications(unread.map((item) => ({ id: item.id, type: item.type, title: item.title, body: item.body, created_at: item.created_at, application_id: item.application_id, status: item.status } as NavNotification)));
          setNotificationCount(unread.length);
          return;
        }
        const items = readLocal();
        setNotifications(items);
        setNotificationCount(items.length);
      } catch {
        // Keep the browser queue when the API is temporarily unavailable.
        try { const items = readLocal(); if (!cancelled) { setNotifications(items); setNotificationCount(items.length); } }
        catch { if (!cancelled) { setNotifications([]); setNotificationCount(0); } }
      }
    };
    void readNotificationCount();
    const timer = window.setInterval(() => { void readNotificationCount(); }, 20000);
    const refresh = () => { void readNotificationCount(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('umutungo:notifications-changed', refresh);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('umutungo:notifications-changed', refresh); };
  }, [roleKey, signedIn]);

  // Other parts of the app render their own notification badges with this markup.
  useEffect(() => {
    const label = notificationCount > 99 ? '99+' : String(notificationCount);
    document.querySelectorAll('.notification-action b').forEach((badge) => {
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
      } catch { setFavoriteItems([]); }
    };
    readFavorites();
    window.addEventListener('umutungo:favorites-changed', readFavorites);
    return () => window.removeEventListener('umutungo:favorites-changed', readFavorites);
  }, []);

  useEffect(() => {
    if (!onLandingVisibilityChange) return;
    const landing = document.getElementById('home');
    if (!landing) return;
    const observer = new IntersectionObserver(([entry]) => onLandingVisibilityChange(entry.isIntersecting), { threshold: 0.15 });
    observer.observe(landing);
    return () => observer.disconnect();
  }, [onLandingVisibilityChange]);

  // Signing in happens on the full /sign-in page, which brings the person back here.
  const openSignIn = (requestedRole?: AuthRole, returnTo?: string) => { closeMenu(); goToSignIn(requestedRole ?? 'Client', returnTo); };

  useEffect(() => {
    const requestSignIn = (event: Event) => {
      const detail = (event as CustomEvent<{ role?: AuthRole; returnTo?: string }>).detail;
      if (signedIn) {
        if (detail?.role === 'Commissioner / Komisiyoneri' && roleKey === detail.role) router.push('/commissioner');
        return;
      }
      goToSignIn(detail?.role ?? 'Client', detail?.returnTo);
    };
    window.addEventListener('umutungo:request-sign-in', requestSignIn);
    return () => window.removeEventListener('umutungo:request-sign-in', requestSignIn);
  }, [signedIn, roleKey, router]);

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
    closeMenu();
    window.dispatchEvent(new Event('umutungo:notifications-changed'));
    window.dispatchEvent(new Event('umutungo:auth-changed'));
    router.replace('/');
    onSignOut?.();
  };

  // Sign out after 5 minutes without activity.
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
      const previousRole = (roleKey || undefined) as AuthRole | undefined;
      const returnTo = `${window.location.pathname}${window.location.search}`;
      void signOut().then(() => goToSignIn(previousRole, returnTo, 'expired'));
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
    closeMenu();
    if (onAccount) { onAccount(); return; }
    if (dashboardPath) router.push(dashboardPath);
  };

  const openNotification = (item: NavNotification) => {
    closeMenu();
    const directPath = item.href ?? item.url ?? (item.destination?.startsWith('/') ? item.destination : undefined);
    if (directPath?.startsWith('/') && !directPath.startsWith('//')) { router.push(directPath); return; }
    const detail = `${item.type ?? ''} ${item.title ?? ''} ${item.message ?? item.body ?? ''}`.toLowerCase();
    const section = detail.includes('message') || detail.includes('reply') ? 'Messages'
      : detail.includes('application') || detail.includes('enquir') ? isTenant ? 'Applications' : 'Enquiries'
      : detail.includes('visit') || detail.includes('viewing') || detail.includes('booking') ? isTenant ? 'Viewings' : roleKey === 'Commissioner / Komisiyoneri' ? 'Visits' : 'Enquiries'
      : detail.includes('maintenance') || detail.includes('repair') ? 'Maintenance'
      : detail.includes('payment') || detail.includes('rent') ? isTenant ? 'Rent & utilities' : 'Income'
      : detail.includes('listing') || detail.includes('property') ? roleKey === 'Commissioner / Komisiyoneri' ? 'My listings' : 'My properties'
      : 'Overview';
    const requestedSection = item.destination && !item.destination.startsWith('/') ? item.destination : section;
    router.push(`${dashboardPath ?? '/tenant'}?section=${encodeURIComponent(requestedSection)}`);
  };

  const pills: Array<{ key: string; label: string; href?: string; onClick?: () => void }> = [
    { key: 'home', label: 'Home', href: '/' },
    { key: 'explore', label: 'Explore', href: '/categories/properties' },
    { key: 'categories', label: 'Categories', onClick: () => (menuOpen && menuView === 'categories' ? closeMenu() : openMenu('categories')) },
    { key: 'about', label: 'About Us', href: '/about' },
  ];

  const roleLabel = roleKey === 'Commissioner / Komisiyoneri' ? 'Komisiyoneri' : roleKey === 'Client' ? 'Client' : roleKey;
  const badgeCount = signedIn ? notificationCount : 0;

  const row = (icon: IconName, label: string, options: { href?: string; onClick?: () => void; hint?: string; count?: number; chevron?: boolean; className?: string }) => {
    const content = <>
      <span className={styles.rowIcon}><Icon name={icon} size={16} /></span>
      <span className={styles.rowText}><strong>{copy(label)}</strong>{options.hint && <small>{copy(options.hint)}</small>}</span>
      {options.count !== undefined && options.count > 0 && <b className={styles.rowCount}>{options.count > 99 ? '99+' : options.count}</b>}
      {options.chevron && <span className={styles.rowChevron}><Icon name="arrow" size={13} /></span>}
    </>;
    const className = `${styles.row} ${options.className ?? ''}`;
    return options.href
      ? <a className={className} href={options.href} onClick={closeMenu}>{content}</a>
      : <button className={className} type="button" onClick={options.onClick}>{content}</button>;
  };

  const backHeader = (title: string) => <div className={styles.viewHeader}>
    <button type="button" className={styles.backButton} onClick={() => setMenuView('main')} aria-label={copy('Back to menu')}><Icon name="arrow" size={14} /></button>
    <strong>{copy(title)}</strong>
  </div>;

  const mainView = <>
    {signedIn && <div className={styles.accountCard}>
      <span className={styles.avatar}><Icon name="user" size={18} /></span>
      <span><small>{copy('Signed in as')}</small><strong>{copy(roleLabel || 'Umutungo account')}</strong></span>
      <button type="button" className={styles.accountButton} onClick={openAccount}>{copy('Dashboard')}</button>
    </div>}

    {/* Page links: shown in the menu only on small screens where the pills are hidden. */}
    <div className={`${styles.group} ${styles.mobileOnly}`}>
      {row('home', 'Home', { href: '/' })}
      {row('search', 'Explore', { href: '/categories/properties' })}
      {row('building', 'Categories', { onClick: () => setMenuView('categories'), chevron: true })}
      {row('users', 'About Us', { href: '/about' })}
      {!isTenant && row('sparkles', 'Post a Property', { href: '/post-property' })}
    </div>

    <div className={styles.group}>
      <p className={styles.groupTitle}>{copy(signedIn ? 'Your activity' : 'Saved')}</p>
      {row('heart', 'Favorites', { hint: 'Properties you saved', count: favoriteItems.length, onClick: () => setMenuView('favorites'), chevron: true })}
      {signedIn && row('bell', 'Notifications', { hint: notificationCount ? 'New updates waiting' : 'You are all caught up', count: notificationCount, onClick: () => setMenuView('notifications'), chevron: true })}
      {signedIn && row('mail', 'Messages', { href: '/messages' })}
    </div>

    {!signedIn && <div className={styles.group}>
      <p className={styles.groupTitle}>{copy('Get started')}</p>
      {row('home', 'Rent a property', { hint: 'Browse homes and other listings to rent.', href: '/categories/properties?intent=Rent' })}
      {row('building', 'Buy a property', { hint: 'Explore properties available for sale.', href: '/categories/properties?intent=Buy' })}
      {row('building', 'Commercial properties', { hint: 'Find shops, offices, and business spaces.', href: '/categories/commercial' })}
      {row('sparkles', 'Browse categories', { hint: 'See every type of property and product.', onClick: () => setMenuView('categories'), chevron: true })}
    </div>}

    {!signedIn && <div className={styles.group}>
      <p className={styles.groupTitle}>{copy('Join Umutungo')}</p>
      <div className={styles.joinGrid}>
        {joinOptions.map((option) => <a key={option.label} href={`/register?role=${encodeURIComponent(option.registerAs)}`} className={styles.joinChip} title={copy(option.description)} onClick={closeMenu}><Icon name={option.icon} size={14} />{copy(option.label)}</a>)}
      </div>
      <p className={styles.signInLine}>{copy('Already have an account?')} <button type="button" onClick={() => openSignIn('Client')}>{copy('Sign in')}</button></p>
    </div>}

    <div className={styles.group}>
      <p className={styles.groupTitle}>{copy('Preferences')}</p>
      <div className={`${styles.prefRow} ${styles.prefStatic}`}>
        <span className={styles.rowIcon}><Icon name="globe" size={16} /></span>
        <div className={styles.segment} role="radiogroup" aria-label={copy('Language')}>
          {languages.map((option) => <button key={option} type="button" role="radio" aria-checked={language === option} title={option} className={language === option ? styles.segmentActive : undefined} onClick={() => onLanguageChange(option)}>{languageCodes[option]}</button>)}
        </div>
      </div>
      <button type="button" className={styles.prefRow} role="switch" aria-checked={darkMode} onClick={onToggleTheme}>
        <span className={styles.rowIcon}><Icon name={darkMode ? 'moon' : 'sun'} size={16} /></span>
        <span className={styles.rowText}><strong>{copy('Dark mode')}</strong></span>
        <span className={darkMode ? `${styles.switch} ${styles.switchOn}` : styles.switch} aria-hidden="true"><i /></span>
      </button>
    </div>

    <div className={styles.group}>
      <p className={styles.groupTitle}>{copy('Help')}</p>
      {row('phone', 'Contact us', { href: '/contact' })}
      {row('bookPen', 'How it works', { href: '/how-it-works' })}
    </div>

    {signedIn && <button type="button" className={styles.signOut} onClick={() => void signOut()}><Icon name="lock" size={15} />{copy('Sign out')}</button>}
  </>;

  const favoritesView = <>
    {backHeader('Favorites')}
    {favoriteItems.length ? <ul className={styles.itemList}>
      {favoriteItems.map((item) => <li key={item.property_id}>
        <a href={`/property/${encodeURIComponent(item.property_id)}`} onClick={closeMenu} className={styles.itemLink}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image || '/properties/listing-placeholder.svg'} alt="" />
          <span><strong>{copy(item.title)}</strong><small>{copy(item.location)}</small><em>{item.price}</em></span>
        </a>
        <button type="button" className={styles.itemRemove} aria-label={`${copy('Remove property from favorites')}: ${item.title}`} onClick={() => removeFromFavorites(item.property_id)}><Icon name="x" size={13} /></button>
      </li>)}
    </ul> : <div className={styles.empty}><Icon name="heart" size={20} /><strong>{copy('No saved properties yet')}</strong><p>{copy('Tap the heart on a property to keep it here.')}</p><a href="/categories/properties" onClick={closeMenu}>{copy('Browse properties')} →</a></div>}
  </>;

  const notificationsView = <>
    {backHeader('Notifications')}
    {notifications.length ? <ul className={styles.itemList}>
      {notifications.slice(0, 8).map((item, index) => <li key={item.id ?? `${item.title ?? 'notification'}-${index}`}>
        <button type="button" className={styles.itemLink} onClick={() => openNotification(item)}>
          <span className={styles.rowIcon}><Icon name="bell" size={14} /></span>
          <span><strong>{item.title ?? copy('New update')}</strong><small>{item.message ?? item.body ?? copy('You have a new update.')}</small>{(item.createdAt ?? item.created_at) && <em>{new Date(item.createdAt ?? item.created_at ?? '').toLocaleString()}</em>}</span>
        </button>
      </li>)}
    </ul> : <div className={styles.empty}><Icon name="check" size={20} /><strong>{copy('No new notifications')}</strong><p>{copy('You are all caught up.')}</p></div>}
  </>;

  const categoriesView = <>
    {backHeader('What are you looking for?')}
    <div className={styles.categoryGrid}>
      {navCategories.map((category) => <a key={category.slug} href={`/categories/${category.slug}`} onClick={closeMenu}>
        <span className={styles.rowIcon}><Icon name={category.icon} size={16} /></span>
        <span className={styles.rowText}><strong>{copy(category.name)}</strong><small>{copy(category.description)}</small></span>
      </a>)}
    </div>
  </>;

  return <div className={styles.slot} style={slotHeight ? { height: slotHeight } : undefined}>
  <header ref={barRef} className={[styles.bar, floating ? styles.island : styles.overlay, variant === 'overlay' && floating ? styles.dropIn : '', scrolled ? styles.scrolled : ''].join(' ')} data-own-colors="">
    <a className={styles.logo} href="/" aria-label="Umutungo home"><Logo darkMode /></a>

    <nav className={styles.pills} aria-label={copy('Primary navigation')}>
      {pills.map((pill) => {
        const isActive = active === pill.key || (pill.key === 'categories' && menuOpen && menuView === 'categories');
        const className = isActive ? `${styles.pill} ${styles.pillActive}` : styles.pill;
        return pill.href
          ? <a key={pill.key} href={pill.href} className={className} aria-current={active === pill.key ? 'page' : undefined}>{copy(pill.label)}</a>
          : <button key={pill.key} type="button" className={className} aria-expanded={menuOpen && menuView === 'categories'} onClick={pill.onClick}>{copy(pill.label)}</button>;
      })}
    </nav>

    <div className={styles.actions}>
      {signedIn
        ? dashboardPath && <a className={styles.textAction} href={dashboardPath}>{copy('Dashboard')}</a>
        : <button type="button" className={styles.textAction} onClick={() => openSignIn('Client')}>{copy('Login')}</button>}
      {!isTenant && <a className={styles.postButton} href="/post-property">{copy('Post a Property')}</a>}
      <div className={styles.menuWrap} ref={menuRef}>
        <button ref={menuButtonRef} type="button" className={styles.menuButton} aria-haspopup="true" aria-expanded={menuOpen} aria-controls="umutungo-nav-menu" aria-label={copy(badgeCount ? `Menu, ${badgeCount} new notifications` : 'Menu')} onClick={toggleMenu}>
          <Icon name={menuOpen ? 'x' : 'menu'} size={18} />
          {badgeCount > 0 && <b className={styles.menuBadge} aria-hidden="true">{badgeCount > 9 ? '9+' : badgeCount}</b>}
        </button>
        {menuOpen && <div className={styles.menu} id="umutungo-nav-menu" role="dialog" aria-label={copy('Menu')}>
          {menuView === 'main' && mainView}
          {menuView === 'favorites' && favoritesView}
          {menuView === 'notifications' && notificationsView}
          {menuView === 'categories' && categoriesView}
        </div>}
      </div>
    </div>
  </header>
  </div>;
}
