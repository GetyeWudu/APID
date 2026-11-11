import { apiClient, type ApiResponse } from '../../../../shared/api/apiClient';
import type { PageResponse } from '../../users/types/users.types';
import type { AuditEvent } from '../types/audit.types';

export const auditApi = {
  async search(params: {
    module?: string;
    action?: string;
    actorUsername?: string;
    page?: number;
    size?: number;
  }): Promise<PageResponse<AuditEvent>> {
    const res = await apiClient.get<ApiResponse<PageResponse<AuditEvent>>>(
      '/core/admin/audit-logs',
      {
        params: {
          module: params.module || undefined,
          action: params.action || undefined,
          actorUsername: params.actorUsername || undefined,
          page: params.page ?? 0,
          size: params.size ?? 20,
        },
      }
    );
    return res.data.data;
  },
};

