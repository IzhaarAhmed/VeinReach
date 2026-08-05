import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setAccessToken } from '../lib/api.js';
import { disablePush } from '../lib/push.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, try to restore a session via the refresh cookie.
  useEffect(() => {
    (async () => {
      try {
        const r = await api.post('/auth/refresh');
        setAccessToken(r.data?.data?.accessToken);
        const me = await api.get('/auth/me');
        setUser(me.data?.data?.user);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const r = await api.post('/auth/login', { email, password });
    setAccessToken(r.data?.data?.accessToken);
    setUser(r.data?.data?.user);
    return r.data?.data?.user;
  }, []);

  const register = useCallback(async (payload) => {
    const r = await api.post('/auth/register', payload);
    setAccessToken(r.data?.data?.accessToken);
    setUser(r.data?.data?.user);
    return r.data?.data?.user;
  }, []);

  const logout = useCallback(async () => {
    await disablePush(); // detach this device's push token before the session ends
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  /** Re-fetch the profile after a server-side change (e.g. availability toggle). */
  const refreshUser = useCallback(async () => {
    const me = await api.get('/auth/me');
    setUser(me.data?.data?.user);
    return me.data?.data?.user;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
