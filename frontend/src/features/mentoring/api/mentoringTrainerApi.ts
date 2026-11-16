import { apiClient, type ApiResponse } from '../../../shared/api/apiClient';

export type TrainerAuthorizationStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
export type TrainerAuthorizationSource = 'APPLICATION' | 'DIRECT_APPOINTMENT';
export type TrainerInFlightPolicy =
  | 'BLOCK_NEW_SESSIONS_ONLY'
  | 'REQUIRE_HR_REASSIGNMENT';

export interface TrainerSkill {
  id: number;
  name: string;
  category: string;
}

export interface TrainerRosterItem {
  id: number;
  employeeId: number;
  userId: number | null;
  employeeNumber: string;
  fullName: string;
  departmentName: string | null;
  employmentStatus: string;
  sourceType: TrainerAuthorizationSource;
  status: TrainerAuthorizationStatus;
  activeTrainees: number;
  pendingTrainees: number;
  maxConcurrentTrainees: number;
  bio: string | null;
  availabilityNotes: string | null;
  skills: TrainerSkill[];
  effectiveFrom: string;
  updatedAt: string;
}

export interface TrainerDirectoryItem {
  userId: number;
  username: string;
  employeeNumber: string;
  fullName: string;
  departmentName: string | null;
  bio: string | null;
  availabilityNotes: string | null;
  activeTrainees: number;
  remainingCapacity: number;
  averageRating: number;
  skills: TrainerSkill[];
}

export interface TrainerEmployeeCandidate {
  employeeId: number;
  userId: number;
  employeeNumber: string;
  fullName: string;
  departmentName: string | null;
}

export interface MentoringSkillDemand {
  skillId: number;
  skillName: string;
  activeTrainers: number;
  openRequests: number;
  availableTrainerSlots: number;
}

export interface MentoringHrOverview {
  pendingApplications: number;
  approvedApplications: number;
  declinedApplications: number;
  activeTrainers: number;
  suspendedTrainers: number;
  revokedTrainers: number;
  activeRelationships: number;
  completedRelationships: number;
  totalSessions: number;
  completedSessions: number;
  averageFeedbackRating: number;
  completionRatePct: number;
  skillSupplyDemand: MentoringSkillDemand[];
}

export const mentoringTrainerApi = {
  async listRoster(): Promise<TrainerRosterItem[]> {
    const response = await apiClient.get<ApiResponse<TrainerRosterItem[]>>('/mentoring/hr/trainers');
    return response.data.data;
  },

  async listAppointmentCandidates(): Promise<TrainerEmployeeCandidate[]> {
    const response = await apiClient.get<ApiResponse<TrainerEmployeeCandidate[]>>(
      '/mentoring/hr/employees'
    );
    return response.data.data;
  },

  async listMatchingEmployees(): Promise<TrainerEmployeeCandidate[]> {
    const response = await apiClient.get<ApiResponse<TrainerEmployeeCandidate[]>>(
      '/mentoring/hr/matching-employees'
    );
    return response.data.data;
  },

  async getOverview(): Promise<MentoringHrOverview> {
    const response = await apiClient.get<ApiResponse<MentoringHrOverview>>('/mentoring/hr/overview');
    return response.data.data;
  },

  async downloadReport(format: 'xlsx' | 'pdf'): Promise<Blob> {
    const response = await apiClient.get<Blob>('/mentoring/hr/reports/export', {
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  },

  async appoint(input: {
    employeeId: number;
    skillIds: number[];
    maxConcurrentTrainees: number;
    appointmentReason: string;
  }): Promise<TrainerRosterItem> {
    const response = await apiClient.post<ApiResponse<TrainerRosterItem>>('/mentoring/hr/trainers', input);
    return response.data.data;
  },

  async changeStatus(
    authorizationId: number,
    input: {
      status: TrainerAuthorizationStatus;
      inFlightPolicy?: TrainerInFlightPolicy;
      reason: string;
    }
  ): Promise<TrainerRosterItem> {
    const response = await apiClient.patch<ApiResponse<TrainerRosterItem>>(
      `/mentoring/hr/trainers/${authorizationId}/status`,
      input
    );
    return response.data.data;
  },

  async updateProfile(input: {
    bio: string;
    availabilityNotes: string;
    maxConcurrentTrainees?: number;
  }): Promise<TrainerRosterItem> {
    const response = await apiClient.patch<ApiResponse<TrainerRosterItem>>('/mentoring/trainer-profile', input);
    return response.data.data;
  },

  async getProfile(): Promise<TrainerRosterItem> {
    const response = await apiClient.get<ApiResponse<TrainerRosterItem>>('/mentoring/trainer-profile');
    return response.data.data;
  },
};
