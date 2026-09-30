'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon, IconName } from './Icons';
import { Logo } from './Logo';
import { AdminReport, AdminReportsResponse, ApiApplication, ApiMessage, ApiNotification, TenantBooking, TenantDashboardData, umutungoApi } from '../lib/umutungoApi';
import { downloadReportsExcel, downloadReportsImage, downloadReportsPdf } from '../lib/adminReportExports';
import { Language, t } from '../data/translations';
import { usePersistentLanguage } from '../lib/language';
import { usePersistentTheme } from '../lib/theme';

export type DashboardRole = 'tenant' | 'commissioner' | 'landlord' | 'admin';
type Metric = { label: string; value: string; note: string; icon: IconName; tone: 'green' | 'amber' | 'blue' | 'dark' };
type Activity = { name: string; detail: string; time: string; status: string; initials: string };
type DashboardConfig = { eyebrow: string; greeting: string; welcome: string; action: string; actionIcon: IconName; navigation: Array<{ label: string; icon: IconName }>; metrics: Metric[]; panelEyebrow: string; panelTitle: string; activity: Activity[]; sideEyebrow: string; sideTitle: string; sideItems: Array<{ title: string; detail: string; icon: IconName }> };
type DashboardListing = { id: string; title: string; type: string; intent: string; location: string; price: string; priceNote: string; cover: string; images: string[]; bedrooms: string; bathrooms: string; area: string; status: string; savedAt: string };
type LandlordApplication = ApiApplication & { applicant?: string; phone?: string; decision_note?: string };
type OwnerListingRecord = { id: string; category: string; transaction_type: string; title: string; description: string; price: number; currency: string; province: string; district: string; sector: string; cell?: string; village?: string; status: string; cover?: string; created_at: string };

const mapOwnerListing = (item: OwnerListingRecord): DashboardListing => {
  const intent = item.transaction_type === 'rent_out' || item.transaction_type === 'rent' ? 'For rent' : item.transaction_type === 'book' ? 'Book' : 'For sale';
  return { id: item.id, title: item.title, type: item.category, intent, location: [item.sector, item.district, item.province].filter(Boolean).join(' · '), price: `${item.currency || 'RWF'} ${item.price.toLocaleString()}`, priceNote: intent === 'For rent' ? '/ month' : ' asking', cover: item.cover || '/properties/house-01.jpg', images: item.cover ? [item.cover] : ['/properties/house-01.jpg'], bedrooms: '—', bathrooms: '—', area: '—', status: item.status, savedAt: item.created_at };
};

const configs: Record<DashboardRole, DashboardConfig> = {
  commissioner: {
    eyebrow: 'Commissioner workspace', greeting: 'Good morning', welcome: 'Keep every property conversation moving.', action: 'Add a listing', actionIcon: 'bookPen',
    navigation: [{ label: 'Overview', icon: 'building' }, { label: 'My listings', icon: 'home' }, { label: 'Enquiries', icon: 'users' }, { label: 'Messages', icon: 'users' }, { label: 'Visits', icon: 'bookPen' }],
    metrics: [{ label: 'Active listings', value: '12', note: '+3 this month', icon: 'home', tone: 'green' }, { label: 'New enquiries', value: '24', note: '8 need a reply', icon: 'users', tone: 'amber' }, { label: 'Viewings this week', value: '8', note: '2 tomorrow', icon: 'bookPen', tone: 'blue' }, { label: 'Commission this month', value: 'RWF 2.4M', note: 'On track', icon: 'arrow', tone: 'dark' }],
    panelEyebrow: 'Stay responsive', panelTitle: 'Recent enquiries', activity: [{ name: 'Aline Mukamana', detail: 'Kacyiru apartment', time: '10 min ago', status: 'New', initials: 'AM' }, { name: 'Patrick Nshimiyimana', detail: 'Gisozi family home', time: '42 min ago', status: 'Follow up', initials: 'PN' }, { name: 'Grace Uwase', detail: 'Gacuriro residential plot', time: 'Yesterday', status: 'Viewing booked', initials: 'GU' }], sideEyebrow: 'Your calendar', sideTitle: 'Upcoming visits', sideItems: [{ title: 'Kacyiru apartment', detail: 'Today · 11:30 AM', icon: 'home' }, { title: 'Gisozi family home', detail: 'Friday · 2:00 PM', icon: 'bookPen' }],
  },
  tenant: {
    eyebrow: 'Client dashboard', greeting: 'Welcome back', welcome: 'Your next home is closer than you think.', action: 'Explore homes', actionIcon: 'search',
    navigation: [{ label: 'Overview', icon: 'building' }, { label: 'Saved properties', icon: 'heart' }, { label: 'Applications', icon: 'bookPen' }, { label: 'Notifications', icon: 'bell' }, { label: 'Rent & utilities', icon: 'arrow' }, { label: 'Maintenance', icon: 'users' }, { label: 'Viewings', icon: 'bookPen' }, { label: 'Messages', icon: 'users' }],
    metrics: [{ label: 'Saved properties', value: '8', note: '+2 this week', icon: 'heart', tone: 'green' }, { label: 'New matches', value: '14', note: 'Based on your search', icon: 'sparkles', tone: 'amber' }, { label: 'Upcoming viewings', value: '2', note: 'Next: tomorrow', icon: 'bookPen', tone: 'blue' }, { label: 'Monthly budget', value: 'RWF 1.5M', note: 'Your current range', icon: 'arrow', tone: 'dark' }],
    panelEyebrow: 'Worth a look', panelTitle: 'Recommended for you', activity: [{ name: 'Modern Kacyiru apartment', detail: '2 beds · Kacyiru · RWF 1.1M / month', time: 'New today', status: 'View', initials: 'KA' }, { name: 'Four-bedroom home', detail: 'Gisozi · RWF 1.25M / month', time: '92% match', status: 'View', initials: 'GH' }, { name: 'Light-filled apartment', detail: 'Kimihurura · RWF 1.65M / month', time: '88% match', status: 'View', initials: 'LA' }], sideEyebrow: 'Your shortlist', sideTitle: 'Saved properties', sideItems: [{ title: 'Kacyiru apartment', detail: 'Saved 2 hours ago', icon: 'heart' }, { title: 'Nyarutarama home', detail: 'Saved yesterday', icon: 'heart' }],
  },
  landlord: {
    eyebrow: 'Property Owner workspace', greeting: 'Good morning', welcome: 'A clearer view of every property you own.', action: 'Post a property', actionIcon: 'bookPen',
    navigation: [{ label: 'Overview', icon: 'building' }, { label: 'My properties', icon: 'home' }, { label: 'Tenants', icon: 'users' }, { label: 'Rent & utilities', icon: 'arrow' }, { label: 'Maintenance', icon: 'bookPen' }, { label: 'Enquiries', icon: 'users' }, { label: 'Messages', icon: 'users' }, { label: 'Income', icon: 'arrow' }],
    metrics: [{ label: 'Listed properties', value: '6', note: '+1 this month', icon: 'home', tone: 'green' }, { label: 'Active enquiries', value: '18', note: '6 need a reply', icon: 'users', tone: 'amber' }, { label: 'Viewings this week', value: '5', note: '2 tomorrow', icon: 'bookPen', tone: 'blue' }, { label: 'Monthly income', value: 'RWF 4.8M', note: '+12% this month', icon: 'arrow', tone: 'dark' }],
    panelEyebrow: 'Keep listings moving', panelTitle: 'Recent enquiries', activity: [{ name: 'Aline Mukamana', detail: 'Kacyiru apartment', time: '10 min ago', status: 'New', initials: 'AM' }, { name: 'Patrick Nshimiyimana', detail: 'Gisozi family home', time: '42 min ago', status: 'Reply', initials: 'PN' }, { name: 'Eric Habimana', detail: 'Remera commercial space', time: 'Yesterday', status: 'Viewing', initials: 'EH' }], sideEyebrow: 'Property health', sideTitle: 'Listing performance', sideItems: [{ title: 'Kacyiru apartment', detail: '24 enquiries · 94% complete', icon: 'home' }, { title: 'Gisozi family home', detail: '18 enquiries · 88% complete', icon: 'home' }],
  },
  admin: {
    eyebrow: 'Admin control centre', greeting: 'Good morning', welcome: 'Keep the Umutungo marketplace trusted and moving.', action: 'Review listings', actionIcon: 'check',
    navigation: [{ label: 'Overview', icon: 'building' }, { label: 'Users', icon: 'users' }, { label: 'Listings review', icon: 'home' }, { label: 'Reports', icon: 'bookPen' }],
    metrics: [{ label: 'Total users', value: '2,840', note: '+8.4% this month', icon: 'users', tone: 'green' }, { label: 'Pending reviews', value: '17', note: 'Needs attention', icon: 'bookPen', tone: 'amber' }, { label: 'Active listings', value: '1,204', note: '+56 this month', icon: 'home', tone: 'blue' }, { label: 'Platform enquiries', value: '386', note: 'Across Rwanda', icon: 'arrow', tone: 'dark' }],
    panelEyebrow: 'Needs attention', panelTitle: 'Latest activity', activity: [{ name: 'New listing submitted', detail: 'Commercial space · Remera', time: '8 min ago', status: 'Review', initials: 'RL' }, { name: 'Agent verification request', detail: 'Jean Claude N. · Kigali', time: '31 min ago', status: 'Open', initials: 'JV' }, { name: 'Listing reported', detail: 'House · Nyarutarama', time: 'Yesterday', status: 'Investigate', initials: 'LR' }], sideEyebrow: 'Platform health', sideTitle: 'Quick checks', sideItems: [{ title: 'Verification queue', detail: '17 accounts waiting', icon: 'check' }, { title: 'Reported listings', detail: '3 need review', icon: 'bell' }],
  },
};

