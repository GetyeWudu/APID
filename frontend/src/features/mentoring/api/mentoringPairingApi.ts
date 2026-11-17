import { apiClient, type ApiResponse } from '../../../shared/api/apiClient';
import type {
  ConversationSummaryDto,
  MessageDto,
  AttachmentDto,
  SendMessageRequest,
} from '../../coaching/api/coachingCommunicationApi';

export interface EligibleMentoringPeerDto {
  employeeId: number;
  userId: number;
  fullName: string;
  email: string | null;
  jobTitle: string | null;
  skillName: string | null;
  mentorName: string | null;
  relationshipId: number | null;
}

export type MentoringRequestType = 'INDIVIDUAL' | 'GROUP';
export type MentoringRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';

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
export type MentoringSessionStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'DECLINED'
  | 'RESCHEDULE_PROPOSED'
  | 'COMPLETED'
  | 'MISSED'
  | 'CANCELLED'
  | 'RESCHEDULED';

export interface MentoringSession {
  id: number;
  relationshipId: number;
  title: string;
  agenda: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  deliveryMode: MentoringDeliveryMode;
  meetingUrl: string | null;
  location?: string | null;
  status: MentoringSessionStatus;
  declineReason?: string | null;
  rescheduleReason?: string | null;
  proposedStart?: string | null;
  proposedEnd?: string | null;
  respondedAt?: string | null;
  cancellationReason?: string | null;
  notes?: string | null;
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

export interface MentoringResource {
  id: number;
  relationshipId: number;
  title: string;
  resourceType: 'FILE' | 'LINK';
  fileId: number | null;
  fileName: string | null;
  externalUrl: string | null;
  uploadedByName: string;
  createdAt: string;
}

export interface MentoringProgressNote {
  id: number;
  relationshipId: number;
  authorUserId: number;
  authorName: string;
  note: string;
  createdAt: string;
}

export interface MentoringFeedback {
  rating: number;
  feedback: string | null;
  ratedAt: string;
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
      location?: string;
    }
  ): Promise<MentoringSession> {
    const response = await apiClient.post<ApiResponse<MentoringSession>>(
      `/mentoring/pairing/relationships/${relationshipId}/sessions`,
      input
    );
    return response.data.data;
  },

  async respondSession(
    relationshipId: number,
    sessionId: number,
    input: { accept: boolean; declineReason?: string }
  ): Promise<MentoringSession> {
    const response = await apiClient.post<ApiResponse<MentoringSession>>(
      `/mentoring/pairing/relationships/${relationshipId}/sessions/${sessionId}/respond`,
      input
    );
    return response.data.data;
  },

  async submitSessionReport(
    relationshipId: number,
    sessionId: number,
    reportNote: string
  ): Promise<MentoringSession> {
    const response = await apiClient.post<ApiResponse<MentoringSession>>(
      `/mentoring/pairing/relationships/${relationshipId}/sessions/${sessionId}/report`,
      { reportNote }
    );
    return response.data.data;
  },

  async proposeReschedule(
    relationshipId: number,
    sessionId: number,
    input: { proposedStart: string; proposedEnd: string; reason: string }
  ): Promise<MentoringSession> {
    const response = await apiClient.post<ApiResponse<MentoringSession>>(
      `/mentoring/pairing/relationships/${relationshipId}/sessions/${sessionId}/reschedule`,
      input
    );
    return response.data.data;
  },

  async respondReschedule(
    relationshipId: number,
    sessionId: number,
    accept: boolean
  ): Promise<MentoringSession> {
    const response = await apiClient.post<ApiResponse<MentoringSession>>(
      `/mentoring/pairing/relationships/${relationshipId}/sessions/${sessionId}/respond-reschedule`,
      null,
      { params: { accept } }
    );
    return response.data.data;
  },

  async cancelSession(
    relationshipId: number,
    sessionId: number,
    reason: string
  ): Promise<MentoringSession> {
    const response = await apiClient.post<ApiResponse<MentoringSession>>(
      `/mentoring/pairing/relationships/${relationshipId}/sessions/${sessionId}/cancel`,
      { reason }
    );
    return response.data.data;
  },

  async getJoinToken(
    relationshipId: number,
    sessionId: number
  ): Promise<{
    roomName: string;
    token: string;
    roomUrlWithToken: string;
    expiresAt: string;
    isMock: boolean;
  }> {
    const response = await apiClient.get<
      ApiResponse<{
        roomName: string;
        token: string;
        roomUrlWithToken: string;
        expiresAt: string;
        isMock: boolean;
      }>
    >(`/mentoring/pairing/relationships/${relationshipId}/sessions/${sessionId}/join-token`);
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

  async listResources(relationshipId: number): Promise<MentoringResource[]> {
    const response = await apiClient.get<ApiResponse<MentoringResource[]>>(
      `/mentoring/pairing/relationships/${relationshipId}/resources`
    );
    return response.data.data;
  },

  async addResource(
    relationshipId: number,
    input: { title: string; externalUrl?: string; file?: File }
  ): Promise<MentoringResource> {
    const formData = new FormData();
    formData.append('title', input.title);
    if (input.externalUrl) formData.append('externalUrl', input.externalUrl);
    if (input.file) formData.append('file', input.file);
    const response = await apiClient.post<ApiResponse<MentoringResource>>(
      `/mentoring/pairing/relationships/${relationshipId}/resources`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data;
  },

  async downloadResource(relationshipId: number, resourceId: number): Promise<Blob> {
    const response = await apiClient.get<Blob>(
      `/mentoring/pairing/relationships/${relationshipId}/resources/${resourceId}/file`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  async listProgressNotes(relationshipId: number): Promise<MentoringProgressNote[]> {
    const response = await apiClient.get<ApiResponse<MentoringProgressNote[]>>(
      `/mentoring/pairing/relationships/${relationshipId}/progress-notes`
    );
    return response.data.data;
  },

  async addProgressNote(relationshipId: number, note: string): Promise<MentoringProgressNote> {
    const response = await apiClient.post<ApiResponse<MentoringProgressNote>>(
      `/mentoring/pairing/relationships/${relationshipId}/progress-notes`,
      { note }
    );
    return response.data.data;
  },

  async getMyFeedback(relationshipId: number): Promise<MentoringFeedback | null> {
    const response = await apiClient.get<ApiResponse<MentoringFeedback | null>>(
      `/mentoring/pairing/relationships/${relationshipId}/feedback/mine`
    );
    return response.data.data;
  },

  async submitFeedback(
    relationshipId: number,
    input: { rating: number; feedback?: string }
  ): Promise<void> {
    await apiClient.post<ApiResponse<null>>(
      `/mentoring/pairing/relationships/${relationshipId}/feedback`,
      input
    );
  },

  async closeRelationship(
    relationshipId: number,
    input: { status: 'COMPLETED' | 'CANCELLED'; reason: string }
  ): Promise<void> {
    await apiClient.patch<ApiResponse<null>>(
      `/mentoring/pairing/relationships/${relationshipId}/status`,
      input
    );
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
    skillId?: number;
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

  async getRelationshipConversation(relationshipId: number): Promise<ConversationSummaryDto> {
    const response = await apiClient.get<ApiResponse<ConversationSummaryDto>>(
      `/mentoring/relationships/${relationshipId}/conversation`
    );
    return response.data.data;
  },

  async listMentoringConversations(): Promise<ConversationSummaryDto[]> {
    const response = await apiClient.get<ApiResponse<ConversationSummaryDto[]>>(
      '/mentoring/conversations'
    );
    return response.data.data;
  },

  async getConversationMessages(
    conversationId: number,
    afterId?: number,
    beforeId?: number,
    limit = 50
  ): Promise<MessageDto[]> {
    const response = await apiClient.get<ApiResponse<MessageDto[]>>(
      `/mentoring/conversations/${conversationId}/messages`,
      { params: { afterId, beforeId, limit } }
    );
    return response.data.data;
  },

  async sendConversationMessage(
    conversationId: number,
    request: SendMessageRequest
  ): Promise<MessageDto> {
    const response = await apiClient.post<ApiResponse<MessageDto>>(
      `/mentoring/conversations/${conversationId}/messages`,
      request
    );
    return response.data.data;
  },

  async markConversationRead(conversationId: number, lastReadMessageId: number): Promise<void> {
    await apiClient.post(`/mentoring/conversations/${conversationId}/read`, { lastReadMessageId });
  },

  async uploadConversationAttachment(conversationId: number, file: File): Promise<AttachmentDto> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<ApiResponse<AttachmentDto>>(
      `/mentoring/conversations/${conversationId}/attachments`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data;
  },

  async downloadConversationAttachment(attachmentId: number, fileName: string): Promise<void> {
    const response = await apiClient.get<Blob>(
      `/mentoring/conversations/attachments/${attachmentId}`,
      { responseType: 'blob' }
    );
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  async getMyMentoringConversations(): Promise<ConversationSummaryDto[]> {
    const response = await apiClient.get<ApiResponse<ConversationSummaryDto[]>>(
      '/mentoring/conversations'
    );
    return response.data.data;
  },

  async getEligibleMentoringPeers(): Promise<EligibleMentoringPeerDto[]> {
    const response = await apiClient.get<ApiResponse<EligibleMentoringPeerDto[]>>(
      '/mentoring/conversations/peers/eligible'
    );
    return response.data.data;
  },

  async togglePinMessage(conversationId: number, messageId: number): Promise<MessageDto> {
    const response = await apiClient.post<ApiResponse<MessageDto>>(
      `/mentoring/conversations/${conversationId}/messages/${messageId}/pin`
    );
    return response.data.data;
  },

  async createPeerConversation(
    mentoringRelationshipId: number | null | undefined,
    targetEmployeeId: number
  ): Promise<ConversationSummaryDto> {
    const response = await apiClient.post<ApiResponse<ConversationSummaryDto>>(
      '/mentoring/conversations/peer',
      { mentoringRelationshipId, targetEmployeeId }
    );
    return response.data.data;
  },
};
