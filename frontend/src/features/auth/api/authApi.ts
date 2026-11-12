import {
  apiClient,
  clearRefreshSessionCache,
  fetchCsrfToken,
  performSingleFlightRefresh,
  type ApiResponse,
} from '../../../shared/api/apiClient';
import type {
  AuthResponse,
  ChangePasswordPayload,
  LoginPayload,
  UserProfile,
} from '../types/auth.types';

export const authApi = {
  async initCsrf(): Promise<string | undefined> {
    return fetchCsrfToken();
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    clearRefreshSessionCache();
    const res = await apiClient.post<ApiResponse<AuthResponse>>('/core/auth/login', payload);
    return res.data.data;
  },

  async refresh(): Promise<AuthResponse> {
    return performSingleFlightRefresh<AuthResponse>(true);
  },

  async logout(): Promise<void> {
    clearRefreshSessionCache();
    const csrfToken = await fetchCsrfToken();
    await apiClient.post(
      '/core/auth/logout',
      {},
      { headers: csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : undefined }
    );
  },

  async changePassword(payload: ChangePasswordPayload): Promise<string> {
    clearRefreshSessionCache();
    const res = await apiClient.post<ApiResponse<null>>('/core/auth/change-password', payload);
    return res.data.message;
  },

  async me(): Promise<UserProfile> {
    const res = await apiClient.get<ApiResponse<UserProfile>>('/core/auth/me');
    return res.data.data;
  },
};

