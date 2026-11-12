"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { type AuthRole } from "./AuthModal";
import { OwnerSignIn } from "./OwnerSignIn";
import { Icon } from "./Icons";
import { Logo } from "./Logo";
import { LandlordAdvertisePropertiesSection, type AdvertiseListing } from "./LandlordAdvertisePropertiesSection";
import { LandlordPortalPage, type Portal } from "./LandlordPortalPages";
import portalStyles from "./LandlordPortal.module.css";
import { WorkspaceTopbar, type WorkspaceAlert } from "./WorkspaceTopbar";
import { LandlordPlanPage, TrialBanner, type AccessResponse } from "./LandlordPlanPage";
import { ApiError, apiToken, umutungoApi } from "../lib/umutungoApi";
import {
  rwandaLocations,
  getDistrictNames,
  getSectorNames,
} from "../data/rwandaLocations";
type OwnerApplication = {
  id: string;
  listing_id: string;
  listing_title: string;
  applicant_name: string;
  phone: string;
  status: string;
  message: string;
  created_at: string;
};
type Workspace = {
  month: string;
  summary: {
    expected: number;
    collected: number;
    balance: number;
    occupied_units: number;
    total_units: number;
    active_tenants: number;
    overdue_count: number;
  };
  properties: Array<{
    id: string;
    name: string;
    province: string;
    district: string;
    sector: string;
    units: Array<{ id: string; name: string; monthly_rent: number }>;
    unit_count: number;
    occupied_units: number;
  }>;
  rent: Array<{
    id: string;
    tenant_name: string;
    tenant_phone: string;
    property: string;
    unit: string;
    amount_due: number;
    amount_paid: number;
    balance: number;
    due_date: string;
    status: string;
  }>;
  maintenance: Array<{
    id: string;
    description: string;
    priority: string;
    status: string;
    property: string;
    unit: string;
  }>;
  applications: OwnerApplication[];
  billing: { configured: boolean; message: string };
  onboarding: { step: number; completed: boolean };
};
type MarketplaceListingRecord = {
  id: string;
  category: string;
  transaction_type: string;
  title: string;
  price: number;
  currency: string;
  province: string;
  district: string;
  sector: string;
  status: string;
  cover?: string;
  images?: string[];
  media?: Array<{ type?: string; url: string; sort_order?: number }>;
  created_at: string;
  is_featured?: boolean;
};
const mapMarketplaceListing = (item: MarketplaceListingRecord): AdvertiseListing => {
  const intent = item.transaction_type === "rent_out" || item.transaction_type === "rent" ? "For rent" : item.transaction_type === "book" ? "Book" : "For sale";
  const mediaImages = item.media?.filter((media) => media.url && (!media.type || media.type.toLowerCase() === "photo")).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((media) => media.url) ?? [];
  const cover = item.cover || mediaImages[0] || item.images?.[0] || "/properties/house-01.jpg";
  return {
    id: item.id,
    title: item.title,
    type: item.category,
    intent,
    location: [item.sector, item.district, item.province].filter(Boolean).join(" - "),
    price: `${item.currency || "RWF"} ${item.price.toLocaleString("en-RW")}`,
    priceNote: intent === "For rent" ? "/ month" : "",
    cover,
    status: item.status,
    featured: item.is_featured ?? false,
  };
};
const PORTAL_PAGES = ["Home", "Properties", "Tenants", "Payments", "Announcements", "Repair advice", "Settings"];
const money = (amount: number) => `RWF ${Math.round(amount).toLocaleString("en-US")}`;
const fmtDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "Africa/Kigali",
  }).format(new Date(`${value}T12:00:00+02:00`));
