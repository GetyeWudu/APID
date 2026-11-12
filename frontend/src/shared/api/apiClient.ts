import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface ApiErrorPayload {
  success: false;
  errorCode: string;
  message: string;
  fieldErrors?: Record<string, string>;
  timestamp: string;
}

// Access token kept strictly in memory (never localStorage) to mitigate XSS token theft
let inMemoryAccessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export const apiClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  if (inMemoryAccessToken) {
    config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
  }
  return config;
});

let refreshInFlight: Promise<unknown> | null = null;
let lastSilentRefresh: { payload: unknown; expiresAt: number } | null = null;
let onUnauthorizedCallback: (() => void) | null = null;
let onForbiddenCallback: (() => void) | null = null;

export function clearRefreshSessionCache(): void {
  lastSilentRefresh = null;
}

export function registerUnauthorizedHandler(cb: () => void): void {
  onUnauthorizedCallback = cb;
}

export function registerForbiddenHandler(cb: () => void): void {
  onForbiddenCallback = cb;
}

export async function fetchCsrfToken(): Promise<string | undefined> {
  const res = await axios.get<ApiResponse<string>>('/api/v1/core/auth/csrf', {
    withCredentials: true,
  });
  return res.data?.data;
}

export async function performSingleFlightRefresh<T = { accessToken: string }>(
  allowRecentReuse = false
): Promise<T> {
  if (allowRecentReuse && lastSilentRefresh && Date.now() < lastSilentRefresh.expiresAt) {
    return lastSilentRefresh.payload as T;
  }

  if (refreshInFlight) {
    return refreshInFlight as Promise<T>;
  }

  const run = (async () => {
    const csrfToken = await fetchCsrfToken();
    const res = await axios.post<ApiResponse<T>>(
      '/api/v1/core/auth/refresh',
      {},
      {
        withCredentials: true,
        xsrfCookieName: 'XSRF-TOKEN',
        xsrfHeaderName: 'X-XSRF-TOKEN',
        headers: csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : undefined,
      }
    );
    const payload = res.data.data;
    const token = (payload as { accessToken?: string })?.accessToken;
    if (token) {
      setAccessToken(token);
    }
    // Brief grace cache protects React 18 StrictMode double-mount from rotating the same cookie twice
    lastSilentRefresh = { payload, expiresAt: Date.now() + 500 };
    return payload;
  })()
    .catch((err) => {
      lastSilentRefresh = null;
      throw err;
    })
    .finally(() => {
      if (refreshInFlight === run) {
        refreshInFlight = null;
      }
    });

  refreshInFlight = run;
  return run;
}

async function performSilentRefresh(): Promise<string | null> {
  try {
    const payload = await performSingleFlightRefresh<{ accessToken: string }>(false);
    return payload.accessToken ?? null;
  } catch {
    setAccessToken(null);
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 403 && onForbiddenCallback) {
      onForbiddenCallback();
    }
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const url = originalRequest.url ?? '';
    if (url.includes('/core/auth/login') || url.includes('/core/auth/refresh')) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    const refreshedToken = await performSilentRefresh();
    if (!refreshedToken) {
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
      return Promise.reject(error);
    }

    originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
    return apiClient(originalRequest);
  }
);