const dashboardLanguages: Language[] = ['English', 'French', 'Kinyarwanda', 'Swahili'];
const dashboardLanguageCodes: Record<Language, string> = { English: 'EN', French: 'FR', Kinyarwanda: 'RW', Swahili: 'SW' };

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
      <Link className="dashboard-header-tool" href="/#properties" title={t(language, 'Favorites')} aria-label={t(language, 'Favorites')}><Icon name="heart" size={17} /></Link>
      <div className="dashboard-notification-wrap">
        <button className="dashboard-header-tool" type="button" title={t(language, 'Notifications')} aria-label={t(language, 'Notifications')} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Icon name="bell" size={17} /><b>0</b></button>
        {notificationsOpen && <div className="dashboard-notification-popover" role="status">{t(language, 'No new notifications')}</div>}
      </div>
      <button className="dashboard-header-tool" type="button" title={darkMode ? t(language, 'Light mode') : t(language, 'Dark mode')} aria-label={darkMode ? t(language, 'Light mode') : t(language, 'Dark mode')} onClick={toggleTheme}><Icon name={darkMode ? 'sun' : 'moon'} size={17} /></button>
      <label className="dashboard-language-select" title={t(language, 'Language')}><Icon name="globe" size={15} /><select value={language} aria-label={t(language, 'Language')} onChange={(event) => changeLanguage(event.target.value as Language)}>{dashboardLanguages.map((item) => <option key={item} value={item}>{dashboardLanguageCodes[item]}</option>)}</select></label>
      <div className="role-dashboard-profile"><span className="role-dashboard-avatar">{initials}</span><span><strong>My account</strong><small>{accountLabel}</small></span><Icon name="chevron" size={14} /></div>
    </div>
  </header>;
}

function getLocalAdminReports(): AdminReport[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem('umutungo-listing-report') ?? 'null') as { listingId?: string; reason?: string; createdAt?: string } | null;
    if (!stored?.reason) return [];
    return [{ id: `local-${stored.listingId ?? 'report'}`, listing_id: stored.listingId ?? '', listing_title: 'Local listing report', reporter_name: 'Local session', reported_user_name: '', reason: stored.reason, details: `Listing ID: ${stored.listingId ?? 'unknown'}`, status: 'pending', created_at: stored.createdAt ?? new Date().toISOString() }];
  } catch { return []; }
}

function AdminReportDownloadMenu() {
  const [open, setOpen] = useState(false);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [busy, setBusy] = useState<'pdf' | 'excel' | 'image' | ''>('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await umutungoApi<AdminReportsResponse>('/api/v1/admin/reports?limit=100');
        if (!cancelled) setReports([...(result?.items ?? []), ...getLocalAdminReports().filter((local) => !(result?.items ?? []).some((item) => item.id === local.id))]);
      } catch { if (!cancelled) setReports(getLocalAdminReports()); }
    };
    void load();
    return () => { cancelled = true; };
  }, []);
  const download = async (format: 'pdf' | 'excel' | 'image') => {
    setBusy(format);
    try {
      if (format === 'pdf') downloadReportsPdf(reports);
      if (format === 'excel') downloadReportsExcel(reports);
      if (format === 'image') await downloadReportsImage(reports);
      setNotice(`${format === 'excel' ? 'Excel' : format[0].toUpperCase() + format.slice(1)} downloaded.`);
    } catch { setNotice('The report could not be prepared. Please try again.'); }
    finally { setBusy(''); }
  };
  return <div className="dashboard-notification-wrap admin-report-download-wrap"><button className="dashboard-header-tool" type="button" title="Download reports" aria-label="Download reports" aria-expanded={open} onClick={() => setOpen((current) => !current)}><Icon name="download" size={17} /></button>{open && <div className="dashboard-notification-popover admin-report-download-popover" role="dialog" aria-label="Download reports"><strong>Download reports</strong><small>{reports.length} report{reports.length === 1 ? '' : 's'} ready</small><div><button type="button" onClick={() => void download('pdf')} disabled={busy !== ''}><Icon name="download" size={13} /> {busy === 'pdf' ? 'Preparing...' : 'PDF'}</button><button type="button" onClick={() => void download('excel')} disabled={busy !== ''}><Icon name="download" size={13} /> {busy === 'excel' ? 'Preparing...' : 'Excel'}</button><button type="button" onClick={() => void download('image')} disabled={busy !== ''}><Icon name="download" size={13} /> {busy === 'image' ? 'Preparing...' : 'Image'}</button></div>{notice && <em role="status">{notice}</em>}</div>}</div>;
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
      const storedRole = role ?? window.localStorage.getItem('umutungo-demo-user')?.toLowerCase() ?? '';
      if (!storedRole.includes('commissioner')) {
        try {
          const result = await umutungoApi<{ items: ApiNotification[] }>('/api/v1/notifications');
          if (cancelled) return;
          if (result?.items) { setNotifications(result.items.filter((item) => !item.read_at)); return; }
        } catch { /* Use the local notification queue when the API is unavailable. */ }
      }
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
    <Link className="dashboard-header-tool" href="/#properties" title={t(language, 'Favorites')} aria-label={t(language, 'Favorites')}><Icon name="heart" size={17} /></Link>
    {isAdmin && <AdminReportDownloadMenu />}
    <div className="dashboard-notification-wrap"><button className="dashboard-header-tool" type="button" title={t(language, 'Notifications')} aria-label={t(language, 'Notifications')} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Icon name="bell" size={17} />{notifications.length > 0 && <b>{notifications.length > 99 ? '99+' : notifications.length}</b>}</button>{notificationsOpen && <div className="dashboard-notification-popover" role="status">{notifications.length ? notifications.slice(0, 5).map((item) => <article key={item.id}><strong>{item.title}</strong><small>{item.body}</small></article>) : t(language, 'No new notifications')}</div>}</div>
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
  const rows = view === 'Saved properties' ? [{ title: 'Light-filled Kacyiru apartment', detail: '2 beds · Kacyiru · RWF 1.1M / month', action: 'View property' }, { title: 'Four-bedroom home with garden', detail: 'Gisozi · RWF 1.25M / month', action: 'Compare' }, { title: 'Nyarutarama family residence', detail: '5 beds · RWF 2.4M / month', action: 'View property' }] : view === 'Viewings' ? [{ title: 'Kacyiru apartment', detail: 'Tomorrow · 11:30 AM · Confirmed', action: 'View details' }, { title: 'Gisozi family home', detail: 'Friday · 2:00 PM · Landlord confirmed', action: 'Open visit' }] : [{ title: 'Eric N. · Kacyiru apartment', detail: 'Landlord replied 10 min ago', action: 'Open message' }, { title: 'Aline M. · Gisozi family home', detail: 'Viewing details shared yesterday', action: 'Reply' }];
  return <section className="tenant-workspace-section"><div className="tenant-workspace-heading"><div><span className="role-dashboard-eyebrow">{panel.eyebrow}</span><h2>{panel.title}</h2><p>{panel.description}</p></div><span className="tenant-workspace-icon"><Icon name={panel.icon} size={22} /></span></div><div className="tenant-workspace-list">{rows.map((row) => <article key={row.title}><span className="tenant-workspace-row-icon"><Icon name={panel.icon} size={16} /></span><div><strong>{row.title}</strong><small>{row.detail}</small></div><button type="button">{row.action}<Icon name="arrow" size={14} /></button></article>)}</div><button className="role-dashboard-primary" type="button"><Icon name={view === 'Messages' ? 'bookPen' : 'search'} size={16} /> {view === 'Saved properties' ? 'Explore more properties' : view === 'Viewings' ? 'Find another viewing' : 'Start a new conversation'}</button></section>;
}

