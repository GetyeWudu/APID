import { apiClient } from '../../../shared/api/apiClient';
import { AssignmentPathway } from './coachingAssignmentApi';

export type SessionMeetingMode = 'VIRTUAL_VIDEO' | 'PHONE_CALL' | 'IN_PERSON';

export type SessionStatus =
  | 'PROPOSED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RESCHEDULE_PENDING'
  | 'EXPIRED';

export type ParticipantRole = 'COACH' | 'COACHEE';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';
export type AttendanceStatus = 'PENDING' | 'ATTENDED' | 'MISSED' | 'EXCUSED';
export type CoachAssessment = 'NEEDS_IMPROVEMENT' | 'PROGRESSING' | 'ON_TRACK' | 'MASTERED';

export interface SessionParticipantItem {
  id: number;
  sessionId: number;
  employeeId: number;
  employeeNumber: string | null;
  fullName: string;
  departmentName: string | null;
  position: string | null;
  role: ParticipantRole;
  invitationStatus: InvitationStatus;
  invitationDeclineReason: string | null;
  respondedAt: string | null;
  attendanceStatus: AttendanceStatus;
  attendanceMarkedAt: string | null;
  coachAssessment: CoachAssessment | null;
  individualNotes: string | null;
  feedbackRating: number | null;
  feedbackComment: string | null;
  feedbackSubmittedAt: string | null;
  coacheeProgressNotes: string | null;
  coacheeProgressSubmittedAt: string | null;
}

export interface RescheduleProposalItem {
  id: number;
  sessionId: number;
  proposedByEmployeeId: number;
  proposedByFullName: string;
  proposedStartTime: string;
  proposedEndTime: string;
  reason: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}

export interface CoachingSessionItem {
  id: number;
  assignmentId: number | null;
  skillRequestId: number | null;
  coachEmployeeId: number;
  coachEmployeeNumber: string | null;
  coachFullName: string | null;
  coachJobTitle: string | null;
  coachDepartment: string | null;
  title: string;
  pathway: AssignmentPathway;
  scheduledStartTime: string;
  scheduledEndTime: string;
  durationMinutes: number;
  meetingMode: SessionMeetingMode;
  meetingLocation: string | null;
  dailyRoomName: string | null;
  dailyRoomUrl: string | null;
  status: SessionStatus;
  cancellationReason: string | null;
  targetPmsGoalId: number | null;
  targetPmsGoalName: string | null;
  sessionNotesMinutes: string | null;
  actionItems: string | null;
  conductedAt: string | null;
  participants: SessionParticipantItem[];
  pendingRescheduleProposal?: RescheduleProposalItem | null;
  seriesId?: number | null;
  sequenceNumber?: number | null;
  isExtensionSession?: boolean;
  createdAt: string;
}

export interface CreateSessionPayload {
  assignmentId?: number;
  skillRequestId?: number;
  title: string;
  scheduledStartTime: string;
  durationMinutes: number;
  meetingMode: SessionMeetingMode;
  meetingLocation?: string;
  targetPmsGoalId?: number;
}

export interface CompleteSessionPayload {
  sessionNotesMinutes: string;
  actionItems?: string;
  participantAttendances: {
    employeeId: number;
    attendanceStatus: AttendanceStatus;
    coachAssessment?: CoachAssessment;
    individualNotes?: string;
  }[];
}

export interface SubmitFeedbackPayload {
  rating: number;
  comment?: string;
}

export interface SessionJoinToken {
  roomName: string;
  token: string;
  roomUrlWithToken: string;
  expiresAt: string;
  isMock: boolean;
}

interface ApiResponse<T> {
  data: T;
  message?: string;
}

