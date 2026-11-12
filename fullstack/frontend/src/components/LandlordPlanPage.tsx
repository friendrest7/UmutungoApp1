"use client";
import { useEffect, useState, type FormEvent } from "react";
import { umutungoApi } from "../lib/umutungoApi";
import styles from "./LandlordPortal.module.css";

export type LandlordAccess = {
  required: boolean;
  state: "active" | "trial" | "locked";
  tier: string;
  label: string;
  is_trial: boolean;
  trial_used: boolean;
  trial_days: number;
  starts_at: string | null;
  ends_at: string | null;
  days_left: number;
  // Kigali calendar dates (YYYY-MM-DD) for the current period.
  first_day: string;
  last_day: string;
  today: string;
  day_number: number;
  period_days: number;
  scheduled_tier: string;
  scheduled_tier_starts_at: string | null;
};
export type LandlordPlan = {
  tier: "silver" | "gold" | "platinum";
  label: string;
  description: string;
  price: number;
  currency: string;
  period_days: number;
  listing_limit: number | null;
  photo_limit_per_listing: number;
  video_enabled: boolean;
  video_limit_per_listing: number;
  max_video_seconds: number;
  features: string[];
  benefits: string[];
};
export type AccessResponse = { access: LandlordAccess; plans: LandlordPlan[]; demo_payments: boolean };