type TenantWorkspaceProps = { view: string; tenantData?: TenantDashboardData; notifications?: ApiNotification[]; onViewed?: (application: ApiApplication) => void; onPay?: (application: ApiApplication) => void; onContact?: (application: ApiApplication) => void; onReview?: (application: ApiApplication) => void; onAction?: (action: string) => void; onPrimaryAction?: (action: string) => void; notice?: string };

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
    const item: ApiMessage = { id: `commissioner-message-${Date.now()}`, sender_id: 'tenant-demo', sender_name: 'Tenant', recipient_id: 'commissioner', recipient_name: 'Commissioner', listing_id: '', body: message.trim(), created_at: createdAt };
    const messages = JSON.parse(window.localStorage.getItem('umutungo-commissioner-messages') ?? '[]') as ApiMessage[];
    window.localStorage.setItem('umutungo-commissioner-messages', JSON.stringify([item, ...messages]));
    const notifications = JSON.parse(window.localStorage.getItem('umutungo-commissioner-notifications') ?? '[]') as Array<Record<string, unknown>>;
    window.localStorage.setItem('umutungo-commissioner-notifications', JSON.stringify([{ id: `commissioner-notification-${item.id}`, type: 'message_received', title: 'New client message', body: item.body, createdAt, readAt: null }, ...notifications]));
    window.dispatchEvent(new CustomEvent('umutungo:commissioner-data-changed'));
    onClose();
    onNotice('Message sent to the commissioner.');
  };
  return <div className="tenant-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="workspace-action-title"><button className="tenant-dialog-backdrop" type="button" aria-label="Close workspace action" onClick={onClose} /><section className="tenant-dialog"><button className="property-action-close" type="button" aria-label="Close workspace action" onClick={onClose}><Icon name="x" size={18} /></button>{action === 'payment-method' && <><span className="role-dashboard-eyebrow">Rent & utilities</span><h2 id="workspace-action-title">Add a payment method</h2><form className="tenant-dialog-form" onSubmit={submitPaymentMethod}><p>Save a payment method for future rent and utility payments.</p><label>Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="mtn_momo">MTN MoMo</option><option value="airtel_money">Airtel Money</option><option value="card">Bank card</option></select></label><label>{paymentMethod === 'card' ? 'Card details' : 'Phone number'}<input value={paymentDetails} onChange={(event) => setPaymentDetails(event.target.value)} placeholder={paymentMethod === 'card' ? 'Last four digits or card label' : '+250 7XX XXX XXX'} required /></label><button className="role-dashboard-primary" type="submit">Save payment method <Icon name="check" size={15} /></button></form></>}{action === 'maintenance' && <><span className="role-dashboard-eyebrow">Property care</span><h2 id="workspace-action-title">Create maintenance request</h2><form className="tenant-dialog-form" onSubmit={submitMaintenance}><p>Tell the property owner what needs attention.</p><label>Issue title<input value={maintenanceTitle} onChange={(event) => setMaintenanceTitle(event.target.value)} placeholder="e.g. Kitchen tap replacement" required /></label><label>Details<textarea value={maintenanceDetails} onChange={(event) => setMaintenanceDetails(event.target.value)} placeholder="Describe the issue" rows={4} required /></label><button className="role-dashboard-primary" type="submit">Submit request <Icon name="arrow" size={15} /></button></form></>}{action === 'commissioner' && <><span className="role-dashboard-eyebrow">Commissioner support</span><h2 id="workspace-action-title">Contact commissioner</h2><form className="tenant-dialog-form" onSubmit={submitCommissioner}><p>Send a message to the commissioner helping you with your property journey.</p><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write your message" rows={5} required /><button className="role-dashboard-primary" type="submit">Send message <Icon name="arrow" size={15} /></button></form></>}</section></div>;
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

  return <section className="tenant-workspace-section landlord-message-workspace"><div className="tenant-workspace-heading"><div><span className="role-dashboard-eyebrow">Tenant conversations</span><h2>Messages</h2><p>Read tenant questions, discuss the rent, and agree on the next step from one place.</p></div><span className="tenant-workspace-icon"><Icon name="users" size={22} /></span></div>{messages.length ? <div className="landlord-message-layout"><div className="landlord-message-inbox">{messages.filter((message, index, all) => index === all.findIndex((item) => item.listing_id === message.listing_id && item.sender_id === message.sender_id)).map((message) => <button className={selected?.id === message.id ? 'is-selected' : ''} type="button" key={message.id} onClick={() => setSelectedID(message.id)}><strong>{message.sender_name}</strong><small>{message.body}</small><time>{new Date(message.created_at).toLocaleDateString()}</time></button>)}</div><div className="landlord-message-thread"><div className="landlord-message-thread-list">{conversation.map((message) => <article key={message.id} className={message.sender_id === currentUserID ? 'is-owner' : ''}><strong>{message.sender_name}</strong><p>{message.body}</p><time>{new Date(message.created_at).toLocaleString()}</time></article>)}</div><form className="tenant-message-composer" onSubmit={sendReply}><label htmlFor="landlord-message-draft">Reply to {selected?.sender_name ?? 'tenant'}</label><textarea id="landlord-message-draft" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a reply or agree on the monthly price" rows={4} /><div><button className="role-dashboard-outline" type="button" onClick={generateReply} disabled={aiLoading || !selected}>{aiLoading ? 'Preparing…' : 'Draft with Groq'}</button><button className="role-dashboard-primary" type="submit">Send reply <Icon name="arrow" size={15} /></button></div>{notice && <small>{notice}</small>}</form></div></div> : <div className="tenant-message-empty"><Icon name="bookPen" size={20} /><div><strong>No tenant messages yet</strong><p>Messages sent from a property or application will appear here.</p></div></div>}</section>;
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

function TenantWorkspaceSection({ view, tenantData, notifications = [], onViewed, onPay, onContact, onReview, onAction, onPrimaryAction, notice }: TenantWorkspaceProps) {
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
  const rows = view === 'Applications' && tenantData ? tenantData.applications.map((application) => ({ title: application.listing_title, detail: `${application.status} · ${application.viewed_at ? 'House seen' : 'House not seen yet'}`, action: application.viewed_at ? 'Pay deposit' : 'Mark house seen', application })) : view === 'Messages' && tenantData ? tenantData.messages.map((message) => ({ title: `${message.sender_name} · landlord conversation`, detail: message.body, action: 'Reply', application: undefined })) : view === 'Rent & utilities' && tenantData ? tenantData.payments.map((payment) => ({ title: `${payment.provider} payment`, detail: `${payment.currency} ${payment.amount.toLocaleString()} · ${payment.status}`, action: 'View payment', application: undefined })) : view === 'Applications' ? [{ title: 'No applications yet', detail: 'Apply to a house to see your next steps here.', action: 'Explore homes' }] : view === 'Rent & utilities' ? [{ title: 'No payments yet', detail: 'Payments will appear here after you have seen a property.', action: 'View applications' }] : view === 'Maintenance' ? [{ title: 'Kitchen tap replacement', detail: 'Submitted today · Open', action: 'View request' }, { title: 'Bedroom light repair', detail: 'Completed last month', action: 'View history' }] : view === 'Tenants' ? [{ title: 'Aline Mukamana', detail: 'Kacyiru apartment · Rent up to date', action: 'Open tenant' }, { title: 'Patrick Nshimiyimana', detail: 'Gisozi family home · Payment due in 3 days', action: 'Send reminder' }] : view === 'Viewings' ? [{ title: 'Kacyiru apartment', detail: 'Tomorrow · 11:30 AM · Confirmed', action: 'View details' }, { title: 'Gisozi family home', detail: 'Friday · 2:00 PM · Landlord confirmed', action: 'Open visit' }] : view === 'Messages' ? [{ title: 'No conversations yet', detail: 'Contact a landlord from an application or property page.', action: 'Explore homes' }] : [{ title: 'Light-filled Kacyiru apartment', detail: '2 beds · Kacyiru · RWF 1.1M / month', action: 'View property' }, { title: 'Four-bedroom home with garden', detail: 'Gisozi · RWF 1.25M / month', action: 'Compare' }];
  const openWorkspaceAction = (action: string) => { if (onPrimaryAction) { onPrimaryAction(action); return; } if (action === 'Add a payment method') setWorkspaceAction('payment-method'); else if (action === 'Create maintenance request') setWorkspaceAction('maintenance'); else if (action === 'Contact commissioner') setWorkspaceAction('commissioner'); else if (onAction) onAction(action); else window.dispatchEvent(new CustomEvent('umutungo:tenant-workspace-action', { detail: { action } })); };
  const handleAction = (action: string, application?: ApiApplication) => { if (application && action === 'Mark house seen') onViewed?.(application); else if (application && action === 'Pay deposit') onPay?.(application); else if (application && action === 'Contact landlord') onContact?.(application); else if (application && action === 'Review property') onReview?.(application); else if (action === 'Start another application' || action === 'Explore homes' || action === 'Explore more properties') window.location.assign('/categories/houses'); else openWorkspaceAction(action); };
  const primaryLabel = view === 'Applications' ? 'Start another application' : view === 'Rent & utilities' ? 'Add a payment method' : view === 'Maintenance' ? 'Create maintenance request' : view === 'Tenants' ? 'Contact commissioner' : view === 'Messages' ? 'Start a new conversation' : view === 'Viewings' ? 'Find another viewing' : 'Explore more properties';
  return <><section className="tenant-workspace-section"><div className="tenant-workspace-heading"><div><span className="role-dashboard-eyebrow">{panel.eyebrow}</span><h2>{panel.title}</h2><p>{panel.description}</p></div><span className="tenant-workspace-icon"><Icon name={panel.icon} size={22} /></span></div>{tenantData?.bookings && <TenantBookingSummary bookings={tenantData.bookings} />}<div className="tenant-workspace-list">{rows.map((row) => <article key={row.title}><span className="tenant-workspace-row-icon"><Icon name={panel.icon} size={16} /></span><div><strong>{row.title}</strong><small>{row.detail}</small></div><button type="button" onClick={() => handleAction(row.action, 'application' in row ? row.application : undefined)}>{row.action}<Icon name="arrow" size={14} /></button>{'application' in row && row.application?.viewed_at && <><button type="button" onClick={() => onContact?.(row.application)}>Contact landlord<Icon name="users" size={14} /></button><button type="button" onClick={() => onReview?.(row.application)}>Review property<Icon name="arrow" size={14} /></button></>}</article>)}</div>{(notice || workspaceNotice) && <p className="workspace-action-notice" role="status"><Icon name="check" size={14} /> {notice || workspaceNotice}</p>}<button className="role-dashboard-primary" type="button" onClick={() => openWorkspaceAction(primaryLabel)}><Icon name={view === 'Messages' ? 'bookPen' : 'arrow'} size={16} /> {primaryLabel}</button></section>{workspaceAction && <TenantWorkspaceActionDialog action={workspaceAction} onClose={() => setWorkspaceAction(null)} onNotice={(message) => { setWorkspaceNotice(message); onAction?.(message); }} />}</>;
}

function LandlordPropertiesSection({ listings, title = 'My properties', actionLabel = 'Post a property', onDelete, onManage }: { listings: DashboardListing[]; title?: string; actionLabel?: string; onDelete?: (listing: DashboardListing) => void; onManage?: (listing: DashboardListing) => void }) {
  return <section className="landlord-properties-section"><div className="tenant-workspace-heading"><div><span className="role-dashboard-eyebrow">Your inventory</span><h2>{title}</h2><p>View the property assets you have uploaded and keep each listing ready for its next step.</p></div><span className="tenant-workspace-icon"><Icon name="home" size={22} /></span></div>{listings.length ? <div className="landlord-property-grid">{listings.map((listing) => <article className="landlord-property-card" key={listing.id}><div className="landlord-property-image"><img src={listing.cover} alt={listing.title} /><span>{listing.status}</span></div><div className="landlord-property-copy"><div><span className="role-dashboard-eyebrow">{listing.type} · {listing.intent}</span><h3>{listing.title}</h3><p>{listing.location}</p></div><strong>{listing.price} <small>{listing.priceNote}</small></strong><div className="landlord-property-meta"><span>{listing.bedrooms} beds</span><span>{listing.bathrooms} baths</span><span>{listing.area} m2</span></div><div className="landlord-property-actions"><button type="button" onClick={() => onManage?.(listing)}>Manage listing <Icon name="arrow" size={14} /></button>{onDelete && <button className="landlord-delete-button" type="button" onClick={() => onDelete(listing)}>Delete listing</button>}</div></div></article>)}</div> : <div className="landlord-empty-properties"><span className="tenant-workspace-icon"><Icon name="download" size={22} /></span><h3>No uploaded properties yet</h3><p>Your saved listing assets will appear here after you complete the post-property builder.</p><Link className="role-dashboard-primary" href="/post-property"><Icon name="bookPen" size={16} /> {actionLabel}</Link></div>}</section>;
}

function LandlordListingEditor({ listing, onSave, onCancel }: { listing: DashboardListing; onSave: (listing: DashboardListing) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(listing.title);
  const [price, setPrice] = useState(listing.price.replace(/[^0-9.]/g, ''));
  const [status, setStatus] = useState(listing.status);
  return <section className="tenant-workspace-section listing-editor"><div className="tenant-workspace-heading"><div><span className="role-dashboard-eyebrow">Listing editor</span><h2>Manage listing</h2><p>Update the details your tenants and buyers see in the marketplace.</p></div><span className="tenant-workspace-icon"><Icon name="bookPen" size={22} /></span></div><form className="listing-editor-form" onSubmit={(event) => { event.preventDefault(); const numericPrice = Number(price); onSave({ ...listing, title: title.trim() || listing.title, price: `${listing.price.split(' ')[0] || 'RWF'} ${Number.isFinite(numericPrice) ? numericPrice.toLocaleString() : price}`, status }); }}><label>Property title<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label>Price<input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value.replace(/[^0-9.]/g, ''))} required /></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="published">Published</option><option value="draft">Draft</option><option value="paused">Paused</option></select></label><div className="listing-editor-actions"><button className="role-dashboard-primary" type="submit">Save changes <Icon name="check" size={15} /></button><button className="role-dashboard-outline" type="button" onClick={onCancel}>Cancel</button></div></form></section>;
}

