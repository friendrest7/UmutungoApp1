"use client";
import Link from "next/link";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "./Icons";
import { umutungoApi } from "../lib/umutungoApi";
import { usePersistentTheme } from "../lib/theme";
import styles from "./LandlordPortal.module.css";

export type PortalTenant = {
  key: string;
  name: string;
  phone: string;
  property_id: string;
  property: string;
  unit_id: string;
  unit: string;
  rent: number;
  status: "overdue" | "due_today" | "upcoming" | "paid";
  days_overdue: number;
  overdue_balance: number;
  balance: number;
  next_due_date: string | null;
};
export type PortalCharge = { id: string; tenant_name: string; tenant_phone: string; property: string; unit: string; amount_due: number; balance: number; due_date: string };
export type PortalPayment = { id: string; amount: number; method: string; reference: string; received_at: string; charge_id: string; tenant_name: string; tenant_phone: string; due_date: string; property: string; unit: string };
export type PortalAnnouncement = { id: string; title: string; message: string; recipient_count: number; created_at: string; property: string };
export type ReminderSettings = { auto_enabled: boolean; days_before: number; overdue_interval: number; send_on_due: boolean; upcoming_message: string; due_today_message: string; overdue_message: string; saved?: boolean };
export type PreparedReminder = { id: string; kind: string; message: string; tenant_name: string; tenant_phone: string; created_at?: string; trigger?: string };
export type Portal = {
  today: string;
  tenants: PortalTenant[];
  open_charges: PortalCharge[];
  payments: PortalPayment[];
  payments_summary: { count: number; total: number };
  announcements: PortalAnnouncement[];
  reminders: { settings: ReminderSettings; recent: PreparedReminder[] };
};
type PortalProperty = { id: string; name: string; district: string; sector: string; unit_count: number; occupied_units: number; units: Array<{ id: string; name: string; monthly_rent: number }>; listing?: PropertyListingLink | null };
// The public marketplace listing that advertises a private property.
type PropertyListingLink = { id: string; title: string; status: string; featured: boolean };
// A landlord marketplace listing that can be chosen to advertise a property.
export type AdvertisableListing = { id: string; title: string; location: string; price: string; priceNote: string; cover: string; status: string };
type Repair = { id: string; description: string; priority: string; status: string; property: string; unit: string };
type RepairAdvice = { urgency: "emergency" | "urgent" | "soon" | "routine"; summary: string; steps: string[]; who_to_call: string; respond_within: string; source: "ai" | "rules" };

export type PortalPageProps = {
  page: string;
  portal: Portal | null;
  properties: PortalProperty[];
  repairs: Repair[];
  onReload: () => Promise<void>;
  onAddProperty: () => void;
  onAddUnit: (propertyId: string) => void;
  onAddTenant: (unitId?: string) => void;
  onRecordPayment: (charge?: { id: string; balance: number }) => void;
  onLogRepair: (input: { description: string; priority: "low" | "normal" | "urgent"; unit_id: string }) => Promise<boolean>;
  onUpdateRepair: (id: string, status: string) => void;
  onNavigate: (page: string) => void;
  tenantQuery?: string;
  greeting: string;
  summary: { expected: number; collected: number; balance: number; occupied_units: number; total_units: number };
  listings?: AdvertisableListing[];
  onAdvertise?: (propertyId: string, listingId: string, advertise: boolean) => Promise<string>;
};

const money = (amount: number) => `RWF ${Math.round(amount).toLocaleString("en-US")}`;
const shortDate = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Kigali" }).format(new Date(value.length === 10 ? `${value}T12:00:00+02:00` : value));
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const methodLabel: Record<string, string> = { cash: "Cash", bank_transfer: "Bank transfer", mtn_momo: "MTN MoMo", airtel_money: "Airtel Money" };
const whatsappLink = (phone: string, text: string) => {
  const digits = phone.replace(/\D/g, "").replace(/^0/, "");
  const number = digits && !digits.startsWith("250") ? `250${digits}` : digits;
  return number.length >= 11 ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
};
const statusOrder = { overdue: 0, due_today: 1, upcoming: 2, paid: 3 } as const;

function AlertIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>;
}

function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return <header className={styles.header}>
    <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
    {actions && <div className={styles.headerActions}>{actions}</div>}
  </header>;
}
function Button({ children, onClick, disabled, variant = "primary", type = "button" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: "primary" | "secondary"; type?: "button" | "submit" }) {
  return <button type={type} className={variant === "primary" ? styles.primary : styles.secondary} onClick={onClick} disabled={disabled}>{children}</button>;
}
function Panel({ title, description, actions, children, flush = false }: { title?: string; description?: string; actions?: ReactNode; children: ReactNode; flush?: boolean }) {
  return <section className={styles.panel}>
    {(title || actions) && <div className={styles.panelHead}><div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>{actions}</div>}
    <div className={flush ? undefined : styles.panelBody}>{children}</div>
  </section>;
}
function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className={styles.empty}><strong>{title}</strong><span>{text}</span>{action}</div>;
}
function Avatar({ name }: { name: string }) {
  return <span className={styles.avatar} aria-hidden="true">{initials(name)}</span>;
}
function StatusBadge({ tenant }: { tenant: PortalTenant }) {
  if (tenant.status === "overdue") return <span className={`${styles.badge} ${styles.badgeDanger}`}>Overdue · {tenant.days_overdue}d</span>;
  if (tenant.status === "due_today") return <span className={`${styles.badge} ${styles.badgeWarning}`}>Due today</span>;
  if (tenant.status === "upcoming") return <span className={`${styles.badge} ${styles.badgeSuccess}`}>Upcoming</span>;
  return <span className={`${styles.badge} ${styles.badgeNeutral}`}>Paid up</span>;
}
function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<[T, string, number?]>; onChange: (value: T) => void; label: string }) {
  return <div className={styles.segmented} role="tablist" aria-label={label}>
    {options.map(([key, text, count]) => <button key={key} type="button" role="tab" aria-selected={value === key} className={value === key ? styles.segmentActive : styles.segment} onClick={() => onChange(key)}>
      {text}{count !== undefined && <span className={styles.segmentCount}>{count}</span>}
    </button>)}
  </div>;
}