export const coachingSessionApi = {
  async createSession(payload: CreateSessionPayload): Promise<CoachingSessionItem> {
    const res = await apiClient.post<ApiResponse<CoachingSessionItem>>(
      '/coaching/sessions',
      payload
    );
    return res.data.data;
  },

  async getMySessions(params?: { upcomingOnly?: boolean; pathway?: AssignmentPathway }): Promise<CoachingSessionItem[]> {
    const searchParams = new URLSearchParams();
    if (params?.upcomingOnly) searchParams.set('upcomingOnly', 'true');
    if (params?.pathway) searchParams.set('pathway', params.pathway);

    const res = await apiClient.get<ApiResponse<CoachingSessionItem[]>>(
      `/coaching/sessions?${searchParams.toString()}`
    );
    return res.data.data;
  },

  async getSessionDetail(id: number): Promise<CoachingSessionItem> {
    const res = await apiClient.get<ApiResponse<CoachingSessionItem>>(
      `/coaching/sessions/${id}`
    );
    return res.data.data;
  },

  async respondInvitation(id: number, payload: { accept: boolean; declineReason?: string }): Promise<CoachingSessionItem> {
    const res = await apiClient.post<ApiResponse<CoachingSessionItem>>(
      `/coaching/sessions/${id}/respond`,
      payload
    );
    return res.data.data;
  },

  async proposeReschedule(id: number, payload: { proposedStartTime: string; reason: string }): Promise<CoachingSessionItem> {
    const res = await apiClient.post<ApiResponse<CoachingSessionItem>>(
      `/coaching/sessions/${id}/reschedule`,
      payload
    );
    return res.data.data;
  },

  async cancelSession(id: number, reason: string): Promise<CoachingSessionItem> {
    const res = await apiClient.post<ApiResponse<CoachingSessionItem>>(
      `/coaching/sessions/${id}/cancel`,
      { reason }
    );
    return res.data.data;
  },

  async completeSession(id: number, payload: CompleteSessionPayload): Promise<CoachingSessionItem> {
    const res = await apiClient.post<ApiResponse<CoachingSessionItem>>(
      `/coaching/sessions/${id}/complete`,
      payload
    );
    return res.data.data;
  },

  async submitFeedback(id: number, payload: SubmitFeedbackPayload): Promise<CoachingSessionItem> {
    const res = await apiClient.post<ApiResponse<CoachingSessionItem>>(
      `/coaching/sessions/${id}/feedback`,
      payload
    );
    return res.data.data;
  },

  async submitCoacheeProgress(id: number, payload: { progressNotes: string }): Promise<CoachingSessionItem> {
    const res = await apiClient.post<ApiResponse<CoachingSessionItem>>(
      `/coaching/sessions/${id}/progress-report`,
      payload
    );
    return res.data.data;
  },

  async respondRescheduleProposal(
    id: number,
    proposalId: number,
    payload: { accept: boolean; responseNotes?: string }
  ): Promise<CoachingSessionItem> {
    const res = await apiClient.post<ApiResponse<CoachingSessionItem>>(
      `/coaching/sessions/${id}/proposals/${proposalId}/respond`,
      payload
    );
    return res.data.data;
  },

  async respondPendingReschedule(
    id: number,
    payload: { accept: boolean; responseNotes?: string }
  ): Promise<CoachingSessionItem> {
    const res = await apiClient.post<ApiResponse<CoachingSessionItem>>(
      `/coaching/sessions/${id}/respond-reschedule`,
      payload
    );
    return res.data.data;
  },

  async getJoinToken(id: number): Promise<SessionJoinToken> {
    const res = await apiClient.get<ApiResponse<SessionJoinToken>>(
      `/coaching/sessions/${id}/join-token`
    );
    return res.data.data;
  },
};

