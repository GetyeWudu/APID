import { apiClient, type ApiResponse } from '../../../../shared/api/apiClient';
import type { CreateSkillPayload, SkillItem, UpdateSkillPayload } from '../types/skills.types';

export const skillsApi = {
  async listActive(): Promise<SkillItem[]> {
    const res = await apiClient.get<ApiResponse<SkillItem[]>>('/core/skills');
    return res.data.data;
  },

  async listAdmin(params: { search?: string; category?: string; active?: boolean | '' }): Promise<SkillItem[]> {
    const res = await apiClient.get<ApiResponse<SkillItem[]>>('/core/admin/skills', {
      params: {
        search: params.search || undefined,
        category: params.category || undefined,
        active: params.active === '' ? undefined : params.active,
      },
    });
    return res.data.data;
  },

  async create(payload: CreateSkillPayload): Promise<SkillItem> {
    const res = await apiClient.post<ApiResponse<SkillItem>>('/core/admin/skills', payload);
    return res.data.data;
  },

  async update(id: number, payload: UpdateSkillPayload): Promise<SkillItem> {
    const res = await apiClient.put<ApiResponse<SkillItem>>(`/core/admin/skills/${id}`, payload);
    return res.data.data;
  },

  async updateStatus(id: number, active: boolean): Promise<SkillItem> {
    const res = await apiClient.patch<ApiResponse<SkillItem>>(`/core/admin/skills/${id}/status`, { active });
    return res.data.data;
  },
};