export function LandlordPortalPage(props: PortalPageProps) {
  switch (props.page) {
    case "Home": return <HomePage {...props} />;
    case "Properties": return <PropertiesPage {...props} />;
    case "Tenants": return <TenantsPage {...props} />;
    case "Payments": return <PaymentsPage {...props} />;
    case "Announcements": return <AnnouncementsPage {...props} />;
    case "Repair advice": return <RepairAdvicePage {...props} />;
    case "Settings": return <SettingsPage {...props} />;
    default: return null;
  }
}

const firstOpenCharge = (portal: Portal | null, tenant: PortalTenant) => portal?.open_charges
  .filter((charge) => charge.tenant_phone === tenant.phone && charge.property === tenant.property && charge.unit === tenant.unit)
  .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

function HomePage({ portal, properties, repairs, summary, greeting, onNavigate, onAddProperty, onRecordPayment }: PortalPageProps) {
  const tenants = portal?.tenants ?? [];
  const overdue = tenants.filter((tenant) => tenant.status === "overdue");
  const attention = tenants.filter((tenant) => tenant.status === "overdue" || tenant.status === "due_today")
    .sort((a, b) => b.days_overdue - a.days_overdue || a.name.localeCompare(b.name));
  const overdueTotal = overdue.reduce((sum, tenant) => sum + tenant.overdue_balance, 0);
  const collectedShare = summary.expected > 0 ? Math.min(100, Math.round((summary.collected / summary.expected) * 100)) : 0;
  const openRepairs = repairs.filter((repair) => repair.status !== "resolved");
  const recentPayments = (portal?.payments ?? []).slice(0, 5);
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Kigali" }).format(new Date());
  return <div className={styles.page}>
    <PageHeader title={greeting} subtitle={today} actions={<>
      <Button variant="secondary" onClick={() => onRecordPayment()}>Record payment</Button>
      <Button onClick={onAddProperty}>Add property</Button>
    </>} />
    <div className={styles.kpis}>
      <div className={styles.kpi}>
        <span>Collected this month</span>
        <strong>{money(summary.collected)}</strong>
        <div className={styles.meter} role="progressbar" aria-valuenow={collectedShare} aria-valuemin={0} aria-valuemax={100} aria-label="Share of this month's rent collected"><span style={{ width: `${collectedShare}%` }} /></div>
        <small>{collectedShare}% of {money(summary.expected)}</small>
      </div>
      <div className={styles.kpi}><span>Outstanding this month</span><strong>{money(summary.balance)}</strong><small>Unpaid on this month&apos;s rent</small></div>
      <button type="button" className={`${styles.kpi} ${styles.kpiLink}`} onClick={() => onNavigate("Tenants")}>
        <span>Overdue</span><strong className={overdue.length ? styles.dangerText : undefined}>{money(overdueTotal)}</strong><small>{overdue.length ? plural(overdue.length, "tenant") : "No late payments"}</small>
      </button>
      <div className={styles.kpi}>
        <span>Units billed this month</span><strong>{summary.occupied_units} <em>/ {summary.total_units}</em></strong>
        <div className={styles.kpiFoot}>
          <small>{plural(properties.length, "property", "properties")}</small>
          <button type="button" className={styles.kpiAction} onClick={() => onNavigate("Properties")}>View data<span aria-hidden="true">→</span></button>
        </div>
      </div>
    </div>

    <Panel title="Needs attention" description="Overdue and due-today rent, most overdue first." actions={attention.length > 0 && <button type="button" className={styles.textLink} onClick={() => onNavigate("Tenants")}>View tenants</button>} flush>
      {attention.length === 0 ? <div className={styles.panelBody}><Empty title="You're all caught up" text="No rent is overdue or due today." /></div> :
        <div className={styles.tableWrap}><table className={styles.table}>
          <thead><tr><th>Tenant</th><th>Property</th><th>Status</th><th className={styles.num}>Amount due</th><th aria-label="Actions" /></tr></thead>
          <tbody>{attention.slice(0, 6).map((tenant) => {
            const charge = firstOpenCharge(portal, tenant);
            return <tr key={tenant.key}>
              <td><div className={styles.person}><Avatar name={tenant.name} /><span>{tenant.name}</span></div></td>
              <td className={styles.mutedCell}>{tenant.property} · {tenant.unit}</td>
              <td><StatusBadge tenant={tenant} /></td>
              <td className={styles.num}>{money(tenant.status === "overdue" ? tenant.overdue_balance : tenant.balance)}</td>
              <td className={styles.actionsCell}>
                {charge && <button type="button" className={styles.smallButton} onClick={() => onRecordPayment({ id: charge.id, balance: charge.balance })}>Record payment</button>}
                <a className={styles.iconButton} title="Message on WhatsApp" aria-label={`Message ${tenant.name} on WhatsApp`} href={whatsappLink(tenant.phone, `Hello ${tenant.name}, this is a reminder about your rent for ${tenant.property} · ${tenant.unit}.`)} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={16} /></a>
              </td>
            </tr>;
          })}</tbody>
        </table></div>}
    </Panel>

    <div className={styles.columns}>
      <Panel title="Recent payments" actions={<button type="button" className={styles.textLink} onClick={() => onNavigate("Payments")}>View all</button>} flush>
        {recentPayments.length === 0 ? <div className={styles.panelBody}><Empty title="No payments yet" text="Payments you record will appear here." /></div> :
          <ul className={styles.simpleList}>{recentPayments.map((payment) => <li key={payment.id}>
            <div><strong>{payment.tenant_name}</strong><small>{methodLabel[payment.method] ?? payment.method} · {shortDate(payment.received_at)}</small></div>
            <span className={styles.amount}>{money(payment.amount)}</span>
          </li>)}</ul>}
      </Panel>
      <Panel title="Open repairs" actions={<button type="button" className={styles.textLink} onClick={() => onNavigate("Repair advice")}>Repair advice</button>} flush>
        {openRepairs.length === 0 ? <div className={styles.panelBody}><Empty title="No open repairs" text="Describe an issue in Repair advice to get next steps." /></div> :
          <ul className={styles.simpleList}>{openRepairs.slice(0, 5).map((repair) => <li key={repair.id}>
            <div><strong className={styles.clamp}>{repair.description}</strong><small>{[repair.property, repair.unit].filter(Boolean).join(" · ") || "No unit"}</small></div>
            <PriorityBadge priority={repair.priority} />
          </li>)}</ul>}
      </Panel>
    </div>
  </div>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const tone = priority === "urgent" ? styles.badgeDanger : priority === "low" ? styles.badgeNeutral : styles.badgeWarning;
  return <span className={`${styles.badge} ${tone}`}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</span>;
}

