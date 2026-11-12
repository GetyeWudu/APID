import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '../features/auth/api/authApi';
import type {
  ChangePasswordPayload,
  LoginPayload,
  UserProfile,
} from '../features/auth/types/auth.types';
import {
  clearRefreshSessionCache,
  getAccessToken,
  registerForbiddenHandler,
  registerUnauthorizedHandler,
  setAccessToken,
} from '../shared/api/apiClient';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<UserProfile>;
  logout: () => Promise<void>;
  changePassword: (payload: ChangePasswordPayload) => Promise<string>;
  refreshProfile: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const lastSyncRef = useRef<number>(0);

  const clearSession = useCallback(() => {
    clearRefreshSessionCache();
    setAccessToken(null);
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!getAccessToken()) return;
    const now = Date.now();
    if (now - lastSyncRef.current < 1500) return;
    lastSyncRef.current = now;
    try {
      const latest = await authApi.me();
      setUser(latest);
    } catch {
      // Unauthorized errors are handled by apiClient interceptor
    }
  }, []);

  useEffect(() => {
    let active = true;
    registerUnauthorizedHandler(clearSession);
    registerForbiddenHandler(() => {
      void refreshProfile();
    });

    authApi
      .refresh()
      .then((res) => {
        setAccessToken(res.accessToken);
        if (active) {
          setUser(res.user);
        }
      })
      .catch(() => {
        if (active) {
          clearSession();
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [clearSession, refreshProfile]);

  const login = useCallback(async (payload: LoginPayload) => {
    const res = await authApi.login(payload);
    setAccessToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const changePassword = useCallback(
    async (payload: ChangePasswordPayload) => {
      const message = await authApi.changePassword(payload);
      clearSession();
      return message;
    },
    [clearSession]
  );

  const hasPermission = useCallback(
    (code: string) => {
      if (!user || user.mustChangePassword) return false;
      return user.permissions.includes(code);
    },
    [user]
  );

  const hasAnyPermission = useCallback(
    (codes: string[]) => {
      if (!user || user.mustChangePassword) return false;
      return codes.some((c) => user.permissions.includes(c));
    },
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: user !== null,
      login,
      logout,
      changePassword,
      refreshProfile,
      hasPermission,
      hasAnyPermission,
    }),
    [user, loading, login, logout, changePassword, refreshProfile, hasPermission, hasAnyPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
