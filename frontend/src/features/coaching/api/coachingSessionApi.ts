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

  async getJoinToken(id: number): Promise<SessionJoinToken> {
    const res = await apiClient.get<ApiResponse<SessionJoinToken>>(
      `/coaching/sessions/${id}/join-token`
    );
    return res.data.data;
  },
};