// Choose which published marketplace listing advertises a property. The chosen
// listing is recommended: shown first on the landing page and marked Featured.
function AdvertiseDialog({ property, listings, properties, onAdvertise, onClose }: { property: PortalProperty; listings: AdvertisableListing[]; properties: PortalProperty[]; onAdvertise: NonNullable<PortalPageProps["onAdvertise"]>; onClose: () => void }) {
  // A listing already advertising another property can't be chosen again.
  const takenBy = new Map(properties.filter((item) => item.id !== property.id && item.listing).map((item) => [item.listing!.id, item.name]));
  const published = listings.filter((listing) => listing.status === "published");
  const linked = property.listing?.id && published.some((listing) => listing.id === property.listing?.id) ? property.listing.id : "";
  const [choice, setChoice] = useState(linked || (published.find((listing) => !takenBy.has(listing.id))?.id ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!choice) return;
    setBusy(true);
    setError("");
    const failure = await onAdvertise(property.id, choice, true);
    setBusy(false);
    if (failure) setError(failure);
    else onClose();
  };
  return <div className="owner-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="owner-modal" role="dialog" aria-modal="true" aria-labelledby="advertise-title">
      <button type="button" className="owner-modal-close" aria-label="Close" onClick={onClose} disabled={busy}>×</button>
      <form className={styles.form} onSubmit={submit}>
        <div>
          <h2 id="advertise-title" style={{ margin: 0 }}>Advertise {property.name}</h2>
          <p className={styles.footnote}>The listing you choose is shown first on the Umutungo home page and marked Recommended on the marketplace. You can stop at any time.</p>
        </div>
        {published.length === 0 ? <div className={styles.advertiseEmpty}>
          <strong>Publish a listing first</strong>
          <span>Renters need photos, a price and a description to find {property.name}. Post it on the marketplace, then come back here to advertise it.</span>
          <Link className={styles.primary} href="/post-property">Post on the marketplace</Link>
        </div> : <fieldset className={styles.advertiseChoices}>
          <legend>Choose the listing for this property</legend>
          {published.map((listing) => {
            const taken = takenBy.get(listing.id);
            return <label key={listing.id} className={`${styles.advertiseChoice} ${taken ? styles.advertiseChoiceTaken : ""}`}>
              <input type="radio" name="listing" value={listing.id} checked={choice === listing.id} disabled={Boolean(taken)} onChange={() => setChoice(listing.id)} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={listing.cover} alt="" />
              <span><strong>{listing.title}</strong><small>{taken ? `Advertising ${taken}` : `${listing.location} · ${listing.price}${listing.priceNote ? ` ${listing.priceNote}` : ""}`}</small></span>
            </label>;
          })}
        </fieldset>}
        {published.length > 0 && <p className={styles.footnote}>Not listed yet? <Link className={styles.textLink} href="/post-property">Post this property on the marketplace</Link>.</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {published.length > 0 && <div className={styles.formActions}>
          <button type="submit" className={styles.primary} disabled={busy || !choice}>{busy ? "Advertising…" : "Advertise on home page"}</button>
          <button type="button" className={styles.secondary} disabled={busy} onClick={onClose}>Cancel</button>
        </div>}
      </form>
    </section>
  </div>;
}

function PropertiesPage({ properties, portal, onAddProperty, onAddUnit, onAddTenant, listings = [], onAdvertise }: PortalPageProps) {
  const [open, setOpen] = useState("");
  const [advertising, setAdvertising] = useState<PortalProperty | null>(null);
  const [stopping, setStopping] = useState("");
  const [notice, setNotice] = useState("");
  const stopAdvertising = async (property: PortalProperty) => {
    if (!onAdvertise) return;
    setStopping(property.id);
    const failure = await onAdvertise(property.id, "", false);
    setStopping("");
    setNotice(failure);
  };
  const units = properties.reduce((sum, property) => sum + property.unit_count, 0);
  const tenantsByUnit = new Map<string, PortalTenant>();
  portal?.tenants.forEach((tenant) => { if (tenant.status !== "paid" || !tenantsByUnit.has(tenant.unit_id)) tenantsByUnit.set(tenant.unit_id, tenant); });
  return <div className={styles.page}>
    <PageHeader title="Properties" subtitle={`${plural(properties.length, "property", "properties")} · ${plural(units, "unit")}`} actions={<Button onClick={onAddProperty}>Add property</Button>} />
    {notice && <p className={styles.error} role="alert">{notice}</p>}
    {advertising && onAdvertise && <AdvertiseDialog property={advertising} listings={listings} properties={properties} onAdvertise={onAdvertise} onClose={() => setAdvertising(null)} />}
    {properties.length === 0 ? <Empty title="No properties yet" text="Add a property and its units. This stays private and does not publish a marketplace listing." action={<Button onClick={onAddProperty}>Add property</Button>} /> :
      <div className={styles.propertyGrid}>{properties.map((property) => {
        const overdue = portal?.tenants.filter((tenant) => tenant.property_id === property.id && tenant.status === "overdue").length ?? 0;
        const occupied = property.units.filter((unit) => tenantsByUnit.has(unit.id)).length;
        const share = property.unit_count ? Math.round((occupied / property.unit_count) * 100) : 0;
        const expanded = open === property.id;
        return <article key={property.id} className={styles.propertyCard}>
          <div className={styles.propertyTop}>
            <span className={styles.propertyIcon}><Icon name="building" size={18} /></span>
            <div className={styles.propertyTitle}><h3>{property.name}</h3><p>{property.sector}, {property.district}</p></div>
            {onAdvertise && (property.listing?.featured
              ? <span className={styles.advertisedBadge} title={`Advertised as ${property.listing.title}`}><Icon name="sparkles" size={13} />On home page</span>
              : <button type="button" className={styles.advertiseButton} onClick={() => { setNotice(""); setAdvertising(property); }}><Icon name="sparkles" size={14} />Advertise</button>)}
          </div>
          {onAdvertise && property.listing?.featured && <div className={styles.advertisedRow}>
            <span>Recommended as <Link className={styles.textLink} href={`/property/${property.listing.id}`}>{property.listing.title}</Link></span>
            <button type="button" className={styles.textLink} disabled={stopping === property.id} onClick={() => void stopAdvertising(property)}>{stopping === property.id ? "Stopping…" : "Stop advertising"}</button>
          </div>}
          <dl className={styles.propertyStats}>
            <div><dt>Units</dt><dd>{property.unit_count}</dd></div>
            <div><dt>Occupied</dt><dd>{occupied}</dd></div>
            <div><dt>Overdue</dt><dd className={overdue ? styles.dangerText : undefined}>{overdue}</dd></div>
          </dl>
          <div className={styles.meter} role="progressbar" aria-valuenow={share} aria-valuemin={0} aria-valuemax={100} aria-label={`${property.name} occupancy`}><span style={{ width: `${share}%` }} /></div>
          <div className={styles.propertyFoot}>
            <small>{share}% occupied</small>
            <button type="button" className={styles.textLink} aria-expanded={expanded} onClick={() => setOpen(expanded ? "" : property.id)}>{expanded ? "Hide units" : "View units"}</button>
          </div>
          {expanded && <div className={styles.unitTable}>
            <table className={styles.table}>
              <thead><tr><th>Unit</th><th className={styles.num}>Rent</th><th>Tenant</th></tr></thead>
              <tbody>{property.units.map((unit) => {
                const tenant = tenantsByUnit.get(unit.id);
                return <tr key={unit.id}>
                  <td>{unit.name}</td>
                  <td className={styles.num}>{money(unit.monthly_rent)}</td>
                  <td>{tenant ? <div className={styles.tenantCell}><span>{tenant.name}</span><StatusBadge tenant={tenant} /></div> : <button type="button" className={styles.textLink} onClick={() => onAddTenant(unit.id)}>Add tenant</button>}</td>
                </tr>;
              })}</tbody>
            </table>
            {property.units.length === 0 && <p className={styles.muted}>No units yet.</p>}
            <button type="button" className={styles.smallButton} onClick={() => onAddUnit(property.id)}>Add unit</button>
          </div>}
        </article>;
      })}</div>}
  </div>;
}

function TenantsPage({ portal, properties, onAddTenant, onRecordPayment, tenantQuery = "" }: PortalPageProps) {
  const [search, setSearch] = useState(tenantQuery);
  // A search from the top bar replaces the current filter text.
  const [appliedQuery, setAppliedQuery] = useState(tenantQuery);
  if (tenantQuery !== appliedQuery) {
    setAppliedQuery(tenantQuery);
    setSearch(tenantQuery);
  }
  const [property, setProperty] = useState("");
  const [filter, setFilter] = useState<"all" | "overdue" | "due_today" | "upcoming">("all");
  const tenants = portal?.tenants ?? [];
  const scoped = tenants.filter((tenant) => (!property || tenant.property_id === property) && tenant.name.toLowerCase().includes(search.trim().toLowerCase()));
  const count = (status: string) => scoped.filter((tenant) => tenant.status === status).length;
  const shown = scoped.filter((tenant) => filter === "all" || tenant.status === filter)
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || b.days_overdue - a.days_overdue || a.name.localeCompare(b.name));
  const active = tenants.filter((tenant) => tenant.status !== "paid").length;
  return <div className={styles.page}>
    <PageHeader title="Tenants" subtitle={`${plural(active, "active tenant")}`} actions={<Button onClick={() => onAddTenant()}>Add tenant</Button>} />
    {tenants.length === 0 ? <Empty title="No tenants yet" text="Add a tenant to a unit with their rent and first due date. Balances and reminders follow from there." action={<Button onClick={() => onAddTenant()}>Add tenant</Button>} /> :
      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <Segmented label="Rent status" value={filter} onChange={setFilter} options={[["all", "All", scoped.length], ["overdue", "Overdue", count("overdue")], ["due_today", "Due today", count("due_today")], ["upcoming", "Upcoming", count("upcoming")]]} />
          <div className={styles.toolbarRight}>
            <label className={styles.search}><Icon name="search" size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tenants" aria-label="Search tenants by name" /></label>
            <select className={styles.select} value={property} onChange={(event) => setProperty(event.target.value)} aria-label="Filter by property">
              <option value="">All properties</option>
              {properties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
        </div>
        {shown.length === 0 ? <div className={styles.panelBody}><Empty title="No tenants match" text="Try another name, property or status." /></div> :
          <div className={styles.tableWrap}><table className={styles.table}>
            <thead><tr><th>Tenant</th><th>Property</th><th className={styles.num}>Monthly rent</th><th>Status</th><th className={styles.num}>Balance due</th><th>Next due</th><th aria-label="Actions" /></tr></thead>
            <tbody>{shown.map((tenant) => {
              const charge = firstOpenCharge(portal, tenant);
              return <tr key={tenant.key}>
                <td><div className={styles.person}><Avatar name={tenant.name} /><div><span>{tenant.name}</span><small>{tenant.phone}</small></div></div></td>
                <td className={styles.mutedCell}>{tenant.property}<small>{tenant.unit}</small></td>
                <td className={styles.num}>{money(tenant.rent)}</td>
                <td><StatusBadge tenant={tenant} /></td>
                <td className={`${styles.num} ${tenant.status === "overdue" ? styles.dangerText : ""}`}>{tenant.balance > 0 ? money(tenant.status === "overdue" ? tenant.overdue_balance : tenant.balance) : "—"}</td>
                <td className={styles.mutedCell}>{tenant.next_due_date ? shortDate(tenant.next_due_date) : "—"}</td>
                <td className={styles.actionsCell}>
                  {charge && <button type="button" className={styles.smallButton} onClick={() => onRecordPayment({ id: charge.id, balance: charge.balance })}>Record payment</button>}
                  <a className={styles.iconButton} title="Message on WhatsApp" aria-label={`Message ${tenant.name} on WhatsApp`} href={whatsappLink(tenant.phone, `Hello ${tenant.name}, this is about ${tenant.property} · ${tenant.unit}.`)} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={16} /></a>
                </td>
              </tr>;
            })}</tbody>
          </table></div>}
      </section>}
  </div>;
}

function downloadReceipt(payment: PortalPayment) {
  const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] ?? character));
  const rows: Array<[string, string]> = [
    ["Tenant", payment.tenant_name], ["Property", `${payment.property} · ${payment.unit}`], ["Rent due date", shortDate(payment.due_date)],
    ["Amount received", money(payment.amount)], ["Method", methodLabel[payment.method] ?? payment.method], ["Reference", payment.reference || "—"],
    ["Received on", shortDate(payment.received_at)], ["Receipt no.", payment.id.slice(0, 8).toUpperCase()],
  ];
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Rent receipt ${escape(payment.id.slice(0, 8).toUpperCase())}</title><style>body{font-family:"Segoe UI",system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 24px;color:#101828}h1{font-size:20px;font-weight:600;margin:0 0 4px}p{color:#667085;margin:0;font-size:14px}table{width:100%;border-collapse:collapse;margin-top:24px;font-size:14px}td{padding:12px 0;border-bottom:1px solid #eaecf0}td:first-child{color:#667085}td:last-child{text-align:right;font-weight:500}.note{font-size:12px;margin-top:24px}</style></head><body><h1>Rent receipt</h1><p>Umutungo · recorded by the landlord</p><table>${rows.map(([label, value]) => `<tr><td>${escape(label)}</td><td>${escape(value)}</td></tr>`).join("")}</table><p class="note">This receipt confirms a payment the landlord recorded in Umutungo. Umutungo did not collect or transfer this money.</p></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `receipt-${payment.tenant_name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${payment.received_at.slice(0, 10)}.html`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function PaymentsPage({ portal, onRecordPayment }: PortalPageProps) {
  const [search, setSearch] = useState("");
  const payments = (portal?.payments ?? []).filter((payment) => payment.tenant_name.toLowerCase().includes(search.trim().toLowerCase()));
  const summary = portal?.payments_summary ?? { count: 0, total: 0 };
  return <div className={styles.page}>
    <PageHeader title="Payments" subtitle={`${plural(summary.count, "payment")} · ${money(summary.total)} received`} actions={<Button onClick={() => onRecordPayment()}>Record payment</Button>} />
    {summary.count === 0 ? <Empty title="No payments recorded yet" text="When a tenant pays, record it here. Umutungo keeps the record and a receipt; it does not collect money." /> :
      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <label className={styles.search}><Icon name="search" size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by tenant" aria-label="Search payments by tenant" /></label>
        </div>
        {payments.length === 0 ? <div className={styles.panelBody}><Empty title="No payments match" text="Try another tenant name." /></div> :
          <div className={styles.tableWrap}><table className={styles.table}>
            <thead><tr><th>Date</th><th>Tenant</th><th>Property</th><th>Method</th><th>Reference</th><th className={styles.num}>Amount</th><th aria-label="Receipt" /></tr></thead>
            <tbody>{payments.map((payment) => <tr key={payment.id}>
              <td className={styles.mutedCell}>{shortDate(payment.received_at)}</td>
              <td>{payment.tenant_name}</td>
              <td className={styles.mutedCell}>{payment.property}<small>{payment.unit}</small></td>
              <td>{methodLabel[payment.method] ?? payment.method}</td>
              <td className={styles.mono}>{payment.reference || "—"}</td>
              <td className={`${styles.num} ${styles.strong}`}>{money(payment.amount)}</td>
              <td className={styles.actionsCell}><button type="button" className={styles.iconButton} title="Download receipt" aria-label={`Download receipt for ${payment.tenant_name}`} onClick={() => downloadReceipt(payment)}><Icon name="download" size={16} /></button></td>
            </tr>)}</tbody>
          </table></div>}
      </section>}
    <p className={styles.footnote}>Payments are records you enter. Recording one does not collect money through MTN MoMo, Airtel Money or a bank.</p>
  </div>;
}

