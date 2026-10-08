'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon, IconName } from './Icons';
import { Logo } from './Logo';
import { FavoritesPanel } from './Navbar';
import { AboutVideo, ApiApplication, ApiMessage, ApiNotification, FavoriteItem, TenantBooking, TenantDashboardData, deleteAboutVideo, getAboutVideo, listFavorites, removeFavorite, uploadAboutVideo, umutungoApi } from '../lib/umutungoApi';
import { Language, t } from '../data/translations';
import { usePersistentLanguage } from '../lib/language';
import { usePersistentTheme } from '../lib/theme';
import { getDistrictNames, getSectorNames, provinceNames } from '../data/rwandaLocations';
import { AdminActivityExportRecord, downloadActivityExcel, downloadActivityImage, downloadActivityPdf } from '../lib/adminReportExports';

export type DashboardRole = 'tenant' | 'commissioner' | 'landlord' | 'admin';
type Metric = { label: string; value: string; note: string; icon: IconName; tone: 'green' | 'amber' | 'blue' | 'dark' };
type Activity = { name: string; detail: string; time: string; status: string; initials: string };
type DashboardConfig = { eyebrow: string; greeting: string; welcome: string; action: string; actionIcon: IconName; navigation: Array<{ label: string; icon: IconName }>; metrics: Metric[]; panelEyebrow: string; panelTitle: string; activity: Activity[]; sideEyebrow: string; sideTitle: string; sideItems: Array<{ title: string; detail: string; icon: IconName }> };
type DashboardListing = { id: string; title: string; type: string; intent: string; location: string; price: string; priceNote: string; cover: string; images: string[]; bedrooms: string; bathrooms: string; area: string; status: string; savedAt: string };
type LandlordApplication = ApiApplication & { applicant?: string; phone?: string; decision_note?: string };
type OwnerListingRecord = { id: string; category: string; transaction_type: string; title: string; description: string; price: number; currency: string; province: string; district: string; sector: string; cell?: string; village?: string; status: string; cover?: string; created_at: string };

const mapOwnerListing = (item: OwnerListingRecord): DashboardListing => {
  const intent = item.transaction_type === 'rent_out' || item.transaction_type === 'rent' ? 'For rent' : item.transaction_type === 'book' ? 'Book' : 'For sale';
  return { id: item.id, title: item.title, type: item.category, intent, location: [item.sector, item.district, item.province].filter(Boolean).join(' Ã‚Â· '), price: `${item.currency || 'RWF'} ${item.price.toLocaleString()}`, priceNote: intent === 'For rent' ? '/ month' : ' asking', cover: item.cover || '/properties/house-01.jpg', images: item.cover ? [item.cover] : ['/properties/house-01.jpg'], bedrooms: 'Ã¢â‚¬â€', bathrooms: 'Ã¢â‚¬â€', area: 'Ã¢â‚¬â€', status: item.status, savedAt: item.created_at };
};

const configs: Record<DashboardRole, DashboardConfig> = {
  commissioner: {
    eyebrow: 'Komisiyoneri workspace', greeting: 'Good morning', welcome: 'Keep every property conversation moving.', action: 'Add a listing', actionIcon: 'bookPen',
    navigation: [{ label: 'Overview', icon: 'building' }, { label: 'My listings', icon: 'home' }, { label: 'Enquiries', icon: 'users' }, { label: 'Messages', icon: 'users' }, { label: 'Visits', icon: 'bookPen' }],
    metrics: [{ label: 'Active listings', value: '12', note: '+3 this month', icon: 'home', tone: 'green' }, { label: 'New enquiries', value: '24', note: '8 need a reply', icon: 'users', tone: 'amber' }, { label: 'Viewings this week', value: '8', note: '2 tomorrow', icon: 'bookPen', tone: 'blue' }, { label: 'Commission this month', value: 'RWF 2.4M', note: 'On track', icon: 'arrow', tone: 'dark' }],
    panelEyebrow: 'Stay responsive', panelTitle: 'Recent enquiries', activity: [{ name: 'Aline Mukamana', detail: 'Kacyiru apartment', time: '10 min ago', status: 'New', initials: 'AM' }, { name: 'Patrick Nshimiyimana', detail: 'Gisozi family home', time: '42 min ago', status: 'Follow up', initials: 'PN' }, { name: 'Grace Uwase', detail: 'Gacuriro residential plot', time: 'Yesterday', status: 'Viewing booked', initials: 'GU' }], sideEyebrow: 'Your calendar', sideTitle: 'Upcoming visits', sideItems: [{ title: 'Kacyiru apartment', detail: 'Today Ã‚Â· 11:30 AM', icon: 'home' }, { title: 'Gisozi family home', detail: 'Friday Ã‚Â· 2:00 PM', icon: 'bookPen' }],
  },
  tenant: {
    eyebrow: 'Client dashboard', greeting: 'Welcome back', welcome: 'Your next home is closer than you think.', action: 'Explore homes', actionIcon: 'search',
    navigation: [{ label: 'Overview', icon: 'building' }, { label: 'Saved properties', icon: 'heart' }, { label: 'Applications', icon: 'bookPen' }, { label: 'Notifications', icon: 'bell' }, { label: 'Rent & utilities', icon: 'arrow' }, { label: 'Maintenance', icon: 'users' }, { label: 'Viewings', icon: 'bookPen' }, { label: 'Messages', icon: 'users' }],
    metrics: [{ label: 'Applications', value: '0', note: 'Your rental applications', icon: 'bookPen', tone: 'green' }, { label: 'Saved properties', value: '0', note: 'Your shortlist', icon: 'heart', tone: 'amber' }, { label: 'Viewings', value: '0', note: 'Your viewing activity', icon: 'home', tone: 'blue' }, { label: 'Recorded payments', value: 'RWF 0', note: 'Your payment history', icon: 'arrow', tone: 'dark' }],
    panelEyebrow: 'Worth a look', panelTitle: 'Recommended for you', activity: [{ name: 'Modern Kacyiru apartment', detail: '2 beds Ã‚Â· Kacyiru Ã‚Â· RWF 1.1M / month', time: 'New today', status: 'View', initials: 'KA' }, { name: 'Four-bedroom home', detail: 'Gisozi Ã‚Â· RWF 1.25M / month', time: '92% match', status: 'View', initials: 'GH' }, { name: 'Light-filled apartment', detail: 'Kimihurura Ã‚Â· RWF 1.65M / month', time: '88% match', status: 'View', initials: 'LA' }], sideEyebrow: 'Your shortlist', sideTitle: 'Saved properties', sideItems: [{ title: 'Kacyiru apartment', detail: 'Saved 2 hours ago', icon: 'heart' }, { title: 'Nyarutarama home', detail: 'Saved yesterday', icon: 'heart' }],
  },
  landlord: {
    eyebrow: 'Property Owner workspace', greeting: 'Good morning', welcome: 'A clearer view of every property you own.', action: 'Post a property', actionIcon: 'bookPen',
    navigation: [{ label: 'Overview', icon: 'building' }, { label: 'My properties', icon: 'home' }, { label: 'Tenants', icon: 'users' }, { label: 'Rent & utilities', icon: 'arrow' }, { label: 'Maintenance', icon: 'bookPen' }, { label: 'Enquiries', icon: 'users' }, { label: 'Messages', icon: 'users' }, { label: 'Income', icon: 'arrow' }],
    metrics: [{ label: 'Listed properties', value: '6', note: '+1 this month', icon: 'home', tone: 'green' }, { label: 'Active enquiries', value: '18', note: '6 need a reply', icon: 'users', tone: 'amber' }, { label: 'Viewings this week', value: '5', note: '2 tomorrow', icon: 'bookPen', tone: 'blue' }, { label: 'Monthly income', value: 'RWF 4.8M', note: '+12% this month', icon: 'arrow', tone: 'dark' }],
    panelEyebrow: 'Keep listings moving', panelTitle: 'Recent enquiries', activity: [{ name: 'Aline Mukamana', detail: 'Kacyiru apartment', time: '10 min ago', status: 'New', initials: 'AM' }, { name: 'Patrick Nshimiyimana', detail: 'Gisozi family home', time: '42 min ago', status: 'Reply', initials: 'PN' }, { name: 'Eric Habimana', detail: 'Remera commercial space', time: 'Yesterday', status: 'Viewing', initials: 'EH' }], sideEyebrow: 'Property health', sideTitle: 'Listing performance', sideItems: [{ title: 'Kacyiru apartment', detail: '24 enquiries Ã‚Â· 94% complete', icon: 'home' }, { title: 'Gisozi family home', detail: '18 enquiries Ã‚Â· 88% complete', icon: 'home' }],
  },
  admin: {
    eyebrow: 'Admin control centre', greeting: 'Good morning', welcome: 'Keep the Umutungo marketplace trusted and moving.', action: 'Review listings', actionIcon: 'check',
    navigation: [{ label: 'Overview', icon: 'building' }, { label: 'Users', icon: 'users' }, { label: 'Listings review', icon: 'home' }, { label: 'Reports', icon: 'bookPen' }, { label: 'About video', icon: 'video' }, { label: 'Locations', icon: 'pin' }],
    metrics: [{ label: 'Total users', value: '2,840', note: '+8.4% this month', icon: 'users', tone: 'green' }, { label: 'Pending reviews', value: '17', note: 'Needs attention', icon: 'bookPen', tone: 'amber' }, { label: 'Active listings', value: '1,204', note: '+56 this month', icon: 'home', tone: 'blue' }, { label: 'Platform enquiries', value: '386', note: 'Across Rwanda', icon: 'arrow', tone: 'dark' }],
    panelEyebrow: 'Needs attention', panelTitle: 'Latest activity', activity: [{ name: 'New listing submitted', detail: 'Commercial space Ã‚Â· Remera', time: '8 min ago', status: 'Review', initials: 'RL' }, { name: 'Agent verification request', detail: 'Jean Claude N. Ã‚Â· Kigali', time: '31 min ago', status: 'Open', initials: 'JV' }, { name: 'Listing reported', detail: 'House Ã‚Â· Nyarutarama', time: 'Yesterday', status: 'Investigate', initials: 'LR' }], sideEyebrow: 'Platform health', sideTitle: 'Quick checks', sideItems: [{ title: 'Verification queue', detail: '17 accounts waiting', icon: 'check' }, { title: 'Reported listings', detail: '3 need review', icon: 'bell' }],
  },
};

const dashboardLanguages: Language[] = ['English', 'French', 'Kinyarwanda', 'Swahili'];
const dashboardLanguageCodes: Record<Language, string> = { English: 'EN', French: 'FR', Kinyarwanda: 'RW', Swahili: 'SW' };

function DashboardFavoritesButton({ language }: { language: Language }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const readFavorites = () => {
      try {
        const stored = JSON.parse(window.localStorage.getItem('umutungo-favorites') ?? '[]') as FavoriteItem[];
        setItems(Array.isArray(stored) ? stored : []);
      } catch { setItems([]); }
    };
    readFavorites();
    window.addEventListener('umutungo:favorites-changed', readFavorites);
    void listFavorites().then((remote) => {
      if (!remote) return;
      setItems(remote);
      window.localStorage.setItem('umutungo-favorites', JSON.stringify(remote));
      window.dispatchEvent(new Event('umutungo:favorites-changed'));
    }).catch(() => undefined);
    return () => window.removeEventListener('umutungo:favorites-changed', readFavorites);
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('mousedown', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape); };
  }, [open]);

  const remove = (propertyID: string) => {
    const next = items.filter((item) => item.property_id !== propertyID);
    setItems(next);
    window.localStorage.setItem('umutungo-favorites', JSON.stringify(next));
    window.dispatchEvent(new Event('umutungo:favorites-changed'));
    void removeFavorite(propertyID).catch(() => undefined);
  };

  return <div className="dashboard-favorites-wrap" ref={ref}><button className="dashboard-header-tool" type="button" title={t(language, 'Favorites')} aria-label={t(language, 'Favorites')} aria-expanded={open} onClick={() => setOpen((current) => !current)}><Icon name="heart" size={17} />{items.length > 0 && <b>{items.length > 9 ? '9+' : items.length}</b>}</button>{open && <FavoritesPanel language={language} items={items} onRemove={remove} onClose={() => setOpen(false)} />}</div>;
}

function DashboardTopbar({ eyebrow, active, initials, accountLabel }: { eyebrow: string; active: string; initials: string; accountLabel: string }) {
  const { darkMode, toggleTheme } = usePersistentTheme();
  const { language, changeLanguage } = usePersistentLanguage();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    const dashboard = document.querySelector('.role-dashboard');
    dashboard?.classList.toggle('dashboard-dark', darkMode);
  }, [darkMode]);

  return <header className="role-dashboard-topbar">
    <div><span className="role-dashboard-eyebrow">{eyebrow}</span><h1>{active}</h1></div>
    <div className="role-dashboard-header-actions">
      <DashboardFavoritesButton language={language} />
      <div className="dashboard-notification-wrap">
        <button className="dashboard-header-tool" type="button" title={t(language, 'Notifications')} aria-label={t(language, 'Notifications')} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Icon name="bell" size={17} /><b>0</b></button>
        {notificationsOpen && <div className="dashboard-notification-popover" role="status">{t(language, 'No new notifications')}</div>}
      </div>
      <button className="dashboard-header-tool" type="button" title={darkMode ? t(language, 'Light mode') : t(language, 'Dark mode')} aria-label={darkMode ? t(language, 'Light mode') : t(language, 'Dark mode')} onClick={toggleTheme}><Icon name={darkMode ? 'sun' : 'moon'} size={17} /></button>
      <label className="dashboard-language-select" title={t(language, 'Language')}><Icon name="globe" size={15} /><select value={language} aria-label={t(language, 'Language')} onChange={(event) => changeLanguage(event.target.value as Language)}>{dashboardLanguages.map((item) => <option key={item} value={item}>{dashboardLanguageCodes[item]}</option>)}</select></label>
      <DashboardAccountMenu initials={initials} accountLabel={accountLabel} onOverview={() => undefined} />
    </div>
  </header>;
}

