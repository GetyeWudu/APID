import { apiClient, type ApiResponse } from '../../../../shared/api/apiClient';
import { PREVIEW_SYSTEM_CONFIG } from '../../../../shared/mocks/boaPreviewFixtures';

export interface AdminDashboardSummary {
  users: {
    total: number;
    active: number;
    temporarilyLocked: number;
    disabled: number;
    adminLocked: number;
    mustChangePassword: number;
  } | null;
  employees: {
    total: number;
    active: number;
    linkedAccounts: number;
    unlinkedAccounts: number;
    activeReportingLinks: number;
  } | null;
  departments: {
    total: number;
    active: number;
  } | null;
  skills: {
    total: number;
    active: number;
  } | null;
  audit24h: {
    totalEvents: number;
    nonSuccessEvents: number;
  } | null;
  totalCatalogPermissions: number | null;
  roles: Array<{
    id: number;
    name: string;
    systemProtected: boolean;
    active: boolean;
    permissionCount: number;
    activeUserCount: number;
  }> | null;
  redisMonitoringAvailable: boolean;
}

export interface CoreHealthStatus {
  service: string;
  status: string;
  modules: string[];
}

export type SystemConfigPreview = typeof PREVIEW_SYSTEM_CONFIG;

export const adminSummaryLiveApi = {
  async getSummary(): Promise<AdminDashboardSummary> {
    const res = await apiClient.get<ApiResponse<AdminDashboardSummary>>('/core/admin/dashboard/summary');
    return res.data.data;
  },

  async getHealth(): Promise<CoreHealthStatus> {
    const res = await apiClient.get<ApiResponse<CoreHealthStatus>>('/core/health');
    return res.data.data;
  },
};

export const systemConfigPreviewAdapter = {
  async getConfig(): Promise<SystemConfigPreview> {
    return { ...PREVIEW_SYSTEM_CONFIG };
  },

  async simulateSaveConfig(
    next: SystemConfigPreview
  ): Promise<{ simulated: true; config: SystemConfigPreview; message: string }> {
    return {
      simulated: true,
      config: { ...next },
      message: 'Saved in preview session only — backend configuration storage is not connected yet.',
    };
  },
};