function LandlordNotifications({ applications, onApprove, onOpenApplications }: { applications: LandlordApplication[]; onApprove: (application: LandlordApplication) => void; onOpenApplications: () => void }) {
  const pending = applications.filter((application) => application.status.toLowerCase() === 'pending');
  return <section className="role-dashboard-panel landlord-notification-panel"><div className="role-dashboard-panel-heading"><div><span className="role-dashboard-eyebrow">Notifications</span><h3>Rental applications</h3></div><span className="landlord-notification-count">{pending.length} pending</span></div>{pending.length ? <div className="landlord-notification-list">{pending.slice(0, 4).map((application) => <article className="landlord-notification-card" key={application.id}><span className="tenant-workspace-row-icon"><Icon name="bell" size={16} /></span><div><strong>{application.applicant_name ?? application.applicant ?? 'New tenant'}</strong><small>{application.listing_title} · {new Date(application.created_at).toLocaleDateString()}</small><p>{application.message || 'New rental application received.'}</p></div><button type="button" onClick={() => onApprove(application)}>Approve <Icon name="check" size={14} /></button></article>)}</div> : <div className="landlord-notification-empty"><Icon name="check" size={18} /><p>No pending applications. New tenant requests will appear here.</p></div>}<button className="role-dashboard-outline" type="button" onClick={onOpenApplications}>Open all applications <Icon name="arrow" size={14} /></button></section>;
}

