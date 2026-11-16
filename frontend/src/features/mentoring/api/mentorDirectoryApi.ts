import { apiClient, type ApiResponse } from '../../../shared/api/apiClient';
import type { TrainerDirectoryItem } from './mentoringTrainerApi';

export type MentorDirectoryItem = TrainerDirectoryItem;

export const mentorDirectoryApi = {
  async listMentors(filters: { skillId?: number; department?: string } = {}): Promise<MentorDirectoryItem[]> {
    const response = await apiClient.get<ApiResponse<MentorDirectoryItem[]>>('/mentoring/directory', {
      params: filters,
    });
    return response.data.data;
  },
};