function AnnouncementsPage({ portal, properties, onReload }: PortalPageProps) {
  const [form, setForm] = useState({ property_id: "", title: "", message: "" });
  const [state, setState] = useState<{ busy: boolean; error: string; notice: string }>({ busy: false, error: "", notice: "" });
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState({ busy: true, error: "", notice: "" });
    try {
      const result = await umutungoApi<{ recipient_count: number }>("/api/v1/owner/portal?action=announcement", { method: "POST", body: JSON.stringify(form) });
      if (!result) throw new Error("Your session expired. Sign in again.");
      setForm({ property_id: form.property_id, title: "", message: "" });
      setState({ busy: false, error: "", notice: `Announcement saved for ${plural(result.recipient_count, "tenant")}.` });
      await onReload();
    } catch (cause) {
      setState({ busy: false, error: cause instanceof Error ? cause.message : "Could not send the announcement.", notice: "" });
    }
  };
  const announcements = portal?.announcements ?? [];
  return <div className={styles.page}>
    <PageHeader title="Announcements" subtitle="Share updates with your tenants." />
    <div className={styles.split}>
      <Panel title="New announcement">
        <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}><span>Send to</span><select className={styles.select} value={form.property_id} onChange={(event) => setForm({ ...form, property_id: event.target.value })}><option value="">All my tenants</option>{properties.map((property) => <option key={property.id} value={property.id}>Tenants at {property.name}</option>)}</select></label>
          <label className={styles.field}><span>Title</span><input className={styles.input} maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Water maintenance on Saturday" /></label>
          <label className={styles.field}><span>Message</span><textarea className={styles.input} rows={6} maxLength={2000} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="What tenants need to know, when, and what they should do." /><small>{form.message.length} / 2000</small></label>
          {state.error && <p className={styles.error} role="alert">{state.error}</p>}
          {state.notice && <p className={styles.notice} role="status">{state.notice}</p>}
          <div className={styles.formActions}><Button type="submit" disabled={state.busy || !form.title.trim() || !form.message.trim()}>{state.busy ? "Sending…" : "Send announcement"}</Button></div>
          <p className={styles.footnote}>Announcements are saved to your workspace. Tenants will see them in their portal once their accounts are linked; until then you can share each one on WhatsApp.</p>
        </form>
      </Panel>
      <Panel title="Sent" description={plural(announcements.length, "announcement")} flush>
        {announcements.length === 0 ? <div className={styles.panelBody}><Empty title="Nothing sent yet" text="Announcements you send will be listed here." /></div> :
          <ul className={styles.feed}>{announcements.map((item) => <li key={item.id}>
            <div className={styles.feedHead}><strong>{item.title}</strong><time>{shortDate(item.created_at)}</time></div>
            <p>{item.message}</p>
            <div className={styles.feedFoot}>
              <span>{item.property ? item.property : "All properties"} · {plural(item.recipient_count, "recipient")}</span>
              <a className={styles.textLink} href={`https://wa.me/?text=${encodeURIComponent(`${item.title}\n\n${item.message}`)}`} target="_blank" rel="noreferrer">Share on WhatsApp</a>
            </div>
          </li>)}</ul>}
      </Panel>
    </div>
  </div>;
}