export type CadenceType = 'WEEKLY' | 'BIWEEKLY' | 'TWICE_WEEKLY' | 'CUSTOM';
export type TargetStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'EXTENDED' | 'COMPLETED_EARLY' | 'CLOSED';
export type AdjustmentType = 'INITIAL_PROPOSAL' | 'EXTENSION_REQUEST' | 'EARLY_COMPLETION_REQUEST';
export type AdjustmentDecision = 'PENDING' | 'APPROVED' | 'REJECTED' | 'AUTO_APPROVED';
export type SeriesStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface CoachingPolicyVersionItem {
  id: number;
  versionTag: string;
  policyName: string;
  pathway: AssignmentPathway;
  minAppraisalRating: number | null;
  maxAppraisalRating: number | null;
  baselineSessions: number;
  minAllowedSessions: number;
  maxAllowedSessions: number;
  defaultCadence: CadenceType;
  coachAdjustmentAllowed: boolean;
  requiresPmsApprovalOutsideRange: boolean;
  allowExtensions: boolean;
  allowEarlyCompletion: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface CoachingTargetAdjustmentItem {
  id: number;
  sessionTargetId: number;
  adjustmentType: AdjustmentType;
  requestedByEmployeeId: number;
  requestedByFullName: string;
  previousTarget: number;
  proposedTarget: number;
  reason: string;
  pmsReviewerId: number | null;
  pmsReviewerFullName: string | null;
  pmsDecision: AdjustmentDecision;
  decisionNotes: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface CoachingSessionTargetItem {
  id: number;
  assignmentId: number | null;
  skillRequestId: number | null;
  policyVersionId: number | null;
  policyName: string;
  policyBaseline: number;
  approvedTarget: number;
  plannedOccurrences: number;
  completedSessions: number;
  remainingApprovedSessions: number;
  status: TargetStatus;
  justificationNotes: string | null;
  approvedByUserId: number | null;
  approvedAt: string | null;
  earlyCompletionReason: string | null;
  earlyCompletedAt: string | null;
  adjustmentHistory: CoachingTargetAdjustmentItem[];
  createdAt: string;
}

export interface GeneratedDatePreviewItem {
  sequenceNumber: number;
  sessionDate: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  weekNumber: number;
  isBufferWeek: boolean;
  note: string;
}

export interface SeriesPreviewRequestPayload {
  firstSessionDate: string;
  quarterEndDate?: string;
  cadenceType: CadenceType;
  daysOfWeek: string;
  preferredStartTime: string;
  durationMinutes: number;
  targetOccurrences: number;
}

export interface SeriesPreviewResponseData {
  targetOccurrences: number;
  generatedOccurrences: number;
  shortfall: number;
  hasShortfall: boolean;
  shortfallMessage: string;
  previewDates: GeneratedDatePreviewItem[];
}

export interface CreateScheduleSeriesPayload {
  assignmentId?: number;
  skillRequestId?: number;
  title: string;
  cadenceType: CadenceType;
  daysOfWeek: string;
  preferredStartTime: string;
  durationMinutes: number;
  meetingMode?: SessionMeetingMode;
  meetingLocation?: string;
  firstSessionDate: string;
  quarterEndDate?: string;
  targetOccurrences: number;
  targetPmsGoalId?: number;
}

export interface ScheduleSeriesItem {
  id: number;
  assignmentId: number | null;
  skillRequestId: number | null;
  coachEmployeeId: number;
  coachFullName: string;
  title: string;
  cadenceType: CadenceType;
  daysOfWeek: string;
  preferredStartTime: string;
  durationMinutes: number;
  meetingMode: SessionMeetingMode;
  meetingLocation: string | null;
  firstSessionDate: string;
  targetOccurrences: number;
  generatedOccurrences: number;
  status: SeriesStatus;
  createdAt: string;
}

export const coachingGovernanceApi = {
  async getPolicies(pathway?: string): Promise<CoachingPolicyVersionItem[]> {
    const res = await apiClient.get<ApiResponse<CoachingPolicyVersionItem[]>>(
      `/coaching/governance/policies`,
      { params: { pathway } }
    );
    return res.data.data;
  },

  async updatePolicy(
    id: number,
    payload: Partial<CoachingPolicyVersionItem>
  ): Promise<CoachingPolicyVersionItem> {
    const res = await apiClient.put<ApiResponse<CoachingPolicyVersionItem>>(
      `/coaching/governance/policies/${id}`,
      payload
    );
    return res.data.data;
  },

  async createPolicy(
    payload: Partial<CoachingPolicyVersionItem>
  ): Promise<CoachingPolicyVersionItem> {
    const res = await apiClient.post<ApiResponse<CoachingPolicyVersionItem>>(
      `/coaching/governance/policies`,
      payload
    );
    return res.data.data;
  },

  async getTarget(params: { assignmentId?: number; skillRequestId?: number }): Promise<CoachingSessionTargetItem> {
    const res = await apiClient.get<ApiResponse<CoachingSessionTargetItem>>(
      `/coaching/governance/target`,
      { params }
    );
    return res.data.data;
  },

  async proposeTarget(payload: {
    assignmentId?: number;
    skillRequestId?: number;
    proposedTarget: number;
    justificationReason: string;
  }): Promise<CoachingSessionTargetItem> {
    const res = await apiClient.post<ApiResponse<CoachingSessionTargetItem>>(
      `/coaching/governance/target/propose`,
      payload
    );
    return res.data.data;
  },

  async reviewAdjustment(
    adjustmentId: number,
    payload: { decision: AdjustmentDecision; decisionNotes?: string }
  ): Promise<CoachingSessionTargetItem> {
    const res = await apiClient.post<ApiResponse<CoachingSessionTargetItem>>(
      `/coaching/governance/adjustments/${adjustmentId}/review`,
      payload
    );
    return res.data.data;
  },

  async requestExtension(
    targetId: number,
    payload: { additionalSessions: number; reason: string; remainingObjectivesSummary?: string }
  ): Promise<CoachingSessionTargetItem> {
    const res = await apiClient.post<ApiResponse<CoachingSessionTargetItem>>(
      `/coaching/governance/target/${targetId}/extend`,
      payload
    );
    return res.data.data;
  },

  async requestEarlyCompletion(
    targetId: number,
    payload: { reason: string; masteryEvidenceSummary?: string }
  ): Promise<CoachingSessionTargetItem> {
    const res = await apiClient.post<ApiResponse<CoachingSessionTargetItem>>(
      `/coaching/governance/target/${targetId}/early-complete`,
      payload
    );
    return res.data.data;
  },

  async previewSeries(payload: SeriesPreviewRequestPayload): Promise<SeriesPreviewResponseData> {
    const res = await apiClient.post<ApiResponse<SeriesPreviewResponseData>>(
      `/coaching/governance/series/preview`,
      payload
    );
    return res.data.data;
  },

  async createSeries(payload: CreateScheduleSeriesPayload): Promise<ScheduleSeriesItem> {
    const res = await apiClient.post<ApiResponse<ScheduleSeriesItem>>(
      `/coaching/governance/series`,
      payload
    );
    return res.data.data;
  },
};