const RANK: Record<string, number> = { none: 0, silver: 1, gold: 2, platinum: 3 };
const FEATURE_LABELS: Record<string, string> = {
  inventory_management: "Properties, tenants and rent tracking",
  photo_uploads: "Photo uploads on listings",
  video_uploads: "Video tours on listings",
  basic_analytics: "Listing views and enquiries",
  advanced_analytics: "Advanced listing analytics",
  business_analytics: "Portfolio business reports",
  standard_promotion: "Standard marketplace placement",
  recommended_eligible: "Eligible for Recommended",
  search_boost: "Higher placement in search",
  priority_inquiries: "Enquiries marked as priority",
  premium_presentation: "Premium listing presentation",
  priority_support: "Priority support",
  business_verification: "Verified business badge",
  ad_free: "No ads in your workspace",
};
const money = (amount: number, currency = "RWF") => `${currency} ${Math.round(amount).toLocaleString("en-US")}`;
const longDate = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Kigali" }).format(new Date(value));
// Calendar dates arrive as YYYY-MM-DD in Kigali time; they are handled as UTC
// dates here so the browser's own time zone can't shift them by a day.
const isoDay = (value: string) => new Date(`${value}T00:00:00Z`);
const dayLabel = (value: string, weekday = false) => new Intl.DateTimeFormat("en-GB", { ...(weekday ? { weekday: "long" as const } : {}), day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(isoDay(value));
const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

// What choosing a tier does, following the business plan rules: upgrades
// start now, a renewal or downgrade starts when the current period ends.
function changeFor(access: LandlordAccess, tier: string): { action: string; note: string } {
  if (access.state === "locked") return { action: `Choose ${titleCase(tier)}`, note: "Starts as soon as payment is confirmed." };
  const current = RANK[access.tier] ?? 0;
  const target = RANK[tier] ?? 0;
  const end = access.ends_at ? longDate(access.ends_at) : "the end of your current period";
  if (target > current) return { action: `Upgrade to ${titleCase(tier)}`, note: "Starts immediately. Your current period is replaced, with no refund for unused days." };
  if (target === current) return { action: access.is_trial ? `Keep ${titleCase(tier)}` : "Renew", note: `Starts on ${end}, when your ${access.is_trial ? "trial" : "current plan"} ends.` };
  return { action: `Switch to ${titleCase(tier)}`, note: `Starts on ${end}. You keep ${titleCase(access.tier)} until then.` };
}

// The plan period drawn as month calendars: days already used, today, the
// days still to come, and the last day.
function PeriodCalendar({ access }: { access: LandlordAccess }) {
  if (!access.first_day || !access.last_day || !access.today) return null;
  const first = isoDay(access.first_day);
  const last = isoDay(access.last_day);
  const months: Date[] = [];
  for (let month = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1)); month <= last; month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1))) months.push(month);
  const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  return <div className={styles.calendar}>
    <div className={styles.calendarMonths}>
      {months.map((month) => {
        const year = month.getUTCFullYear();
        const index = month.getUTCMonth();
        const daysInMonth = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
        const lead = (month.getUTCDay() + 6) % 7; // weeks start on Monday
        return <figure key={month.toISOString()} className={styles.calendarMonth}>
          <figcaption>{monthName.format(month)}</figcaption>
          <div className={styles.calendarGrid}>
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => <span key={day} className={styles.calendarWeekday} aria-hidden="true">{day}</span>)}
            {Array.from({ length: lead }, (_, i) => <span key={`lead-${i}`} aria-hidden="true" />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const iso = `${year}-${String(index + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
              const inPeriod = iso >= access.first_day && iso <= access.last_day;
              const state = !inPeriod ? "outside" : iso < access.today ? "used" : iso === access.today ? "today" : "ahead";
              const label = inPeriod ? `${dayLabel(iso)}: ${state === "used" ? "used" : state === "today" ? "today" : "to come"}${iso === access.last_day ? ", last day" : ""}` : undefined;
              const className = [styles.calendarDay, styles[`calendarDay_${state}`], iso === access.last_day ? styles.calendarDayLast : ""].join(" ");
              return <span key={iso} className={className} aria-label={label} aria-hidden={inPeriod ? undefined : true} aria-current={state === "today" ? "date" : undefined}>{i + 1}</span>;
            })}
          </div>
        </figure>;
      })}
    </div>
    <ul className={styles.calendarLegend} aria-hidden="true">
      <li><span className={`${styles.calendarKey} ${styles.calendarDay_used}`} />Used</li>
      <li><span className={`${styles.calendarKey} ${styles.calendarDay_today}`} />Today</li>
      <li><span className={`${styles.calendarKey} ${styles.calendarDay_ahead}`} />To come</li>
      <li><span className={`${styles.calendarKey} ${styles.calendarDayLast}`} />Last day</li>
    </ul>
  </div>;
}

function StatusCard({ access }: { access: LandlordAccess }) {
  if (access.state === "locked") {
    return <section className={`${styles.panel} ${styles.planStatus} ${styles.planStatusLocked}`}>
      <div>
        <span className={`${styles.badge} ${styles.badgeDanger}`}>No active plan</span>
        <h2>{access.trial_used ? "Your free trial has ended" : "Your plan has ended"}</h2>
        <p>Your properties, tenants and payment records are kept safe. Choose a plan to open your workspace again.</p>
      </div>
    </section>;
  }
  const total = access.period_days || (access.is_trial ? access.trial_days : 0);
  const used = total ? Math.min(100, Math.max(0, ((access.day_number - 1) / total) * 100)) : 0;
  return <section className={`${styles.panel} ${styles.planStatus}`}>
    <div>
      <span className={`${styles.badge} ${access.is_trial ? styles.badgeWarning : styles.badgeSuccess}`}>{access.is_trial ? "Free trial" : "Active"}</span>
      <h2>{access.label || titleCase(access.tier)}{access.is_trial ? " trial" : " plan"}</h2>
      <p>
        {access.day_number && total ? `Day ${access.day_number} of ${total} · ` : ""}
        {access.days_left === 1 ? "Last day today" : `${access.days_left} days left`}
        {access.last_day ? ` · last day ${dayLabel(access.last_day, true)}` : access.ends_at ? ` · ends ${longDate(access.ends_at)}` : ""}
        {access.scheduled_tier && access.scheduled_tier_starts_at ? ` · ${titleCase(access.scheduled_tier)} starts ${longDate(access.scheduled_tier_starts_at)}` : ""}
      </p>
    </div>
    {access.is_trial && <div className={styles.planMeter} aria-label={`${Math.round(used)}% of trial used`}><span style={{ width: `${used}%` }} /></div>}
    <PeriodCalendar access={access} />
  </section>;
}

export function LandlordPlanPage({ data, onChanged, locked = false }: { data: AccessResponse | null; onChanged: () => Promise<void>; locked?: boolean }) {
  const [selected, setSelected] = useState<LandlordPlan | null>(null);
  const [method, setMethod] = useState<"mobilemoneyrwanda" | "card" | "demo">("mobilemoneyrwanda");
  const [phone, setPhone] = useState("+250");
  const [email, setEmail] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Message after returning from the payment provider.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("payment");
    if (!result) return;
    if (result === "successful") { setNotice("Payment confirmed. Your plan is now active."); void onChanged(); }
    else if (result === "pending") setNotice("Your payment is still being confirmed. This page will update once it completes.");
    else if (result === "cancelled") setError("Payment was cancelled. You have not been charged.");
    else setError("The payment did not go through. You have not been charged.");
    params.delete("payment");
    params.delete("subscription_id");
    window.history.replaceState(null, "", `${window.location.pathname}${params.toString() ? `?${params}` : ""}`);
  }, [onChanged]);

  if (!data) return <div className={styles.page}><p className={styles.footnote}>Loading your plan…</p></div>;
  const { access, plans } = data;
  const sorted = [...plans].sort((a, b) => (RANK[a.tier] ?? 0) - (RANK[b.tier] ?? 0));
  const scheduled = Boolean(access.scheduled_tier);

  const open = (plan: LandlordPlan) => {
    setSelected(plan);
    setMethod(data.demo_payments ? "demo" : "mobilemoneyrwanda");
    setKey(crypto.randomUUID());
    setError("");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const result = await umutungoApi<{ status: string; checkout_url?: string; message?: string }>("/api/v1/business/subscriptions", {
        method: "POST",
        body: JSON.stringify({ tier: selected.tier, payment_method: method, phone, email, idempotency_key: key }),
      });
      if (!result) throw new Error("Your session expired. Sign in again to continue.");
      if (result.checkout_url) { window.location.assign(result.checkout_url); return; }
      setSelected(null);
      setNotice(result.message ?? "Your plan is active.");
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start the payment.");
    } finally {
      setBusy(false);
    }
  };

  return <div className={styles.page}>
    <header className={styles.header}>
      <div>
        <h1>{locked ? "Choose a plan to continue" : "Plan & billing"}</h1>
        <p>{locked ? "Landlord workspaces run on a paid plan. Pick the one that fits your portfolio." : "Your current plan, what it includes, and your options to upgrade or renew."}</p>
      </div>
    </header>
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {error && !selected && <p className={styles.error} role="alert">{error}</p>}
    <StatusCard access={access} />
    {scheduled && <p className={styles.footnote}>You already have a plan scheduled to start. You can change plans again after it starts.</p>}

    {sorted.length === 0 ? (
      <section className={styles.panel}><div className={styles.panelBody}>
        <div className={styles.empty}>
          <strong>Plans are not open for purchase yet</strong>
          <span>Pricing is being finalised. Your data is safe, and plans will appear here as soon as they are available. Contact Umutungo support if you need access in the meantime.</span>
        </div>
      </div></section>
    ) : (
      <div className={styles.planGrid}>
        {sorted.map((plan) => {
          const current = access.state !== "locked" && access.tier === plan.tier;
          const change = changeFor(access, plan.tier);
          const lines = [
            plan.listing_limit === null ? "Unlimited listings (fair use)" : `Up to ${plan.listing_limit} listings`,
            `${plan.photo_limit_per_listing} photos per listing`,
            plan.video_enabled ? `${plan.video_limit_per_listing} video${plan.video_limit_per_listing === 1 ? "" : "s"} per listing, up to ${Math.round(plan.max_video_seconds / 60)} min` : "No video tours",
            ...plan.features.filter((f) => f !== "photo_uploads" && f !== "video_uploads").map((f) => FEATURE_LABELS[f] ?? f.replace(/_/g, " ")),
            ...plan.benefits,
          ];
          return <article key={plan.tier} className={`${styles.planCard} ${current ? styles.planCardCurrent : ""}`}>
            <div className={styles.planCardHead}>
              <h2>{plan.label}</h2>
              {current && <span className={`${styles.badge} ${styles.badgeSuccess}`}>{access.is_trial ? "On trial" : "Current"}</span>}
            </div>
            {plan.description && <p className={styles.planDescription}>{plan.description}</p>}
            <p className={styles.planPrice}><strong>{money(plan.price, plan.currency)}</strong><span> / {plan.period_days} days</span></p>
            <ul className={styles.planFeatures}>{lines.map((line) => <li key={line}>{line}</li>)}</ul>
            <div className={styles.planAction}>
              <button type="button" className={current && !access.is_trial ? styles.secondary : styles.primary} disabled={scheduled} onClick={() => open(plan)}>{change.action}</button>
              <small>{change.note}</small>
            </div>
          </article>;
        })}
      </div>
    )}
    <p className={styles.footnote}>Prices are in Rwandan francs. Upgrades apply immediately; renewals and downgrades begin when your current period ends. Unused days are not refunded.</p>

    {selected && <div className="owner-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setSelected(null); }}>
      <section className="owner-modal" role="dialog" aria-modal="true" aria-labelledby="plan-checkout-title">
        <form className={styles.form} onSubmit={submit}>
          <div>
            <h2 id="plan-checkout-title" style={{ margin: 0 }}>{changeFor(access, selected.tier).action}</h2>
            <p className={styles.footnote}>{money(selected.price, selected.currency)} for {selected.period_days} days. {changeFor(access, selected.tier).note}</p>
          </div>
          <label className={styles.field}>
            <span>Payment method</span>
            <select className={styles.input} value={method} onChange={(event) => setMethod(event.target.value as typeof method)}>
              <option value="mobilemoneyrwanda">Mobile money (MTN / Airtel)</option>
              <option value="card">Bank card</option>
              {data.demo_payments && <option value="demo">Demo payment (test only, no charge)</option>}
            </select>
          </label>
          {method === "mobilemoneyrwanda" && <label className={styles.field}>
            <span>Mobile money number</span>
            <input className={styles.input} value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" required />
          </label>}
          {method !== "demo" && <label className={styles.field}>
            <span>Email for the receipt</span>
            <input className={styles.input} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required={method === "card"} />
            {method === "mobilemoneyrwanda" && <small>Optional if your account already has an email.</small>}
          </label>}
          {method === "demo" && <p className={styles.footnote}>Demo payments activate the plan straight away without charging anyone. They are only available on test environments.</p>}
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.formActions}>
            <button type="submit" className={styles.primary} disabled={busy}>{busy ? "Starting payment…" : method === "demo" ? "Activate (demo)" : `Pay ${money(selected.price, selected.currency)}`}</button>
            <button type="button" className={styles.secondary} disabled={busy} onClick={() => setSelected(null)}>Cancel</button>
          </div>
        </form>
      </section>
    </div>}
  </div>;
}

// A slim banner shown across the workspace while a trial runs, more prominent
// in the last week.
export function TrialBanner({ access, onChoose }: { access: LandlordAccess; onChoose: () => void }) {
  if (access.state !== "trial") return null;
  const urgent = access.days_left <= 7;
  return <div className={`${styles.trialBanner} ${urgent ? styles.trialBannerUrgent : ""}`} role="status">
    <span><strong>{access.label || "Silver"} trial</strong> · {access.day_number && access.period_days ? `Day ${access.day_number} of ${access.period_days} · ` : ""}{access.days_left === 1 ? "last day today" : `${access.days_left} days left`}{access.scheduled_tier ? ` · ${titleCase(access.scheduled_tier)} plan starts next` : ""}</span>
    {!access.scheduled_tier && <button type="button" className={styles.textLink} onClick={onChoose}>Choose a plan</button>}
  </div>;
}