function DashboardAccountMenu({ initials, accountLabel, onOverview }: { initials: string; accountLabel: string; onOverview: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('mousedown', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape); };
  }, [open]);

  const selectOverview = () => { onOverview(); setOpen(false); };

  return <div className="dashboard-account-menu" ref={ref}>
    <button className={`role-dashboard-profile ${open ? 'is-open' : ''}`} type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span className="role-dashboard-avatar">{initials}</span>
      <span><strong>My account</strong><small>{accountLabel}</small></span>
      <Icon name="chevron" size={14} />
    </button>
    {open && <div className="dashboard-account-panel" role="menu" aria-label="My account">
      <div className="dashboard-account-panel-heading"><span className="role-dashboard-avatar">{initials}</span><span><strong>My account</strong><small>{accountLabel}</small></span></div>
      <button type="button" role="menuitem" onClick={selectOverview}><Icon name="user" size={15} /><span>Account overview</span><Icon name="arrow" size={13} /></button>
      <Link href="/" role="menuitem" onClick={() => setOpen(false)}><Icon name="home" size={15} /><span>Back to marketplace</span><Icon name="arrow" size={13} /></Link>
    </div>}
  </div>;
}

function DashboardAccountBridge({ initials, accountLabel }: { initials: string; accountLabel: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 18 });

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element;
      const profile = target.closest<HTMLElement>('.role-dashboard-profile');
      if (profile) {
        const bounds = profile.getBoundingClientRect();
        setPosition({ top: bounds.bottom + 10, right: Math.max(18, window.innerWidth - bounds.right) });
        setOpen((current) => !current);
        return;
      }
      if (!target.closest('.dashboard-account-bridge-panel')) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('click', handleClick); document.removeEventListener('keydown', closeOnEscape); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const profile = document.querySelector<HTMLElement>('.role-dashboard-profile');
      if (!profile) return;
      const bounds = profile.getBoundingClientRect();
      setPosition({ top: bounds.bottom + 10, right: Math.max(18, window.innerWidth - bounds.right) });
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, { passive: true });
    return () => { window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition); };
  }, [open]);

  if (!open) return null;
  return <div className="dashboard-account-bridge-panel" role="menu" aria-label="My account" style={{ top: position.top, right: position.right }}>
    <div className="dashboard-account-panel-heading"><span className="role-dashboard-avatar">{initials}</span><span><strong>My account</strong><small>{accountLabel}</small></span></div>
    <button type="button" role="menuitem" onClick={() => setOpen(false)}><Icon name="user" size={15} /><span>Account overview</span><Icon name="arrow" size={13} /></button>
    <Link href="/" role="menuitem" onClick={() => setOpen(false)}><Icon name="home" size={15} /><span>Back to marketplace</span><Icon name="arrow" size={13} /></Link>
  </div>;
}

type AdminActivityRecord = AdminActivityExportRecord;
type AdminActivitiesResponse = { items: AdminActivityRecord[]; count: number };

function AdminActivityWorkspace({ filter = 'all' }: { filter?: 'all' | 'users' | 'listings' }) {
  const { language } = usePersistentLanguage();
  const copy = (key: string) => t(language, key);
  const [activities, setActivities] = useState<AdminActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    void umutungoApi<AdminActivitiesResponse>('/api/v1/admin/activities?limit=500')
      .then((result) => { if (!cancelled) { if (result === null) setError('Connect an admin API session to load activity records.'); else setActivities(result.items ?? []); } })
      .catch(() => { if (!cancelled) setError('Activity records could not be loaded. Sign in with an admin account connected to the Umutungo API, then refresh.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const visibleActivities = activities.filter((item) => filter === 'all' || (filter === 'users' ? item.activity_type === 'account_created' : item.activity_type === 'listing_created'));
  const heading = filter === 'users' ? 'New accounts' : filter === 'listings' ? 'New listings' : 'Platform activity';
  return <div className="role-dashboard-content"><section className="role-dashboard-welcome"><div><p className="role-dashboard-eyebrow">{copy(heading)}</p><h2>{copy(filter === 'all' ? 'A clear record of what people do.' : filter === 'users' ? 'New accounts joining the marketplace.' : 'New listings entering the marketplace.')}</h2><p>{copy(filter === 'all' ? 'A live record of accounts, listings, enquiries, messages, bookings, reports, reviews, and listing interactions.' : filter === 'users' ? 'Records below come from actual account registrations in Umutungo.' : 'Records below come from actual property submissions in Umutungo.')}</p></div>{filter === 'all' && <AdminReportDownloadMenu showLabel />}</section><section className="role-dashboard-panel"><div className="role-dashboard-panel-heading"><div><span className="role-dashboard-eyebrow">{copy(filter === 'all' ? 'All users · newest first' : 'Newest first')}</span><h3>{loading ? copy('Loading activity') : `${visibleActivities.length} ${copy(filter === 'all' ? 'recorded activities' : filter === 'users' ? 'accounts recorded' : 'listings recorded')}`}</h3></div><Icon name={filter === 'users' ? 'users' : filter === 'listings' ? 'home' : 'bell'} size={17} /></div>{loading ? <p className="workspace-action-notice" role="status">{copy('Loading recorded activity…')}</p> : error ? <p className="workspace-action-notice" role="alert">{error}</p> : visibleActivities.length ? <div className="role-dashboard-activity">{visibleActivities.map((item) => <article key={`${item.activity_type}-${item.id}`}><span className="role-dashboard-contact-avatar">{item.actor_name.slice(0, 2).toUpperCase()}</span><div><strong>{item.actor_name}</strong><small>{item.summary} · {item.actor_role.replaceAll('_', ' ')}</small></div><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></article>)}</div> : <p className="workspace-action-notice">{copy(filter === 'all' ? 'No activity has been recorded yet. New account and marketplace actions will appear here automatically.' : filter === 'users' ? 'No account registrations appear in the recent activity records yet.' : 'No listings appear in the recent activity records yet.')}</p>}</section></div>;
}

function AdminOverview({ onReports }: { onReports: () => void }) {
  const { language } = usePersistentLanguage();
  const copy = (key: string) => t(language, key);
  const [activities, setActivities] = useState<AdminActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    void umutungoApi<AdminActivitiesResponse>('/api/v1/admin/activities?limit=500')
      .then((result) => { if (!cancelled) { if (!result) setError('Sign in with an administrator account connected to the Umutungo API to load live platform activity.'); else setActivities(result.items ?? []); } })
      .catch(() => { if (!cancelled) setError('Live platform activity could not be loaded. Check the administrator API connection.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const accounts = activities.filter((item) => item.activity_type === 'account_created').length;
  const listings = activities.filter((item) => item.activity_type === 'listing_created').length;
  const interactions = activities.filter((item) => item.activity_type === 'listing_interaction').length;
  const reports = activities.filter((item) => item.activity_type === 'listing_reported').length;
  const metricItems: Array<{ label: string; value: string; note: string; icon: IconName; tone: Metric['tone'] }> = [
    { label: 'Recent records', value: loading ? '—' : String(activities.length), note: 'Latest API activity batch', icon: 'bell', tone: 'green' },
    { label: 'New accounts', value: loading ? '—' : String(accounts), note: 'In this activity batch', icon: 'users', tone: 'blue' },
    { label: 'Listings posted', value: loading ? '—' : String(listings), note: 'In this activity batch', icon: 'home', tone: 'amber' },
    { label: 'Reports filed', value: loading ? '—' : String(reports), note: `${interactions} listing interactions`, icon: 'check', tone: 'dark' },
  ];
  return <div className="role-dashboard-content admin-overview-content"><section className="role-dashboard-welcome admin-overview-welcome"><div><p className="role-dashboard-eyebrow">{copy('Trust and safety · Rwanda')}</p><h2>{copy('One clear view of Umutungo today.')}</h2><p>{copy('Follow real activity across accounts, property posts and marketplace interactions, then move into the work that needs attention.')}</p></div><div className="admin-dashboard-welcome-actions"><button className="role-dashboard-primary" type="button" onClick={onReports}><Icon name="bell" size={16} /> {copy('Open activity report')}</button><AdminReportDownloadMenu showLabel /></div></section><section className="role-dashboard-metrics admin-overview-metrics" aria-label={copy('Live platform activity')}>{metricItems.map((metric) => <article key={metric.label}><span className={`role-dashboard-metric-icon ${metric.tone}`}><Icon name={metric.icon} size={17} /></span><small>{copy(metric.label)}</small><strong>{metric.value}</strong><em>{copy(metric.note)}</em></article>)}</section><section className="role-dashboard-panel admin-overview-feed"><div className="role-dashboard-panel-heading"><div><span className="role-dashboard-eyebrow">{copy('Live record · newest first')}</span><h3>{copy('What’s happening across the platform')}</h3></div><button type="button" onClick={onReports}>{copy('Full activity')} <Icon name="arrow" size={14} /></button></div>{loading ? <p className="workspace-action-notice" role="status">{copy('Loading activity from Umutungo…')}</p> : error ? <p className="workspace-action-notice" role="alert">{error}</p> : activities.length ? <div className="role-dashboard-activity">{activities.slice(0, 8).map((item) => <article key={`${item.activity_type}-${item.id}`}><span className="role-dashboard-contact-avatar">{item.actor_name.slice(0, 2).toUpperCase()}</span><div><strong>{item.actor_name}</strong><small>{item.summary} · {item.actor_role.replaceAll('_', ' ')}</small></div><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></article>)}</div> : <div className="admin-overview-empty"><span><Icon name="pin" size={20} /></span><div><strong>{copy('The activity record is ready.')}</strong><p>{copy('New account and marketplace actions will appear here as they are recorded.')}</p></div></div>}</section></div>;
}

function AdminReportDownloadMenu({ showLabel = false }: { showLabel?: boolean }) {
  const { language } = usePersistentLanguage();
  const copy = (key: string) => t(language, key);
  const [open, setOpen] = useState(false);
  const [activities, setActivities] = useState<AdminActivityRecord[]>([]);
  const [busy, setBusy] = useState<'pdf' | 'image' | 'excel' | ''>('');
  const [notice, setNotice] = useState('');
  const [loadIssue, setLoadIssue] = useState('');
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const first = await umutungoApi<AdminActivitiesResponse>('/api/v1/admin/activities?limit=500');
        if (!first) throw new Error('Connect an admin API session to generate this report.');
        const allActivities = [...(first.items ?? [])];
        for (let offset = first.items?.length ?? 0; (first.items?.length ?? 0) === 500; offset += 500) {
          const page = await umutungoApi<AdminActivitiesResponse>(`/api/v1/admin/activities?limit=500&offset=${offset}`);
          if (!page) throw new Error('The activity report could not be loaded.');
          allActivities.push(...(page.items ?? []));
          if ((page.items?.length ?? 0) < 500) break;
        }
        if (!cancelled) setActivities(allActivities);
      } catch (caught) { if (!cancelled) { setActivities([]); setLoadIssue(caught instanceof Error ? caught.message : 'Activity could not be loaded. Check the admin API connection.'); } }
    };
    void load();
    return () => { cancelled = true; };
  }, []);
  const download = async (format: 'pdf' | 'image' | 'excel') => {
    setBusy(format);
    try {
      if (format === 'pdf') downloadActivityPdf(activities);
      else if (format === 'excel') downloadActivityExcel(activities);
      else await downloadActivityImage(activities);
      setNotice(`${format === 'image' ? 'PNG image' : format.toUpperCase()} report downloaded with ${activities.length} activities.`);
    } catch (caught) { setNotice(caught instanceof Error ? caught.message : 'The activity report could not be prepared. Please try again.'); }
    finally { setBusy(''); }
  };
  return <div className={`dashboard-notification-wrap admin-report-download-wrap ${showLabel ? 'is-labeled' : ''}`}><button className={`dashboard-header-tool ${showLabel ? 'admin-report-download-trigger' : ''}`} type="button" title={copy('Download activity report')} aria-label={copy('Download activity report')} aria-expanded={open} onClick={() => setOpen((current) => !current)}><Icon name="download" size={17} />{showLabel && <span>{copy('Export activity')}</span>}</button>{open && <div className="dashboard-notification-popover admin-report-download-popover" role="dialog" aria-label={copy('Download activity report')}><strong>{copy('Export user activity')}</strong><small>{activities.length} {copy('recorded activities · includes all pages')}</small><div className="admin-report-format-grid"><button type="button" onClick={() => void download('pdf')} disabled={busy !== '' || activities.length === 0}><Icon name="download" size={13} /> {busy === 'pdf' ? copy('Preparing…') : copy('PDF document')}</button><button type="button" onClick={() => void download('image')} disabled={busy !== '' || activities.length === 0}><Icon name="download" size={13} /> {busy === 'image' ? copy('Preparing…') : copy('PNG image')}</button><button type="button" onClick={() => void download('excel')} disabled={busy !== '' || activities.length === 0}><Icon name="download" size={13} /> {busy === 'excel' ? copy('Preparing…') : copy('Excel sheet')}</button></div>{loadIssue ? <em role="alert">{loadIssue}</em> : activities.length === 0 && <em>{copy('No recorded activity yet. New actions will appear here automatically.')}</em>}{notice && <em role="status">{notice}</em>}</div>}</div>;
}

function notificationDestination(item: ApiNotification, role: DashboardRole) {
  const message = `${item.type} ${item.title} ${item.body}`.toLowerCase();
  if (message.includes('message') || message.includes('reply')) return 'Messages';
  if (message.includes('application') || message.includes('enquir')) return role === 'tenant' ? 'Applications' : 'Enquiries';
  if (message.includes('visit') || message.includes('viewing') || message.includes('booking')) return role === 'commissioner' ? 'Visits' : role === 'tenant' ? 'Viewings' : 'Enquiries';
  if (message.includes('maintenance') || message.includes('repair')) return 'Maintenance';
  if (message.includes('payment') || message.includes('rent')) return role === 'tenant' ? 'Rent & utilities' : 'Income';
  if (message.includes('listing') || message.includes('property')) return role === 'commissioner' ? 'My listings' : 'My properties';
  return 'Notifications';
}

function useDashboardNotificationNavigation(setActive: (section: string) => void) {
  useEffect(() => {
    const navigate = (event: Event) => {
      const section = (event as CustomEvent<{ section?: string }>).detail?.section;
      if (section) setActive(section);
    };
    window.addEventListener('umutungo:dashboard-navigate', navigate);
    return () => window.removeEventListener('umutungo:dashboard-navigate', navigate);
  }, [setActive]);
}

function DashboardUtilityDock({ isAdmin = false, role }: { isAdmin?: boolean; role?: DashboardRole }) {
  const { darkMode, toggleTheme } = usePersistentTheme();
  const { language, changeLanguage } = usePersistentLanguage();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);

  useEffect(() => {
    const dashboard = document.querySelector('.role-dashboard');
    dashboard?.classList.toggle('dashboard-dark', darkMode);
  }, [darkMode]);
  useEffect(() => {
    let cancelled = false;
    const loadNotifications = async () => {
      if (!window.localStorage.getItem('umutungo-demo-user')) {
        setNotifications([]);
        return;
      }
      const storedRole = role ?? window.localStorage.getItem('umutungo-demo-user')?.toLowerCase() ?? '';
      try {
        const result = await umutungoApi<{ items: ApiNotification[] }>('/api/v1/notifications');
        if (cancelled) return;
        if (result?.items) { setNotifications(result.items.filter((item) => !item.read_at)); return; }
      } catch { /* Use the local notification queue when the API is unavailable. */ }
      try {
        const key = storedRole.includes('landlord') ? 'umutungo-landlord-notifications' : storedRole.includes('commissioner') ? 'umutungo-commissioner-notifications' : 'umutungo-tenant-notifications';
        const local = JSON.parse(window.localStorage.getItem(key) ?? '[]') as Array<Record<string, string>>;
        if (!cancelled) setNotifications(local.filter((item) => !item.readAt).map((item) => ({ id: item.id ?? `local-${Date.now()}`, type: item.type ?? 'update', title: item.title ?? 'New update', body: item.body ?? '', created_at: item.createdAt ?? new Date().toISOString() })));
      } catch { if (!cancelled) setNotifications([]); }
    };
    void loadNotifications();
    const refresh = () => { void loadNotifications(); };
    const timer = window.setInterval(loadNotifications, 20000);
    window.addEventListener('umutungo:notifications-changed', refresh);
    window.addEventListener('umutungo:landlord-data-changed', refresh);
    window.addEventListener('umutungo:tenant-data-changed', refresh);
    window.addEventListener('umutungo:commissioner-data-changed', refresh);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('umutungo:notifications-changed', refresh); window.removeEventListener('umutungo:landlord-data-changed', refresh); window.removeEventListener('umutungo:tenant-data-changed', refresh); window.removeEventListener('umutungo:commissioner-data-changed', refresh); };
  }, [role]);
  return <div className={`dashboard-utility-dock ${darkMode ? 'is-dark' : ''}`} aria-label="Dashboard tools">
    <DashboardFavoritesButton language={language} />
    {isAdmin && <AdminReportDownloadMenu />}
    <div className="dashboard-notification-wrap"><button className="dashboard-header-tool" type="button" title={t(language, 'Notifications')} aria-label={t(language, 'Notifications')} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Icon name="bell" size={17} />{notifications.length > 0 && <b>{notifications.length > 99 ? '99+' : notifications.length}</b>}</button>{notificationsOpen && <div className="dashboard-notification-popover dashboard-notification-list" role="dialog" aria-label={t(language, 'Notifications')}>{notifications.length ? notifications.slice(0, 8).map((item) => <button className="dashboard-notification-item" key={item.id} type="button" onClick={() => { setNotificationsOpen(false); const section = role ? notificationDestination(item, role) : 'Reports'; window.dispatchEvent(new CustomEvent('umutungo:dashboard-navigate', { detail: { section } })); }}><strong>{item.title}</strong><small>{item.body}</small><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></button>) : <p>{t(language, 'No new notifications')}</p>}</div>}</div>
    <button className="dashboard-header-tool" type="button" title={darkMode ? t(language, 'Light mode') : t(language, 'Dark mode')} aria-label={darkMode ? t(language, 'Light mode') : t(language, 'Dark mode')} onClick={toggleTheme}><Icon name={darkMode ? 'sun' : 'moon'} size={17} /></button>
    <label className="dashboard-language-select" title={t(language, 'Language')}><Icon name="globe" size={15} /><select value={language} aria-label={t(language, 'Language')} onChange={(event) => changeLanguage(event.target.value as Language)}>{dashboardLanguages.map((item) => <option key={item} value={item}>{dashboardLanguageCodes[item]}</option>)}</select></label>
  </div>;
}

