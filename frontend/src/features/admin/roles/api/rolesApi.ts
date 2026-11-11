import { apiClient, type ApiResponse } from '../../../../shared/api/apiClient';
import type {
  CreateRolePayload,
  PermissionItem,
  RoleItem,
  UpdateRolePayload,
} from '../types/roles.types';

export const rolesApi = {
  async listPermissions(): Promise<PermissionItem[]> {
    const res = await apiClient.get<ApiResponse<PermissionItem[]>>('/core/admin/permissions');
    return res.data.data;
  },

  async listRoles(): Promise<RoleItem[]> {
    const res = await apiClient.get<ApiResponse<RoleItem[]>>('/core/admin/roles');
    return res.data.data;
  },

  async createRole(payload: CreateRolePayload): Promise<RoleItem> {
    const res = await apiClient.post<ApiResponse<RoleItem>>('/core/admin/roles', payload);
    return res.data.data;
  },

  async updateRole(roleId: number, payload: UpdateRolePayload): Promise<RoleItem> {
    const res = await apiClient.put<ApiResponse<RoleItem>>(`/core/admin/roles/${roleId}`, payload);
    return res.data.data;
  },

  async updateRolePermissions(roleId: number, permissionCodes: string[]): Promise<RoleItem> {
    const res = await apiClient.put<ApiResponse<RoleItem>>(
      `/core/admin/roles/${roleId}/permissions`,
      { permissionCodes }
    );
    return res.data.data;
  },
};

