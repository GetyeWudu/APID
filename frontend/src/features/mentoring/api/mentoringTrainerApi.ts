import { apiClient, type ApiResponse } from '../../../shared/api/apiClient';

export type TrainerAuthorizationStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
export type TrainerAuthorizationSource = 'APPLICATION' | 'DIRECT_APPOINTMENT';
export type TrainerInFlightPolicy =
  | 'BLOCK_NEW_SESSIONS_ONLY'
  | 'REQUIRE_HR_REASSIGNMENT';
export type MentorBadgeRemovalRequestStatus = 'PENDING' | 'APPROVED' | 'DECLINED';
export type MentorBadgeRemovalDisposition = 'KEEP_EXISTING_PAIRINGS' | 'REVOKE_ALL_PAIRINGS';

export interface TrainerSkill {
  id: number;
  name: string;
  category: string;
  status?: TrainerAuthorizationStatus;
  statusReason?: string | null;
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
  acceptingNewPairings?: boolean;
  activeTrainees: number;
  pendingTrainees: number;
  maxConcurrentTrainees: number;
  bio: string | null;
  availabilityNotes: string | null;
  experienceYears?: number | null;
  mentoringApproach?: string | null;
  sessionsPerWeek?: number | null;
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
  experienceYears?: number | null;
  mentoringApproach?: string | null;
  sessionsPerWeek?: number | null;
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

export interface MentoringPairingReportSummary {
  relationshipId: number;
  requestId: number;
  requestType: 'INDIVIDUAL' | 'GROUP';
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'REASSIGNED';
  mentorName: string;
  traineeNames: string[];
  skillName: string | null;
  startedAt: string;
  endedAt: string | null;
  totalSessions: number;
  completedSessions: number;
  sessionCompletionRatePct: number;
}

export interface MentoringPairingReportOverview {
  totalPairings: number;
  completedPairings: number;
  pairingCompletionRatePct: number;
  totalSessions: number;
  completedSessions: number;
  sessionCompletionRatePct: number;
  pairings: MentoringPairingReportSummary[];
}

export interface MentoringPairingReportDetail {
  pairing: MentoringPairingReportSummary;
  completionNote: string | null;
  sessions: {
    id: number;
    title: string;
    agenda: string | null;
    scheduledStart: string;
    scheduledEnd: string;
    status: 'SCHEDULED' | 'COMPLETED' | 'MISSED' | 'CANCELLED' | 'RESCHEDULED';
    reportNote: string | null;
  }[];
}

export interface HrMentorProfile {
  acceptingNewPairings: boolean;
  profileSetupRequired: boolean;
  profile: TrainerRosterItem | null;
  activeSkills: TrainerSkill[];
}

export interface MentorBadgeRemovalRequest {
  id: number;
  authorizationId: number;
  employeeNumber: string;
  mentorName: string;
  departmentName: string | null;
  skills: string[];
  reason: string | null;
  status: MentorBadgeRemovalRequestStatus;
  requestedAt: string;
  reviewedAt: string | null;
  disposition: MentorBadgeRemovalDisposition | null;
  decisionReason: string | null;
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

  async getPairingReportOverview(): Promise<MentoringPairingReportOverview> {
    const response = await apiClient.get<ApiResponse<MentoringPairingReportOverview>>(
      '/mentoring/hr/reports/pairings'
    );
    return response.data.data;
  },

  async getPairingReport(relationshipId: number): Promise<MentoringPairingReportDetail> {
    const response = await apiClient.get<ApiResponse<MentoringPairingReportDetail>>(
      `/mentoring/hr/reports/pairings/${relationshipId}`
    );
    return response.data.data;
  },

  async hasMentorWorkspaceAccess(): Promise<boolean> {
    const response = await apiClient.get<ApiResponse<boolean>>(
      '/mentoring/trainer-profile/workspace-access'
    );
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
      skillId: number;
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
    availabilityNotes?: string;
    experienceYears: number | null;
    mentoringApproach: string;
    sessionsPerWeek: number | null;
    maxConcurrentTrainees?: number;
  }): Promise<TrainerRosterItem> {
    const response = await apiClient.patch<ApiResponse<TrainerRosterItem>>('/mentoring/trainer-profile', input);
    return response.data.data;
  },

  async getProfile(): Promise<TrainerRosterItem> {
    const response = await apiClient.get<ApiResponse<TrainerRosterItem>>('/mentoring/trainer-profile');
    return response.data.data;
  },

  async getMyBadgeRemovalRequest(): Promise<MentorBadgeRemovalRequest | null> {
    const response = await apiClient.get<ApiResponse<MentorBadgeRemovalRequest | null>>(
      '/mentoring/trainer-profile/badge-removal-request'
    );
    return response.data.data;
  },

  async submitBadgeRemovalRequest(reason?: string): Promise<MentorBadgeRemovalRequest> {
    const response = await apiClient.post<ApiResponse<MentorBadgeRemovalRequest>>(
      '/mentoring/trainer-profile/badge-removal-request',
      { reason }
    );
    return response.data.data;
  },

  async listBadgeRemovalRequests(): Promise<MentorBadgeRemovalRequest[]> {
    const response = await apiClient.get<ApiResponse<MentorBadgeRemovalRequest[]>>(
      '/mentoring/hr/badge-removal-requests'
    );
    return response.data.data;
  },

  async decideBadgeRemovalRequest(input: {
    requestId: number;
    status: Exclude<MentorBadgeRemovalRequestStatus, 'PENDING'>;
    disposition?: MentorBadgeRemovalDisposition;
    decisionReason?: string;
  }): Promise<MentorBadgeRemovalRequest> {
    const response = await apiClient.post<ApiResponse<MentorBadgeRemovalRequest>>(
      `/mentoring/hr/badge-removal-requests/${input.requestId}/decision`,
      {
        status: input.status,
        disposition: input.disposition,
        decisionReason: input.decisionReason,
      }
    );
    return response.data.data;
  },

  async getHrMentorProfile(): Promise<HrMentorProfile> {
    const response = await apiClient.get<ApiResponse<HrMentorProfile>>('/mentoring/hr/my-mentor-profile');
    return response.data.data;
  },

  async updateHrMentorProfile(input: {
    acceptingNewPairings: boolean;
    skillIds?: number[];
    maxConcurrentTrainees?: number;
  }): Promise<HrMentorProfile> {
    const response = await apiClient.patch<ApiResponse<HrMentorProfile>>(
      '/mentoring/hr/my-mentor-profile',
      input
    );
    return response.data.data;
  },
};
