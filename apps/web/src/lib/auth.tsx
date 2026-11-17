import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, refreshSession, setAccessToken, setSessionLostHandler } from './api';
import type { Profile } from './types';

interface AuthState {
  user: Profile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ mfaToken?: string }>;
  verifyMfa: (mfaToken: string, code: string) => Promise<void>;
  demo: () => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  can: (perm: string) => boolean;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSessionLostHandler(() => {
      setAccessToken(null);
      setUser(null);
    });
    refreshSession()
      .then((d) => setUser(d?.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const accept = (d: { accessToken: string; user: Profile }) => {
    setAccessToken(d.accessToken);
    setUser(d.user);
  };

  const login = useCallback(async (email: string, password: string) => {
    const d = await api('/auth/login', { method: 'POST', json: { email, password } });
    if (d.mfaRequired) return { mfaToken: d.mfaToken as string };
    accept(d);
    return {};
  }, []);

  const verifyMfa = useCallback(async (mfaToken: string, code: string) => accept(await api('/auth/mfa/verify', { method: 'POST', json: { mfaToken, code } })), []);
  const demo = useCallback(async () => accept(await api('/auth/demo', { method: 'POST' })), []);
  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setAccessToken(null);
    setUser(null);
  }, []);
  const reload = useCallback(async () => setUser(await api<Profile>('/auth/me')), []);
  const can = useCallback((perm: string) => Boolean(user?.permissions.includes(perm)), [user]);

  return <Ctx.Provider value={{ user, loading, login, verifyMfa, demo, logout, reload, can }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fuera de AuthProvider');
  return c;
}
