import { apiClient, type ApiResponse } from '../../../shared/api/apiClient';

export type MentoringMatchRequestStatus = 'OPEN' | 'MATCHED' | 'CANCELLED';

export interface MentoringMatchRequest {
  id: number;
  traineeUserId: number;
  traineeName: string;
  traineeEmployeeNumber: string;
  departmentName: string | null;
  skillId: number;
  skillName: string;
  message: string | null;
  status: MentoringMatchRequestStatus;
  matchedTrainerUserId: number | null;
  matchedTrainerName: string | null;
  mentoringRelationshipId: number | null;
  createdAt: string;
}

export interface MentoringReassignmentCandidate {
  relationshipId: number;
  formerTrainerUserId: number;
  formerTrainerName: string;
  skillId: number | null;
  skillName: string | null;
  requestType: 'INDIVIDUAL' | 'GROUP';
  startedAt: string;
  trainees: Array<{ userId: number; name: string }>;
}

export interface MentoringReassignmentResult {
  previousRelationshipId: number;
  newRelationshipId: number;
  trainerUserId: number;
  trainerName: string;
  reassignedTrainees: number;
}

export const mentoringMatchApi = {
  async listMine(): Promise<MentoringMatchRequest[]> {
    const response = await apiClient.get<ApiResponse<MentoringMatchRequest[]>>('/mentoring/match-requests');
    return response.data.data;
  },

  async submit(input: { skillId: number; message?: string }): Promise<MentoringMatchRequest> {
    const response = await apiClient.post<ApiResponse<MentoringMatchRequest>>(
      '/mentoring/match-requests',
      input
    );
    return response.data.data;
  },

  async listForHr(): Promise<MentoringMatchRequest[]> {
    const response = await apiClient.get<ApiResponse<MentoringMatchRequest[]>>(
      '/mentoring/hr/match-requests'
    );
    return response.data.data;
  },

  async match(
    requestId: number,
    input: { trainerUserId: number; overrideCapacity?: boolean; overrideReason?: string }
  ): Promise<MentoringMatchRequest> {
    const response = await apiClient.post<ApiResponse<MentoringMatchRequest>>(
      `/mentoring/hr/match-requests/${requestId}/match`,
      input
    );
    return response.data.data;
  },

  async listReassignmentQueue(): Promise<MentoringReassignmentCandidate[]> {
    const response = await apiClient.get<ApiResponse<MentoringReassignmentCandidate[]>>(
      '/mentoring/hr/reassignment-queue'
    );
    return response.data.data;
  },

  async reassign(
    relationshipId: number,
    input: {
      trainerUserId: number;
      reason: string;
      overrideCapacity?: boolean;
      overrideReason?: string;
      skillOverrideReason?: string;
    }
  ): Promise<MentoringReassignmentResult> {
    const response = await apiClient.post<ApiResponse<MentoringReassignmentResult>>(
      `/mentoring/hr/relationships/${relationshipId}/reassign`,
      input
    );
    return response.data.data;
  },
};
