import { apiClient, type ApiResponse } from '../../../shared/api/apiClient';
import type {
  AuthResponse,
  ChangePasswordPayload,
  LoginPayload,
  UserProfile,
} from '../types/auth.types';

export const authApi = {
  async initCsrf(): Promise<void> {
    await apiClient.get('/core/auth/csrf');
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    const res = await apiClient.post<ApiResponse<AuthResponse>>('/core/auth/login', payload);
    return res.data.data;
  },

  async refresh(): Promise<AuthResponse> {
    await authApi.initCsrf();
    const res = await apiClient.post<ApiResponse<AuthResponse>>('/core/auth/refresh', {});
    return res.data.data;
  },

  async logout(): Promise<void> {
    await authApi.initCsrf();
    await apiClient.post('/core/auth/logout', {});
  },

  async changePassword(payload: ChangePasswordPayload): Promise<string> {
    const res = await apiClient.post<ApiResponse<null>>('/core/auth/change-password', payload);
    return res.data.message;
  },

  async me(): Promise<UserProfile> {
    const res = await apiClient.get<ApiResponse<UserProfile>>('/core/auth/me');
    return res.data.data;
  },
};

