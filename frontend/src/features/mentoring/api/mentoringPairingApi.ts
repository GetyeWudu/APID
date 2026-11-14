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

export interface MentoringRelationshipPair {
  memberId: number;
  relationshipId: number;
  requestId: number;
  requestType: MentoringRequestType;
  relationshipStatus: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'REASSIGNED';
  memberStatus: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  currentUserRole: 'MENTOR' | 'TRAINEE';
  mentorUserId: number;
  mentorName: string;
  traineeUserId: number;
  traineeName: string;
  skillId: number | null;
  skillName: string | null;
  message: string | null;
  startedAt: string;
  joinedAt: string;
  endedAt: string | null;
  memberEndedAt: string | null;
}

export interface MentoringPairingDetail {
  relationshipId: number;
  requestId: number;
  requestType: MentoringRequestType;
  status: MentoringRelationshipPair['relationshipStatus'];
  mentorUserId: number;
  mentorName: string;
  skillName: string | null;
  requestMessage: string | null;
  startedAt: string;
  endedAt: string | null;
  currentUserRole: 'MENTOR' | 'TRAINEE';
  trainees: {
    userId: number;
    name: string;
    status: MentoringRelationshipPair['memberStatus'];
    joinedAt: string;
    endedAt: string | null;
  }[];
}

export type MentoringDeliveryMode = 'ONLINE' | 'IN_PERSON' | 'HYBRID';
export type MentoringSessionStatus = 'SCHEDULED' | 'COMPLETED' | 'MISSED' | 'CANCELLED' | 'RESCHEDULED';

export interface MentoringSession {
  id: number;
  relationshipId: number;
  title: string;
  agenda: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  deliveryMode: MentoringDeliveryMode;
  meetingUrl: string | null;
  status: MentoringSessionStatus;
  createdByUserId: number;
  createdByName: string;
  createdAt: string;
}

export interface MentoringChatMessage {
  id: number;
  relationshipId: number;
  senderUserId: number;
  senderName: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

export interface MentoringChatHistory {
  messages: MentoringChatMessage[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export const mentoringPairingApi = {
  async listMyRequests(): Promise<MentoringPairing[]> {
    const response = await apiClient.get<ApiResponse<MentoringPairing[]>>('/mentoring/pairing/requests');
    return response.data.data;
  },

  async listMyRelationships(): Promise<MentoringRelationshipPair[]> {
    const response = await apiClient.get<ApiResponse<MentoringRelationshipPair[]>>(
      '/mentoring/pairing/relationships'
    );
    return response.data.data;
  },

  async getRelationshipDetail(relationshipId: number): Promise<MentoringPairingDetail> {
    const response = await apiClient.get<ApiResponse<MentoringPairingDetail>>(
      `/mentoring/pairing/relationships/${relationshipId}`
    );
    return response.data.data;
  },

  async listSessions(relationshipId: number): Promise<MentoringSession[]> {
    const response = await apiClient.get<ApiResponse<MentoringSession[]>>(
      `/mentoring/pairing/relationships/${relationshipId}/sessions`
    );
    return response.data.data;
  },

  async listMySessions(): Promise<MentoringSession[]> {
    const response = await apiClient.get<ApiResponse<MentoringSession[]>>('/mentoring/pairing/sessions');
    return response.data.data;
  },

  async createSession(
    relationshipId: number,
    input: {
      title: string;
      agenda?: string;
      scheduledStart: string;
      scheduledEnd: string;
      deliveryMode: MentoringDeliveryMode;
      meetingUrl?: string;
    }
  ): Promise<MentoringSession> {
    const response = await apiClient.post<ApiResponse<MentoringSession>>(
      `/mentoring/pairing/relationships/${relationshipId}/sessions`,
      input
    );
    return response.data.data;
  },

  async listMessages(
    relationshipId: number,
    page: number,
    size = 50
  ): Promise<MentoringChatHistory> {
    const response = await apiClient.get<ApiResponse<MentoringChatHistory>>(
      `/mentoring/pairing/relationships/${relationshipId}/messages`,
      { params: { page, size } }
    );
    return response.data.data;
  },

  async sendMessage(relationshipId: number, body: string): Promise<MentoringChatMessage> {
    const response = await apiClient.post<ApiResponse<MentoringChatMessage>>(
      `/mentoring/pairing/relationships/${relationshipId}/messages`,
      { body }
    );
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
