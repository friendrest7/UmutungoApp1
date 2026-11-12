"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "./Icons";
import { listFavorites, removeFavorite, umutungoApi, type ApiNotification, type FavoriteItem } from "../lib/umutungoApi";
import { usePersistentTheme } from "../lib/theme";
import styles from "./LandlordPortal.module.css";

export type WorkspaceAlert = { id: string; tone: "danger" | "warning"; title: string; detail: string; page: string };

type Props = {
  name: string;
  role: string;
  alerts: WorkspaceAlert[];
  onNavigate: (page: string) => void;
  onSearch: (query: string) => void;
  onSignOut: () => void;
  inAppPlan?: boolean;
};

const FAVORITES_KEY = "umutungo-favorites";
const relativeTime = (value: string) => {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days} d ago` : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(value));
};

function readStoredFavorites(): FavoriteItem[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

/** Closes a dropdown on outside click or Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) close(); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open, close]);
  return ref;
}

function Dropdown({ title, action, children, wide = false }: { title: string; action?: ReactNode; children: ReactNode; wide?: boolean }) {
  return <div className={`${styles.dropdown} ${wide ? styles.dropdownWide : ""}`} role="dialog" aria-label={title}>
    <div className={styles.dropdownHead}><strong>{title}</strong>{action}</div>
    <div className={styles.dropdownBody}>{children}</div>
  </div>;
}

export function WorkspaceTopbar({ name, role, alerts, onNavigate, onSearch, onSignOut, inAppPlan = false }: Props) {
  const { darkMode, toggleTheme } = usePersistentTheme();
  const [open, setOpen] = useState<"" | "favorites" | "notifications" | "account">("");
  const close = useCallback(() => setOpen(""), []);
  const ref = useDismiss(open !== "", close);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const local = readStoredFavorites();
      try {
        const remote = await listFavorites();
        if (!cancelled) setFavorites(remote ?? local);
      } catch {
        if (!cancelled) setFavorites(local);
      }
    };
    void load();
    const refresh = () => { void load(); };
    window.addEventListener("umutungo:favorites-changed", refresh);
    return () => { cancelled = true; window.removeEventListener("umutungo:favorites-changed", refresh); };
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const result = await umutungoApi<{ items: ApiNotification[] }>("/api/v1/notifications");
      if (result?.items) setNotifications(result.items);
    } catch {
      // Keep the last list if the API is briefly unavailable.
    }
  }, []);
  useEffect(() => {
    void loadNotifications();
    const timer = window.setInterval(() => void loadNotifications(), 30000);
    window.addEventListener("umutungo:notifications-changed", loadNotifications);
    return () => { window.clearInterval(timer); window.removeEventListener("umutungo:notifications-changed", loadNotifications); };
  }, [loadNotifications]);

  const unread = notifications.filter((item) => !item.read_at);
  const badge = unread.length + alerts.length;
  const markRead = async (id?: string) => {
    setNotifications((items) => items.map((item) => (!id || item.id === id) && !item.read_at ? { ...item, read_at: new Date().toISOString() } : item));
    try { await umutungoApi(`/api/v1/notifications/${id ? encodeURIComponent(id) : "read-all"}`, { method: "PATCH" }); } catch { void loadNotifications(); }
  };
  const unsave = (propertyId: string) => {
    const next = favorites.filter((item) => item.property_id !== propertyId);
    setFavorites(next);
    try { window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(readStoredFavorites().filter((item) => item.property_id !== propertyId))); } catch { /* storage unavailable */ }
    window.dispatchEvent(new Event("umutungo:favorites-changed"));
    void removeFavorite(propertyId).catch(() => undefined);
  };
  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(query.trim());
  };
  const toggle = (panel: typeof open) => setOpen((current) => current === panel ? "" : panel);

  return <header className={styles.topbar}>
    <form className={styles.topSearch} role="search" onSubmit={search}>
      <Icon name="search" size={15} />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tenants" aria-label="Search tenants" />
      <kbd>Enter</kbd>
    </form>
    <div className={styles.topActions} ref={ref}>
      <Link className={styles.topLink} href="/categories/properties"><Icon name="globe" size={16} /><span>Marketplace</span></Link>
      <Link className={styles.topIcon} href="/messages" title="Messages" aria-label="Messages"><Icon name="mail" size={18} /></Link>

      <div className={styles.topItem}>
        <button type="button" className={styles.topIcon} title="Saved houses" aria-label={`Saved houses, ${favorites.length}`} aria-expanded={open === "favorites"} onClick={() => toggle("favorites")}>
          <Icon name="heart" size={18} />{favorites.length > 0 && <span className={styles.topCount}>{favorites.length > 99 ? "99+" : favorites.length}</span>}
        </button>
        {open === "favorites" && <Dropdown title="Saved houses" action={<Link className={styles.textLink} href="/categories/properties" onClick={close}>Browse</Link>} wide>
          {favorites.length === 0 ? <p className={styles.dropdownEmpty}>Houses you like on the marketplace will be saved here.</p> :
            <ul className={styles.dropdownList}>{favorites.map((item) => <li key={item.property_id} className={styles.favoriteItem}>
              <Link href={`/property/${encodeURIComponent(item.property_id)}`} onClick={close} className={styles.favoriteLink}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image || "/properties/listing-placeholder.svg"} alt="" />
                <span><strong>{item.title}</strong><small>{[item.location, item.price].filter(Boolean).join(" · ")}</small></span>
              </Link>
              <button type="button" className={styles.iconButton} title="Remove" aria-label={`Remove ${item.title} from saved houses`} onClick={() => unsave(item.property_id)}><Icon name="x" size={14} /></button>
            </li>)}</ul>}
        </Dropdown>}
      </div>

      <div className={styles.topItem}>
        <button type="button" className={styles.topIcon} title="Notifications" aria-label={`Notifications, ${badge} new`} aria-expanded={open === "notifications"} onClick={() => toggle("notifications")}>
          <Icon name="bell" size={18} />{badge > 0 && <span className={`${styles.topCount} ${styles.topCountAlert}`}>{badge > 99 ? "99+" : badge}</span>}
        </button>
        {open === "notifications" && <Dropdown title="Notifications" action={unread.length > 0 && <button type="button" className={styles.textLink} onClick={() => void markRead()}>Mark all as read</button>} wide>
          {alerts.length > 0 && <>
            <p className={styles.dropdownLabel}>Needs attention</p>
            <ul className={styles.dropdownList}>{alerts.map((alert) => <li key={alert.id}>
              <button type="button" className={styles.notification} onClick={() => { onNavigate(alert.page); close(); }}>
                <span className={`${styles.dot} ${alert.tone === "danger" ? styles.dotDanger : styles.dotWarning}`} aria-hidden="true" />
                <span><strong>{alert.title}</strong><small>{alert.detail}</small></span>
              </button>
            </li>)}</ul>
          </>}
          <p className={styles.dropdownLabel}>Account</p>
          {notifications.length === 0 ? <p className={styles.dropdownEmpty}>No notifications yet.</p> :
            <ul className={styles.dropdownList}>{notifications.slice(0, 8).map((item) => <li key={item.id}>
              <button type="button" className={`${styles.notification} ${item.read_at ? styles.notificationRead : ""}`} onClick={() => void markRead(item.id)}>
                <span className={`${styles.dot} ${item.read_at ? "" : styles.dotAccent}`} aria-hidden="true" />
                <span><strong>{item.title}</strong><small>{item.body}</small><time>{relativeTime(item.created_at)}</time></span>
              </button>
            </li>)}</ul>}
        </Dropdown>}
      </div>

      <div className={styles.topItem}>
        <button type="button" className={styles.topAccount} aria-label="Account menu" aria-expanded={open === "account"} onClick={() => toggle("account")}>
          <span className={styles.avatar}>{name.slice(0, 1).toUpperCase()}</span>
          <span className={styles.topAccountText}><strong>{name}</strong><small>{role}</small></span>
          <Icon name="chevron" size={14} />
        </button>
        {open === "account" && <div className={styles.menu} role="menu">
          <div className={styles.menuHead}><strong>{name}</strong><small>{role} account</small></div>
          <button type="button" role="menuitem" onClick={() => { onNavigate("Settings"); close(); }}><Icon name="user" size={16} /> Settings</button>
          <Link role="menuitem" href="/messages" onClick={close}><Icon name="mail" size={16} /> Messages</Link>
          {inAppPlan ? <button type="button" role="menuitem" onClick={() => { onNavigate("Plan"); close(); }}><Icon name="sparkles" size={16} /> Plan & billing</button> : <Link role="menuitem" href="/upgrade/owner" onClick={close}><Icon name="sparkles" size={16} /> Plans & upgrades</Link>}
          <button type="button" role="menuitemcheckbox" aria-checked={darkMode} onClick={toggleTheme}><Icon name={darkMode ? "sun" : "moon"} size={16} /> {darkMode ? "Light mode" : "Dark mode"}</button>
          <hr />
          <button type="button" role="menuitem" onClick={onSignOut}><Icon name="arrow" size={16} /> Sign out</button>
        </div>}
      </div>
    </div>
  </header>;
}