const urgencyTone: Record<RepairAdvice["urgency"], string> = { emergency: styles.badgeCritical, urgent: styles.badgeDanger, soon: styles.badgeWarning, routine: styles.badgeSuccess };
const urgencyPriority: Record<RepairAdvice["urgency"], "low" | "normal" | "urgent"> = { emergency: "urgent", urgent: "urgent", soon: "normal", routine: "low" };

function RepairAdvicePage({ properties, repairs, onLogRepair, onUpdateRepair }: PortalPageProps) {
  const [description, setDescription] = useState("");
  const [advice, setAdvice] = useState<RepairAdvice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unitId, setUnitId] = useState("");
  const [logged, setLogged] = useState(false);
  const units = useMemo(() => properties.flatMap((property) => property.units.map((unit) => ({ id: unit.id, label: `${property.name} · ${unit.name}` }))), [properties]);
  const ask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError(""); setAdvice(null); setLogged(false);
    try {
      const response = await fetch("/api/repair-advice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description }) });
      const data = await response.json() as RepairAdvice & { error?: string };
      if (!response.ok || data.error) throw new Error(data.error || "Could not get advice.");
      setAdvice(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not get advice.");
    } finally {
      setBusy(false);
    }
  };
  const log = async () => {
    if (!advice) return;
    if (await onLogRepair({ description: description.trim(), priority: urgencyPriority[advice.urgency], unit_id: unitId })) setLogged(true);
  };
  return <div className={styles.page}>
    <PageHeader title="Repair advice" subtitle="Describe an issue to get an urgency rating and next steps." />
    <div className={styles.callout} role="note"><AlertIcon /><p><strong>Immediate danger?</strong> Keep people away and call emergency services on 112 or a qualified professional before anything else.</p></div>
    <div className={styles.split}>
      <Panel title="Describe the issue">
        <form className={styles.form} onSubmit={ask}>
          <label className={styles.field}><span>What is happening?</span><textarea className={styles.input} rows={7} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What happened, where it is, when it started, and whether anyone is at risk." /></label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.formActions}><Button type="submit" disabled={busy || description.trim().length < 5}>{busy ? "Assessing…" : "Get advice"}</Button></div>
        </form>
      </Panel>
      <Panel title="Assessment" description={advice ? (advice.source === "ai" ? "AI suggestion, checked against safety rules." : "Based on Umutungo safety rules.") : undefined}>
        {!advice ? <p className={styles.muted}>The urgency rating and recommended steps will appear here.</p> :
          <div className={styles.advice} aria-live="polite">
            <div className={styles.adviceHead}><span className={`${styles.badge} ${urgencyTone[advice.urgency]}`}>{advice.urgency.charAt(0).toUpperCase() + advice.urgency.slice(1)}</span><span className={styles.muted}>{advice.respond_within}</span></div>
            <p className={styles.adviceSummary}>{advice.summary}</p>
            <ol className={styles.steps}>{advice.steps.map((step) => <li key={step}>{step}</li>)}</ol>
            <dl className={styles.definition}><dt>Who to contact</dt><dd>{advice.who_to_call}</dd></dl>
            <div className={styles.adviceLog}>
              <select className={styles.select} value={unitId} onChange={(event) => setUnitId(event.target.value)} aria-label="Unit for this repair"><option value="">No specific unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select>
              <Button variant="secondary" disabled={logged} onClick={() => void log()}>{logged ? "Logged" : "Log repair request"}</Button>
            </div>
          </div>}
      </Panel>
    </div>
    <Panel title="Repair requests" description={plural(repairs.length, "request")} flush>
      {repairs.length === 0 ? <div className={styles.panelBody}><Empty title="No repair requests" text="Issues you log will stay here with their priority and progress." /></div> :
        <div className={styles.tableWrap}><table className={styles.table}>
          <thead><tr><th>Issue</th><th>Location</th><th>Priority</th><th>Status</th></tr></thead>
          <tbody>{repairs.map((repair) => <tr key={repair.id}>
            <td className={styles.wideCell}>{repair.description}</td>
            <td className={styles.mutedCell}>{[repair.property, repair.unit].filter(Boolean).join(" · ") || "—"}</td>
            <td><PriorityBadge priority={repair.priority} /></td>
            <td><select className={`${styles.select} ${styles.selectSmall}`} aria-label="Repair status" value={repair.status} onChange={(event) => onUpdateRepair(repair.id, event.target.value)}><option value="submitted">Submitted</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></td>
          </tr>)}</tbody>
        </table></div>}
    </Panel>
  </div>;
}

