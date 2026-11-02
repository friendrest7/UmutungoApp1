"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AuthModal, type AuthRole } from "./AuthModal";
import { Icon } from "./Icons";
import { apiToken, umutungoApi } from "../lib/umutungoApi";
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
const money = (amount: number) =>
  new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: "RWF",
    maximumFractionDigits: 0,
  }).format(amount);
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
function exportRentCSV(rows: Workspace["rent"], month: string) {
  const columns = [
    "Tenant",
    "Phone",
    "Property",
    "Unit",
    "Due RWF",
    "Paid RWF",
    "Balance RWF",
    "Due date",
    "Status",
  ];
  const csv = [
    columns,
    ...rows.map((row) => [
      row.tenant_name,
      row.tenant_phone,
      row.property,
      row.unit,
      row.amount_due,
      row.amount_paid,
      row.balance,
      row.due_date,
      row.status,
    ]),
  ]
    .map((row) =>
      row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `umutungo-rent-${month}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
export function LandlordWorkspace({
  ownerRoute = false,
}: {
  ownerRoute?: boolean;
}) {
  const [session, setSession] = useState<
    "checking" | "allowed" | "guest" | "denied"
  >("checking");
  const [moreOpen, setMoreOpen] = useState(false);
  const [ownerName, setOwnerName] = useState("there");
  const [role, setRole] = useState<AuthRole>("Property Owner");
  const [authOpen, setAuthOpen] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [month, setMonth] = useState(monthKigali);
  const [modal, setModal] = useState<
    "property" | "unit" | "charge" | "payment" | "maintenance" | ""
  >("");
  const [saving, setSaving] = useState(false);
  const [propertyFilter, setPropertyFilter] = useState("");
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
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load the workspace.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
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
    if (session === "allowed") void loadWorkspace(month, propertyFilter);
  }, [session, month, propertyFilter, loadWorkspace]);
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
      await loadWorkspace(month, propertyFilter);
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
  const skipOnboarding = async () => {
    setError("");
    try {
      await umutungoApi("/api/v1/owner/workspace?action=onboarding", {
        method: "POST",
        body: JSON.stringify({ step: 5, complete: true }),
      });
      await loadWorkspace(month, propertyFilter);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save setup progress.",
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
  if (session === "checking")
    return (
      <main className="owner-workspace-access">
        <p>Checking your secure workspace </p>
      </main>
    );
  if (session === "guest" || session === "denied")
    return (
      <main className="owner-workspace-access">
        <section>
          <span className="owner-eyebrow">UMUTUNGO OWNER WORKSPACE</span>
          <h1>
            {session === "denied"
              ? "This workspace is for property owners"
              : "Sign in to manage your properties"}
          </h1>
          <p>
            Your private portfolio, rent and repair records are available after
            the backend confirms your account.
          </p>
          <button className="owner-primary" onClick={() => setAuthOpen(true)}>
            Sign in <Icon name="arrow" size={15} />
          </button>
          <Link href="/">Back to marketplace</Link>
        </section>
        <AuthModal
          open={authOpen}
          role={ownerRoute ? "Property Owner" : "Landlord"}
          onClose={() => setAuthOpen(false)}
          onSuccess={() => {
            setAuthOpen(false);
            window.location.reload();
          }}
        />
      </main>
    );
  return (
    <main className="owner-workspace">
      {" "}
      <aside className="owner-sidebar">
        <Link href="/" className="owner-brand">
          <span>U</span> Umutungo
        </Link>
        <div className="owner-sidebar-label">PROPERTY WORKSPACE</div>
        <nav>
          <a href="#overview" className="is-active">
            <Icon name="home" size={17} />
            Overview
          </a>
          <a href="#properties">
            <Icon name="building" size={17} />
            Properties
          </a>
          <a href="#rent">
            <Icon name="creditCard" size={17} />
            Rent
          </a>
          <a href="/messages">
            <Icon name="users" size={17} />
            Inbox
          </a>
          <button
            className="owner-more-trigger"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((value) => !value)}
          >
            <Icon name="menu" size={17} />
            More <span>{moreOpen ? "?" : "+"}</span>
          </button>
          {moreOpen && (
            <div className="owner-more-menu">
              <Link href="#maintenance">Maintenance and repairs</Link>
              <Link href="#enquiries">Rental enquiries</Link>
              <Link href="/post-property">Create a marketplace listing</Link>
              <Link href="/messages">Messages</Link>
              <Link href="/upgrade/owner">One-time listing upgrades</Link>
            </div>
          )}
        </nav>
        <div className="owner-sidebar-bottom">
          <Link href="/"> Back to marketplace</Link>
          <span>Private owner account</span>
        </div>
      </aside>{" "}
      <section className="owner-main">
        <header className="owner-topbar">
          <div>
            <span>Workspace</span>
            <strong>{role}</strong>
          </div>
          <div>
            <span>RWF · Africa/Kigali</span>
            <span className="owner-avatar">
              {firstName.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>{" "}
        <div className="owner-content" id="overview">
          <div className="owner-welcome">
            <div>
              <span className="owner-eyebrow">
                YOUR PROPERTY, CLEARLY MANAGED
              </span>
              <h1>
                {greeting}, {firstName}
              </h1>
              <p>
                {workspace?.summary.overdue_count
                  ? `${workspace.summary.overdue_count} rent record${workspace.summary.overdue_count === 1 ? "" : "s"} need attention.`
                  : "Here is your portfolio overview for the selected month."}
              </p>
            </div>
            <div className="owner-actions">
              <button
                className="owner-primary"
                onClick={() => setModal("payment")}
              >
                {" "}
                Record payment
              </button>
              <button
                className="owner-secondary"
                onClick={() => setModal("property")}
              >
                {" "}
                Add property
              </button>
            </div>
          </div>{" "}
          <div className="owner-filters">
            <label>
              Reporting month
              <input
                aria-label="Reporting month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </label>
            <label>
              Property
              <select
                aria-label="Filter by property"
                value={propertyFilter}
                onChange={(e) => setPropertyFilter(e.target.value)}
              >
                <option value="">All properties</option>
                {workspace?.properties.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <span>
              Month totals use charges due in the selected period and payments
              allocated to those charges.
            </span>
          </div>{" "}
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
                {!workspace.onboarding.completed && (
                  <section className="owner-panel owner-onboarding">
                    <div className="owner-onboarding-header">
                      <div>
                        <span className="owner-eyebrow">A FEW SIMPLE STEPS</span>
                        <h2>Set up your property workspace</h2>
                        <p>
                          Your progress saves as you go. You can skip these steps
                          and finish later.
                        </p>
                      </div>
                      <span className="owner-onboarding-progress">
                        {workspace.onboarding.step <= 1 ? "STEP 1 OF 2" : "STEP 2 OF 2"}
                      </span>
                    </div>
                    <div className="owner-onboarding-steps">
                      <div className={`owner-onboarding-step ${workspace.onboarding.step > 1 ? "is-complete" : "is-current"}`}>
                        <span className="owner-onboarding-number">01</span>
                        <div className="owner-onboarding-copy">
                          <strong>
                            {workspace.onboarding.step <= 1
                              ? "Add your first property and unit"
                              : "Property added"}
                          </strong>
                          <small>
                            Keep property details private until you choose to
                            publish a marketplace listing.
                          </small>
                        </div>
                        {workspace.onboarding.step <= 1 && (
                          <button className="owner-primary owner-onboarding-action" onClick={() => setModal("property")}>
                            Add property
                          </button>
                        )}
                      </div>
                      <div className={`owner-onboarding-step ${workspace.onboarding.step >= 5 ? "is-complete" : "is-current"}`}>
                        <span className="owner-onboarding-number">02</span>
                        <div className="owner-onboarding-copy">
                          <strong>
                            {workspace.onboarding.step >= 5
                              ? "Tenant and rent charge added"
                              : "Add a tenant and rent charge"}
                          </strong>
                          <small>
                            Create a charge with a due date. You can start
                            recording the rent they owe.
                          </small>
                        </div>
                        {workspace.properties.some(
                          (item) => item.units.length > 0,
                        ) ? (
                          <button className="owner-primary owner-onboarding-action" onClick={() => setModal("charge")}>
                            Add tenant and charge
                          </button>
                        ) : workspace.properties.length > 0 ? (
                          <button className="owner-primary owner-onboarding-action" onClick={() => {
                            setUnitForm({ property_id: workspace.properties[0].id, name: "", monthly_rent: "" });
                            setModal("unit");
                          }}>
                            Add first unit
                          </button>
                        ) : (
                          <button className="owner-primary owner-onboarding-action" onClick={() => setModal("property")}>
                            Add property and unit
                          </button>
                        )}
                      </div>
                    </div>
                    <button
                      className="owner-onboarding-skip"
                      onClick={() => void skipOnboarding()}
                    >
                      Skip setup and open overview
                    </button>
                  </section>
                )}
                <div className="owner-metrics">
                  {[
                    [
                      "Rent expected",
                      workspace.summary.expected,
                      "Total rent charges due this month.",
                    ],
                    [
                      "Rent collected",
                      workspace.summary.collected,
                      "Payments recorded against this month charges.",
                    ],
                    [
                      "Outstanding balance",
                      workspace.summary.balance,
                      "Unpaid balance on this month rent charges.",
                    ],
                    [
                      "Units with rent charges",
                      `${workspace.summary.occupied_units} / ${workspace.summary.total_units}`,
                      "Units with a rent charge this month, compared with all rentable units.",
                    ],
                  ].map(([label, value, hint]) => (
                    <article key={String(label)} className="owner-metric">
                      <span>
                        {label}
                        <span
                          className="owner-tip"
                          title={String(hint)}
                          aria-label={String(hint)}
                        >
                          i
                        </span>
                      </span>
                      <strong>
                        {typeof value === "number" ? money(value) : value}
                      </strong>
                      <small>{hint}</small>
                    </article>
                  ))}
                </div>{" "}
                <section className="owner-panel owner-attention">
                  <div className="owner-panel-heading">
                    <div>
                      <span className="owner-eyebrow">PRIORITY QUEUE</span>
                      <h2>Needs attention</h2>
                    </div>
                    <span className="owner-count">
                      {workspace.summary.overdue_count +
                        workspace.maintenance.filter(
                          (x) =>
                            x.priority === "urgent" && x.status !== "resolved",
                        ).length}{" "}
                      items
                    </span>
                  </div>
                  <div className="owner-attention-grid">
                    {" "}
                    {workspace.rent
                      .filter(
                        (x) =>
                          x.status.includes("overdue") ||
                          x.status === "due_today",
                      )
                      .slice(0, 5)
                      .map((item) => (
                        <div className="owner-attention-item" key={item.id}>
                          <span
                            className={`owner-dot ${item.status.includes("overdue") ? "is-red" : "is-amber"}`}
                          />
                          <div>
                            <strong>
                              {item.status.includes("overdue")
                                ? "Overdue rent"
                                : "Due today"}{" "}
                              {item.tenant_name}
                            </strong>
                            <small>
                              {item.property} {item.unit} {money(item.balance)}
                            </small>
                          </div>
                          <button
                            onClick={() => {
                              setPaymentForm({
                                charge_id: item.id,
                                amount: String(item.balance),
                                method: "cash",
                                reference: "",
                                idempotency_key: crypto.randomUUID(),
                              });
                              setModal("payment");
                            }}
                          >
                            Record
                          </button>
                        </div>
                      ))}{" "}
                    {workspace.maintenance
                      .filter(
                        (x) =>
                          x.priority === "urgent" && x.status !== "resolved",
                      )
                      .slice(0, 3)
                      .map((item) => (
                        <div className="owner-attention-item" key={item.id}>
                          <span className="owner-dot is-red" />
                          <div>
                            <strong>Urgent repair</strong>
                            <small>
                              {item.property || "Property"} {item.description}
                            </small>
                          </div>
                          <a href="#maintenance">Review</a>
                        </div>
                      ))}{" "}
                    {!workspace.summary.overdue_count &&
                      !workspace.maintenance.some(
                        (x) =>
                          x.priority === "urgent" && x.status !== "resolved",
                      ) && (
                        <p className="owner-empty-inline">
                          You re up to date. New rent and repair items will
                          appear here.
                        </p>
                      )}{" "}
                  </div>
                </section>{" "}
                <div className="owner-section-grid">
                  <section className="owner-panel owner-rent-panel" id="rent">
                    <div className="owner-panel-heading">
                      <div>
                        <span className="owner-eyebrow">MONTHLY LEDGER</span>
                        <h2>Rent & payments</h2>
                      </div>
                      <button
                        className="owner-link-button"
                        onClick={() => exportRentCSV(workspace.rent, month)}
                      >
                        Export CSV
                      </button>
                      <button
                        className="owner-link-button"
                        onClick={() => exportRentCSV(workspace.rent, month)}
                      >
                        Export CSV
                      </button>
                      <button
                        className="owner-link-button"
                        onClick={() => setModal("charge")}
                      >
                        {" "}
                        Add rent charge
                      </button>
                    </div>
                    {workspace.rent.length ? (
                      <div className="owner-table-wrap">
                        <table className="owner-table">
                          <thead>
                            <tr>
                              <th>Tenant / unit</th>
                              <th>Due</th>
                              <th>Paid</th>
                              <th>Balance</th>
                              <th>Due date</th>
                              <th>Status</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {workspace.rent.map((item) => (
                              <tr key={item.id}>
                                <td>
                                  <strong>{item.tenant_name}</strong>
                                  <small>
                                    {item.property} {item.unit}
                                  </small>
                                </td>
                                <td>{money(item.amount_due)}</td>
                                <td>{money(item.amount_paid)}</td>
                                <td>{money(item.balance)}</td>
                                <td>{fmtDate(item.due_date)}</td>
                                <td>
                                  <span
                                    className={`owner-status status-${item.status.includes("overdue") ? "overdue" : item.status.replace("partial_", "")}`}
                                  >
                                    {item.status.replace("_", " ")}
                                  </span>
                                </td>
                                <td>
                                  {item.balance > 0 && (
                                    <button
                                      aria-label={`Record payment from ${item.tenant_name}`}
                                      className="owner-row-action"
                                      onClick={() => {
                                        setPaymentForm({
                                          charge_id: item.id,
                                          amount: String(item.balance),
                                          method: "cash",
                                          reference: "",
                                          idempotency_key: crypto.randomUUID(),
                                        });
                                        setModal("payment");
                                      }}
                                    >
                                      Record
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="owner-empty">
                        <strong>No rent charges for {month}</strong>
                        <span>
                          Add a tenant s charge to begin tracking balances.
                          Nothing is counted as income until a payment is
                          recorded.
                        </span>
                        <button onClick={() => setModal("charge")}>
                          Add rent charge
                        </button>
                      </div>
                    )}
                  </section>{" "}
                  <section
                    className="owner-panel owner-portfolio"
                    id="properties"
                  >
                    <div className="owner-panel-heading">
                      <div>
                        <span className="owner-eyebrow">PRIVATE PORTFOLIO</span>
                        <h2>Properties & units</h2>
                      </div>
                      <button
                        className="owner-link-button"
                        onClick={() => setModal("property")}
                      >
                        {" "}
                        Add
                      </button>
                    </div>
                    {workspace.properties.length ? (
                      workspace.properties.map((property) => (
                        <article
                          className="owner-property-card"
                          key={property.id}
                        >
                          <div className="owner-property-monogram">
                            {property.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <strong>{property.name}</strong>
                            <small>
                              {property.sector}, {property.district}
                            </small>
                            <span>
                              {property.occupied_units} of {property.unit_count}{" "}
                              units with rent records
                            </span>
                            <button
                              className="owner-link-button"
                              onClick={() => {
                                setUnitForm({ property_id: property.id, name: "", monthly_rent: "" });
                                setModal("unit");
                              }}
                            >
                              Add unit
                            </button>
                          </div>
                          <span className="owner-property-count">
                            {property.unit_count} units
                          </span>
                        </article>
                      ))
                    ) : (
                      <div className="owner-empty">
                        <strong>Your portfolio starts here</strong>
                        <span>
                          Add a property and units for private management. This
                          does not publish a marketplace listing.
                        </span>
                        <button onClick={() => setModal("property")}>
                          Add first property
                        </button>
                      </div>
                    )}
                  </section>
                </div>{" "}
                <div className="owner-section-grid owner-lower-grid">
                  <section className="owner-panel" id="maintenance">
                    <div className="owner-panel-heading">
                      <div>
                        <span className="owner-eyebrow">PROPERTY CARE</span>
                        <h2>Maintenance</h2>
                      </div>
                      <button
                        className="owner-link-button"
                        onClick={() => setModal("maintenance")}
                      >
                        {" "}
                        New request
                      </button>
                    </div>
                    {workspace.maintenance.length ? (
                      workspace.maintenance.map((item) => (
                        <article className="owner-repair-row" key={item.id}>
                          <span
                            className={`owner-priority priority-${item.priority}`}
                          >
                            {item.priority}
                          </span>
                          <div>
                            <strong>{item.description}</strong>
                            <small>
                              {item.property} {item.unit && `  ${item.unit}`}
                            </small>
                          </div>
                          <select
                            className="owner-repair-status"
                            aria-label="Repair status"
                            value={item.status}
                            onChange={(event) =>
                              void updateRepair(item.id, event.target.value)
                            }
                          >
                            <option value="submitted">Submitted</option>
                            <option value="in_progress">In progress</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </article>
                      ))
                    ) : (
                      <div className="owner-empty">
                        <strong>No repair requests</strong>
                        <span>
                          Requests you add will stay visible with their priority
                          and progress.
                        </span>
                        <button onClick={() => setModal("maintenance")}>
                          Create request
                        </button>
                      </div>
                    )}
                  </section>{" "}
                  <section className="owner-panel" id="portfolio">
                    <div className="owner-panel-heading">
                      <div>
                        <span className="owner-eyebrow">ACCOUNT</span>
                        <h2>Workspace setup</h2>
                      </div>
                    </div>
                    <div className="owner-setup-row">
                      <span className="owner-setup-check"> </span>
                      <div>
                        <strong>Owner workspace is ready</strong>
                        <small>
                          Property management can be private and does not create
                          a public listing.
                        </small>
                      </div>
                    </div>
                    <div className="owner-setup-row">
                      <span className="owner-setup-pending"> </span>
                      <div>
                        <strong>Subscription billing</strong>
                        <small>
                          {workspace.billing.configured
                            ? "Configured"
                            : "Not configured"}{" "}
                          no subscription charge will be made here.
                        </small>
                      </div>
                    </div>
                    <Link className="owner-muted-link" href="/upgrade/owner">
                      View existing one-time listing upgrades <span> </span>
                    </Link>
                  </section>
                </div>
                <section className="owner-panel owner-enquiries" id="enquiries">
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
                <p className="owner-footnote">
                  Payments shown here are records entered by you. Record payment
                  does not collect money through MTN MoMo, Airtel Money or a
                  bank.
                </p>{" "}
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
              {" "}
            </button>
            <span className="owner-eyebrow">OWNER WORKSPACE</span>
            <h2 id="owner-modal-title">
              {modal === "property"
                ? "Add a private property"
                : modal === "unit"
                  ? "Add a unit"
                : modal === "charge"
                  ? "Add a rent charge"
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
                    Amount due (RWF)
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
                    Due date
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
              {modal === "payment" && (
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
                      {workspace?.rent
                        .filter((x) => x.balance > 0)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.tenant_name} {x.unit} {money(x.balance)}{" "}
                            remaining
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
              <button
                className="owner-primary owner-submit"
                type="submit"
                disabled={saving}
              >
                {saving ? "Saving   " : "Save"}
              </button>{" "}
            </form>
          </section>
        </div>
      )}{" "}
    </main>
  );
}