function LandlordApplicationsSection({ applications, onApprove, notice }: { applications: LandlordApplication[]; onApprove: (application: LandlordApplication, agreedPrice?: number) => void; notice: string }) {
  const [agreedPrices, setAgreedPrices] = useState<Record<string, string>>({});
  return <section className="tenant-workspace-section"><div className="tenant-workspace-heading"><div><span className="role-dashboard-eyebrow">Tenant requests</span><h2>Applications</h2><p>Review rental applications from tenants and approve the requests that are ready to move forward.</p></div><span className="tenant-workspace-icon"><Icon name="users" size={22} /></span></div>{applications.length ? <div className="landlord-application-list">{applications.map((application) => { const pending = application.status.toLowerCase() === 'pending'; return <article className="landlord-application-card" key={application.id}><div className="landlord-application-card-heading"><div><strong>{application.applicant_name ?? application.applicant ?? 'Tenant applicant'}</strong><small>{application.listing_title} · {new Date(application.created_at).toLocaleDateString()}</small></div><span className={`role-dashboard-status ${pending ? 'pending' : 'new'}`}>{application.status}</span></div><p>{application.message || 'No message included with this application.'}</p>{application.phone && <small className="landlord-application-phone">Phone: {application.phone}</small>}{pending && <button className="role-dashboard-primary" type="button" onClick={() => onApprove(application)}>Approve application <Icon name="check" size={15} /></button>}</article>; })}</div> : <div className="landlord-notification-empty"><Icon name="users" size={18} /><p>No applications have been received yet.</p></div>}{notice && <p className="workspace-action-notice" role="status"><Icon name="check" size={14} /> {notice}</p>}</section>;
}

function LandlordApplicationsWithPrice({ applications, onApprove, notice }: { applications: LandlordApplication[]; onApprove: (application: LandlordApplication, agreedPrice?: number) => void; notice: string }) {
  const [agreedPrices, setAgreedPrices] = useState<Record<string, string>>({});
  return <section className="tenant-workspace-section"><div className="tenant-workspace-heading"><div><span className="role-dashboard-eyebrow">Tenant requests</span><h2>Applications</h2><p>Review rental applications, agree on a monthly price, and approve the request when you are ready.</p></div><span className="tenant-workspace-icon"><Icon name="users" size={22} /></span></div>{applications.length ? <div className="landlord-application-list">{applications.map((application) => { const pending = application.status.toLowerCase() === 'pending'; return <article className="landlord-application-card" key={application.id}><div className="landlord-application-card-heading"><div><strong>{application.applicant_name ?? application.applicant ?? 'Tenant applicant'}</strong><small>{application.listing_title} · {new Date(application.created_at).toLocaleDateString()}</small></div><span className={`role-dashboard-status ${pending ? 'pending' : 'new'}`}>{application.status}</span></div><p>{application.message || 'No message included with this application.'}</p>{application.phone && <small className="landlord-application-phone">Phone: {application.phone}</small>}{pending && <div className="landlord-approval-controls"><label>Agreed monthly rent (RWF)<input type="number" min="1" value={agreedPrices[application.id] ?? ''} onChange={(event) => setAgreedPrices((current) => ({ ...current, [application.id]: event.target.value }))} placeholder="Use listing price" /></label><button className="role-dashboard-primary" type="button" onClick={() => onApprove(application, agreedPrices[application.id] ? Number(agreedPrices[application.id]) : undefined)}>Approve application <Icon name="check" size={15} /></button></div>}</article>; })}</div> : <div className="landlord-notification-empty"><Icon name="users" size={18} /><p>No applications have been received yet.</p></div>}{notice && <p className="workspace-action-notice" role="status"><Icon name="check" size={14} /> {notice}</p>}</section>;
}

function LandlordDashboard() {
  const config = configs.landlord;
  const [active, setActive] = useState('Overview');
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
    if (!window.confirm(`Delete “${listing.title}”? This removes it from the hosted marketplace.`)) return;
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
    const message: ApiMessage = { id: `commissioner-message-${Date.now()}`, sender_id: 'landlord-demo', sender_name: 'Property Owner', recipient_id: 'commissioner', recipient_name: 'Commissioner', listing_id: '', body, created_at: createdAt };
    try {
      const stored = JSON.parse(window.localStorage.getItem('umutungo-commissioner-messages') ?? '[]') as ApiMessage[];
      window.localStorage.setItem('umutungo-commissioner-messages', JSON.stringify([message, ...stored]));
      const notifications = JSON.parse(window.localStorage.getItem('umutungo-commissioner-notifications') ?? '[]') as Array<Record<string, unknown>>;
      window.localStorage.setItem('umutungo-commissioner-notifications', JSON.stringify([{ id: `commissioner-notification-${message.id}`, type: 'message_received', title: 'New landlord message', body: message.body, createdAt, readAt: null }, ...notifications]));
    } catch { /* Keep the action usable when storage is unavailable. */ }
    window.dispatchEvent(new CustomEvent('umutungo:commissioner-data-changed'));
    setCommissionerMessage('');
    setContactCommissionerOpen(false);
    setNotice('Message sent to the commissioner.');
  };
  const metrics = config.metrics.map((metric, index) => index === 0 && listings.length ? { ...metric, value: String(listings.length), note: 'Saved in your workspace' } : metric);
  const landlordNotificationPanel = <div className="role-dashboard-content"><LandlordNotifications applications={applications} onApprove={approveApplication} onOpenApplications={() => setActive('Enquiries')} /></div>;
  const overview = <div className="role-dashboard-content"><section className="role-dashboard-welcome"><div><p className="role-dashboard-eyebrow">Good morning</p><h2>A clearer view of every property you own.</h2><p>Upload, manage, and promote your property assets from one professional workspace.</p></div><Link className="role-dashboard-primary" href="/post-property"><Icon name="bookPen" size={16} /> Post a property</Link></section><section className="role-dashboard-metrics" aria-label="Landlord metrics">{metrics.map((metric) => <article key={metric.label}><span className={`role-dashboard-metric-icon ${metric.tone}`}><Icon name={metric.icon} size={17} /></span><small>{metric.label}</small><strong>{metric.value}</strong><em>{metric.note}</em></article>)}</section><div className="role-dashboard-panel landlord-overview-panel"><div className="role-dashboard-panel-heading"><div><span className="role-dashboard-eyebrow">Latest uploads</span><h3>Property assets</h3></div><button type="button" onClick={() => setActive('My properties')}>View all <Icon name="arrow" size={14} /></button></div>{listings.slice(0, 3).map((listing) => <div className="role-dashboard-side-item" key={listing.id}><span><Icon name="home" size={16} /></span><div><strong>{listing.title}</strong><small>{listing.location} · {listing.status}</small></div><Icon name="arrow" size={14} /></div>)}{!listings.length && <p className="landlord-empty-note">No new property assets yet. Start with your first listing.</p>}</div></div>;
  const body = active === 'Overview' ? <>{overview}{landlordNotificationPanel}</> : active === 'My properties' ? <div className="role-dashboard-content">{editingListing ? <LandlordListingEditor listing={editingListing} onSave={saveListing} onCancel={() => setEditingListing(null)} /> : <LandlordPropertiesSection listings={listings} onDelete={deleteListing} onManage={setEditingListing} />}</div> : active === 'Enquiries' ? <div className="role-dashboard-content"><LandlordApplicationsWithPrice applications={applications} onApprove={approveApplication} notice={notice} /></div> : active === 'Messages' ? <div className="role-dashboard-content"><LandlordMessageWorkspace messages={messages} currentUserID={currentUserID} onSent={(message) => setMessages((current) => [...current, message])} /></div> : <div className="role-dashboard-content"><TenantWorkspaceSection view={active} onPrimaryAction={(action) => { if (action === 'Contact commissioner') setContactCommissionerOpen(true); }} onAction={(action) => setNotice(`${action} selected.`)} notice={notice} /></div>;
  return <main className="role-dashboard"><aside className="role-dashboard-sidebar"><Link className="role-dashboard-brand" href="/"><Logo /></Link><span className="role-dashboard-label">{config.eyebrow}</span><nav aria-label="Property Owner dashboard navigation"><Link className="role-dashboard-nav role-dashboard-home-link" href="/"><Icon name="home" size={17} /><span>Home</span></Link>{config.navigation.map((item) => <button className={`role-dashboard-nav ${active === item.label ? 'active' : ''}`} key={item.label} type="button" onClick={() => { setActive(item.label); setEditingListing(null); }}><Icon name={item.icon} size={17} /><span>{item.label}</span></button>)}</nav><div className="role-dashboard-sidebar-bottom"><Link href="/">Back to marketplace <Icon name="arrow" size={14} /></Link><Link href="/post-property"><Icon name="bookPen" size={16} /> Post property</Link></div></aside><section className="role-dashboard-main"><header className="role-dashboard-topbar"><div><span className="role-dashboard-eyebrow">{config.eyebrow}</span><h1>{active}</h1></div><button className="role-dashboard-profile" type="button" onClick={() => setActive('Overview')}><span className="role-dashboard-avatar">LL</span><span><strong>My account</strong><small>Verified Property Owner</small></span><Icon name="chevron" size={14} /></button></header>{body}{contactCommissionerOpen && <div className="tenant-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="commissioner-contact-title"><button className="tenant-dialog-backdrop" type="button" aria-label="Close commissioner message" onClick={() => setContactCommissionerOpen(false)} /><section className="tenant-dialog"><button className="property-action-close" type="button" aria-label="Close commissioner message" onClick={() => setContactCommissionerOpen(false)}><Icon name="x" size={18} /></button><span className="role-dashboard-eyebrow">Commissioner support</span><h2 id="commissioner-contact-title">Contact commissioner</h2><form className="tenant-dialog-form" onSubmit={sendCommissionerMessage}><p>Send a message to the commissioner helping coordinate your property.</p><textarea value={commissionerMessage} onChange={(event) => setCommissionerMessage(event.target.value)} placeholder="Write your message" rows={5} required /><button className="role-dashboard-primary" type="submit">Send message <Icon name="arrow" size={15} /></button></form></section></div>}</section></main>;
}

