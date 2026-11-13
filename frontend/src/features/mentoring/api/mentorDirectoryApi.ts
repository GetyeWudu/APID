import { apiClient, type ApiResponse } from '../../../shared/api/apiClient';

export interface MentorDirectoryItem {
  userId: number;
  username: string;
  employeeNumber: string | null;
  fullName: string;
  departmentName: string | null;
  skills: Array<{
    id: number;
    name: string;
    category: string;
  }>;
}

export const mentorDirectoryApi = {
  async listMentors(): Promise<MentorDirectoryItem[]> {
    const response = await apiClient.get<ApiResponse<MentorDirectoryItem[]>>('/core/mentors');
    return response.data.data;
  },
};
