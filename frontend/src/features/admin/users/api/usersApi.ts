import { apiClient, type ApiResponse } from '../../../../shared/api/apiClient';
import type {
  AdminUser,
  CreateUserPayload,
  CreateUserResult,
  PageResponse,
  PasswordResetResult,
  UserStatus,
} from '../types/users.types';

export const usersApi = {
  async search(params: {
    search?: string;
    status?: UserStatus | '';
    authProvider?: string | '';
    roleId?: number | '';
    page?: number;
    size?: number;
  }): Promise<PageResponse<AdminUser>> {
    const res = await apiClient.get<ApiResponse<PageResponse<AdminUser>>>('/core/admin/users', {
      params: {
        search: params.search || undefined,
        status: params.status || undefined,
        authProvider: params.authProvider || undefined,
        roleId: params.roleId || undefined,
        page: params.page ?? 0,
        size: params.size ?? 15,
      },
    });
    return res.data.data;
  },

  async create(payload: CreateUserPayload): Promise<CreateUserResult> {
    const res = await apiClient.post<ApiResponse<CreateUserResult>>('/core/admin/users', payload);
    return res.data.data;
  },

  async updateStatus(userId: number, status: UserStatus, reason?: string): Promise<AdminUser> {
    const res = await apiClient.patch<ApiResponse<AdminUser>>(`/core/admin/users/${userId}/status`, {
      status,
      reason,
    });
    return res.data.data;
  },

  async unlock(userId: number): Promise<AdminUser> {
    const res = await apiClient.post<ApiResponse<AdminUser>>(`/core/admin/users/${userId}/unlock`);
    return res.data.data;
  },

  async resetPassword(userId: number): Promise<PasswordResetResult> {
    const res = await apiClient.post<ApiResponse<PasswordResetResult>>(
      `/core/admin/users/${userId}/reset-password`
    );
    return res.data.data;
  },

  async updateRoles(userId: number, roleIds: number[]): Promise<AdminUser> {
    const res = await apiClient.put<ApiResponse<AdminUser>>(`/core/admin/users/${userId}/roles`, {
      roleIds,
    });
    return res.data.data;
  },

  async syncLdap(): Promise<{
    success: boolean;
    message: string;
    usersScanned: number;
    usersCreated: number;
    usersUpdated: number;
    usersDisabled: number;
    managersLinked: number;
    rolesAssigned: number;
    durationMs: number;
    completedAt: string;
  }> {
    const res = await apiClient.post<ApiResponse<{
      success: boolean;
      message: string;
      usersScanned: number;
      usersCreated: number;
      usersUpdated: number;
      usersDisabled: number;
      managersLinked: number;
      rolesAssigned: number;
      durationMs: number;
      completedAt: string;
    }>>('/core/admin/ldap/sync');
    return res.data.data;
  },

  async getLdapStatus(): Promise<{
    enabled: boolean;
    url: string;
    domain: string;
    baseDn: string;
    userSearchBase: string;
    syncEnabled: boolean;
    syncCron: string;
  }> {
    const res = await apiClient.get<ApiResponse<{
      enabled: boolean;
      url: string;
      domain: string;
      baseDn: string;
      userSearchBase: string;
      syncEnabled: boolean;
      syncCron: string;
    }>>('/core/admin/ldap/status');
    return res.data.data;
  },
};