function AdminDashboard() {
  const config = configs.admin;
  const [active, setActive] = useState('Overview');
  const [notice, setNotice] = useState('');
  const rows = active === 'Users' ? [{ title: 'Jean Claude N.', detail: 'Komisiyoneri KYC · Submitted 31 min ago', action: 'Review KYC' }, { title: 'Aline Mukamana', detail: 'Client account · Verified', action: 'Open account' }] : active === 'Listings review' ? [{ title: 'Commercial space · Remera', detail: 'New listing · Awaiting review', action: 'Approve listing' }, { title: 'House · Nyarutarama', detail: 'Reported · Incorrect information', action: 'Remove listing' }] : active === 'Reports' ? [{ title: 'Listing report', detail: 'Possible duplicate · 8 min ago', action: 'Investigate report' }, { title: 'Account report', detail: 'Suspicious activity · Yesterday', action: 'Suspend account' }] : config.activity.map((item) => ({ title: item.name, detail: `${item.detail} · ${item.time}`, action: item.status }));
  const act = (action: string) => { window.localStorage.setItem('umutungo-admin-audit-log', JSON.stringify({ action, actor: 'demo-admin', timestamp: new Date().toISOString() })); setNotice(`${action} recorded in the moderation audit log.`); };
  return <main className="role-dashboard"><aside className="role-dashboard-sidebar"><Link className="role-dashboard-brand" href="/"><Logo /></Link><span className="role-dashboard-label">{config.eyebrow}</span><nav aria-label="Admin dashboard navigation"><Link className="role-dashboard-nav role-dashboard-home-link" href="/"><Icon name="home" size={17} /><span>Home</span></Link>{config.navigation.map((item) => <button className={`role-dashboard-nav ${active === item.label ? 'active' : ''}`} key={item.label} type="button" onClick={() => setActive(item.label)}><Icon name={item.icon} size={17} /><span>{item.label}</span></button>)}</nav><div className="role-dashboard-sidebar-bottom"><Link href="/">Back to marketplace <Icon name="arrow" size={14} /></Link><Link href="/register"><Icon name="user" size={16} /> Create account</Link></div></aside><section className="role-dashboard-main"><header className="role-dashboard-topbar"><div><span className="role-dashboard-eyebrow">{config.eyebrow}</span><h1>{active}</h1></div><div className="role-dashboard-profile"><span className="role-dashboard-avatar">AD</span><span><strong>My account</strong><small>Platform administrator</small></span><Icon name="chevron" size={14} /></div></header><div className="role-dashboard-content"><section className="role-dashboard-welcome"><div><p className="role-dashboard-eyebrow">Trust and safety</p><h2>Keep the marketplace trusted and moving.</h2><p>Review KYC submissions, investigate reports, and record every moderation decision.</p></div><button className="role-dashboard-primary" type="button" onClick={() => setActive('Reports')}><Icon name="bell" size={16} /> Review reports</button></section><section className="role-dashboard-metrics" aria-label="Moderation metrics">{config.metrics.map((metric) => <article key={metric.label}><span className={`role-dashboard-metric-icon ${metric.tone}`}><Icon name={metric.icon} size={17} /></span><small>{metric.label}</small><strong>{metric.value}</strong><em>{metric.note}</em></article>)}</section><section className="role-dashboard-panel"><div className="role-dashboard-panel-heading"><div><span className="role-dashboard-eyebrow">Moderation queue</span><h3>{active === 'Overview' ? 'Latest activity' : active}</h3></div><Icon name="check" size={17} /></div><div className="role-dashboard-activity">{rows.map((row) => <article key={row.title}><span className="role-dashboard-contact-avatar">{row.title.slice(0, 2).toUpperCase()}</span><div><strong>{row.title}</strong><small>{row.detail}</small></div><button type="button" onClick={() => act(row.action)}>{row.action}<Icon name="arrow" size={14} /></button></article>)}</div>{notice && <p className="workspace-action-notice" role="status"><Icon name="check" size={14} /> {notice}</p>}</section></div></section></main>;
}

function CommissionerDashboard() {
  const config = configs.commissioner;
  const [active, setActive] = useState('Overview');
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
  const overview = <div className="role-dashboard-content"><section className="role-dashboard-welcome"><div><p className="role-dashboard-eyebrow">{config.greeting}</p><h2>{config.welcome}</h2><p>Add properties, manage enquiries, and keep every client conversation moving from one workspace.</p></div><Link className="role-dashboard-primary" href="/post-property"><Icon name="bookPen" size={16} /> Add a property</Link></section><section className="role-dashboard-metrics" aria-label="Commissioner metrics">{metrics.map((metric) => <article key={metric.label}><span className={`role-dashboard-metric-icon ${metric.tone}`}><Icon name={metric.icon} size={17} /></span><small>{metric.label}</small><strong>{metric.value}</strong><em>{metric.note}</em></article>)}</section><div className="role-dashboard-panel landlord-overview-panel"><div className="role-dashboard-panel-heading"><div><span className="role-dashboard-eyebrow">Latest uploads</span><h3>Property listings</h3></div><button type="button" onClick={() => setActive('My listings')}>View all <Icon name="arrow" size={14} /></button></div>{listings.slice(0, 3).map((listing) => <div className="role-dashboard-side-item" key={listing.id}><span><Icon name="home" size={16} /></span><div><strong>{listing.title}</strong><small>{listing.location} · {listing.status}</small></div><Icon name="arrow" size={14} /></div>)}{!listings.length && <p className="landlord-empty-note">No property listings yet. Add your first property to get started.</p>}</div></div>;
  const body = active === 'Overview' ? overview : active === 'My listings' ? <div className="role-dashboard-content"><LandlordPropertiesSection listings={listings} title="My listings" actionLabel="Add a property" /></div> : active === 'Messages' ? <div className="role-dashboard-content"><LandlordMessageWorkspace messages={messages} currentUserID={currentUserID} contactLabel="client" onSent={(message) => setMessages((current) => [...current, message])} /></div> : <div className="role-dashboard-content"><TenantWorkspaceSection view={active} /></div>;
  return <main className="role-dashboard"><aside className="role-dashboard-sidebar"><Link className="role-dashboard-brand" href="/"><Logo /></Link><span className="role-dashboard-label">{config.eyebrow}</span><nav aria-label="Commissioner dashboard navigation"><Link className="role-dashboard-nav role-dashboard-home-link" href="/"><Icon name="home" size={17} /><span>Home</span></Link>{config.navigation.map((item) => <button className={`role-dashboard-nav ${active === item.label ? 'active' : ''}`} key={item.label} type="button" onClick={() => setActive(item.label)}><Icon name={item.icon} size={17} /><span>{item.label}</span></button>)}</nav><div className="role-dashboard-sidebar-bottom"><Link href="/">Back to marketplace <Icon name="arrow" size={14} /></Link><Link href="/post-property"><Icon name="bookPen" size={16} /> Add a property</Link></div></aside><section className="role-dashboard-main"><header className="role-dashboard-topbar"><div><span className="role-dashboard-eyebrow">{config.eyebrow}</span><h1>{active}</h1></div><div className="role-dashboard-profile"><span className="role-dashboard-avatar">CM</span><span><strong>My account</strong><small>Verified commissioner</small></span><Icon name="chevron" size={14} /></div></header>{body}</section></main>;
}

