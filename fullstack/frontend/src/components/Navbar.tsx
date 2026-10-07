import { ReactElement, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Language, t } from '../data/translations';
import { Icon } from './Icons';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { AuthModal, AuthRole } from './AuthModal';
import { removeFavorite, type FavoriteItem } from '../lib/umutungoApi';

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

const authRoles = ['Client', 'Commissioner / Komisiyoneri', 'Landlord', 'Property Owner', 'Admin'];
const categories = ['Houses', 'Apartments', 'Land', 'Commercial', 'Offices', 'Hotels and lodges', 'Vehicles', 'Furniture', 'Appliances', 'Equipment', 'Other'];
const languages: Language[] = ['English', 'French', 'Kinyarwanda', 'Swahili'];
const languageCodes: Record<Language, string> = { English: 'EN', French: 'FR', Kinyarwanda: 'RW', Swahili: 'SW' };
const dashboardPaths: Record<AuthRole, string> = { Client: '/tenant', Tenant: '/tenant', 'Commissioner / Komisiyoneri': '/commissioner', Landlord: '/landlord', 'Property Owner': '/property-owner', Admin: '/admin' };
const dashboardPathForRole = (role?: string) => role && role in dashboardPaths ? dashboardPaths[role as AuthRole] : undefined;

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

type NavNotification = { id?: string; title?: string; message?: string; body?: string; createdAt?: string; created_at?: string };