const todayKigali = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kigali",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const monthKigali = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kigali",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
export function LandlordWorkspace({
  ownerRoute = false,
}: {
  ownerRoute?: boolean;
}) {
  const [session, setSession] = useState<
    "checking" | "allowed" | "guest" | "denied"
  >("checking");
  const [ownerName, setOwnerName] = useState("there");
  const [role, setRole] = useState<AuthRole>("Property Owner");
  const [activePage, setActivePage] = useState("Home");
  const signOut = async () => {
    const token = localStorage.getItem("umutungo-api-token");
    if (token) {
      try { await fetch("/api/v1/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } }); }
      catch { /* Clear the local credential even if offline. */ }
    }
    localStorage.removeItem("umutungo-demo-user");
    localStorage.removeItem("umutungo-api-token");
    ["umutungo-notifications", "umutungo-landlord-notifications", "umutungo-commissioner-notifications", "umutungo-tenant-notifications"].forEach((key) => localStorage.removeItem(key));
    window.dispatchEvent(new Event("umutungo:auth-changed"));
    window.location.replace("/");
  };
  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get("section");
    if (section === "Properties" || section === "Tenants" || section === "Payments" || section === "Announcements" || section === "Repair advice" || section === "Settings" || section === "Plan" || section === "Enquiries" || section === "Reports" || section === "Advertise property") setActivePage(section);
  }, []);
  // Landlord accounts have no free tier: the first visit starts a Silver
  // trial, and without an active plan the workspace is replaced by the plan
  // picker. Property owner accounts always come back as "active".
  const [accessData, setAccessData] = useState<AccessResponse | null>(null);
  const loadAccess = useCallback(async () => {
    try {
      const data = await umutungoApi<AccessResponse>("/api/v1/owner/access");
      if (data) setAccessData(data);
    } catch {
      // Fail open to the normal workspace; the backend still enforces the plan.
      setAccessData({ access: { required: false, state: "active", tier: "", label: "", is_trial: false, trial_used: false, trial_days: 0, starts_at: null, ends_at: null, days_left: 0, first_day: "", last_day: "", today: "", day_number: 0, period_days: 0, scheduled_tier: "", scheduled_tier_starts_at: null }, plans: [], demo_payments: false });
    }
  }, []);
  const planLocked = accessData?.access.state === "locked";
  const workspaceReady = session === "allowed" && accessData !== null && !planLocked;
  // A 402 from any workspace call means the plan ended while the page was open.
  const handlePlanError = useCallback((cause: unknown) => {
    if (cause instanceof ApiError && cause.code === "plan_required") { void loadAccess(); return true; }
    return false;
  }, [loadAccess]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [marketplaceListings, setMarketplaceListings] = useState<AdvertiseListing[]>([]);
  const [canAdvertiseListings, setCanAdvertiseListings] = useState(false);
  const [advertiseNotice, setAdvertiseNotice] = useState("");
  const [selectedTenantPhone, setSelectedTenantPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [month] = useState(monthKigali);
  const [modal, setModal] = useState<
    "property" | "unit" | "charge" | "payment" | "maintenance" | ""
  >("");
  const [saving, setSaving] = useState(false);
  const propertyFilter = "";
  const [propertyForm, setPropertyForm] = useState({
    name: "",
    province: "City of Kigali",
    district: "Gasabo",
    sector: "Kacyiru",
    cell: "",
    village: "",
    unit: "",
    monthly_rent: "",
  });
  const [chargeForm, setChargeForm] = useState({
    unit_id: "",
    tenant_name: "",
    tenant_phone: "+250",
    amount_due: "",
    due_date: todayKigali(),
  });
  const [unitForm, setUnitForm] = useState({ property_id: "", name: "", monthly_rent: "" });
  const [paymentForm, setPaymentForm] = useState({
    charge_id: "",
    amount: "",
    method: "cash",
    reference: "",
    idempotency_key: "",
  });
  const [repairForm, setRepairForm] = useState({
    unit_id: "",
    description: "",
    priority: "normal",
  });
  const loadWorkspace = useCallback(
    async (selectedMonth: string, selectedProperty: string) => {
      setLoading(true);
      setError("");
      try {
        const data = await umutungoApi<Workspace>(
          `/api/v1/owner/workspace?month=${encodeURIComponent(selectedMonth)}${selectedProperty ? `&property_id=${encodeURIComponent(selectedProperty)}` : ""}`,
        );
        if (!data) throw new Error("Sign in to open your private workspace.");
        setWorkspace(data);
      } catch (cause) {
        if (handlePlanError(cause)) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load the workspace.",
        );
      } finally {
        setLoading(false);
      }
    },
    [handlePlanError],
  );
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!apiToken()) {
        if (!cancelled) {
          setSession("guest");
          setLoading(false);
        }
        return;
      }
      try {
        const data = await umutungoApi<{
          user: { role: string; workspace_kind?: string; name?: string };
        }>("/api/v1/me");
        if (!data) throw new Error("session");
        if (data.user.role !== "property_owner") {
          if (!cancelled) {
            setSession("denied");
            setLoading(false);
          }
          return;
        }
        if (!cancelled) {
          setRole(
            data.user.workspace_kind === "landlord"
              ? "Landlord"
              : "Property Owner",
          );
          setOwnerName(data.user.name?.trim().split(/\s+/)[0] || "there");
          setSession("allowed");
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem("umutungo-api-token");
          setSession("guest");
          setLoading(false);
        }
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (session === "allowed") void loadAccess();
  }, [session, loadAccess]);
  useEffect(() => {
    if (workspaceReady) void loadWorkspace(month, propertyFilter);
  }, [workspaceReady, month, propertyFilter, loadWorkspace]);
  const [portal, setPortal] = useState<Portal | null>(null);
  const loadPortal = useCallback(async () => {
    try {
      const data = await umutungoApi<Portal>("/api/v1/owner/portal");
      if (data) setPortal(data);
    } catch (cause) {
      if (handlePlanError(cause)) return;
      setError(cause instanceof Error ? cause.message : "Could not load tenants and payments.");
    }
  }, [handlePlanError]);
  useEffect(() => {
    if (workspaceReady) void loadPortal();
  }, [workspaceReady, loadPortal]);
  const reloadAll = useCallback(async () => {
    await Promise.all([loadWorkspace(month, propertyFilter), loadPortal()]);
  }, [loadWorkspace, loadPortal, month, propertyFilter]);
  const [tenantQuery, setTenantQuery] = useState("");
  // Advertise a private property through one of the landlord's published
  // listings, or stop. Returns an error message, or "" on success.
  const advertiseProperty = async (propertyId: string, listingId: string, advertise: boolean) => {
    try {
      const result = await umutungoApi(`/api/v1/owner/properties/${encodeURIComponent(propertyId)}/advertise`, { method: "POST", body: JSON.stringify({ listing_id: listingId, advertise }) });
      if (!result) return "Your session expired. Sign in again to continue.";
      const name = workspace?.properties.find((item) => item.id === propertyId)?.name ?? "This property";
      setError("");
      setSuccess(advertise ? `${name} is now advertised: it shows first on the home page and is marked Recommended.` : `${name} is no longer advertised on the home page.`);
      await loadWorkspace(month, propertyFilter);
      window.dispatchEvent(new Event("umutungo:landlord-data-changed"));
      return "";
    } catch (cause) {
      if (handlePlanError(cause)) return "Your plan has ended. Choose a plan to keep advertising.";
      return cause instanceof Error ? cause.message : "Could not update advertising.";
    }
  };
  // Live alerts for the top bar: overdue and due-today rent, urgent open repairs.
  const workspaceAlerts: WorkspaceAlert[] = [
    ...(portal?.tenants ?? [])
      .filter((tenant) => tenant.status === "overdue" || tenant.status === "due_today")
      .sort((a, b) => b.days_overdue - a.days_overdue)
      .map((tenant): WorkspaceAlert => ({
        id: `rent-${tenant.key}`,
        tone: tenant.status === "overdue" ? "danger" : "warning",
        title: tenant.status === "overdue" ? `${tenant.name} is ${tenant.days_overdue} day${tenant.days_overdue === 1 ? "" : "s"} overdue` : `${tenant.name}'s rent is due today`,
        detail: `${tenant.property} · ${tenant.unit} · RWF ${(tenant.status === "overdue" ? tenant.overdue_balance : tenant.balance).toLocaleString("en-US")}`,
        page: "Tenants",
      })),
    ...(workspace?.maintenance ?? [])
      .filter((repair) => repair.priority === "urgent" && repair.status !== "resolved")
      .map((repair): WorkspaceAlert => ({ id: `repair-${repair.id}`, tone: "danger", title: "Urgent repair open", detail: repair.description.slice(0, 90), page: "Repair advice" })),
  ];
  const openAddTenant = (unitId = "") => {
    const unit = workspace?.properties.flatMap((property) => property.units).find((item) => item.id === unitId);
    setChargeForm({ unit_id: unitId, tenant_name: "", tenant_phone: "+250", amount_due: unit ? String(unit.monthly_rent) : "", due_date: todayKigali() });
    setModal("charge");
  };
  const openRecordPayment = (charge?: { id: string; balance: number }) => {
    // A fresh key per form opening lets the backend ignore double submissions.
    setPaymentForm({ charge_id: charge?.id ?? "", amount: charge ? String(charge.balance) : "", method: "cash", reference: "", idempotency_key: crypto.randomUUID() });
    setModal("payment");
  };
  const logRepair = async (input: { description: string; priority: "low" | "normal" | "urgent"; unit_id: string }) => {
    setError("");
    try {
      const result = await umutungoApi("/api/v1/owner/workspace?action=maintenance", { method: "POST", body: JSON.stringify(input) });
      if (!result) throw new Error("Your session expired. Sign in again to continue.");
      await loadWorkspace(month, propertyFilter);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not log the repair.");
      return false;
    }
  };
  useEffect(() => {
    if (!workspaceReady) return;
    let cancelled = false;
    const loadAdvertising = async () => {
      try {
        const [listingResponse, upgradeResponse] = await Promise.all([
          umutungoApi<{ items: MarketplaceListingRecord[] }>("/api/v1/owner/listings"),
          umutungoApi<{ purchases?: Array<{ plan?: string; status: string; expires_at?: string | null }> }>("/api/v1/owner/upgrades"),
        ]);
        if (cancelled) return;
        setMarketplaceListings((listingResponse?.items ?? []).map(mapMarketplaceListing));
        const now = Date.now();
        const activePlan = upgradeResponse?.purchases?.some((purchase) =>
          ["silver", "gold", "platinum"].includes(purchase.plan ?? "") &&
          purchase.status === "active" && purchase.expires_at && Date.parse(purchase.expires_at) > now,
        ) ?? false;
        setCanAdvertiseListings(activePlan);
      } catch {
        if (!cancelled) {
          setMarketplaceListings([]);
          setCanAdvertiseListings(false);
        }
      }
    };
    const refresh = () => { void loadAdvertising(); };
    refresh();
    window.addEventListener("umutungo:landlord-data-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("umutungo:landlord-data-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [workspaceReady]);
  const toggleMarketplacePromotion = async (listing: AdvertiseListing) => {
    const featured = !listing.featured;
    setAdvertiseNotice(featured ? `Recommending ${listing.title}…` : `Removing ${listing.title} from recommendations…`);
    try {
      const result = await umutungoApi<{ is_featured: boolean }>(`/api/v1/listings/${encodeURIComponent(listing.id)}/featured`, {
        method: "PATCH",
        body: JSON.stringify({ is_featured: featured }),
      });
      if (!result) throw new Error("Could not update this property promotion.");
      setMarketplaceListings((current) => current.map((item) => item.id === listing.id ? { ...item, featured: result.is_featured } : item));
      setAdvertiseNotice(result.is_featured ? `${listing.title} is recommended on the home page.` : `${listing.title} was removed from home page recommendations.`);
    } catch (cause) {
      setAdvertiseNotice(cause instanceof Error ? cause.message : "Could not update this property promotion.");
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const action =
        modal === "property"
          ? ""
          : modal === "unit"
            ? "?action=unit"
          : modal === "charge"
            ? "?action=charge"
            : modal === "payment"
              ? "?action=payment"
              : "?action=maintenance";
      const body =
        modal === "property"
          ? {
              ...propertyForm,
              monthly_rent: Number(propertyForm.monthly_rent) || 0,
            }
          : modal === "unit"
            ? { ...unitForm, monthly_rent: Number(unitForm.monthly_rent) || 0 }
          : modal === "charge"
            ? { ...chargeForm, amount_due: Number(chargeForm.amount_due) }
            : modal === "payment"
              ? { ...paymentForm, amount: Number(paymentForm.amount) }
              : repairForm;
      const result = await umutungoApi<{ status?: string; id?: string }>(
        `/api/v1/owner/workspace${action}`,
        { method: "POST", body: JSON.stringify(body) },
      );
      if (!result)
        throw new Error("Your session expired. Sign in again to continue.");
      if (modal === "payment" && result.status === "recorded")
        setSuccess(
          "Payment recorded manually. No money was collected by a provider.",
        );
      else setSuccess("Saved successfully.");
      setModal("");
      if (modal === "payment")
        setPaymentForm({
          charge_id: "",
          amount: "",
          method: "cash",
          reference: "",
          idempotency_key: "",
        });
      await reloadAll();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The change could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  const updateRepair = async (id: string, status: string) => {
    setError("");
    try {
      await umutungoApi(`/api/v1/owner/workspace/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadWorkspace(month, propertyFilter);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update repair.",
      );
    }
  };
  const decideApplication = async (
    id: string,
    status: "accepted" | "rejected",
  ) => {
    setError("");
    setSuccess("");
    try {
      await umutungoApi(
        `/api/v1/applications/${encodeURIComponent(id)}/decision`,
        {
          method: "POST",
          body: JSON.stringify({
            status,
            note: "Updated in the owner workspace.",
          }),
        },
      );
      setSuccess(
        status === "accepted"
          ? "Application accepted. The existing rental agreement workflow was started."
          : "Application declined.",
      );
      await loadWorkspace(month, propertyFilter);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update the application.",
      );
    }
  };
  const firstName = ownerName;
  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat("en", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Africa/Kigali",
    }).format(now),
  );
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const tenantContacts = new Map<string, { name: string; phone: string; context: string }>();
  workspace?.rent.forEach((row) => {
    const phone = row.tenant_phone.trim();
    if (phone) tenantContacts.set(phone, { name: row.tenant_name, phone, context: `${row.property}${row.unit ? ` · ${row.unit}` : ""}` });
  });
  workspace?.applications.forEach((application) => {
    const phone = application.phone.trim();
    if (phone && !tenantContacts.has(phone)) tenantContacts.set(phone, { name: application.applicant_name || "Tenant applicant", phone, context: application.listing_title });
  });
  const selectedTenant = Array.from(tenantContacts.values()).find((tenant) => tenant.phone === selectedTenantPhone);
  const tenantPhoneDigits = selectedTenant?.phone.replace(/\D/g, "").replace(/^0/, "") ?? "";
  const whatsappNumber = tenantPhoneDigits && !tenantPhoneDigits.startsWith("250") ? `250${tenantPhoneDigits}` : tenantPhoneDigits;
  const tenantMessageLink = selectedTenant && whatsappNumber.length >= 11
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hello ${selectedTenant.name}, I am contacting you about ${selectedTenant.context || "your rental"}.`)}`
    : "";
  if (session === "checking")
    return (
      <main className="owner-workspace-access">
        <p>Checking your secure workspace </p>
      </main>
    );
  if (session === "guest" || session === "denied")
    return (
      <OwnerSignIn
        audience={ownerRoute ? "Property Owner" : "Landlord"}
        denied={session === "denied"}
        onSignedIn={() => window.location.reload()}
      />
    );
  if (!accessData)
    return (
      <main className="owner-workspace-access">
        <p>Checking your plan </p>
      </main>
    );
  if (planLocked)
    return (
      <main className={`${portalStyles.workspace} ${portalStyles.lockShell}`}>
        <header className={portalStyles.lockTop}>
          <Link href="/" aria-label="Umutungo home"><Logo darkMode /></Link>
          <button type="button" className={portalStyles.lockSignOut} onClick={() => void signOut()}>Sign out</button>
        </header>
        <div className={portalStyles.lockBody}>
          <LandlordPlanPage data={accessData} onChanged={loadAccess} locked />
        </div>
      </main>
    );
  const showPlan = accessData.access.required;
  return (
    <main className={`owner-workspace ${portalStyles.workspace}`}>
      {" "}
      <aside className={`owner-sidebar ${portalStyles.sidebar}`}>
        <Link href="/" className={`owner-brand ${portalStyles.brand}`} aria-label="Umutungo home">
          <Logo darkMode />
        </Link>
        <nav>
          {([
            ["Home", "home"],
            ["Properties", "building"],
            ["Tenants", "users"],
            ["Payments", "creditCard"],
            ["Announcements", "bell"],
            ["Repair advice", "wrench"],
            ...(showPlan ? [["Plan", "sparkles"] as const] : []),
            ["Settings", "user"],
          ] as const).map(([page, icon]) => (
            <button key={page} type="button" className={activePage === page ? "is-active" : ""} aria-current={activePage === page ? "page" : undefined} onClick={() => setActivePage(page)}>
              <Icon name={icon} size={17} />
              {page}
            </button>
          ))}
          <button type="button" className={portalStyles.navSignOut} onClick={() => void signOut()}>
            <Icon name="arrow" size={17} />
            Sign out
          </button>
        </nav>
        <button type="button" className={portalStyles.signOut} onClick={() => void signOut()}>
          <Icon name="arrow" size={16} />
          Sign out
        </button>
      </aside>{" "}
      <section className={`owner-main ${portalStyles.main}`}>
        <WorkspaceTopbar
          name={firstName}
          role={role}
          alerts={workspaceAlerts}
          onNavigate={setActivePage}
          onSearch={(query) => { setTenantQuery(query); setActivePage("Tenants"); }}
          onSignOut={() => void signOut()}
          inAppPlan={showPlan}
        />
        <div className="owner-content" id="overview" data-page={activePage}>
          {activePage !== "Plan" && <TrialBanner access={accessData.access} onChoose={() => setActivePage("Plan")} />}
          {activePage === "Plan" && showPlan && <LandlordPlanPage data={accessData} onChanged={loadAccess} />}
          {error && (
            <div className="owner-alert" role="alert">
              {error}
              <button onClick={() => void loadWorkspace(month, propertyFilter)}>
                Retry
              </button>
            </div>
          )}
          {success && (
            <div className="owner-success" role="status">
              {success}
            </div>
          )}{" "}
          {loading ? (
            <div className="owner-loading" role="status">
              Loading your workspace{" "}
            </div>
          ) : (
            workspace && (
              <>
                <section className="owner-panel owner-report-panel" hidden={activePage !== "Reports"}>
                  <div className="owner-panel-heading">
                    <div><span className="owner-eyebrow">PROPERTY PERFORMANCE</span><h2>Portfolio report</h2></div>
                    <span className="owner-report-period">{month}</span>
                  </div>
                  <p className="owner-report-intro">A snapshot of your assigned properties and rental activity for this month.</p>
                  <div className="owner-report-grid">
                    <article><span>Assigned properties</span><strong>{workspace.properties.length}</strong><small>Private portfolio</small></article>
                    <article><span>Rent expected</span><strong>{money(workspace.summary.expected)}</strong><small>This month</small></article>
                    <article><span>Rent collected</span><strong>{money(workspace.summary.collected)}</strong><small>This month</small></article>
                    <article><span>Outstanding</span><strong>{money(workspace.summary.balance)}</strong><small>{workspace.summary.overdue_count} overdue charges</small></article>
                  </div>
                </section>{" "}
                <div className="owner-advertise-page" hidden={activePage !== "Advertise property"}>
                  <LandlordAdvertisePropertiesSection
                    listings={marketplaceListings}
                    onFeature={(listing) => void toggleMarketplacePromotion(listing)}
                    notice={advertiseNotice}
                    canAdvertise={canAdvertiseListings}
                    audience="Owner"
                    upgradeHref="/upgrade/owner"
                  />
                </div>
                <section className="owner-panel owner-enquiries" id="enquiries" hidden={activePage !== "Enquiries"}>
                  <div className="owner-panel-heading">
                    <div>
                      <span className="owner-eyebrow">MARKETPLACE</span>
                      <h2>Rental enquiries</h2>
                    </div>
                    <Link className="owner-link-button" href="/messages">
                      Open messages
                    </Link>
                  </div>
                  {workspace.applications.length ? (
                    workspace.applications.map((item) => (
                      <article className="owner-enquiry-row" key={item.id}>
                        <div>
                          <strong>
                            {item.applicant_name}{" "}
                            <span
                              className={`owner-status ${item.status === "pending" ? "status-upcoming" : "status-paid"}`}
                            >
                              {item.status}
                            </span>
                          </strong>
                          <small>
                            {item.listing_title} -{" "}
                            {new Intl.DateTimeFormat("en-GB", {
                              dateStyle: "medium",
                              timeZone: "Africa/Kigali",
                            }).format(new Date(item.created_at))}
                          </small>
                          <p>{item.message || "No message included."}</p>
                          {item.phone && <small>{item.phone}</small>}
                        </div>
                        {item.status === "pending" && (
                          <div className="owner-enquiry-actions">
                            <button
                              onClick={() =>
                                void decideApplication(item.id, "accepted")
                              }
                            >
                              Accept
                            </button>
                            <button
                              onClick={() =>
                                void decideApplication(item.id, "rejected")
                              }
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </article>
                    ))
                  ) : (
                    <div className="owner-empty">
                      <strong>No enquiries yet</strong>
                      <span>
                        Applications from your existing published marketplace
                        listings will appear here.
                      </span>
                      <Link href="/post-property">Create a listing</Link>
                    </div>
                  )}
                </section>
                {PORTAL_PAGES.includes(activePage) && (
                  <LandlordPortalPage
                    page={activePage}
                    portal={portal}
                    properties={workspace.properties}
                    repairs={workspace.maintenance}
                    onReload={reloadAll}
                    onAddProperty={() => setModal("property")}
                    onAddUnit={(propertyId) => {
                      setUnitForm({ property_id: propertyId, name: "", monthly_rent: "" });
                      setModal("unit");
                    }}
                    onAddTenant={openAddTenant}
                    onRecordPayment={openRecordPayment}
                    onLogRepair={logRepair}
                    onUpdateRepair={(id, status) => void updateRepair(id, status)}
                    onNavigate={setActivePage}
                    tenantQuery={tenantQuery}
                    greeting={`${greeting}, ${firstName}`}
                    summary={workspace.summary}
                    listings={marketplaceListings}
                    onAdvertise={advertiseProperty}
                  />
                )}{" "}
              </>
            )
          )}{" "}
        </div>
      </section>{" "}
      {modal && (
        <div
          className="owner-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal("");
          }}
        >
          <section
            className="owner-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="owner-modal-title"
          >
            <button
              className="owner-modal-close"
              onClick={() => setModal("")}
              aria-label="Close"
            >
              <span aria-hidden="true">×</span>
            </button>
            <span className="owner-eyebrow">OWNER WORKSPACE</span>
            <h2 id="owner-modal-title">
              {modal === "property"
                ? "Add a private property"
                : modal === "unit"
                  ? "Add a unit"
                : modal === "charge"
                  ? "Add a tenant"
                  : modal === "payment"
                    ? "Record a payment"
                    : "Create a maintenance request"}
            </h2>
            <form onSubmit={submit}>
              {" "}
              {modal === "unit" && (
                <>
                  <label>
                    Property
                    <select required value={unitForm.property_id} onChange={(event) => setUnitForm({ ...unitForm, property_id: event.target.value })}>
                      <option value="">Choose a property</option>
                      {workspace?.properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
                    </select>
                  </label>
                  <label>
                    Unit name
                    <input required maxLength={80} value={unitForm.name} onChange={(event) => setUnitForm({ ...unitForm, name: event.target.value })} placeholder="e.g. Apartment 2" />
                  </label>
                  <label>
                    Monthly rent (RWF)
                    <input required type="number" min="0" step="1" value={unitForm.monthly_rent} onChange={(event) => setUnitForm({ ...unitForm, monthly_rent: event.target.value })} />
                  </label>
                </>
              )}
              {modal === "property" && (
                <>
                  <label>
                    Property name
                    <input
                      required
                      maxLength={120}
                      value={propertyForm.name}
                      onChange={(e) =>
                        setPropertyForm({
                          ...propertyForm,
                          name: e.target.value,
                        })
                      }
                      placeholder="e.g. Kacyiru family home"
                    />
                  </label>
                  <div className="owner-form-grid">
                    <label>
                      Province
                      <select
                        value={propertyForm.province}
                        onChange={(e) => {
                          const province = e.target.value;
                          const district = getDistrictNames(province)[0] ?? "";
                          setPropertyForm({
                            ...propertyForm,
                            province,
                            district,
                            sector: getSectorNames(province, district)[0] ?? "",
                          });
                        }}
                      >
                        {rwandaLocations.map((p) => (
                          <option key={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      District
                      <select
                        value={propertyForm.district}
                        onChange={(e) =>
                          setPropertyForm({
                            ...propertyForm,
                            district: e.target.value,
                            sector:
                              getSectorNames(
                                propertyForm.province,
                                e.target.value,
                              )[0] ?? "",
                          })
                        }
                      >
                        {getDistrictNames(propertyForm.province).map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Sector
                      <input
                        required
                        value={propertyForm.sector}
                        onChange={(e) =>
                          setPropertyForm({
                            ...propertyForm,
                            sector: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Cell (optional)
                      <input
                        value={propertyForm.cell}
                        onChange={(e) =>
                          setPropertyForm({
                            ...propertyForm,
                            cell: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Village (optional)
                      <input
                        value={propertyForm.village}
                        onChange={(e) =>
                          setPropertyForm({
                            ...propertyForm,
                            village: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      First unit (optional)
                      <input
                        value={propertyForm.unit}
                        onChange={(e) =>
                          setPropertyForm({
                            ...propertyForm,
                            unit: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Monthly rent (RWF)
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={propertyForm.monthly_rent}
                        onChange={(e) =>
                          setPropertyForm({
                            ...propertyForm,
                            monthly_rent: e.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                </>
              )}{" "}
              {modal === "charge" && (
                <>
                  <label>
                    Property unit
                    <select
                      required
                      value={chargeForm.unit_id}
                      onChange={(e) =>
                        setChargeForm({
                          ...chargeForm,
                          unit_id: e.target.value,
                        })
                      }
                    >
                      <option value="">Select a unit</option>
                      {workspace?.properties.flatMap((p) =>
                        p.units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {p.name} {u.name}
                          </option>
                        )),
                      )}
                    </select>
                  </label>
                  {!workspace?.properties.some((p) => p.units.length > 0) && (
                    <p className="owner-form-note">
                      Add a property with a unit first. You can enter one in the
                      Add property form.
                    </p>
                  )}
                  <label>
                    Tenant name
                    <input
                      required
                      value={chargeForm.tenant_name}
                      onChange={(e) =>
                        setChargeForm({
                          ...chargeForm,
                          tenant_name: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Tenant phone (+250)
                    <input
                      required
                      type="tel"
                      value={chargeForm.tenant_phone}
                      onChange={(e) =>
                        setChargeForm({
                          ...chargeForm,
                          tenant_phone: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Monthly rent (RWF)
                    <input
                      required
                      type="number"
                      min="1"
                      step="1"
                      value={chargeForm.amount_due}
                      onChange={(e) =>
                        setChargeForm({
                          ...chargeForm,
                          amount_due: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Rent due date
                    <input
                      required
                      type="date"
                      value={chargeForm.due_date}
                      onChange={(e) =>
                        setChargeForm({
                          ...chargeForm,
                          due_date: e.target.value,
                        })
                      }
                    />
                  </label>
                </>
              )}{" "}
              {modal === "payment" && !(portal?.open_charges.length) && (
                // Payments are recorded against a tenant's unpaid rent. With
                // none yet, point to the next setup step instead.
                <div className="owner-empty">
                  <strong>No unpaid rent to record against yet</strong>
                  <span>
                    {!workspace?.properties.length
                      ? "A payment is recorded against a tenant's rent. Start by adding your property, then a unit and its tenant."
                      : !workspace.properties.some((property) => property.units.length)
                        ? "A payment is recorded against a tenant's rent. Add a unit to your property, then add its tenant with their rent and due date."
                        : "A payment is recorded against a tenant's rent. Add a tenant with their rent and first due date, then record what they pay here."}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!workspace?.properties.length) setModal("property");
                      else if (!workspace.properties.some((property) => property.units.length)) {
                        setUnitForm({ property_id: workspace.properties[0].id, name: "", monthly_rent: "" });
                        setModal("unit");
                      } else openAddTenant();
                    }}
                  >
                    {!workspace?.properties.length ? "Add a property" : !workspace.properties.some((property) => property.units.length) ? "Add a unit" : "Add a tenant"}
                  </button>
                </div>
              )}
              {modal === "payment" && Boolean(portal?.open_charges.length) && (
                <>
                  <label>
                    Rent charge
                    <select
                      required
                      value={paymentForm.charge_id}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          charge_id: e.target.value,
                        })
                      }
                    >
                      <option value="">Choose an unpaid charge</option>
                      {(portal?.open_charges ?? []).map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.tenant_name} · {x.unit} · due {fmtDate(x.due_date)} · {money(x.balance)} remaining
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Amount received (RWF)
                    <input
                      required
                      type="number"
                      min="1"
                      step="1"
                      value={paymentForm.amount}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          amount: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Recorded method
                    <select
                      value={paymentForm.method}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          method: e.target.value,
                        })
                      }
                    >
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="mtn_momo">MTN MoMo (record only)</option>
                      <option value="airtel_money">
                        Airtel Money (record only)
                      </option>
                    </select>
                  </label>
                  <label>
                    Reference (optional)
                    <input
                      maxLength={120}
                      value={paymentForm.reference}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          reference: e.target.value,
                        })
                      }
                    />
                  </label>
                  <p className="owner-form-note">
                    This records a payment you received elsewhere. It does not
                    request or collect money.
                  </p>
                </>
              )}{" "}
              {modal === "maintenance" && (
                <>
                  <label>
                    Property unit (optional)
                    <select
                      value={repairForm.unit_id}
                      onChange={(e) =>
                        setRepairForm({
                          ...repairForm,
                          unit_id: e.target.value,
                        })
                      }
                    >
                      <option value="">Select later</option>
                      {workspace?.properties.flatMap((property) =>
                        property.units.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {property.name} - {unit.name}
                          </option>
                        )),
                      )}
                    </select>
                  </label>
                  <label>
                    Issue description
                    <textarea
                      required
                      maxLength={2000}
                      rows={4}
                      value={repairForm.description}
                      onChange={(e) =>
                        setRepairForm({
                          ...repairForm,
                          description: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Priority
                    <select
                      value={repairForm.priority}
                      onChange={(e) =>
                        setRepairForm({
                          ...repairForm,
                          priority: e.target.value,
                        })
                      }
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </label>
                </>
              )}{" "}
              {error && (
                <p className="owner-form-error" role="alert">
                  {error}
                </p>
              )}
              {!(modal === "payment" && !portal?.open_charges.length) && <button
                className="owner-primary owner-submit"
                type="submit"
                disabled={saving}
              >
                {saving ? "Saving   " : "Save"}
              </button>}{" "}
            </form>
          </section>
        </div>
      )}{" "}
    </main>
  );
}
