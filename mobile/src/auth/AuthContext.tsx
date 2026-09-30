import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { clearStoredToken, getMe, getStoredToken } from '../api/client';
import type { ApiProfile, ApiUser } from '../api/types';

type AuthContextValue = { user: ApiUser | null; profile: ApiProfile | null; loading: boolean; refresh: () => Promise<void>; signOut: () => Promise<void>; setUser: (user: ApiUser) => void; setProfile: (profile: ApiProfile | null) => void };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    try {
      if (!(await getStoredToken())) { setUser(null); setProfile(null); return; }
      const result = await getMe();
      setUser(result.user);
      setProfile(result.profile);
    } catch {
      await clearStoredToken();
      setUser(null);
      setProfile(null);
    } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  const value = useMemo(() => ({ user, profile, loading, refresh, signOut: async () => { await clearStoredToken(); setUser(null); setProfile(null); }, setUser, setProfile }), [user, profile, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
