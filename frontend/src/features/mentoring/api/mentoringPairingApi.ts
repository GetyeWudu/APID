import { apiClient, type ApiResponse } from '../../../shared/api/apiClient';

export type MentoringRequestType = 'INDIVIDUAL' | 'GROUP';
export type MentoringRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export interface MentoringEmployeeCandidate {
  userId: number;
  employeeNumber: string;
  fullName: string;
  departmentName: string | null;
}

export interface MentoringPairing {
  id: number;
  requestId: number;
  requestType: MentoringRequestType;
  status: MentoringRequestStatus;
  incoming: boolean;
  initiatedByMentor: boolean;
  mentorUserId: number;
  mentorName: string;
  traineeUserId: number;
  traineeName: string;
  recipientUserId: number;
  skillId: number | null;
  skillName: string | null;
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
}

export const mentoringPairingApi = {
  async listMyRequests(): Promise<MentoringPairing[]> {
    const response = await apiClient.get<ApiResponse<MentoringPairing[]>>('/mentoring/pairing/requests');
    return response.data.data;
  },

  async listEmployeeCandidates(): Promise<MentoringEmployeeCandidate[]> {
    const response = await apiClient.get<ApiResponse<MentoringEmployeeCandidate[]>>(
      '/mentoring/pairing/employees'
    );
    return response.data.data;
  },

  async inviteTrainees(input: {
    requestType: MentoringRequestType;
    traineeUserIds: number[];
    message?: string;
  }): Promise<MentoringPairing[]> {
    const response = await apiClient.post<ApiResponse<MentoringPairing[]>>(
      '/mentoring/pairing/requests/invitations',
      input
    );
    return response.data.data;
  },

  async requestMentor(input: {
    mentorUserId: number;
    skillId?: number;
    message?: string;
  }): Promise<MentoringPairing> {
    const response = await apiClient.post<ApiResponse<MentoringPairing>>(
      '/mentoring/pairing/requests/mentors',
      input
    );
    return response.data.data;
  },

  async respond(
    recipientId: number,
    decision: Exclude<MentoringRequestStatus, 'PENDING'>
  ): Promise<MentoringPairing> {
    const response = await apiClient.post<ApiResponse<MentoringPairing>>(
      `/mentoring/pairing/requests/${recipientId}/decision`,
      { decision }
    );
    return response.data.data;
  },
};