const emptyTenantData: TenantDashboardData = { properties: [], applications: [], notifications: [], payments: [], messages: [], bookings: [], reviews: [] };

function TenantBookingSummary({ bookings }: { bookings: TenantBooking[] }) {
  if (!bookings.length) return null;
  return <section className="tenant-booking-summary" aria-label="Booked houses"><div className="tenant-booking-summary-heading"><span className="role-dashboard-eyebrow">Your booked house</span><Icon name="home" size={17} /></div>{bookings.map((booking) => <article key={booking.id}><div><strong>{booking.property_title}</strong><small>{booking.location} · {booking.price}</small></div><span className={`role-dashboard-status ${booking.payment_status === 'paid' ? 'new' : 'pending'}`}>{booking.payment_status === 'paid' ? 'Paid' : 'Pending payment'}</span></article>)}</section>;
}

function TenantNotificationWorkspace({ notifications }: { notifications: ApiNotification[] }) {
  return <section className="tenant-workspace-section"><div className="tenant-workspace-heading"><div><span className="role-dashboard-eyebrow">Account updates</span><h2>Notifications</h2><p>See application decisions, landlord messages, and important updates about your property journey.</p></div><span className="tenant-workspace-icon"><Icon name="bell" size={22} /></span></div>{notifications.length ? <div className="tenant-workspace-list">{notifications.map((item) => <article key={item.id}><span className="tenant-workspace-row-icon"><Icon name="bell" size={16} /></span><div><strong>{item.title}</strong><small>{item.body}</small></div><time>{new Date(item.created_at).toLocaleString()}</time></article>)}</div> : <div className="tenant-message-empty"><Icon name="check" size={20} /><div><strong>No new notifications</strong><p>Application decisions and landlord replies will appear here.</p></div></div>}</section>;
}

function TenantDashboard() {
  const config = configs.tenant;
  const [active, setActive] = useState('Overview');
  const [tenantData, setTenantData] = useState<TenantDashboardData>(emptyTenantData);
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
    let cancelled = false;
    const load = async () => {
      const storedApplications = JSON.parse(window.localStorage.getItem('umutungo-rental-applications') ?? '[]') as Array<Record<string, string>>;
      const localApplications: ApiApplication[] = storedApplications.map((item) => ({ id: item.id, listing_id: item.propertyId ?? '', listing_title: item.propertyTitle ?? 'Rental property', status: (item.status ?? 'pending').toLowerCase(), message: item.message ?? '', viewed_at: item.viewedAt ?? null, created_at: item.createdAt ?? new Date().toISOString() }));
      const localPayments = JSON.parse(window.localStorage.getItem('umutungo-payments') ?? '[]') as TenantDashboardData['payments'];
      const localMessages = JSON.parse(window.localStorage.getItem('umutungo-tenant-messages') ?? '[]') as ApiMessage[];
      const localBookings = JSON.parse(window.localStorage.getItem('umutungo-tenant-bookings') ?? '[]') as TenantBooking[];
      const localNotifications = JSON.parse(window.localStorage.getItem('umutungo-tenant-notifications') ?? '[]') as ApiNotification[];
      if (!cancelled) setNotifications(localNotifications);
      if (!cancelled) setTenantData({ ...emptyTenantData, applications: localApplications, notifications: localNotifications, payments: localPayments, messages: localMessages, bookings: localBookings });
      try {
        const apiData = await umutungoApi<TenantDashboardData>('/api/v1/tenant/dashboard');
        if (apiData && !cancelled) setTenantData((current) => ({ ...apiData, notifications: current.notifications, applications: [...apiData.applications, ...current.applications.filter((local) => !apiData.applications.some((item) => item.id === local.id))], payments: [...apiData.payments, ...current.payments.filter((local) => !apiData.payments.some((item) => item.id === local.id))], messages: [...apiData.messages, ...current.messages.filter((local) => !apiData.messages.some((item) => item.id === local.id))], bookings: current.bookings }));
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
    setTenantData((current) => ({ ...current, messages: [{ id: `message-${Date.now()}`, sender_id: 'me', sender_name: 'You', recipient_id: '', recipient_name: 'Landlord', listing_id: selectedApplication.listing_id, body: messageBody, created_at: new Date().toISOString() }, ...current.messages] }));
    closeDialog();
    setNotice('Message sent to the landlord.');
  };

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedApplication || !reviewBody.trim()) return;
    try { await umutungoApi('/api/v1/reviews', { method: 'POST', body: JSON.stringify({ listing_id: selectedApplication.listing_id, rating: reviewRating, body: reviewBody }) }); } catch { /* local/demo review */ }
    setTenantData((current) => ({ ...current, reviews: [{ id: `review-${Date.now()}`, listing_id: selectedApplication.listing_id, listing_title: selectedApplication.listing_title, rating: reviewRating, body: reviewBody, created_at: new Date().toISOString() }, ...current.reviews] }));
    closeDialog();
    setNotice('Review saved to your tenant dashboard.');
  };
  const metrics = config.metrics.map((metric, index) => index === 0 ? { ...metric, value: String(tenantData.applications.length), note: 'Your rental applications' } : index === 2 ? { ...metric, value: String(tenantData.applications.filter((item) => item.viewed_at).length), note: 'Houses seen' } : index === 3 ? { ...metric, value: `RWF ${tenantData.payments.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}`, note: 'Recorded payments' } : metric);
  const dialogTitle = dialog === 'payment' ? 'Pay after seeing the house' : dialog === 'contact' ? 'Contact the landlord' : 'Review this property';
  return <main className="role-dashboard"><aside className="role-dashboard-sidebar"><Link className="role-dashboard-brand" href="/"><Logo /></Link><span className="role-dashboard-label">{config.eyebrow}</span><nav aria-label="Tenant dashboard navigation"><Link className="role-dashboard-nav role-dashboard-home-link" href="/"><Icon name="home" size={17} /><span>Home</span></Link>{config.navigation.map((item) => <button className={`role-dashboard-nav ${active === item.label ? 'active' : ''}`} key={item.label} type="button" onClick={() => setActive(item.label)}><Icon name={item.icon} size={17} /><span>{item.label}</span></button>)}</nav><div className="role-dashboard-sidebar-bottom"><Link href="/">Back to marketplace <Icon name="arrow" size={14} /></Link><button type="button" onClick={() => setActive('Overview')}><Icon name="user" size={16} /> Account</button></div></aside><section className="role-dashboard-main"><header className="role-dashboard-topbar"><div><span className="role-dashboard-eyebrow">{config.eyebrow}</span><h1>{active}</h1></div><button className="role-dashboard-profile" type="button" onClick={() => setActive('Overview')}><span className="role-dashboard-avatar">TN</span><span><strong>My account</strong><small>Verified tenant</small></span><Icon name="chevron" size={14} /></button></header>{active === 'Overview' ? <div className="role-dashboard-content"><section className="role-dashboard-welcome"><div><p className="role-dashboard-eyebrow">Welcome back</p><h2>Your next home is closer than you think.</h2><p>Manage applications, payments, house-viewing status, landlord conversations, and reviews in one clear workspace.</p></div><Link className="role-dashboard-primary" href="/categories/houses"><Icon name="search" size={16} /> Explore homes</Link></section><section className="role-dashboard-metrics" aria-label="Tenant metrics">{metrics.map((metric) => <article key={metric.label}><span className={`role-dashboard-metric-icon ${metric.tone}`}><Icon name={metric.icon} size={17} /></span><small>{metric.label}</small><strong>{metric.value}</strong><em>{metric.note}</em></article>)}</section><div className="role-dashboard-panel tenant-overview-panel"><div className="role-dashboard-panel-heading"><div><span className="role-dashboard-eyebrow">Your next steps</span><h3>Rental journey</h3></div><button type="button" onClick={() => setActive('Applications')}>Open applications <Icon name="arrow" size={14} /></button></div><div className="tenant-overview-cards"><article><span className="tenant-card-number">01</span><div><strong>{tenantData.applications.length} applications</strong><small>Track decisions and house-viewing status</small></div><Icon name="arrow" size={15} /></article><article><span className="tenant-card-number">02</span><div><strong>{tenantData.payments.length} payments</strong><small>Pay only after you have seen the house</small></div><Icon name="arrow" size={15} /></article><article><span className="tenant-card-number">03</span><div><strong>{tenantData.messages.length} conversations</strong><small>Keep landlord contact in one place</small></div><Icon name="arrow" size={15} /></article></div></div></div> : <div className="role-dashboard-content"><TenantWorkspaceSection view={active} tenantData={tenantData} onViewed={(application) => updateApplication(application, new Date().toISOString())} onPay={(application) => openDialog('payment', application)} onContact={(application) => openDialog('contact', application)} onReview={(application) => openDialog('review', application)} onAction={(action) => { if (action === 'View applications') setActive('Applications'); else if (action === 'Start a new conversation') setActive('Messages'); else setNotice(`${action} selected.`); }} notice={notice} /></div>}</section>{dialog && selectedApplication && <div className="tenant-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="tenant-dialog-title"><button className="tenant-dialog-backdrop" type="button" aria-label="Close dialog" onClick={closeDialog} /><section className="tenant-dialog"><button className="property-action-close" type="button" aria-label="Close dialog" onClick={closeDialog}><Icon name="x" size={18} /></button><span className="role-dashboard-eyebrow">{selectedApplication.listing_title}</span><h2 id="tenant-dialog-title">{dialogTitle}</h2>{dialog === 'payment' && <form className="tenant-dialog-form" onSubmit={submitPayment}><p>Payment is available because you marked this house as seen.</p><label>Amount (RWF)<input type="number" min="1" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} required /></label><label>Payment method<select value={paymentProvider} onChange={(event) => setPaymentProvider(event.target.value)}><option value="mtn_momo">MTN MoMo</option><option value="airtel_money">Airtel Money</option><option value="card">Bank card</option></select></label>{paymentProvider !== 'card' && <label>Rwanda phone number<input type="tel" value={paymentPhone} onChange={(event) => setPaymentPhone(event.target.value)} placeholder="+250 7XX XXX XXX" required /></label>}<button className="role-dashboard-primary" type="submit">Start payment <Icon name="arrow" size={15} /></button></form>}{dialog === 'contact' && <form className="tenant-dialog-form" onSubmit={submitMessage}><p>Ask about viewing times, availability, deposit terms, or anything else about this house.</p><textarea value={messageBody} onChange={(event) => setMessageBody(event.target.value)} placeholder="Write your message" rows={5} required /><button className="role-dashboard-primary" type="submit">Send message <Icon name="arrow" size={15} /></button></form>}{dialog === 'review' && <form className="tenant-dialog-form" onSubmit={submitReview}><p>Tell other renters about your experience with this property.</p><div className="property-review-stars" aria-label="Choose a rating">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" className={value <= reviewRating ? 'is-selected' : ''} aria-label={`${value} stars`} onClick={() => setReviewRating(value)}>★</button>)}</div><textarea value={reviewBody} onChange={(event) => setReviewBody(event.target.value)} placeholder="Write your review" rows={5} required /><button className="role-dashboard-primary" type="submit">Save review <Icon name="arrow" size={15} /></button></form>}</section></div>}</main>;
}