function LegacyTenantWorkspaceSection({ view }: { view: string }) {
  const panels: Record<string, { eyebrow: string; title: string; description: string; icon: IconName }> = {
    'Saved properties': { eyebrow: 'Your shortlist', title: 'Saved properties', description: 'Keep the homes, apartments, and spaces you want to compare close at hand.', icon: 'heart' },
    Viewings: { eyebrow: 'Your calendar', title: 'Upcoming viewings', description: 'See every confirmed visit and keep the next step clear.', icon: 'bookPen' },
    Messages: { eyebrow: 'Stay connected', title: 'Messages', description: 'Continue conversations with landlords and property contacts from one place.', icon: 'users' },
  };
  const panel = panels[view] ?? panels['Saved properties'];
  const rows = view === 'Saved properties' ? [{ title: 'Light-filled Kacyiru apartment', detail: '2 beds Ã‚Â· Kacyiru Ã‚Â· RWF 1.1M / month', action: 'View property' }, { title: 'Four-bedroom home with garden', detail: 'Gisozi Ã‚Â· RWF 1.25M / month', action: 'Compare' }, { title: 'Nyarutarama family residence', detail: '5 beds Ã‚Â· RWF 2.4M / month', action: 'View property' }] : view === 'Viewings' ? [{ title: 'Kacyiru apartment', detail: 'Tomorrow Ã‚Â· 11:30 AM Ã‚Â· Confirmed', action: 'View details' }, { title: 'Gisozi family home', detail: 'Friday Ã‚Â· 2:00 PM Ã‚Â· Landlord confirmed', action: 'Open visit' }] : [{ title: 'Eric N. Ã‚Â· Kacyiru apartment', detail: 'Landlord replied 10 min ago', action: 'Open message' }, { title: 'Aline M. Ã‚Â· Gisozi family home', detail: 'Viewing details shared yesterday', action: 'Reply' }];
  return <section className="tenant-workspace-section"><div className="tenant-workspace-heading"><div><span className="role-dashboard-eyebrow">{panel.eyebrow}</span><h2>{panel.title}</h2><p>{panel.description}</p></div><span className="tenant-workspace-icon"><Icon name={panel.icon} size={22} /></span></div><div className="tenant-workspace-list">{rows.map((row) => <article key={row.title}><span className="tenant-workspace-row-icon"><Icon name={panel.icon} size={16} /></span><div><strong>{row.title}</strong><small>{row.detail}</small></div><button type="button">{row.action}<Icon name="arrow" size={14} /></button></article>)}</div><button className="role-dashboard-primary" type="button"><Icon name={view === 'Messages' ? 'bookPen' : 'search'} size={16} /> {view === 'Saved properties' ? 'Explore more properties' : view === 'Viewings' ? 'Find another viewing' : 'Start a new conversation'}</button></section>;
}

type TenantWorkspaceProps = { view: string; tenantData?: TenantDashboardData; favorites?: FavoriteItem[]; notifications?: ApiNotification[]; onViewed?: (application: ApiApplication) => void; onPay?: (application: ApiApplication) => void; onContact?: (application: ApiApplication) => void; onReview?: (application: ApiApplication) => void; onAction?: (action: string) => void; onPrimaryAction?: (action: string) => void; notice?: string };

function TenantWorkspaceActionDialog({ action, onClose, onNotice }: { action: 'payment-method' | 'maintenance' | 'commissioner'; onClose: () => void; onNotice: (notice: string) => void }) {
  const [paymentMethod, setPaymentMethod] = useState('mtn_momo');
  const [paymentDetails, setPaymentDetails] = useState('');
  const [maintenanceTitle, setMaintenanceTitle] = useState('');
  const [maintenanceDetails, setMaintenanceDetails] = useState('');
  const [message, setMessage] = useState('');
  const submitPaymentMethod = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!paymentDetails.trim()) return;
    const method = { id: `method-${Date.now()}`, provider: paymentMethod, details: paymentDetails.trim(), created_at: new Date().toISOString() };
    const stored = JSON.parse(window.localStorage.getItem('umutungo-payment-methods') ?? '[]') as Array<typeof method>;
    window.localStorage.setItem('umutungo-payment-methods', JSON.stringify([method, ...stored]));
    onClose();
    onNotice('Payment method added to your account.');
  };
  const submitMaintenance = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!maintenanceTitle.trim() || !maintenanceDetails.trim()) return;
    const request = { id: `maintenance-${Date.now()}`, title: maintenanceTitle.trim(), details: maintenanceDetails.trim(), status: 'Open', created_at: new Date().toISOString() };
    const stored = JSON.parse(window.localStorage.getItem('umutungo-maintenance-requests') ?? '[]') as Array<typeof request>;
    window.localStorage.setItem('umutungo-maintenance-requests', JSON.stringify([request, ...stored]));
    onClose();
    onNotice('Maintenance request submitted to the property owner.');
  };
  const submitCommissioner = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim()) return;
    const createdAt = new Date().toISOString();
    const item: ApiMessage = { id: `commissioner-message-${Date.now()}`, sender_id: 'tenant-demo', sender_name: 'Tenant', recipient_id: 'commissioner', recipient_name: 'Komisiyoneri', listing_id: '', body: message.trim(), created_at: createdAt };
    const messages = JSON.parse(window.localStorage.getItem('umutungo-commissioner-messages') ?? '[]') as ApiMessage[];
    window.localStorage.setItem('umutungo-commissioner-messages', JSON.stringify([item, ...messages]));
    const notifications = JSON.parse(window.localStorage.getItem('umutungo-commissioner-notifications') ?? '[]') as Array<Record<string, unknown>>;
    window.localStorage.setItem('umutungo-commissioner-notifications', JSON.stringify([{ id: `commissioner-notification-${item.id}`, type: 'message_received', title: 'New client message', body: item.body, createdAt, readAt: null }, ...notifications]));
    window.dispatchEvent(new CustomEvent('umutungo:commissioner-data-changed'));
    onClose();
    onNotice('Message sent to the Komisiyoneri.');
  };
  return <div className="tenant-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="workspace-action-title"><button className="tenant-dialog-backdrop" type="button" aria-label="Close workspace action" onClick={onClose} /><section className="tenant-dialog"><button className="property-action-close" type="button" aria-label="Close workspace action" onClick={onClose}><Icon name="x" size={18} /></button>{action === 'payment-method' && <><span className="role-dashboard-eyebrow">Rent & utilities</span><h2 id="workspace-action-title">Add a payment method</h2><form className="tenant-dialog-form" onSubmit={submitPaymentMethod}><p>Save a payment method for future rent and utility payments.</p><label>Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="mtn_momo">MTN MoMo</option><option value="airtel_money">Airtel Money</option><option value="card">Bank card</option></select></label><label>{paymentMethod === 'card' ? 'Card details' : 'Phone number'}<input value={paymentDetails} onChange={(event) => setPaymentDetails(event.target.value)} placeholder={paymentMethod === 'card' ? 'Last four digits or card label' : '+250 7XX XXX XXX'} required /></label><button className="role-dashboard-primary" type="submit">Save payment method <Icon name="check" size={15} /></button></form></>}{action === 'maintenance' && <><span className="role-dashboard-eyebrow">Property care</span><h2 id="workspace-action-title">Create maintenance request</h2><form className="tenant-dialog-form" onSubmit={submitMaintenance}><p>Tell the property owner what needs attention.</p><label>Issue title<input value={maintenanceTitle} onChange={(event) => setMaintenanceTitle(event.target.value)} placeholder="e.g. Kitchen tap replacement" required /></label><label>Details<textarea value={maintenanceDetails} onChange={(event) => setMaintenanceDetails(event.target.value)} placeholder="Describe the issue" rows={4} required /></label><button className="role-dashboard-primary" type="submit">Submit request <Icon name="arrow" size={15} /></button></form></>}{action === 'commissioner' && <><span className="role-dashboard-eyebrow">Komisiyoneri support</span><h2 id="workspace-action-title">Contact Komisiyoneri</h2><form className="tenant-dialog-form" onSubmit={submitCommissioner}><p>Send a message to the Komisiyoneri helping you with your property journey.</p><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write your message" rows={5} required /><button className="role-dashboard-primary" type="submit">Send message <Icon name="arrow" size={15} /></button></form></>}</section></div>;
}