function Switch({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className={styles.switchRow}>
    <span><strong>{label}</strong>{description && <small>{description}</small>}</span>
    <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <span className={styles.switch} aria-hidden="true" />
  </label>;
}

function SettingsPage({ portal, onReload }: PortalPageProps) {
  const { darkMode, toggleTheme } = usePersistentTheme();
  const [settings, setSettings] = useState<ReminderSettings | null>(portal?.reminders.settings ?? null);
  const [state, setState] = useState<{ busy: "" | "save" | "send"; error: string; notice: string }>({ busy: "", error: "", notice: "" });
  const [prepared, setPrepared] = useState<PreparedReminder[]>([]);
  if (!settings && portal) setSettings(portal.reminders.settings);
  const save = async () => {
    if (!settings) return;
    setState({ busy: "save", error: "", notice: "" });
    try {
      const result = await umutungoApi("/api/v1/owner/portal?action=reminders", { method: "PUT", body: JSON.stringify({ ...settings, days_before: Number(settings.days_before), overdue_interval: Number(settings.overdue_interval) }) });
      if (!result) throw new Error("Your session expired. Sign in again.");
      setState({ busy: "", error: "", notice: "Reminder settings saved." });
      await onReload();
    } catch (cause) {
      setState({ busy: "", error: cause instanceof Error ? cause.message : "Could not save reminders.", notice: "" });
    }
  };
  const sendNow = async () => {
    setState({ busy: "send", error: "", notice: "" });
    try {
      const result = await umutungoApi<{ prepared: number; items: PreparedReminder[] }>("/api/v1/owner/portal?action=send-reminders", { method: "POST", body: "{}" });
      if (!result) throw new Error("Your session expired. Sign in again.");
      setPrepared(result.items);
      setState({ busy: "", error: "", notice: result.prepared ? `${plural(result.prepared, "reminder")} ready to send.` : "No tenants need a reminder right now." });
      await onReload();
    } catch (cause) {
      setState({ busy: "", error: cause instanceof Error ? cause.message : "Could not prepare reminders.", notice: "" });
    }
  };
  const recent = portal?.reminders.recent ?? [];
  const reminderList = prepared.length ? prepared : recent.slice(0, 8);
  return <div className={styles.page}>
    <PageHeader title="Settings" subtitle="Appearance and rent reminder rules." />
    <div className={styles.settingsGroup}>
      <div className={styles.settingsIntro}><h2>Appearance</h2><p>How the workspace looks on this device.</p></div>
      <div className={styles.panel}><div className={styles.panelBody}><Switch label="Dark mode" description="Use a dark colour scheme." checked={darkMode} onChange={() => toggleTheme()} /></div></div>
    </div>
    {settings && <div className={styles.settingsGroup}>
      <div className={styles.settingsIntro}><h2>Rent reminders</h2><p>When tenants are reminded and what the message says. Reminders are prepared for you to send on WhatsApp; no SMS is sent and no money is collected.</p></div>
      <div className={styles.panel}>
        <div className={styles.panelBody}>
          <div className={styles.form}>
            <Switch label="Automatic reminders" description={settings.saved ? "Prepared automatically for tenants who qualify." : "Starts once you save these settings."} checked={settings.auto_enabled} onChange={(value) => setSettings({ ...settings, auto_enabled: value })} />
            <Switch label="Remind on the due date" checked={settings.send_on_due} onChange={(value) => setSettings({ ...settings, send_on_due: value })} />
            <div className={styles.fieldGrid}>
              <label className={styles.field}><span>Days before rent is due</span><input className={styles.input} type="number" min={0} max={30} value={settings.days_before} onChange={(event) => setSettings({ ...settings, days_before: Number(event.target.value) })} /></label>
              <label className={styles.field}><span>Repeat overdue reminders every (days)</span><input className={styles.input} type="number" min={1} max={30} value={settings.overdue_interval} onChange={(event) => setSettings({ ...settings, overdue_interval: Number(event.target.value) })} /></label>
            </div>
            <label className={styles.field}><span>Upcoming rent message</span><textarea className={styles.input} rows={2} maxLength={500} value={settings.upcoming_message} onChange={(event) => setSettings({ ...settings, upcoming_message: event.target.value })} /></label>
            <label className={styles.field}><span>Due today message</span><textarea className={styles.input} rows={2} maxLength={500} value={settings.due_today_message} onChange={(event) => setSettings({ ...settings, due_today_message: event.target.value })} /></label>
            <label className={styles.field}><span>Overdue message</span><textarea className={styles.input} rows={2} maxLength={500} value={settings.overdue_message} onChange={(event) => setSettings({ ...settings, overdue_message: event.target.value })} /><small>Placeholders: {"{tenant}"}, {"{amount}"}, {"{due_date}"}, {"{property}"}, {"{unit}"}</small></label>
            {state.error && <p className={styles.error} role="alert">{state.error}</p>}
            {state.notice && <p className={styles.notice} role="status">{state.notice}</p>}
          </div>
        </div>
        <div className={styles.panelFoot}>
          <Button variant="secondary" onClick={() => void sendNow()} disabled={state.busy !== ""}>{state.busy === "send" ? "Preparing…" : "Prepare reminders now"}</Button>
          <Button onClick={() => void save()} disabled={state.busy !== ""}>{state.busy === "save" ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>
    </div>}
    {reminderList.length > 0 && <div className={styles.settingsGroup}>
      <div className={styles.settingsIntro}><h2>{prepared.length ? "Ready to send" : "Recent reminders"}</h2><p>Open each one in WhatsApp to send it to the tenant.</p></div>
      <div className={styles.panel}>
        <ul className={styles.simpleList}>{reminderList.map((item) => <li key={item.id}>
          <div><strong>{item.tenant_name}</strong><small>{item.message}</small></div>
          <a className={styles.smallButton} href={whatsappLink(item.tenant_phone, item.message)} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={14} /> Send</a>
        </li>)}</ul>
      </div>
    </div>}
  </div>;
}
