import { apiClient, type ApiResponse } from '../../../shared/api/apiClient';
import type { TrainerDirectoryItem } from './mentoringTrainerApi';

export type MentorDirectoryItem = TrainerDirectoryItem;

export interface MentorRecommendation {
  rank: number;
  reason: string;
  skillId: number | null;
  skillName: string | null;
  mentor: MentorDirectoryItem;
}

export const mentorDirectoryApi = {
  async listMentors(filters: { skillId?: number; department?: string } = {}): Promise<MentorDirectoryItem[]> {
    const response = await apiClient.get<ApiResponse<MentorDirectoryItem[]>>('/mentoring/directory', {
      params: filters,
    });
    return response.data.data;
  },

  async recommendMentors(learningGoal: string): Promise<MentorRecommendation[]> {
    const response = await apiClient.post<ApiResponse<{ recommendations: MentorRecommendation[] }>>(
      '/mentoring/recommendations',
      { learningGoal }
    );
    return response.data.data.recommendations;
  },
};
