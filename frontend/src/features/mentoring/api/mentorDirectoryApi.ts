import { apiClient, type ApiResponse } from '../../../shared/api/apiClient';
import type { TrainerDirectoryItem } from './mentoringTrainerApi';
import type { OrganizationLocation } from './organizationLocation';

export type MentorDirectoryItem = TrainerDirectoryItem;

export type MentorDirectoryLocation = OrganizationLocation;

export interface MentorExperience {
  role: string | null;
  organization: string | null;
  years: string | null;
}

export interface MentorProfileDetails {
  mentor: MentorDirectoryItem;
  profileSummary?: string | null;
  careerExperience: MentorExperience[];
  mentorshipExperience: MentorExperience[];
}

export interface MentorRecommendation extends MentorProfileDetails {
  rank: number;
  reason: string;
  skillId: number | null;
  skillName: string | null;
}

export interface MentorRecommendationResult {
  overallReason: string | null;
  recommendations: MentorRecommendation[];
}

export const mentorDirectoryApi = {
  async listMentors(filters: { skillId?: number; department?: string } = {}): Promise<MentorDirectoryItem[]> {
    const response = await apiClient.get<ApiResponse<MentorDirectoryItem[]>>('/mentoring/directory', {
      params: filters,
    });
    return response.data.data;
  },

  async getMyOrganizationPath(): Promise<MentorDirectoryLocation[]> {
    const response = await apiClient.get<ApiResponse<MentorDirectoryLocation[]>>(
      '/mentoring/directory/location-context'
    );
    return response.data.data;
  },

  async getMentorProfile(userId: number): Promise<MentorProfileDetails> {
    const response = await apiClient.get<ApiResponse<MentorProfileDetails>>(
      `/mentoring/directory/${userId}/profile`
    );
    return response.data.data;
  },

  async recommendMentors(learningGoal: string): Promise<MentorRecommendationResult> {
    const response = await apiClient.post<ApiResponse<MentorRecommendationResult>>(
      '/mentoring/recommendations',
      { learningGoal }
    );
    return response.data.data;
  },

  async recommendExactSkillMentorsForHr(
    learningGoal: string,
    skillId: number
  ): Promise<MentorRecommendationResult> {
    const response = await apiClient.post<ApiResponse<MentorRecommendationResult>>(
      '/mentoring/recommendations/hr-match',
      { learningGoal, skillId }
    );
    return response.data.data;
  },
};
