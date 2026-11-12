import { apiClient, type ApiResponse } from '../../../../shared/api/apiClient';

export interface ActiveCycleInfo {
  quarterId: number;
  fiscalYear: string;
  quarter: number;
  label: string;
  startDate: string;
  endDate: string;
}

export interface PublicConfigSettings {
  mandatoryCutoffRounded: number;
  missedSessionAlertThreshold: number;
  inactivityReminderDays: number;
  maxFileUploadMb: number;
}

export interface ActiveConfigSnapshot {
  activeQuarter: ActiveCycleInfo;
  calendarQuarterLabel: string | null;
  publicConfig: PublicConfigSettings;
}

export type ConfigValueType = 'INTEGER' | 'DECIMAL' | 'BOOLEAN' | 'STRING';

export interface SystemConfigItem {
  configKey: string;
  configValue: string;
  valueType: ConfigValueType;
  description: string | null;
  publicVisible: boolean;
  updatedByUserId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalQuarterItem {
  id: number;
  fiscalYear: string;
  quarter: number;
  label: string;
  startDate: string;
  endDate: string;
  active: boolean;
  locked: boolean;
  referencedByRecords: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminConfigView {
  configs: SystemConfigItem[];
  quarters: FiscalQuarterItem[];
}

export interface CreateFiscalQuarterPayload {
  fiscalYear: string;
  quarter: number;
  label?: string;
  startDate: string;
  endDate: string;
  activate: boolean;
}

export interface UpdateFiscalQuarterPayload {
  label: string;
  startDate: string;
  endDate: string;
}

export const coreConfigApi = {
  async getActiveConfig(): Promise<ActiveConfigSnapshot> {
    const res = await apiClient.get<ApiResponse<ActiveConfigSnapshot>>('/core/config/active');
    return res.data.data;
  },

  async getAdminConfig(): Promise<AdminConfigView> {
    const res = await apiClient.get<ApiResponse<AdminConfigView>>('/core/admin/config');
    return res.data.data;
  },

  async updateConfigs(
    updates: Array<{ configKey: string; configValue: string }>
  ): Promise<SystemConfigItem[]> {
    const res = await apiClient.put<ApiResponse<SystemConfigItem[]>>('/core/admin/config', {
      updates,
    });
    return res.data.data;
  },

  async createQuarter(payload: CreateFiscalQuarterPayload): Promise<FiscalQuarterItem> {
    const res = await apiClient.post<ApiResponse<FiscalQuarterItem>>(
      '/core/admin/fiscal-quarters',
      payload
    );
    return res.data.data;
  },

  async updateQuarter(
    id: number,
    payload: UpdateFiscalQuarterPayload
  ): Promise<FiscalQuarterItem> {
    const res = await apiClient.put<ApiResponse<FiscalQuarterItem>>(
      `/core/admin/fiscal-quarters/${id}`,
      payload
    );
    return res.data.data;
  },

  async activateQuarter(id: number): Promise<FiscalQuarterItem> {
    const res = await apiClient.post<ApiResponse<FiscalQuarterItem>>(
      `/core/admin/fiscal-quarters/${id}/activate`
    );
    return res.data.data;
  },
};

