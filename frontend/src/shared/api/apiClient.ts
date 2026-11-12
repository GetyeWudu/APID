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

let refreshInFlight: Promise<string | null> | null = null;
let onUnauthorizedCallback: (() => void) | null = null;
let onForbiddenCallback: (() => void) | null = null;

export function registerUnauthorizedHandler(cb: () => void): void {
  onUnauthorizedCallback = cb;
}

export function registerForbiddenHandler(cb: () => void): void {
  onForbiddenCallback = cb;
}

async function performSilentRefresh(): Promise<string | null> {
  try {
    // Ensure CSRF cookie is present before cookie-authenticated refresh POST
    await axios.get('/api/v1/core/auth/csrf', { withCredentials: true });
    const res = await axios.post<ApiResponse<{ accessToken: string }>>(
      '/api/v1/core/auth/refresh',
      {},
      {
        withCredentials: true,
        xsrfCookieName: 'XSRF-TOKEN',
        xsrfHeaderName: 'X-XSRF-TOKEN',
      }
    );
    const nextToken = res.data.data.accessToken;
    setAccessToken(nextToken);
    return nextToken;
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
    if (!refreshInFlight) {
      refreshInFlight = performSilentRefresh().finally(() => {
        refreshInFlight = null;
      });
    }

    const refreshedToken = await refreshInFlight;
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