function LandlordMessageWorkspace({ messages, currentUserID, onSent, contactLabel = 'tenant' }: { messages: ApiMessage[]; currentUserID: string; onSent: (message: ApiMessage) => void; contactLabel?: 'tenant' | 'client' }) {
  const [selectedID, setSelectedID] = useState(messages[0]?.id ?? '');
  const [draft, setDraft] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const selected = messages.find((message) => message.id === selectedID) ?? messages[0];
  const targetID = selected ? (selected.sender_id === currentUserID ? selected.recipient_id : selected.sender_id) : '';
  const conversation = selected ? messages.filter((message) => message.listing_id === selected.listing_id && (message.sender_id === selected.sender_id || message.recipient_id === selected.sender_id)) : [];

  useEffect(() => {
    if (!selected && messages[0]) setSelectedID(messages[0].id);
  }, [messages, selected]);

  const generateReply = async () => {
    if (!selected) return;
    setAiLoading(true);
    setNotice('');
    try {
      const response = await fetch('/api/message-reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantMessage: selected.body, listingTitle: `Property ${selected.listing_id}`, conversation: conversation.map((message) => `${message.sender_name}: ${message.body}`).join('\n') }) });
      const body = await response.json() as { reply?: string; error?: string };
      if (!response.ok || !body.reply) throw new Error(body.error ?? 'Could not draft reply');
      setDraft(body.reply);
      setNotice('Groq prepared a reply. Review it before sending.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not prepare a reply.');
    } finally {
      setAiLoading(false);
    }
  };

  const sendReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !targetID || !draft.trim()) return;
    try {
      const result = await umutungoApi<{ id: string }>('/api/v1/messages', { method: 'POST', body: JSON.stringify({ listing_id: selected.listing_id, recipient_id: targetID, body: draft.trim() }) });
      const sentMessage: ApiMessage = { id: result?.id ?? `message-${Date.now()}`, sender_id: currentUserID, sender_name: 'You', recipient_id: targetID, recipient_name: selected.sender_name, listing_id: selected.listing_id, body: draft.trim(), created_at: new Date().toISOString() };
      onSent(sentMessage);
      const localMessages = JSON.parse(window.localStorage.getItem('umutungo-tenant-messages') ?? '[]') as ApiMessage[];
      window.localStorage.setItem('umutungo-tenant-messages', JSON.stringify([sentMessage, ...localMessages]));
      window.dispatchEvent(new CustomEvent('umutungo:tenant-data-changed'));
      setDraft('');
      setNotice(result ? `Reply sent to the ${contactLabel}.` : `Reply saved locally. Connect the backend session to deliver it to the ${contactLabel}.`);
    } catch {
      setNotice('The reply could not be sent. Check that the backend session is connected.');
    }
  };

  return <section className="tenant-workspace-section landlord-message-workspace"><div className="tenant-workspace-heading"><div><span className="role-dashboard-eyebrow">Tenant conversations</span><h2>Messages</h2><p>Read tenant questions, discuss the rent, and agree on the next step from one place.</p></div><span className="tenant-workspace-icon"><Icon name="users" size={22} /></span></div>{messages.length ? <div className="landlord-message-layout"><div className="landlord-message-inbox">{messages.filter((message, index, all) => index === all.findIndex((item) => item.listing_id === message.listing_id && item.sender_id === message.sender_id)).map((message) => <button className={selected?.id === message.id ? 'is-selected' : ''} type="button" key={message.id} onClick={() => setSelectedID(message.id)}><strong>{message.sender_name}</strong><small>{message.body}</small><time>{new Date(message.created_at).toLocaleDateString()}</time></button>)}</div><div className="landlord-message-thread"><div className="landlord-message-thread-list">{conversation.map((message) => <article key={message.id} className={message.sender_id === currentUserID ? 'is-owner' : ''}><strong>{message.sender_name}</strong><p>{message.body}</p><time>{new Date(message.created_at).toLocaleString()}</time></article>)}</div><form className="tenant-message-composer" onSubmit={sendReply}><label htmlFor="landlord-message-draft">Reply to {selected?.sender_name ?? 'tenant'}</label><textarea id="landlord-message-draft" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a reply or agree on the monthly price" rows={4} /><div><button className="role-dashboard-outline" type="button" onClick={generateReply} disabled={aiLoading || !selected}>{aiLoading ? 'PreparingÃ¢â‚¬Â¦' : 'Draft with Groq'}</button><button className="role-dashboard-primary" type="submit">Send reply <Icon name="arrow" size={15} /></button></div>{notice && <small>{notice}</small>}</form></div></div> : <div className="tenant-message-empty"><Icon name="bookPen" size={20} /><div><strong>No tenant messages yet</strong><p>Messages sent from a property or application will appear here.</p></div></div>}</section>;
}

function TenantMessageWorkspace({ tenantData }: { tenantData?: TenantDashboardData }) {
  const [draft, setDraft] = useState('');
  const [sentNotice, setSentNotice] = useState('');
  const messages = tenantData?.messages ?? [];
  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    const message: ApiMessage = { id: `message-${Date.now()}`, sender_id: 'me', sender_name: 'You', recipient_id: '', recipient_name: 'Umutungo support', listing_id: '', body, created_at: new Date().toISOString() };
    try {
      const stored = JSON.parse(window.localStorage.getItem('umutungo-tenant-messages') ?? '[]') as ApiMessage[];
      window.localStorage.setItem('umutungo-tenant-messages', JSON.stringify([...stored, message]));
    } catch { /* Keep the composer usable when storage is unavailable. */ }
    window.dispatchEvent(new Event('storage'));
    setDraft('');
    setSentNotice('Message saved to your tenant workspace.');
  };
  return <section className="tenant-workspace-section tenant-message-workspace"><div className="tenant-workspace-heading"><div><span className="role-dashboard-eyebrow">Stay connected</span><h2>Messages</h2><p>Write to Umutungo support or continue a conversation about a property, viewing, or application.</p></div><span className="tenant-workspace-icon"><Icon name="users" size={22} /></span></div><div className="tenant-message-list">{messages.length ? messages.slice().reverse().map((message) => <article key={message.id}><span className="tenant-workspace-row-icon"><Icon name="users" size={16} /></span><div><strong>{message.sender_name}</strong><small>{message.body}</small></div><time>{new Date(message.created_at).toLocaleDateString()}</time></article>) : <div className="tenant-message-empty"><Icon name="bookPen" size={20} /><div><strong>No messages yet</strong><p>Start a conversation and keep your property questions in one place.</p></div></div>}</div><form className="tenant-message-composer" onSubmit={sendMessage}><label htmlFor="tenant-message-draft">Write a message</label><textarea id="tenant-message-draft" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about a property, viewing, or application" rows={4} /><div><small>{sentNotice || 'Your message stays in your tenant workspace.'}</small><button className="role-dashboard-primary" type="submit"><Icon name="arrow" size={15} /> Send message</button></div></form></section>;
}

function TenantWorkspaceSection({ view, tenantData, favorites = [], notifications = [], onViewed, onPay, onContact, onReview, onAction, onPrimaryAction, notice }: TenantWorkspaceProps) {
  const [workspaceAction, setWorkspaceAction] = useState<'payment-method' | 'maintenance' | 'commissioner' | null>(null);
  const [workspaceNotice, setWorkspaceNotice] = useState('');
  if (view === 'Notifications') return <TenantNotificationWorkspace notifications={notifications.length ? notifications : tenantData?.notifications ?? []} />;
  if (view === 'Messages') return <TenantMessageWorkspace tenantData={tenantData} />;
  const panels: Record<string, { eyebrow: string; title: string; description: string; icon: IconName }> = {
    Applications: { eyebrow: 'Rental applications', title: 'Applications', description: 'Track each application from submitted to accepted and keep the next step clear.', icon: 'bookPen' },
    'Rent & utilities': { eyebrow: 'Payments and reminders', title: 'Rent & utilities', description: 'See what is due, review payment history, and keep utility obligations visible.', icon: 'arrow' },
    Maintenance: { eyebrow: 'Property care', title: 'Maintenance requests', description: 'Report a repair and follow its progress with the property owner or manager.', icon: 'users' },
    Tenants: { eyebrow: 'Occupancy', title: 'Tenant management', description: 'Review tenant relationships, occupancy status, and important follow-ups.', icon: 'users' },
    'Saved properties': { eyebrow: 'Your shortlist', title: 'Saved properties', description: 'Keep the homes, apartments, and spaces you want to compare close at hand.', icon: 'heart' },
    Viewings: { eyebrow: 'Your calendar', title: 'Upcoming viewings', description: 'See every confirmed visit and keep the next step clear.', icon: 'bookPen' },
    Messages: { eyebrow: 'Stay connected', title: 'Messages', description: 'Continue conversations with landlords and property contacts from one place.', icon: 'users' },
  };
  const panel = panels[view] ?? panels['Saved properties'];
  const rows: Array<{ title: string; detail: string; action: string; application?: ApiApplication; propertyID?: string }> = view === 'Applications' && tenantData ? tenantData.applications.map((application) => ({ title: application.listing_title, detail: `${application.status} · ${application.viewed_at ? 'House seen' : 'House not seen yet'}`, action: application.viewed_at ? 'Pay deposit' : 'Mark house seen', application })) : view === 'Rent & utilities' && tenantData ? tenantData.payments.map((payment) => ({ title: `${payment.provider} payment`, detail: `${payment.currency} ${payment.amount.toLocaleString()} · ${payment.status}`, action: 'View payment' })) : view === 'Saved properties' ? favorites.map((item) => ({ title: item.title, detail: `${item.type} · ${item.location} · ${item.price}`, action: 'View property', propertyID: item.property_id })) : view === 'Viewings' && tenantData ? tenantData.bookings.map((booking) => ({ title: booking.property_title, detail: `${booking.location} · ${booking.price}`, action: 'View property' })) : [];
  const openWorkspaceAction = (action: string) => { if (onPrimaryAction) { onPrimaryAction(action); return; } if (action === 'Add a payment method') setWorkspaceAction('payment-method'); else if (action === 'Create maintenance request') setWorkspaceAction('maintenance'); else if (action === 'Contact Komisiyoneri') setWorkspaceAction('commissioner'); else if (onAction) onAction(action); else window.dispatchEvent(new CustomEvent('umutungo:tenant-workspace-action', { detail: { action } })); };
  const handleAction = (action: string, application?: ApiApplication) => { if (application && action === 'Mark house seen') onViewed?.(application); else if (application && action === 'Pay deposit') onPay?.(application); else if (application && action === 'Contact landlord') onContact?.(application); else if (application && action === 'Review property') onReview?.(application); else if (action === 'Start another application' || action === 'Explore homes' || action === 'Explore more properties') window.location.assign('/categories/houses'); else openWorkspaceAction(action); };
  const primaryLabel = view === 'Applications' ? 'Start another application' : view === 'Rent & utilities' ? 'Add a payment method' : view === 'Maintenance' ? 'Create maintenance request' : view === 'Tenants' ? 'Contact Komisiyoneri' : view === 'Messages' ? 'Start a new conversation' : view === 'Viewings' ? 'Find another viewing' : 'Explore more properties';
  return <><section className="tenant-workspace-section"><div className="tenant-workspace-heading"><div><span className="role-dashboard-eyebrow">{panel.eyebrow}</span><h2>{panel.title}</h2><p>{panel.description}</p></div><span className="tenant-workspace-icon"><Icon name={panel.icon} size={22} /></span></div>{tenantData?.bookings && <TenantBookingSummary bookings={tenantData.bookings} />}{rows.length ? <div className="tenant-workspace-list">{rows.map((row) => <article key={row.title}><span className="tenant-workspace-row-icon"><Icon name={panel.icon} size={16} /></span><div><strong>{row.title}</strong><small>{row.detail}</small></div><button type="button" onClick={() => 'propertyID' in row && row.propertyID ? window.location.assign('/property/' + encodeURIComponent(row.propertyID)) : handleAction(row.action, 'application' in row ? row.application : undefined)}>{row.action}<Icon name="arrow" size={14} /></button>{'application' in row && row.application && row.application.viewed_at && <><button type="button" onClick={() => onContact?.(row.application!)}>Contact landlord<Icon name="users" size={14} /></button><button type="button" onClick={() => onReview?.(row.application!)}>Review property<Icon name="arrow" size={14} /></button></>}</article>)}</div> : <div className="tenant-message-empty"><Icon name={panel.icon} size={20} /><div><strong>{view === 'Applications' ? 'No applications yet' : view === 'Rent & utilities' ? 'No payments yet' : view === 'Viewings' ? 'No viewings yet' : view === 'Maintenance' ? 'No maintenance requests yet' : 'No saved properties yet'}</strong><p>{view === 'Applications' ? 'Apply to a listing to track its status here.' : view === 'Rent & utilities' ? 'Your payment history will appear after a payment is recorded.' : view === 'Viewings' ? 'Viewings appear after a listing contact confirms a visit.' : view === 'Maintenance' ? 'Create a request when you need help with a property you rent.' : 'Save a listing from the marketplace and it will appear here.'}</p></div></div>}{(notice || workspaceNotice) && <p className="workspace-action-notice" role="status"><Icon name="check" size={14} /> {notice || workspaceNotice}</p>}<button className="role-dashboard-primary" type="button" onClick={() => openWorkspaceAction(primaryLabel)}><Icon name={view === 'Messages' ? 'bookPen' : 'arrow'} size={16} /> {primaryLabel}</button></section>{workspaceAction && <TenantWorkspaceActionDialog action={workspaceAction} onClose={() => setWorkspaceAction(null)} onNotice={(message) => { setWorkspaceNotice(message); onAction?.(message); }} />}</>;
}

function LandlordPropertiesSection({ listings, title = 'My properties', actionLabel = 'Post a property', onDelete, onManage }: { listings: DashboardListing[]; title?: string; actionLabel?: string; onDelete?: (listing: DashboardListing) => void; onManage?: (listing: DashboardListing) => void }) {
  return <section className="landlord-properties-section"><div className="tenant-workspace-heading"><div><span className="role-dashboard-eyebrow">Your inventory</span><h2>{title}</h2><p>View the property assets you have uploaded and keep each listing ready for its next step.</p></div><span className="tenant-workspace-icon"><Icon name="home" size={22} /></span></div>{listings.length ? <div className="landlord-property-grid">{listings.map((listing) => <article className="landlord-property-card" key={listing.id}><div className="landlord-property-image"><img src={listing.cover} alt={listing.title} /><span>{listing.status}</span></div><div className="landlord-property-copy"><div><span className="role-dashboard-eyebrow">{listing.type} Ã‚Â· {listing.intent}</span><h3>{listing.title}</h3><p>{listing.location}</p></div><strong>{listing.price} <small>{listing.priceNote}</small></strong><div className="landlord-property-meta"><span>{listing.bedrooms} beds</span><span>{listing.bathrooms} baths</span><span>{listing.area} m2</span></div><div className="landlord-property-actions"><button type="button" onClick={() => onManage?.(listing)}>Manage listing <Icon name="arrow" size={14} /></button>{onDelete && <button className="landlord-delete-button" type="button" onClick={() => onDelete(listing)}>Delete listing</button>}</div></div></article>)}</div> : <div className="landlord-empty-properties"><span className="tenant-workspace-icon"><Icon name="download" size={22} /></span><h3>No uploaded properties yet</h3><p>Your saved listing assets will appear here after you complete the post-property builder.</p><Link className="role-dashboard-primary" href="/post-property"><Icon name="bookPen" size={16} /> {actionLabel}</Link></div>}</section>;
}

