import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(clearSession);

    // Attempt silent session hydration via HttpOnly refresh cookie on initial page load
    authApi
      .refresh()
      .then((res) => {
        setAccessToken(res.accessToken);
        setUser(res.user);
      })
      .catch(() => {
        clearSession();
      })
      .finally(() => {
        setLoading(false);
      });
  }, [clearSession]);

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
      // Force reauthentication after password change
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
      hasPermission,
      hasAnyPermission,
    }),
    [user, loading, login, logout, changePassword, hasPermission, hasAnyPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}

