import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { decideApplication, listApplications, listOwnerListings } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/ThemeContext';
import type { ApiApplication, ApiListing } from '@/api/types';

type OwnerSummary = { listings: number; active_listings: number; pending_applications: number; active_tenants: number };
type TenantSummary = { properties: Array<{ title: string; rent_amount: number; currency: string; status: string; due_day: number }>; applications: ApiApplication[]; payments: Array<{ amount: number; currency: string; status: string; created_at: string }>; messages: unknown[]; reviews: unknown[] };
type AdminSummary = { items: Array<{ activity_type: string; summary: string; actor_name: string; created_at: string }> };
type AdminReport = { id: string; listing_title: string; reporter_name: string; reason: string; details: string; status: string };

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { getStoredToken, getApiBaseUrl } = await import('@/api/client');
  const token = await getStoredToken();
  const response = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const { colors, styles } = useTheme();
  const router = useRouter();
  const [applications, setApplications] = useState<ApiApplication[]>([]);
  const [listings, setListings] = useState<ApiListing[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [tenantData, setTenantData] = useState<TenantSummary | null>(null);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      const role = user?.role;
      if (!role) return;
      if (role === 'admin') {
        const [activity, reportResult] = await Promise.all([api<AdminSummary>('/api/v1/admin/activities?limit=12'), api<{ items: AdminReport[]; summary: Record<string, number> }>('/api/v1/admin/reports')]);
        setSummary({ activity: activity.items, reports: reportResult.summary }); setReports(reportResult.items);
      } else if (role === 'property_owner' || role === 'komisiyoneri') {
        const [owner, ownListings, apps] = await Promise.all([api<OwnerSummary>('/api/v1/owner/dashboard'), listOwnerListings(), listApplications()]);
        setSummary(owner); setListings(ownListings.items); setApplications(apps.items);
      } else {
        const tenant = await api<TenantSummary>('/api/v1/tenant/dashboard');
        setTenantData(tenant);
        setSummary({ properties: tenant.properties, applications: tenant.applications.length, active_agreements: tenant.properties.filter((item) => item.status === 'active').length, payments: tenant.payments.length, conversations: tenant.messages.length });
        setApplications(tenant.applications);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Dashboard data could not be loaded.'); }
    finally { setBusy(false); }
  }, [user]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const metric = (label: string, value: unknown) => <View key={label} style={[styles.card, { flex: 1, minWidth: '44%', gap: 5 }]}><Text style={styles.muted}>{label}</Text><Text style={styles.title}>{String(value ?? 0)}</Text></View>;
  const act = async (application: ApiApplication, decision: 'accepted' | 'rejected') => { try { await decideApplication(application.id, decision); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update application.'); } };
  const reviewReport = async (report: AdminReport, status: 'reviewing' | 'resolved' | 'dismissed') => { try { await api(`/api/v1/admin/reports/${encodeURIComponent(report.id)}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update report.'); } };
  return <ScrollView style={styles.screen} contentContainerStyle={styles.safeContent} refreshControl={<RefreshControl refreshing={busy} onRefresh={() => { setBusy(true); void load(); }} />}>
    <Text style={styles.brand}>UMUTUNGO WORKSPACE</Text><Text style={styles.title}>{!user ? 'Join Umutungo' : user.role === 'admin' ? 'Admin dashboard' : user.role === 'tenant' || user.role === 'client' ? 'Tenant and client dashboard' : 'Owner dashboard'}</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {!user ? <><Text style={styles.body}>Sign in to open your dashboard, or create an account as a client, tenant, property owner, or Komisiyoneri.</Text><Pressable style={styles.button} onPress={() => router.push('/auth/sign-in')}><Text style={styles.buttonText}>Sign in</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => router.push('/auth/register')}><Text style={styles.secondaryText}>Create an account</Text></Pressable></> : user.role === 'admin' ? <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{Object.entries((summary.reports as object) || {}).map(([key, value]) => metric(`${key} reports`, value))}</View>
      <Text style={styles.heading}>Moderation reports</Text>{reports.map((item) => <View key={item.id} style={[styles.card, { gap: 6 }]}><Text style={styles.heading}>{item.listing_title || item.reason}</Text><Text style={styles.body}>{item.details || item.reason}</Text><Text style={styles.muted}>{item.reporter_name} · {item.status}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{(['reviewing', 'resolved', 'dismissed'] as const).map((status) => <Pressable key={status} style={styles.secondaryButton} onPress={() => void reviewReport(item, status)}><Text style={styles.secondaryText}>{status}</Text></Pressable>)}</View></View>)}
      <Text style={styles.heading}>Recent activity</Text>{((summary.activity as AdminSummary['items']) || []).map((item, i) => <View key={`${item.created_at}-${i}`} style={[styles.card, { gap: 4 }]}><Text style={styles.heading}>{item.summary}</Text><Text style={styles.muted}>{item.actor_name} · {item.activity_type}</Text></View>)}
    </> : <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{Object.entries(summary).filter(([key, value]) => typeof value === 'number').map(([key, value]) => metric(key.replaceAll('_', ' '), value))}</View>
      {(user?.role === 'property_owner' || user?.role === 'komisiyoneri') && <><Pressable style={styles.button} onPress={() => router.push('/listing/new')}><Text style={styles.buttonText}>Post a property</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => router.push('/owner-upgrade' as never)}><Text style={styles.secondaryText}>Owner plans · MTN MoMo</Text></Pressable><Text style={styles.heading}>My properties</Text>{listings.map((item) => <Pressable key={item.id} onPress={() => router.push({ pathname: '/property/[id]', params: { id: item.id } })} style={[styles.card, { gap: 4 }]}><Text style={styles.heading}>{item.title}</Text><Text style={styles.muted}>{item.status} · {item.price} {item.currency}</Text></Pressable>)}<Text style={styles.heading}>Applications</Text>{applications.map((item) => <View key={item.id} style={[styles.card, { gap: 7 }]}><Text style={styles.heading}>{item.listing_title}</Text><Text style={styles.body}>{item.applicant_name}: {item.message}</Text><Text style={styles.muted}>Status: {item.status}</Text>{item.status === 'pending' && <View style={{ flexDirection: 'row', gap: 8 }}><Pressable style={[styles.button, { flex: 1 }]} onPress={() => void act(item, 'accepted')}><Text style={styles.buttonText}>Accept</Text></Pressable><Pressable style={[styles.secondaryButton, { flex: 1 }]} onPress={() => void act(item, 'rejected')}><Text style={styles.secondaryText}>Decline</Text></Pressable></View>}</View>)}</>}
      {(user?.role === 'tenant' || user?.role === 'client') && <><Text style={styles.heading}>My rental applications</Text>{applications.map((item) => <View key={item.id} style={[styles.card, { gap: 5 }]}><Text style={styles.heading}>{item.listing_title}</Text><Text style={styles.body}>{item.status}</Text><Text style={styles.muted}>{item.message}</Text></View>)}<Text style={styles.heading}>Current rentals</Text>{((tenantData?.properties) || []).map((item, i) => <View key={`${item.title}-${i}`} style={[styles.card, { gap: 4 }]}><Text style={styles.heading}>{item.title}</Text><Text style={styles.body}>{item.rent_amount.toLocaleString()} {item.currency} · due day {item.due_day}</Text><Text style={styles.muted}>{item.status}</Text></View>)}<Text style={styles.heading}>Payments</Text>{(tenantData?.payments || []).map((item, i) => <View key={`${item.created_at}-${i}`} style={[styles.card, { gap: 4 }]}><Text style={styles.heading}>{item.amount.toLocaleString()} {item.currency}</Text><Text style={styles.muted}>{item.status} · {new Date(item.created_at).toLocaleDateString()}</Text></View>)}</>}
    </>}
    <Pressable style={styles.secondaryButton} onPress={() => router.push('/messages')}><Text style={styles.secondaryText}>Open messages</Text></Pressable>
  </ScrollView>;
}