function LandlordListingEditor({ listing, onSave, onCancel }: { listing: DashboardListing; onSave: (listing: DashboardListing) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(listing.title);
  const [price, setPrice] = useState(listing.price.replace(/[^0-9.]/g, ''));
  const [status, setStatus] = useState(listing.status);
  return <section className="tenant-workspace-section listing-editor"><div className="tenant-workspace-heading"><div><span className="role-dashboard-eyebrow">Listing editor</span><h2>Manage listing</h2><p>Update the details your tenants and buyers see in the marketplace.</p></div><span className="tenant-workspace-icon"><Icon name="bookPen" size={22} /></span></div><form className="listing-editor-form" onSubmit={(event) => { event.preventDefault(); const numericPrice = Number(price); onSave({ ...listing, title: title.trim() || listing.title, price: `${listing.price.split(' ')[0] || 'RWF'} ${Number.isFinite(numericPrice) ? numericPrice.toLocaleString() : price}`, status }); }}><label>Property title<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label>Price<input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value.replace(/[^0-9.]/g, ''))} required /></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="published">Published</option><option value="draft">Draft</option><option value="paused">Paused</option></select></label><div className="listing-editor-actions"><button className="role-dashboard-primary" type="submit">Save changes <Icon name="check" size={15} /></button><button className="role-dashboard-outline" type="button" onClick={onCancel}>Cancel</button></div></form></section>;
}

function LandlordNotifications({ applications, onApprove, onOpenApplications }: { applications: LandlordApplication[]; onApprove: (application: LandlordApplication) => void; onOpenApplications: () => void }) {
  const pending = applications.filter((application) => application.status.toLowerCase() === 'pending');
  return <section className="role-dashboard-panel landlord-notification-panel"><div className="role-dashboard-panel-heading"><div><span className="role-dashboard-eyebrow">Notifications</span><h3>Rental applications</h3></div><span className="landlord-notification-count">{pending.length} pending</span></div>{pending.length ? <div className="landlord-notification-list">{pending.slice(0, 4).map((application) => <article className="landlord-notification-card" key={application.id}><span className="tenant-workspace-row-icon"><Icon name="bell" size={16} /></span><div><strong>{application.applicant_name ?? application.applicant ?? 'New tenant'}</strong><small>{application.listing_title} Ã‚Â· {new Date(application.created_at).toLocaleDateString()}</small><p>{application.message || 'New rental application received.'}</p></div><button type="button" onClick={() => onApprove(application)}>Approve <Icon name="check" size={14} /></button></article>)}</div> : <div className="landlord-notification-empty"><Icon name="check" size={18} /><p>No pending applications. New tenant requests will appear here.</p></div>}<button className="role-dashboard-outline" type="button" onClick={onOpenApplications}>Open all applications <Icon name="arrow" size={14} /></button></section>;
}

function LandlordApplicationsSection({ applications, onApprove, notice }: { applications: LandlordApplication[]; onApprove: (application: LandlordApplication, agreedPrice?: number) => void; notice: string }) {
  const [agreedPrices, setAgreedPrices] = useState<Record<string, string>>({});
  return <section className="tenant-workspace-section"><div className="tenant-workspace-heading"><div><span className="role-dashboard-eyebrow">Tenant requests</span><h2>Applications</h2><p>Review rental applications from tenants and approve the requests that are ready to move forward.</p></div><span className="tenant-workspace-icon"><Icon name="users" size={22} /></span></div>{applications.length ? <div className="landlord-application-list">{applications.map((application) => { const pending = application.status.toLowerCase() === 'pending'; return <article className="landlord-application-card" key={application.id}><div className="landlord-application-card-heading"><div><strong>{application.applicant_name ?? application.applicant ?? 'Tenant applicant'}</strong><small>{application.listing_title} Ã‚Â· {new Date(application.created_at).toLocaleDateString()}</small></div><span className={`role-dashboard-status ${pending ? 'pending' : 'new'}`}>{application.status}</span></div><p>{application.message || 'No message included with this application.'}</p>{application.phone && <small className="landlord-application-phone">Phone: {application.phone}</small>}{pending && <button className="role-dashboard-primary" type="button" onClick={() => onApprove(application)}>Approve application <Icon name="check" size={15} /></button>}</article>; })}</div> : <div className="landlord-notification-empty"><Icon name="users" size={18} /><p>No applications have been received yet.</p></div>}{notice && <p className="workspace-action-notice" role="status"><Icon name="check" size={14} /> {notice}</p>}</section>;
}

function LandlordApplicationsWithPrice({ applications, onApprove, notice }: { applications: LandlordApplication[]; onApprove: (application: LandlordApplication, agreedPrice?: number) => void; notice: string }) {
  const [agreedPrices, setAgreedPrices] = useState<Record<string, string>>({});
  return <section className="tenant-workspace-section"><div className="tenant-workspace-heading"><div><span className="role-dashboard-eyebrow">Tenant requests</span><h2>Applications</h2><p>Review rental applications, agree on a monthly price, and approve the request when you are ready.</p></div><span className="tenant-workspace-icon"><Icon name="users" size={22} /></span></div>{applications.length ? <div className="landlord-application-list">{applications.map((application) => { const pending = application.status.toLowerCase() === 'pending'; return <article className="landlord-application-card" key={application.id}><div className="landlord-application-card-heading"><div><strong>{application.applicant_name ?? application.applicant ?? 'Tenant applicant'}</strong><small>{application.listing_title} Ã‚Â· {new Date(application.created_at).toLocaleDateString()}</small></div><span className={`role-dashboard-status ${pending ? 'pending' : 'new'}`}>{application.status}</span></div><p>{application.message || 'No message included with this application.'}</p>{application.phone && <small className="landlord-application-phone">Phone: {application.phone}</small>}{pending && <div className="landlord-approval-controls"><label>Agreed monthly rent (RWF)<input type="number" min="1" value={agreedPrices[application.id] ?? ''} onChange={(event) => setAgreedPrices((current) => ({ ...current, [application.id]: event.target.value }))} placeholder="Use listing price" /></label><button className="role-dashboard-primary" type="button" onClick={() => onApprove(application, agreedPrices[application.id] ? Number(agreedPrices[application.id]) : undefined)}>Approve application <Icon name="check" size={15} /></button></div>}</article>; })}</div> : <div className="landlord-notification-empty"><Icon name="users" size={18} /><p>No applications have been received yet.</p></div>}{notice && <p className="workspace-action-notice" role="status"><Icon name="check" size={14} /> {notice}</p>}</section>;
}

function LandlordDashboard() {
  const config = configs.landlord;
  const { language } = usePersistentLanguage();
  const [active, setActive] = useState('Overview');
  useDashboardNotificationNavigation(setActive);
  const [listings, setListings] = useState<DashboardListing[]>([]);
  const [applications, setApplications] = useState<LandlordApplication[]>([]);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [currentUserID, setCurrentUserID] = useState('');
  const [notice, setNotice] = useState('');
  const [editingListing, setEditingListing] = useState<DashboardListing | null>(null);
  const [contactCommissionerOpen, setContactCommissionerOpen] = useState(false);
  const [commissionerMessage, setCommissionerMessage] = useState('');
  useEffect(() => {
    const load = async () => {
      try { setListings(JSON.parse(window.localStorage.getItem('umutungo-landlord-properties') ?? '[]') as DashboardListing[]); } catch { setListings([]); }
      try {
        const apiListings = await umutungoApi<{ items: OwnerListingRecord[] }>('/api/v1/owner/listings');
        if (apiListings?.items) setListings(apiListings.items.map(mapOwnerListing));
      } catch { /* Keep local listings available when the hosted API is unavailable. */ }
      let localApplications: LandlordApplication[] = [];
      try {
        const stored = JSON.parse(window.localStorage.getItem('umutungo-rental-applications') ?? '[]') as Array<Record<string, string>>;
        localApplications = stored.map((item) => ({ id: item.id, listing_id: item.propertyId ?? '', listing_title: item.propertyTitle ?? 'Rental property', applicant: item.applicant, applicant_name: item.applicant, phone: item.phone, status: (item.status ?? 'pending').toLowerCase(), message: item.message ?? '', viewed_at: item.viewedAt ?? null, created_at: item.createdAt ?? new Date().toISOString() }));
      } catch { localApplications = []; }
      setApplications(localApplications);
      try {
        const apiData = await umutungoApi<{ items: LandlordApplication[] }>('/api/v1/applications');
        if (apiData?.items) setApplications((current) => [...apiData.items, ...current.filter((local) => !apiData.items.some((item) => item.id === local.id))]);
      } catch { /* Keep the local notification queue available when the API is not running. */ }
      try {
        const [me, apiMessages] = await Promise.all([
          umutungoApi<{ user?: { id?: string } }>('/api/v1/me'),
          umutungoApi<{ items: ApiMessage[] }>('/api/v1/messages'),
        ]);
        if (me?.user?.id) setCurrentUserID(me.user.id);
        if (apiMessages?.items) setMessages(apiMessages.items);
        else {
          try { setMessages(JSON.parse(window.localStorage.getItem('umutungo-tenant-messages') ?? '[]') as ApiMessage[]); } catch { setMessages([]); }
        }
      } catch {
        try { setMessages(JSON.parse(window.localStorage.getItem('umutungo-tenant-messages') ?? '[]') as ApiMessage[]); } catch { setMessages([]); }
      }
    };
    load();
    const refresh = () => load();
    window.addEventListener('umutungo:landlord-data-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('umutungo:landlord-data-changed', refresh); window.removeEventListener('storage', refresh); };
  }, []);
  const approveApplication = async (application: LandlordApplication, agreedPrice?: number) => {
    try { await umutungoApi(`/api/v1/applications/${application.id}/decision`, { method: 'POST', body: JSON.stringify({ status: 'accepted', note: agreedPrice ? `Approved at RWF ${agreedPrice.toLocaleString()} per month.` : 'Approved from the landlord dashboard.', ...(agreedPrice ? { rent_amount: agreedPrice } : {}) }) }); } catch { /* The local demo workflow remains available without the hosted API. */ }
    const updated = { ...application, status: 'accepted' };
    setApplications((current) => current.map((item) => item.id === application.id ? updated : item));
    try {
      const stored = JSON.parse(window.localStorage.getItem('umutungo-rental-applications') ?? '[]') as Array<Record<string, unknown>>;
      window.localStorage.setItem('umutungo-rental-applications', JSON.stringify(stored.map((item) => item.id === application.id ? { ...item, status: 'accepted', decisionAt: new Date().toISOString() } : item)));
      const storedNotifications = JSON.parse(window.localStorage.getItem('umutungo-landlord-notifications') ?? '[]') as Array<Record<string, unknown>>;
      window.localStorage.setItem('umutungo-landlord-notifications', JSON.stringify(storedNotifications.map((item) => item.applicationId === application.id ? { ...item, status: 'accepted', readAt: new Date().toISOString() } : item)));
      const tenantNotifications = JSON.parse(window.localStorage.getItem('umutungo-tenant-notifications') ?? '[]') as Array<Record<string, unknown>>;
      window.localStorage.setItem('umutungo-tenant-notifications', JSON.stringify([{ id: `notification-decision-${application.id}`, type: 'application_decision', title: 'Rental application accepted', body: `${application.listing_title} was accepted${agreedPrice ? ` at RWF ${agreedPrice.toLocaleString()} per month` : ''}.`, createdAt: new Date().toISOString(), readAt: null }, ...tenantNotifications]));
      window.dispatchEvent(new CustomEvent('umutungo:notifications-changed'));
    } catch { /* Keep the in-memory approval visible if storage is unavailable. */ }
    window.dispatchEvent(new CustomEvent('umutungo:tenant-data-changed'));
    window.dispatchEvent(new CustomEvent('umutungo:landlord-data-changed'));
    setNotice(`${application.applicant_name ?? application.applicant ?? 'Tenant'}'s application was approved${agreedPrice ? ` at RWF ${agreedPrice.toLocaleString()} per month` : ''}.`);
  };
  const deleteListing = async (listing: DashboardListing) => {
    if (!window.confirm(`Delete Ã¢â‚¬Å“${listing.title}Ã¢â‚¬Â? This removes it from the hosted marketplace.`)) return;
    const looksLikeDatabaseID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(listing.id);
    try { await umutungoApi(`/api/v1/listings/${listing.id}`, { method: 'DELETE' }); } catch {
      if (looksLikeDatabaseID) { setNotice('The hosted listing could not be deleted. Check your backend session and try again.'); return; }
    }
    setListings((current) => current.filter((item) => item.id !== listing.id));
    try {
      const storageKey = 'umutungo-landlord-properties';
      const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]') as DashboardListing[];
      window.localStorage.setItem(storageKey, JSON.stringify(stored.filter((item) => item.id !== listing.id)));
    } catch { /* Ignore unavailable local storage. */ }
    setNotice(`${listing.title} was deleted.`);
  };
  const saveListing = async (listing: DashboardListing) => {
    const numericPrice = Number(listing.price.replace(/[^0-9.]/g, ''));
    try { await umutungoApi(`/api/v1/listings/${listing.id}`, { method: 'PATCH', body: JSON.stringify({ title: listing.title, price: numericPrice, status: listing.status }) }); } catch { /* Keep local listing edits available in demo mode. */ }
    setListings((current) => current.map((item) => item.id === listing.id ? listing : item));
    try {
      const stored = JSON.parse(window.localStorage.getItem('umutungo-landlord-properties') ?? '[]') as DashboardListing[];
      window.localStorage.setItem('umutungo-landlord-properties', JSON.stringify(stored.map((item) => item.id === listing.id ? listing : item)));
    } catch { /* Ignore unavailable local storage. */ }
    setEditingListing(null);
    setNotice(`${listing.title} was updated.`);
  };
  const sendCommissionerMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = commissionerMessage.trim();
    if (!body) return;
    const createdAt = new Date().toISOString();
    const message: ApiMessage = { id: `commissioner-message-${Date.now()}`, sender_id: 'landlord-demo', sender_name: 'Property Owner', recipient_id: 'commissioner', recipient_name: 'Komisiyoneri', listing_id: '', body, created_at: createdAt };
    try {
      const stored = JSON.parse(window.localStorage.getItem('umutungo-commissioner-messages') ?? '[]') as ApiMessage[];
      window.localStorage.setItem('umutungo-commissioner-messages', JSON.stringify([message, ...stored]));
      const notifications = JSON.parse(window.localStorage.getItem('umutungo-commissioner-notifications') ?? '[]') as Array<Record<string, unknown>>;
      window.localStorage.setItem('umutungo-commissioner-notifications', JSON.stringify([{ id: `commissioner-notification-${message.id}`, type: 'message_received', title: 'New landlord message', body: message.body, createdAt, readAt: null }, ...notifications]));
    } catch { /* Keep the action usable when storage is unavailable. */ }
    window.dispatchEvent(new CustomEvent('umutungo:commissioner-data-changed'));
    setCommissionerMessage('');
    setContactCommissionerOpen(false);
    setNotice('Message sent to the Komisiyoneri.');
  };
  const metrics = config.metrics.map((metric, index) => index === 0 && listings.length ? { ...metric, value: String(listings.length), note: 'Saved in your workspace' } : metric);
  const landlordNotificationPanel = <div className="role-dashboard-content"><LandlordNotifications applications={applications} onApprove={approveApplication} onOpenApplications={() => setActive('Enquiries')} /></div>;
  const overview = <div className="role-dashboard-content"><section className="role-dashboard-welcome"><div><p className="role-dashboard-eyebrow">Good morning</p><h2>A clearer view of every property you own.</h2><p>Upload, manage, and promote your property assets from one professional workspace.</p></div><Link className="role-dashboard-primary" href="/post-property"><Icon name="bookPen" size={16} /> {t(language, 'Post a property')}</Link></section><section className="role-dashboard-metrics" aria-label="Landlord metrics">{metrics.map((metric) => <article key={metric.label}><span className={`role-dashboard-metric-icon ${metric.tone}`}><Icon name={metric.icon} size={17} /></span><small>{metric.label}</small><strong>{metric.value}</strong><em>{metric.note}</em></article>)}</section><div className="role-dashboard-panel landlord-overview-panel"><div className="role-dashboard-panel-heading"><div><span className="role-dashboard-eyebrow">Latest uploads</span><h3>Property assets</h3></div><button type="button" onClick={() => setActive('My properties')}>View all <Icon name="arrow" size={14} /></button></div>{listings.slice(0, 3).map((listing) => <div className="role-dashboard-side-item" key={listing.id}><span><Icon name="home" size={16} /></span><div><strong>{listing.title}</strong><small>{listing.location} Ã‚Â· {listing.status}</small></div><Icon name="arrow" size={14} /></div>)}{!listings.length && <p className="landlord-empty-note">No new property assets yet. Start with your first listing.</p>}</div></div>;
  const body = active === 'Overview' ? <>{overview}{landlordNotificationPanel}</> : active === 'My properties' ? <div className="role-dashboard-content">{editingListing ? <LandlordListingEditor listing={editingListing} onSave={saveListing} onCancel={() => setEditingListing(null)} /> : <LandlordPropertiesSection listings={listings} onDelete={deleteListing} onManage={setEditingListing} />}</div> : active === 'Enquiries' ? <div className="role-dashboard-content"><LandlordApplicationsWithPrice applications={applications} onApprove={approveApplication} notice={notice} /></div> : active === 'Messages' ? <div className="role-dashboard-content"><LandlordMessageWorkspace messages={messages} currentUserID={currentUserID} onSent={(message) => setMessages((current) => [...current, message])} /></div> : <div className="role-dashboard-content"><TenantWorkspaceSection view={active} onPrimaryAction={(action) => { if (action === 'Contact Komisiyoneri') setContactCommissionerOpen(true); }} onAction={(action) => setNotice(`${action} selected.`)} notice={notice} /></div>;
  return <main className="role-dashboard"><aside className="role-dashboard-sidebar"><Link className="role-dashboard-brand" href="/"><Logo /></Link><span className="role-dashboard-label">{t(language, config.eyebrow)}</span><nav aria-label="Property Owner dashboard navigation"><Link className="role-dashboard-nav role-dashboard-home-link" href="/"><Icon name="home" size={17} /><span>{t(language, 'Home')}</span></Link>{config.navigation.map((item) => <button className={`role-dashboard-nav ${active === item.label ? 'active' : ''}`} key={item.label} type="button" onClick={() => { setActive(item.label); setEditingListing(null); }}><Icon name={item.icon} size={17} /><span>{t(language, item.label)}</span></button>)}</nav><div className="role-dashboard-sidebar-bottom"><Link href="/">{t(language, 'Back to marketplace')} <Icon name="arrow" size={14} /></Link><Link href="/post-property"><Icon name="bookPen" size={16} /> Post property</Link></div></aside><section className="role-dashboard-main"><header className="role-dashboard-topbar"><div><span className="role-dashboard-eyebrow">{t(language, config.eyebrow)}</span><h1>{t(language, active)}</h1></div><button className="role-dashboard-profile" type="button" onClick={() => setActive('Overview')}><span className="role-dashboard-avatar">LL</span><span><strong>{t(language, 'My account')}</strong><small>{t(language, 'Verified Property Owner')}</small></span><Icon name="chevron" size={14} /></button></header>{body}{contactCommissionerOpen && <div className="tenant-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="commissioner-contact-title"><button className="tenant-dialog-backdrop" type="button" aria-label="Close commissioner message" onClick={() => setContactCommissionerOpen(false)} /><section className="tenant-dialog"><button className="property-action-close" type="button" aria-label="Close commissioner message" onClick={() => setContactCommissionerOpen(false)}><Icon name="x" size={18} /></button><span className="role-dashboard-eyebrow">Komisiyoneri support</span><h2 id="commissioner-contact-title">Contact Komisiyoneri</h2><form className="tenant-dialog-form" onSubmit={sendCommissionerMessage}><p>Send a message to the Komisiyoneri helping coordinate your property.</p><textarea value={commissionerMessage} onChange={(event) => setCommissionerMessage(event.target.value)} placeholder="Write your message" rows={5} required /><button className="role-dashboard-primary" type="submit">Send message <Icon name="arrow" size={15} /></button></form></section></div>}</section></main>;
}

