import { apiClient, ApiResponse } from '../../../shared/api/apiClient';

export type SkillRequestStatus = 'PENDING_PMS_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface SkillCoachingTargetItem {
  id: number;
  employeeId: number;
  employeeFullName: string;
  employeeNumber: string;
  department: string | null;
  position: string | null;
  createdAssignmentId: number | null;
}

export interface SkillCoachingRequestItem {
  id: number;
  requesterEmployeeId: number;
  requesterFullName: string;
  requesterEmployeeNumber: string;
  requesterDepartment: string | null;
  proposedCoachEmployeeId: number;
  proposedCoachFullName: string;
  proposedCoachEmployeeNumber: string;
  coachingFiscalQuarterId: number;
  coachingQuarterLabel: string;
  skillTitle: string;
  businessJustification: string;
  status: SkillRequestStatus;
  reviewedByUserId: number | null;
  reviewedByUsername: string | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  targets: SkillCoachingTargetItem[];
}

export interface CreateSkillCoachingRequestPayload {
  targetEmployeeIds: number[];
  proposedCoachEmployeeId?: number | null;
  coachingFiscalQuarterId: number;
  skillTitle: string;
  businessJustification: string;
}

export interface ApproveSkillCoachingRequestPayload {
  overrideCoachEmployeeId?: number | null;
  reviewNotes?: string;
}

export interface RejectSkillCoachingRequestPayload {
  reviewNotes: string;
}

export const skillCoachingRequestApi = {
  async createRequest(payload: CreateSkillCoachingRequestPayload): Promise<SkillCoachingRequestItem> {
    const res = await apiClient.post<ApiResponse<SkillCoachingRequestItem>>(
      '/coaching/skill-requests',
      payload
    );
    return res.data.data;
  },

  async getMyRequests(): Promise<SkillCoachingRequestItem[]> {
    const res = await apiClient.get<ApiResponse<SkillCoachingRequestItem[]>>(
      '/coaching/skill-requests/my-requests'
    );
    return res.data.data;
  },

  async getPendingRequests(): Promise<SkillCoachingRequestItem[]> {
    const res = await apiClient.get<ApiResponse<SkillCoachingRequestItem[]>>(
      '/coaching/skill-requests/pending'
    );
    return res.data.data;
  },

  async getAllRequests(filters?: {
    status?: SkillRequestStatus;
    fiscalQuarterId?: number;
  }): Promise<SkillCoachingRequestItem[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.fiscalQuarterId) params.set('fiscalQuarterId', String(filters.fiscalQuarterId));
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await apiClient.get<ApiResponse<SkillCoachingRequestItem[]>>(
      `/coaching/skill-requests${queryStr}`
    );
    return res.data.data;
  },

  async approveRequest(id: number, payload?: ApproveSkillCoachingRequestPayload): Promise<SkillCoachingRequestItem> {
    const res = await apiClient.post<ApiResponse<SkillCoachingRequestItem>>(
      `/coaching/skill-requests/${id}/approve`,
      payload ?? {}
    );
    return res.data.data;
  },

  async rejectRequest(id: number, payload: RejectSkillCoachingRequestPayload): Promise<SkillCoachingRequestItem> {
    const res = await apiClient.post<ApiResponse<SkillCoachingRequestItem>>(
      `/coaching/skill-requests/${id}/reject`,
      payload
    );
    return res.data.data;
  },
};