function NotificationsPanel({ language, items }: { language: Language; items: NavNotification[] }) {
  return <div className="notification-panel" role="dialog" aria-label={t(language, 'Notifications')}>
    <div className="notification-panel-heading"><div><span className="notification-panel-eyebrow">{t(language, 'Recent activity')}</span><h2>{t(language, 'Notifications')}</h2></div><span className="notification-panel-count">{items.length}</span></div>
    {items.length ? <div className="notification-panel-list">{items.slice(0, 6).map((item, index) => <article className="notification-panel-item" key={item.id ?? `${item.title ?? 'notification'}-${index}`}><span className="notification-panel-icon"><Icon name="bell" size={15} /></span><div><strong>{item.title ?? t(language, 'New update')}</strong><p>{item.message ?? item.body ?? t(language, 'You have a new update.')}</p>{(item.createdAt ?? item.created_at) && <time>{new Date(item.createdAt ?? item.created_at ?? '').toLocaleString()}</time>}</div></article>)}</div> : <div className="notification-panel-empty"><Icon name="check" size={20} /><strong>{t(language, 'No new notifications')}</strong><p>{t(language, 'You are all caught up.')}</p></div>}
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
  const [scrolled, setScrolled] = useState(false);
  const [landingVisible, setLandingVisible] = useState(true);
  const [mobileCategoryOpen, setMobileCategoryOpen] = useState(false);
  const [roleKey, setRoleKey] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const mobileAccountMenuRef = useRef<HTMLDivElement>(null);
  const [pendingRole, setPendingRole] = useState<AuthRole | undefined>();
  const [intendedPath, setIntendedPath] = useState<string | undefined>();
  const [demoSignedIn, setDemoSignedIn] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState<NavNotification[]>([]);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [favoritesPanelOpen, setFavoritesPanelOpen] = useState(false);
  const favoritesRef = useRef<HTMLDivElement>(null);
  const signedIn = isSignedIn || demoSignedIn;
  const isTenant = roleKey === 'Client' || roleKey === 'Tenant';
  const postActionLabel = isTenant ? 'Upgrade to Post' : 'Post a Property';
  const postActionHint = isTenant ? 'Post (Upgrade)' : 'Share a property with people looking.';
  const goTo = (id: string) => { setMobileOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };
  const openFavorites = () => { setFavoritesPanelOpen((open) => !open); setAccountMenuOpen(false); setMobileOpen(false); };
  const openCategory = (value: string) => {
    const category = categories.find((item) => t(language, item) === value) ?? value;
    const slugs: Record<string, string> = { Houses: 'houses', Apartments: 'apartments', Land: 'land', Commercial: 'commercial', Offices: 'offices', 'Hotels and lodges': 'hospitality', Vehicles: 'vehicles', Furniture: 'furniture', Appliances: 'appliances', Equipment: 'equipment', Other: 'other' };
    if (slugs[category]) window.location.assign(`/categories/${slugs[category]}`);
  };

  useEffect(() => {
    ['/tenant', '/commissioner', '/landlord', '/admin'].forEach((path) => router.prefetch(path));
  }, [router]);

  useEffect(() => {
    const storedUser = window.localStorage.getItem('umutungo-demo-user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser) as { role?: string };
        if (authRoles.includes(parsed.role ?? '')) {
          setDemoSignedIn(true);
          setRoleKey(parsed.role === 'Tenant' ? 'Client' : parsed.role ?? '');
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
    const readNotificationCount = () => {
      if (!signedIn) {
        setNotifications([]);
        setNotificationCount(0);
        return;
      }
      try {
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
        setNotifications([]);
        setNotificationCount(0);
      }
    };
    readNotificationCount();
    window.addEventListener('umutungo:notifications-changed', readNotificationCount);
    return () => window.removeEventListener('umutungo:notifications-changed', readNotificationCount);
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
    if (!accountMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => { const target = event.target as Node; if (!accountMenuRef.current?.contains(target) && !mobileAccountMenuRef.current?.contains(target)) setAccountMenuOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setAccountMenuOpen(false); };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('mousedown', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape); };
  }, [accountMenuOpen]);

  const showSignInModal = (requestedRole?: AuthRole, returnTo?: string) => {
    setPendingRole(requestedRole);
    setIntendedPath(returnTo);
    setAuthOpen(true);
  };

  const openSignIn = (requestedRole?: AuthRole, returnTo?: string) => {
    setIntendedPath(returnTo);
    window.dispatchEvent(new CustomEvent('umutungo:request-google-sign-in', { detail: { role: requestedRole ?? 'Client' } }));
  };

  useEffect(() => {
    const requestSignIn = (event: Event) => {
      const requestedRole = (event as CustomEvent<{ role?: AuthRole }>).detail?.role;
      const returnTo = (event as CustomEvent<{ returnTo?: string }>).detail?.returnTo;
      if (signedIn) {
        if (requestedRole === 'Commissioner / Komisiyoneri' && roleKey === requestedRole) router.push('/commissioner');
        return;
      }
      showSignInModal(requestedRole ?? 'Client', returnTo);
    };
    window.addEventListener('umutungo:request-sign-in', requestSignIn);
    return () => window.removeEventListener('umutungo:request-sign-in', requestSignIn);
  }, [signedIn]);

  const signOut = () => {
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

  const openMarket = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!signedIn) { event.preventDefault(); setMobileOpen(false); openSignIn('Client'); }
  };
  const postAction = <a className={`nav-link nav-post ${isTenant ? 'nav-post-upgrade' : ''}`} href={isTenant ? '/upgrade' : '/post-property'} onClick={() => setMobileOpen(false)} aria-label={t(language, postActionHint)}><span className="nav-post-label">{t(language, postActionLabel)}</span></a>;

  return <>
    <aside className={`site-header ${scrolled ? 'is-scrolled' : ''} ${landingVisible ? '' : 'is-hidden'}`}>
      <div className="sidebar-shell"><nav className="sidebar-nav" aria-label="Property navigation">
        <a className="sidebar-nav-link sidebar-market-link" href="#properties" onClick={openMarket}><Icon name="home" size={17} /><span>{t(language, 'Rent')}</span></a>
        <a className="sidebar-nav-link sidebar-market-link" href="#properties" onClick={openMarket}><Icon name="building" size={17} /><span>{t(language, 'Buy')}</span></a>
        <a className="sidebar-nav-link sidebar-market-link" href="#post-property"><Icon name="arrow" size={17} /><span>{t(language, 'Commercial')}</span></a>
        <HoverHint text={t(language, 'View your saved properties.')} placement="right"><button className="sidebar-nav-link sidebar-icon-action" type="button" title={t(language, 'Favorites')} aria-label={t(language, 'Favorites')} onClick={openFavorites}><Icon name="heart" size={17} /><span>{t(language, 'Favorites')}</span></button></HoverHint>
        <HoverHint text={t(language, 'Check your latest updates.')} placement="right"><button className="sidebar-nav-link sidebar-icon-action notification-action" type="button" title={t(language, 'Notifications')} aria-label={t(language, 'Notifications')}><Icon name="bell" size={17} /><span>{t(language, 'Notifications')}</span><b>0</b></button></HoverHint>
       </nav><div className="sidebar-account"><HoverHint text={t(language, 'Access your Umutungo account.')} placement="right"><button className={`sidebar-nav-link ${signedIn ? 'sidebar-account-link' : 'sidebar-sign-in'}`} type="button" title={t(language, signedIn ? 'Log out' : 'Sign in')} aria-label={t(language, signedIn ? 'Log out' : 'Sign in')} onClick={signedIn ? signOut : () => (onSignIn ? onSignIn() : openSignIn())}>{signedIn && <Icon name="user" size={17} />}<span>{t(language, signedIn ? 'Log out' : 'Sign in')}</span></button></HoverHint></div></div>
    </aside>

    <header className={`topbar ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="topbar-inner">
        <div className="topbar-brand-group">
          <a className="topbar-brand" href="/" aria-label="Umutungo home"><Logo darkMode={darkMode} /></a>
          <a className="nav-home-link" href="/"><span>{t(language, 'Home')}</span></a>
        </div>
        <nav className="desktop-nav" aria-label="Primary navigation">
          <a className="nav-link" href="/how-it-works"><span>{t(language, 'How it works')}</span></a>
          <a className="nav-link" href="/about"><span>{t(language, 'About us')}</span></a>
          <a className="nav-link" href="/categories"><span>{t(language, 'Categories')}</span></a>
          <a className="nav-contact-link" href="/#contact">{t(language, 'Contact us')}</a>
        </nav>

        <div className="nav-actions">
          <HoverHint text={t(language, postActionHint)} placement="bottom">{postAction}</HoverHint>
          <div className="nav-favorites-wrap" ref={favoritesRef}><button className="nav-saved" type="button" title={t(language, 'Favorites')} aria-label={t(language, 'Favorites')} aria-expanded={favoritesPanelOpen} onClick={openFavorites}><Icon name="heart" size={17} />{favoriteItems.length > 0 && <b>{favoriteItems.length > 9 ? '9+' : favoriteItems.length}</b>}</button>{favoritesPanelOpen && <FavoritesPanel language={language} items={favoriteItems} onRemove={removeFromFavorites} onClose={() => setFavoritesPanelOpen(false)} />}</div>
           <div className="nav-notifications-wrap"><button className="nav-notifications" type="button" title={t(language, 'Notifications')} aria-label={t(language, 'Notifications')} aria-expanded={notificationPanelOpen} onClick={() => setNotificationPanelOpen((open) => !open)}><Icon name="bell" size={17} /><b>0</b></button>{notificationPanelOpen && <NotificationsPanel language={language} items={notifications} />}</div>
          <div className="nav-utility-group" aria-label="Site preferences"><Dropdown label={languageCodes[language]} items={languages} active={language} onSelect={(value) => onLanguageChange(value as Language)} icon="globe" /><ThemeToggle darkMode={darkMode} onToggle={onToggleTheme} language={language} /></div>
          <div className="account-menu-wrap" ref={accountMenuRef}>
            <button className={`nav-sign-in ${signedIn ? 'nav-account' : ''}`} type="button" title={t(language, signedIn ? 'Account' : 'Sign in')} aria-label={t(language, signedIn ? 'Account' : 'Sign in')} aria-expanded={signedIn ? accountMenuOpen : undefined} onClick={signedIn ? () => setAccountMenuOpen((open) => !open) : () => (onSignIn ? onSignIn() : openSignIn())}>{signedIn && <Icon name="user" size={16} />}{t(language, signedIn ? 'Account' : 'Sign in')}{signedIn && <Icon name="chevron" size={12} />}</button>
            {signedIn && accountMenuOpen && <AccountPanel language={language} role={roleKey} darkMode={darkMode} onToggleTheme={onToggleTheme} onLanguageChange={onLanguageChange} onAccount={openAccount} onFavorites={() => { setAccountMenuOpen(false); openFavorites(); }} onSignOut={signOut} />}
          </div>
          <span className="mobile-post-action">{postAction}</span>
          <button className="mobile-menu-button" type="button" aria-expanded={mobileOpen} aria-controls="mobile-menu" aria-label={mobileOpen ? 'Close menu' : 'Open menu'} onClick={() => setMobileOpen(!mobileOpen)}><Icon name={mobileOpen ? 'x' : 'menu'} size={22} /></button>
        </div>
      </div>

      {mobileOpen && <div className="mobile-menu" id="mobile-menu">
        <a className="mobile-menu-link active" href="/" onClick={() => setMobileOpen(false)}>{t(language, 'Home')}</a>
        <a className="mobile-menu-link" href="/how-it-works" onClick={() => setMobileOpen(false)}>{t(language, 'How it works')}</a>
        <a className="mobile-menu-link" href="/about" onClick={() => setMobileOpen(false)}>{t(language, 'About us')}</a>
        <a className="mobile-menu-link mobile-contact-link" href="/#contact" onClick={() => setMobileOpen(false)}>{t(language, 'Contact us')} <Icon name="arrow" size={14} /></a>
        <div className="mobile-menu-group"><button className="mobile-menu-link" type="button" onClick={() => setMobileCategoryOpen(!mobileCategoryOpen)}>{t(language, 'Categories')} <Icon name="chevron" size={14} /></button>{mobileCategoryOpen && <div className="mobile-submenu mobile-language-submenu">{categories.map((item) => <button key={item} type="button" onClick={() => openCategory(t(language, item))}>{t(language, item)}</button>)}</div>}</div>
        <div className="mobile-account-menu-wrap" ref={mobileAccountMenuRef}>
          <button className="mobile-menu-link mobile-sign-in-link" type="button" aria-expanded={signedIn ? accountMenuOpen : undefined} onClick={signedIn ? () => setAccountMenuOpen((open) => !open) : () => { setMobileOpen(false); onSignIn ? onSignIn() : openSignIn(); }}>{t(language, signedIn ? 'Account' : 'Sign in')}<Icon name={signedIn && accountMenuOpen ? 'chevron' : 'user'} size={15} /></button>
          {signedIn && accountMenuOpen && <AccountPanel language={language} role={roleKey} darkMode={darkMode} onToggleTheme={onToggleTheme} onLanguageChange={onLanguageChange} onAccount={openAccount} onFavorites={() => { setAccountMenuOpen(false); openFavorites(); }} onSignOut={signOut} showSettings={false} />}
        </div>
      </div>}
    </header>
    <AuthModal open={authOpen} role={pendingRole} onClose={() => { setAuthOpen(false); setIntendedPath(undefined); }} onSuccess={(accountRole) => { setDemoSignedIn(true); setRoleKey(accountRole); setAuthOpen(false); window.dispatchEvent(new Event('umutungo:auth-changed')); const destination = intendedPath ?? dashboardPaths[accountRole]; setIntendedPath(undefined); router.push(destination); }} />
  </>;
}