function AdminLocationWorkspace() {
  const [province, setProvince] = useState(provinceNames[0] ?? '');
  const [district, setDistrict] = useState('');
  const [sector, setSector] = useState('');
  const [cell, setCell] = useState('');
  const [village, setVillage] = useState('');
  const [notice, setNotice] = useState('');
  const districts = getDistrictNames(province);
  const sectors = getSectorNames(province, district);
  useEffect(() => { if (!districts.includes(district)) setDistrict(districts[0] ?? ''); }, [district, districts]);
  useEffect(() => { if (!sectors.includes(sector)) setSector(sectors[0] ?? ''); }, [sector, sectors]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice('');
    try {
      await umutungoApi('/api/v1/admin/locations', { method: 'POST', body: JSON.stringify({ province, district, sector, cell, village }) });
      setNotice('Administrative location saved. Duplicate values were ignored.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Location could not be saved.'); }
  };
  return <section className="tenant-workspace-section admin-location-workspace"><div className="tenant-workspace-heading"><div><span className="role-dashboard-eyebrow">Administrative hierarchy</span><h2>Locations</h2><p>Maintain Province, District, Sector, Cell, and Village values without duplicating existing records.</p></div><span className="tenant-workspace-icon"><Icon name="pin" size={22} /></span></div><form className="listing-editor-form" onSubmit={save}><label>Province<select value={province} onChange={(event) => { setProvince(event.target.value); setDistrict(''); setSector(''); setCell(''); setVillage(''); }}>{provinceNames.map((item) => <option key={item}>{item}</option>)}</select></label><label>District<select value={district} onChange={(event) => { setDistrict(event.target.value); setSector(''); setCell(''); setVillage(''); }}>{districts.map((item) => <option key={item}>{item}</option>)}</select></label><label>Sector<select value={sector} onChange={(event) => { setSector(event.target.value); setCell(''); setVillage(''); }}>{sectors.length ? sectors.map((item) => <option key={item}>{item}</option>) : <option value="">Use national directory</option>}</select></label><label>Cell (optional)<input value={cell} onChange={(event) => setCell(event.target.value)} /></label><label>Village (optional)<input value={village} onChange={(event) => setVillage(event.target.value)} /></label><button className="role-dashboard-primary" type="submit" disabled={!province || !district || !sector}>Save location <Icon name="check" size={15} /></button></form>{notice && <p className="workspace-action-notice" role="status">{notice}</p>}</section>;
}