export function RoleDashboard({ role }: { role: DashboardRole }) {
  const config = configs[role];
  const [active, setActive] = useState('Overview');
  const initials = role === 'admin' ? 'AD' : role === 'tenant' ? 'TN' : role === 'landlord' ? 'LL' : 'CM';
  const accountLabel = role === 'admin' ? 'Platform administrator' : `Verified ${role}`;

  if (role === 'tenant') return <><DashboardUtilityDock role={role} /><TenantDashboard /></>;
  if (role === 'commissioner') return <><DashboardUtilityDock role={role} /><CommissionerDashboard /></>;
  if (role === 'landlord') return <><DashboardUtilityDock role={role} /><LandlordDashboard /></>;
  if (role === 'admin') return <><DashboardUtilityDock role={role} isAdmin /><AdminDashboard /></>;

  return <main className="role-dashboard"><aside className="role-dashboard-sidebar"><Link className="role-dashboard-brand" href="/"><Logo /></Link><span className="role-dashboard-label">{config.eyebrow}</span><nav aria-label={`${config.eyebrow} navigation`}><Link className="role-dashboard-nav role-dashboard-home-link" href="/"><Icon name="home" size={17} /><span>Home</span></Link>{config.navigation.map((item) => <button className={`role-dashboard-nav ${active === item.label ? 'active' : ''}`} key={item.label} type="button" onClick={() => setActive(item.label)}><Icon name={item.icon} size={17} /><span>{item.label}</span></button>)}</nav><div className="role-dashboard-sidebar-bottom"><Link href="/">Back to marketplace <Icon name="arrow" size={14} /></Link><button type="button"><Icon name="user" size={16} /> Account</button></div></aside><section className="role-dashboard-main"><header className="role-dashboard-topbar"><div><span className="role-dashboard-eyebrow">{config.eyebrow}</span><h1>{active}</h1></div><div className="role-dashboard-profile"><span className="role-dashboard-avatar">{initials}</span><span><strong>My account</strong><small>{accountLabel}</small></span><Icon name="chevron" size={14} /></div></header><div className="role-dashboard-content"><section className="role-dashboard-welcome"><div><p className="role-dashboard-eyebrow">{config.greeting}</p><h2>{config.welcome}</h2><p>Manage your Umutungo activity in one clear, professional workspace.</p></div><button className="role-dashboard-primary" type="button"><Icon name={config.actionIcon} size={16} /> {config.action}</button></section><section className="role-dashboard-metrics" aria-label="Dashboard metrics">{config.metrics.map((metric) => <article key={metric.label}><span className={`role-dashboard-metric-icon ${metric.tone}`}><Icon name={metric.icon} size={17} /></span><small>{metric.label}</small><strong>{metric.value}</strong><em>{metric.note}</em></article>)}</section><div className="role-dashboard-grid"><section className="role-dashboard-panel"><div className="role-dashboard-panel-heading"><div><span className="role-dashboard-eyebrow">{config.panelEyebrow}</span><h3>{config.panelTitle}</h3></div><button type="button">View all <Icon name="arrow" size={14} /></button></div><div className="role-dashboard-activity">{config.activity.map((item) => <article key={`${item.name}-${item.time}`}><span className="role-dashboard-contact-avatar">{item.initials}</span><div><strong>{item.name}</strong><small>{item.detail} · {item.time}</small></div><span className={`role-dashboard-status ${item.status === 'New' ? 'new' : ''}`}>{item.status}</span><button type="button" aria-label={`Open ${item.name}`}><Icon name="arrow" size={14} /></button></article>)}</div></section><section className="role-dashboard-panel role-dashboard-side-panel"><div className="role-dashboard-panel-heading"><div><span className="role-dashboard-eyebrow">{config.sideEyebrow}</span><h3>{config.sideTitle}</h3></div><Icon name="sparkles" size={17} /></div>{config.sideItems.map((item) => <div className="role-dashboard-side-item" key={item.title}><span><Icon name={item.icon} size={16} /></span><div><strong>{item.title}</strong><small>{item.detail}</small></div><Icon name="arrow" size={14} /></div>)}<button className="role-dashboard-outline" type="button">Open workspace</button></section></div></div></section></main>;
}