function AdminAboutVideoWorkspace() {
  const { language } = usePersistentLanguage();
  const copy = (key: string) => t(language, key);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentVideo, setCurrentVideo] = useState<AboutVideo | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('The Umutungo story');
  const [localPreview, setLocalPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void getAboutVideo().then((video) => { if (active && video) { setCurrentVideo(video); setTitle(video.title); } }).catch(() => { if (active) setError('The video library could not be reached. Check the API connection.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!file) { setLocalPreview(''); return; }
    const objectURL = URL.createObjectURL(file);
    setLocalPreview(objectURL);
    return () => URL.revokeObjectURL(objectURL);
  }, [file]);

  const chooseFile = (candidate?: File) => {
    setNotice('');
    setError('');
    if (!candidate) return;
    const extension = candidate.name.toLowerCase().split('.').pop();
    if (!['mp4', 'webm'].includes(extension ?? '')) { setFile(null); setError('Choose an MP4 or WebM video.'); return; }
    if (candidate.size > 200 * 1024 * 1024) { setFile(null); setError('Choose a video smaller than 200 MB.'); return; }
    setFile(candidate);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const publish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) { setError('Choose a video file before publishing.'); return; }
    setBusy(true); setNotice(''); setError('');
    try {
      const published = await uploadAboutVideo(file, title.trim() || 'The Umutungo story');
      setCurrentVideo(published); setTitle(published.title); setFile(null); setNotice('Your story is now live on the About page.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The video could not be published.'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm('Remove the video from the public About page?')) return;
    setBusy(true); setNotice(''); setError('');
    try { await deleteAboutVideo(); setCurrentVideo(null); setFile(null); setTitle('The Umutungo story'); setNotice('The video has been removed from the About page.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The video could not be removed.'); }
    finally { setBusy(false); }
  };

  return <div className="role-dashboard-content admin-about-video-content">
    <section className="admin-about-video-hero"><div><span className="admin-about-video-kicker"><Icon name="video" size={15} /> {copy('PUBLIC STORY · ABOUT UMUTUNGO')}</span><h2>{copy('Your story,')}<br /><em>{copy('in motion.')}</em></h2><p>{copy('Introduce Umutungo in your own voice. Publish a short film that helps people see the homes, people and purpose behind the platform.')}</p></div><div className="admin-about-video-hero-mark"><span>UMU</span><small>{copy('A better way to find your place.')}</small></div><span className="admin-about-video-index">01 / {copy('STORY FILM')}</span></section>
    <div className="admin-about-video-grid">
      <form className="admin-about-video-editor" onSubmit={publish}>
        <div className="admin-about-video-editor-heading"><span>01 — THE INTRODUCTION</span><strong>{currentVideo ? 'Update your film' : 'Add your film'}</strong><p>MP4 or WebM · up to 200 MB</p></div>
        <label className="admin-about-video-title">Title shown on the About page<input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="The Umutungo story" /></label>
        <label className="admin-about-video-drop" htmlFor="admin-about-video-file" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); chooseFile(event.dataTransfer.files[0]); }}>
          <input ref={fileInputRef} id="admin-about-video-file" type="file" accept="video/mp4,video/webm,.mp4,.webm" onChange={(event) => chooseFile(event.target.files?.[0])} />
          <span className="admin-about-video-drop-icon"><Icon name="video" size={22} /></span><strong>{file ? file.name : copy('Choose your story film')}</strong><small>{file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB · ready to preview` : copy('Browse for a file, or drop it here')}</small><span className="admin-about-video-browse">{copy('Browse videos')} <Icon name="arrow" size={13} /></span>
        </label>
        {error && <p className="admin-about-video-message is-error" role="alert">{error}</p>}
        {notice && <p className="admin-about-video-message" role="status"><Icon name="check" size={14} /> {notice}</p>}
        <div className="admin-about-video-actions"><button className="role-dashboard-primary" type="submit" disabled={busy || !file}>{busy ? 'Publishing…' : currentVideo ? 'Publish update' : 'Publish to About'} <Icon name="arrow" size={15} /></button>{currentVideo && <button className="admin-about-video-remove" type="button" onClick={() => void remove()} disabled={busy}>Remove video</button>}</div>
        <div className="admin-about-video-note"><Icon name="check" size={15} /><span><strong>Made for the About page</strong><small>Visitors can play your video directly on Umutungo. Uploading a new version replaces the current one.</small></span></div>
      </form>
      <aside className="admin-about-video-preview"><div className="admin-about-video-preview-heading"><div><span>{copy('LIVE PREVIEW')}</span><strong>{file ? copy('Unpublished preview') : currentVideo ? copy('Currently on About') : copy('Awaiting your story')}</strong></div><span className={`admin-about-video-status ${currentVideo && !file ? 'is-live' : ''}`}><i />{currentVideo && !file ? copy('LIVE') : file ? copy('DRAFT') : copy('EMPTY')}</span></div>
        <div className="admin-about-video-frame">{localPreview || currentVideo ? <video key={localPreview || currentVideo?.url} src={localPreview || currentVideo?.url} controls playsInline preload="metadata" poster="/properties/story-begin.jpg">Your browser does not support video playback.</video> : <div className="admin-about-video-empty" style={{ backgroundImage: "linear-gradient(180deg, rgba(8,20,12,.06), rgba(8,20,12,.78)), url('/properties/story-begin.jpg')" }}><span className="admin-about-video-play"><Icon name="video" size={23} /></span><strong>Your film will live here.</strong><small>A warm hello from the people building Umutungo.</small></div>}</div>
        <div className="admin-about-video-preview-footer"><span><small>STORY FILM</small><strong>{title || 'The Umutungo story'}</strong></span><span>{file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : currentVideo ? new Date(currentVideo.updated_at).toLocaleDateString() : 'No video yet'}</span></div>
      </aside>
    </div>
    {loading && <p className="admin-about-video-loading" role="status">Checking the published About video…</p>}
  </div>;
}

function AdminDashboard() {
  const config = configs.admin;
  const { language } = usePersistentLanguage();
  const [active, setActive] = useState('Overview');
  useDashboardNotificationNavigation(setActive);
  return <main className="role-dashboard admin-dashboard"><aside className="role-dashboard-sidebar"><Link className="role-dashboard-brand" href="/"><Logo darkMode /></Link><span className="role-dashboard-label">{t(language, config.eyebrow)}</span><nav aria-label={t(language, 'Admin dashboard navigation')}><Link className="role-dashboard-nav role-dashboard-home-link" href="/"><Icon name="home" size={17} /><span>{t(language, 'Home')}</span></Link>{config.navigation.map((item) => <button className={`role-dashboard-nav ${active === item.label ? 'active' : ''}`} key={item.label} type="button" onClick={() => setActive(item.label)}><Icon name={item.icon} size={17} /><span>{t(language, item.label)}</span></button>)}</nav><div className="role-dashboard-sidebar-bottom"><Link href="/">{t(language, 'Back to marketplace')} <Icon name="arrow" size={14} /></Link><Link href="/register"><Icon name="user" size={16} /> {t(language, 'Create account')}</Link></div></aside><section className="role-dashboard-main"><header className="role-dashboard-topbar"><div><span className="role-dashboard-eyebrow">{t(language, config.eyebrow)}</span><h1>{t(language, active)}</h1></div><div className="role-dashboard-profile"><span className="role-dashboard-avatar">AD</span><span><strong>{t(language, 'My account')}</strong><small>{t(language, 'Platform administrator')}</small></span><Icon name="chevron" size={14} /></div></header>{active === 'About video' ? <AdminAboutVideoWorkspace /> : active === 'Locations' ? <div className="role-dashboard-content"><AdminLocationWorkspace /></div> : active === 'Reports' ? <AdminActivityWorkspace /> : active === 'Users' ? <AdminActivityWorkspace filter="users" /> : active === 'Listings review' ? <AdminActivityWorkspace filter="listings" /> : <AdminOverview onReports={() => setActive('Reports')} />}</section></main>;
}
function CommissionerDashboard() {
  const config = configs.commissioner;
  const { language } = usePersistentLanguage();
  const [active, setActive] = useState('Overview');
  useDashboardNotificationNavigation(setActive);
  const [listings, setListings] = useState<DashboardListing[]>([]);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [currentUserID, setCurrentUserID] = useState('commissioner-demo');
  useEffect(() => {
    const load = async () => {
      try { setListings(JSON.parse(window.localStorage.getItem('umutungo-commissioner-properties') ?? '[]') as DashboardListing[]); } catch { setListings([]); }
      try {
        const me = await umutungoApi<{ user?: { id?: string } }>('/api/v1/me');
        if (me?.user?.id) setCurrentUserID(me.user.id);
      } catch {
        setCurrentUserID('commissioner-demo');
      }
      try {
        const stored = JSON.parse(window.localStorage.getItem('umutungo-commissioner-messages') ?? '[]') as ApiMessage[];
        setMessages(stored.filter((message) => message.recipient_id === 'commissioner' || message.recipient_name?.toLowerCase() === 'commissioner'));
      } catch { setMessages([]); }
    };
    void load();
    const refresh = () => { void load(); };
    window.addEventListener('umutungo:commissioner-data-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('umutungo:commissioner-data-changed', refresh); window.removeEventListener('storage', refresh); };
  }, []);
  const metrics = config.metrics.map((metric, index) => index === 0 && listings.length ? { ...metric, value: String(listings.length), note: 'Saved in your workspace' } : metric);
  const overview = <div className="role-dashboard-content"><section className="role-dashboard-welcome"><div><p className="role-dashboard-eyebrow">{config.greeting}</p><h2>{config.welcome}</h2><p>Add properties, manage enquiries, and keep every client conversation moving from one workspace.</p></div><Link className="role-dashboard-primary" href="/post-property"><Icon name="bookPen" size={16} /> {t(language, 'Add a property')}</Link></section><section className="role-dashboard-metrics" aria-label="Komisiyoneri metrics">{metrics.map((metric) => <article key={metric.label}><span className={`role-dashboard-metric-icon ${metric.tone}`}><Icon name={metric.icon} size={17} /></span><small>{metric.label}</small><strong>{metric.value}</strong><em>{metric.note}</em></article>)}</section><div className="role-dashboard-panel landlord-overview-panel"><div className="role-dashboard-panel-heading"><div><span className="role-dashboard-eyebrow">Latest uploads</span><h3>Property listings</h3></div><button type="button" onClick={() => setActive('My listings')}>View all <Icon name="arrow" size={14} /></button></div>{listings.slice(0, 3).map((listing) => <div className="role-dashboard-side-item" key={listing.id}><span><Icon name="home" size={16} /></span><div><strong>{listing.title}</strong><small>{listing.location} Ã‚Â· {listing.status}</small></div><Icon name="arrow" size={14} /></div>)}{!listings.length && <p className="landlord-empty-note">No property listings yet. Add your first property to get started.</p>}</div></div>;
  const body = active === 'Overview' ? overview : active === 'My listings' ? <div className="role-dashboard-content"><LandlordPropertiesSection listings={listings} title="My listings" actionLabel="Add a property" /></div> : active === 'Messages' ? <div className="role-dashboard-content"><LandlordMessageWorkspace messages={messages} currentUserID={currentUserID} contactLabel="client" onSent={(message) => setMessages((current) => [...current, message])} /></div> : <div className="role-dashboard-content"><TenantWorkspaceSection view={active} /></div>;
  return <main className="role-dashboard"><aside className="role-dashboard-sidebar"><Link className="role-dashboard-brand" href="/"><Logo /></Link><span className="role-dashboard-label">{t(language, config.eyebrow)}</span><nav aria-label="Komisiyoneri dashboard navigation"><Link className="role-dashboard-nav role-dashboard-home-link" href="/"><Icon name="home" size={17} /><span>{t(language, 'Home')}</span></Link>{config.navigation.map((item) => <button className={`role-dashboard-nav ${active === item.label ? 'active' : ''}`} key={item.label} type="button" onClick={() => setActive(item.label)}><Icon name={item.icon} size={17} /><span>{t(language, item.label)}</span></button>)}</nav><div className="role-dashboard-sidebar-bottom"><Link href="/">{t(language, 'Back to marketplace')} <Icon name="arrow" size={14} /></Link><Link href="/post-property"><Icon name="bookPen" size={16} /> {t(language, 'Add a property')}</Link></div></aside><section className="role-dashboard-main"><header className="role-dashboard-topbar"><div><span className="role-dashboard-eyebrow">{t(language, config.eyebrow)}</span><h1>{t(language, active)}</h1></div><div className="role-dashboard-profile"><span className="role-dashboard-avatar">CM</span><span><strong>{t(language, 'My account')}</strong><small>{t(language, 'Verified Komisiyoneri')}</small></span><Icon name="chevron" size={14} /></div></header>{body}</section></main>;
}

const emptyTenantData: TenantDashboardData = { properties: [], applications: [], notifications: [], payments: [], messages: [], bookings: [], reviews: [] };

function TenantBookingSummary({ bookings }: { bookings: TenantBooking[] }) {
  if (!bookings.length) return null;
  return <section className="tenant-booking-summary" aria-label="Booked houses"><div className="tenant-booking-summary-heading"><span className="role-dashboard-eyebrow">Your booked house</span><Icon name="home" size={17} /></div>{bookings.map((booking) => <article key={booking.id}><div><strong>{booking.property_title}</strong><small>{booking.location} Ã‚Â· {booking.price}</small></div><span className={`role-dashboard-status ${booking.payment_status === 'paid' ? 'new' : 'pending'}`}>{booking.payment_status === 'paid' ? 'Paid' : 'Pending payment'}</span></article>)}</section>;
}

function TenantNotificationWorkspace({ notifications }: { notifications: ApiNotification[] }) {
  return <section className="tenant-workspace-section"><div className="tenant-workspace-heading"><div><span className="role-dashboard-eyebrow">Account updates</span><h2>Notifications</h2><p>See application decisions, landlord messages, and important updates about your property journey.</p></div><span className="tenant-workspace-icon"><Icon name="bell" size={22} /></span></div>{notifications.length ? <div className="tenant-workspace-list">{notifications.map((item) => <article key={item.id}><span className="tenant-workspace-row-icon"><Icon name="bell" size={16} /></span><div><strong>{item.title}</strong><small>{item.body}</small></div><time>{new Date(item.created_at).toLocaleString()}</time></article>)}</div> : <div className="tenant-message-empty"><Icon name="check" size={20} /><div><strong>No new notifications</strong><p>Application decisions and landlord replies will appear here.</p></div></div>}</section>;
}

function TenantDashboard() {
  const config = configs.tenant;
  const { language } = usePersistentLanguage();
  const [active, setActive] = useState('Overview');
  useDashboardNotificationNavigation(setActive);
  const [tenantData, setTenantData] = useState<TenantDashboardData>(emptyTenantData);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [notice, setNotice] = useState('');
  const [selectedApplication, setSelectedApplication] = useState<ApiApplication | null>(null);
  const [dialog, setDialog] = useState<'payment' | 'contact' | 'review' | null>(null);
  const [paymentProvider, setPaymentProvider] = useState('mtn_momo');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('50000');
  const [messageBody, setMessageBody] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState('');

  useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get('view');
    if (requestedView && config.navigation.some((item) => item.label === requestedView)) setActive(requestedView);
  }, [config.navigation]);

  useEffect(() => {
    const refreshFavorites = () => {
      try { setFavorites(JSON.parse(window.localStorage.getItem('umutungo-favorites') ?? '[]') as FavoriteItem[]); } catch { setFavorites([]); }
    };
    refreshFavorites();
    window.addEventListener('umutungo:favorites-changed', refreshFavorites);
    window.addEventListener('storage', refreshFavorites);
    return () => { window.removeEventListener('umutungo:favorites-changed', refreshFavorites); window.removeEventListener('storage', refreshFavorites); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const storedApplications = JSON.parse(window.localStorage.getItem('umutungo-rental-applications') ?? '[]') as Array<Record<string, string>>;
      const localApplications: ApiApplication[] = storedApplications.map((item) => ({ id: item.id, listing_id: item.propertyId ?? '', listing_title: item.propertyTitle ?? 'Rental property', status: (item.status ?? 'pending').toLowerCase(), message: item.message ?? '', viewed_at: item.viewedAt ?? null, created_at: item.createdAt ?? new Date().toISOString() }));
      const localPayments = JSON.parse(window.localStorage.getItem('umutungo-payments') ?? '[]') as TenantDashboardData['payments'];
      const localMessages = JSON.parse(window.localStorage.getItem('umutungo-tenant-messages') ?? '[]') as ApiMessage[];
      const localBookings = JSON.parse(window.localStorage.getItem('umutungo-tenant-bookings') ?? '[]') as TenantBooking[];
      const localReviews = JSON.parse(window.localStorage.getItem('umutungo-tenant-reviews') ?? '[]') as TenantDashboardData['reviews'];
      const localNotifications = JSON.parse(window.localStorage.getItem('umutungo-tenant-notifications') ?? '[]') as ApiNotification[];
      if (!cancelled) setNotifications(localNotifications);
      if (!cancelled) setTenantData({ ...emptyTenantData, applications: localApplications, notifications: localNotifications, payments: localPayments, messages: localMessages, bookings: localBookings, reviews: localReviews });
      try {
        const apiData = await umutungoApi<TenantDashboardData>('/api/v1/tenant/dashboard');
        if (apiData && !cancelled) setTenantData((current) => ({ ...apiData, notifications: current.notifications, applications: [...apiData.applications, ...current.applications.filter((local) => !apiData.applications.some((item) => item.id === local.id))], payments: [...apiData.payments, ...current.payments.filter((local) => !apiData.payments.some((item) => item.id === local.id))], messages: [...apiData.messages, ...current.messages.filter((local) => !apiData.messages.some((item) => item.id === local.id))], bookings: current.bookings, reviews: [...apiData.reviews, ...current.reviews.filter((local) => !apiData.reviews.some((item) => item.id === local.id))] }));
      } catch { /* Keep the local workspace available when the API is not running. */ }
      try {
        const apiNotifications = await umutungoApi<{ items: ApiNotification[] }>('/api/v1/notifications');
        if (apiNotifications && !cancelled) { const unread = apiNotifications.items.filter((item) => !item.read_at); setNotifications(unread); setTenantData((current) => ({ ...current, notifications: unread })); }
      } catch { /* Keep local notifications available when the API is not running. */ }
    };
    load();
    const refresh = () => load();
    window.addEventListener('umutungo:tenant-data-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => { cancelled = true; window.removeEventListener('umutungo:tenant-data-changed', refresh); window.removeEventListener('storage', refresh); };
  }, []);

  const updateApplication = async (application: ApiApplication, viewedAt: string) => {
    try { await umutungoApi(`/api/v1/applications/${application.id}/viewed`, { method: 'POST', body: '{}' }); } catch { /* local/demo application */ }
    const next = { ...application, viewed_at: viewedAt };
    setTenantData((current) => ({ ...current, applications: current.applications.map((item) => item.id === application.id ? next : item) }));
    const stored = JSON.parse(window.localStorage.getItem('umutungo-rental-applications') ?? '[]') as Array<Record<string, unknown>>;
    window.localStorage.setItem('umutungo-rental-applications', JSON.stringify(stored.map((item) => item.id === application.id ? { ...item, viewedAt } : item)));
    setNotice('House marked as seen. You can now pay, contact the landlord, or leave a review.');
  };

  const openDialog = (kind: 'payment' | 'contact' | 'review', application: ApiApplication) => { setSelectedApplication(application); setDialog(kind); setNotice(''); };
  const closeDialog = () => { setDialog(null); setSelectedApplication(null); setMessageBody(''); setReviewBody(''); };

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedApplication) return;
    const payload = { related_type: 'application', related_id: selectedApplication.id, amount: Number(paymentAmount), currency: 'RWF', provider: paymentProvider, phone: paymentPhone };
    try {
      const result = await umutungoApi<{ id: string; status: string; amount: number; currency: string; provider: string }>('/api/v1/payments', { method: 'POST', body: JSON.stringify(payload) });
      if (result) setTenantData((current) => ({ ...current, payments: [{ ...result, related_type: 'application', related_id: selectedApplication.id, created_at: new Date().toISOString() }, ...current.payments] }));
      else throw new Error('local payment');
    } catch {
      const localPayment = { id: `payment-${Date.now()}`, related_type: 'application', related_id: selectedApplication.id, amount: Number(paymentAmount), currency: 'RWF', provider: paymentProvider, status: 'successful', created_at: new Date().toISOString() };
      const current = JSON.parse(window.localStorage.getItem('umutungo-payments') ?? '[]') as TenantDashboardData['payments'];
      window.localStorage.setItem('umutungo-payments', JSON.stringify([localPayment, ...current]));
      setTenantData((value) => ({ ...value, payments: [localPayment, ...value.payments] }));
    }
    closeDialog();
    setNotice('Payment started. Mobile-money payments remain pending until the provider confirms them.');
  };

  const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedApplication || !messageBody.trim()) return;
    try { await umutungoApi('/api/v1/messages', { method: 'POST', body: JSON.stringify({ listing_id: selectedApplication.listing_id, body: messageBody }) }); } catch { /* local/demo message */ }
    const message: ApiMessage = { id: `message-${Date.now()}`, sender_id: 'me', sender_name: 'You', recipient_id: '', recipient_name: 'Landlord', listing_id: selectedApplication.listing_id, body: messageBody, created_at: new Date().toISOString() };
    const localMessages = JSON.parse(window.localStorage.getItem('umutungo-tenant-messages') ?? '[]') as ApiMessage[];
    window.localStorage.setItem('umutungo-tenant-messages', JSON.stringify([message, ...localMessages]));
    setTenantData((current) => ({ ...current, messages: [message, ...current.messages] }));
    closeDialog();
    setNotice('Message sent to the landlord.');
  };

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedApplication || !reviewBody.trim()) return;
    try { await umutungoApi('/api/v1/reviews', { method: 'POST', body: JSON.stringify({ listing_id: selectedApplication.listing_id, rating: reviewRating, body: reviewBody }) }); } catch { /* local/demo review */ }
    const review = { id: `review-${Date.now()}`, listing_id: selectedApplication.listing_id, listing_title: selectedApplication.listing_title, rating: reviewRating, body: reviewBody, created_at: new Date().toISOString() };
    const localReviews = JSON.parse(window.localStorage.getItem('umutungo-tenant-reviews') ?? '[]') as TenantDashboardData['reviews'];
    window.localStorage.setItem('umutungo-tenant-reviews', JSON.stringify([review, ...localReviews]));
    setTenantData((current) => ({ ...current, reviews: [review, ...current.reviews] }));
    closeDialog();
    setNotice('Review saved to your tenant dashboard.');
  };
  const metrics = config.metrics.map((metric, index) => index === 0 ? { ...metric, value: String(tenantData.applications.length) } : index === 1 ? { ...metric, value: String(favorites.length) } : index === 2 ? { ...metric, value: String(tenantData.bookings.length + tenantData.applications.filter((item) => item.viewed_at).length), note: 'Requested or completed visits' } : { ...metric, value: `RWF ${tenantData.payments.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}` });
  const dialogTitle = dialog === 'payment' ? 'Pay after seeing the house' : dialog === 'contact' ? 'Contact the landlord' : 'Review this property';
  return <main className="role-dashboard"><aside className="role-dashboard-sidebar"><Link className="role-dashboard-brand" href="/"><Logo /></Link><span className="role-dashboard-label">{t(language, config.eyebrow)}</span><nav aria-label="Client dashboard navigation"><Link className="role-dashboard-nav role-dashboard-home-link" href="/"><Icon name="home" size={17} /><span>{t(language, 'Home')}</span></Link>{config.navigation.map((item) => <button className={`role-dashboard-nav ${active === item.label ? 'active' : ''}`} key={item.label} type="button" onClick={() => setActive(item.label)}><Icon name={item.icon} size={17} /><span>{t(language, item.label)}</span></button>)}</nav><div className="role-dashboard-sidebar-bottom"><Link href="/">{t(language, 'Back to marketplace')} <Icon name="arrow" size={14} /></Link><button type="button" onClick={() => setActive('Overview')}><Icon name="user" size={16} /> Account</button></div></aside><section className="role-dashboard-main"><header className="role-dashboard-topbar"><div><span className="role-dashboard-eyebrow">{t(language, config.eyebrow)}</span><h1>{t(language, active)}</h1></div><button className="role-dashboard-profile" type="button" onClick={() => setActive('Overview')}><span className="role-dashboard-avatar">CL</span><span><strong>{t(language, 'My account')}</strong><small>Verified client</small></span><Icon name="chevron" size={14} /></button></header>{active === 'Overview' ? <div className="role-dashboard-content"><section className="role-dashboard-welcome"><div><p className="role-dashboard-eyebrow">Welcome back</p><h2>Your next home is closer than you think.</h2><p>Manage applications, payments, house-viewing status, landlord conversations, and reviews in one clear workspace.</p></div><Link className="role-dashboard-primary" href="/categories/houses"><Icon name="search" size={16} /> Explore homes</Link></section><section className="role-dashboard-metrics" aria-label="Client metrics">{metrics.map((metric) => <article key={metric.label}><span className={`role-dashboard-metric-icon ${metric.tone}`}><Icon name={metric.icon} size={17} /></span><small>{metric.label}</small><strong>{metric.value}</strong><em>{metric.note}</em></article>)}</section><div className="role-dashboard-panel tenant-overview-panel"><div className="role-dashboard-panel-heading"><div><span className="role-dashboard-eyebrow">Your next steps</span><h3>Rental journey</h3></div><button type="button" onClick={() => setActive('Applications')}>Open applications <Icon name="arrow" size={14} /></button></div><div className="tenant-overview-cards"><article><span className="tenant-card-number">01</span><div><strong>{tenantData.applications.length} applications</strong><small>Track decisions and house-viewing status</small></div><Icon name="arrow" size={15} /></article><article><span className="tenant-card-number">02</span><div><strong>{tenantData.payments.length} payments</strong><small>Pay only after you have seen the house</small></div><Icon name="arrow" size={15} /></article><article><span className="tenant-card-number">03</span><div><strong>{tenantData.messages.length} conversations</strong><small>Keep landlord contact in one place</small></div><Icon name="arrow" size={15} /></article></div></div></div> : <div className="role-dashboard-content"><TenantWorkspaceSection view={active} tenantData={tenantData} favorites={favorites} onViewed={(application) => updateApplication(application, new Date().toISOString())} onPay={(application) => openDialog('payment', application)} onContact={(application) => openDialog('contact', application)} onReview={(application) => openDialog('review', application)} onAction={(action) => { if (action === 'View applications') setActive('Applications'); else if (action === 'Start a new conversation') setActive('Messages'); else setNotice(`${action} selected.`); }} notice={notice} /></div>}</section>{dialog && selectedApplication && <div className="tenant-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="tenant-dialog-title"><button className="tenant-dialog-backdrop" type="button" aria-label="Close dialog" onClick={closeDialog} /><section className="tenant-dialog"><button className="property-action-close" type="button" aria-label="Close dialog" onClick={closeDialog}><Icon name="x" size={18} /></button><span className="role-dashboard-eyebrow">{selectedApplication.listing_title}</span><h2 id="tenant-dialog-title">{dialogTitle}</h2>{dialog === 'payment' && <form className="tenant-dialog-form" onSubmit={submitPayment}><p>Payment is available because you marked this house as seen.</p><label>Amount (RWF)<input type="number" min="1" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} required /></label><label>Payment method<select value={paymentProvider} onChange={(event) => setPaymentProvider(event.target.value)}><option value="mtn_momo">MTN MoMo</option><option value="airtel_money">Airtel Money</option><option value="card">Bank card</option></select></label>{paymentProvider !== 'card' && <label>Rwanda phone number<input type="tel" value={paymentPhone} onChange={(event) => setPaymentPhone(event.target.value)} placeholder="+250 7XX XXX XXX" required /></label>}<button className="role-dashboard-primary" type="submit">Start payment <Icon name="arrow" size={15} /></button></form>}{dialog === 'contact' && <form className="tenant-dialog-form" onSubmit={submitMessage}><p>Ask about viewing times, availability, deposit terms, or anything else about this house.</p><textarea value={messageBody} onChange={(event) => setMessageBody(event.target.value)} placeholder="Write your message" rows={5} required /><button className="role-dashboard-primary" type="submit">Send message <Icon name="arrow" size={15} /></button></form>}{dialog === 'review' && <form className="tenant-dialog-form" onSubmit={submitReview}><p>Tell other renters about your experience with this property.</p><div className="property-review-stars" aria-label="Choose a rating">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" className={value <= reviewRating ? 'is-selected' : ''} aria-label={`${value} stars`} onClick={() => setReviewRating(value)}>Ã¢Ëœâ€¦</button>)}</div><textarea value={reviewBody} onChange={(event) => setReviewBody(event.target.value)} placeholder="Write your review" rows={5} required /><button className="role-dashboard-primary" type="submit">Save review <Icon name="arrow" size={15} /></button></form>}</section></div>}</main>;
}

export function RoleDashboard({ role }: { role: DashboardRole }) {
  const config = configs[role];
  const [active, setActive] = useState('Overview');
  const initials = role === 'admin' ? 'AD' : role === 'tenant' ? 'TN' : role === 'landlord' ? 'LL' : 'CM';
  const accountLabel = role === 'admin' ? 'Platform administrator' : `Verified ${role}`;

  if (role === 'tenant') return <><DashboardUtilityDock role={role} /><TenantDashboard /><DashboardAccountBridge initials="CL" accountLabel="Verified client" /></>;
  if (role === 'commissioner') return <><DashboardUtilityDock role={role} /><CommissionerDashboard /><DashboardAccountBridge initials="CM" accountLabel="Verified Komisiyoneri" /></>;
  if (role === 'landlord') return <><DashboardUtilityDock role={role} /><LandlordDashboard /><DashboardAccountBridge initials="LL" accountLabel="Verified Property Owner" /></>;
  if (role === 'admin') return <><DashboardUtilityDock role={role} isAdmin /><AdminDashboard /><DashboardAccountBridge initials="AD" accountLabel="Platform administrator" /></>;

  return <main className="role-dashboard"><aside className="role-dashboard-sidebar"><Link className="role-dashboard-brand" href="/"><Logo /></Link><span className="role-dashboard-label">{config.eyebrow}</span><nav aria-label={`${config.eyebrow} navigation`}><Link className="role-dashboard-nav role-dashboard-home-link" href="/"><Icon name="home" size={17} /><span>Home</span></Link>{config.navigation.map((item) => <button className={`role-dashboard-nav ${active === item.label ? 'active' : ''}`} key={item.label} type="button" onClick={() => setActive(item.label)}><Icon name={item.icon} size={17} /><span>{item.label}</span></button>)}</nav><div className="role-dashboard-sidebar-bottom"><Link href="/">Back to marketplace <Icon name="arrow" size={14} /></Link><button type="button"><Icon name="user" size={16} /> Account</button></div></aside><section className="role-dashboard-main"><header className="role-dashboard-topbar"><div><span className="role-dashboard-eyebrow">{config.eyebrow}</span><h1>{active}</h1></div><div className="role-dashboard-profile"><span className="role-dashboard-avatar">{initials}</span><span><strong>My account</strong><small>{accountLabel}</small></span><Icon name="chevron" size={14} /></div></header><div className="role-dashboard-content"><section className="role-dashboard-welcome"><div><p className="role-dashboard-eyebrow">{config.greeting}</p><h2>{config.welcome}</h2><p>Manage your Umutungo activity in one clear, professional workspace.</p></div><button className="role-dashboard-primary" type="button"><Icon name={config.actionIcon} size={16} /> {config.action}</button></section><section className="role-dashboard-metrics" aria-label="Dashboard metrics">{config.metrics.map((metric) => <article key={metric.label}><span className={`role-dashboard-metric-icon ${metric.tone}`}><Icon name={metric.icon} size={17} /></span><small>{metric.label}</small><strong>{metric.value}</strong><em>{metric.note}</em></article>)}</section><div className="role-dashboard-grid"><section className="role-dashboard-panel"><div className="role-dashboard-panel-heading"><div><span className="role-dashboard-eyebrow">{config.panelEyebrow}</span><h3>{config.panelTitle}</h3></div><button type="button">View all <Icon name="arrow" size={14} /></button></div><div className="role-dashboard-activity">{config.activity.map((item) => <article key={`${item.name}-${item.time}`}><span className="role-dashboard-contact-avatar">{item.initials}</span><div><strong>{item.name}</strong><small>{item.detail} Ã‚Â· {item.time}</small></div><span className={`role-dashboard-status ${item.status === 'New' ? 'new' : ''}`}>{item.status}</span><button type="button" aria-label={`Open ${item.name}`}><Icon name="arrow" size={14} /></button></article>)}</div></section><section className="role-dashboard-panel role-dashboard-side-panel"><div className="role-dashboard-panel-heading"><div><span className="role-dashboard-eyebrow">{config.sideEyebrow}</span><h3>{config.sideTitle}</h3></div><Icon name="sparkles" size={17} /></div>{config.sideItems.map((item) => <div className="role-dashboard-side-item" key={item.title}><span><Icon name={item.icon} size={16} /></span><div><strong>{item.title}</strong><small>{item.detail}</small></div><Icon name="arrow" size={14} /></div>)}<button className="role-dashboard-outline" type="button">Open workspace</button></section></div></div></section></main>;
}
