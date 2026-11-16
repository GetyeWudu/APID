import { apiClient, ApiResponse } from '../../../shared/api/apiClient';

export type ConversationType = 'DIRECT' | 'GROUP';
export type ConversationContextType =
  | 'MANDATORY_ASSIGNMENT'
  | 'SKILL_COHORT_GROUP'
  | 'SKILL_PEER_DIRECT'
  | 'MENTORING_RELATIONSHIP_DIRECT'
  | 'MENTORING_COHORT_GROUP'
  | 'MENTORING_PEER_DIRECT';
export type ConversationStatus = 'ACTIVE' | 'ARCHIVED';
export type ConversationParticipantRole = 'COACH' | 'COACHEE' | 'PEER' | 'TRAINER' | 'TRAINEE';
export type ParticipantStatus = 'ACTIVE' | 'REMOVED';
export type MessageType = 'TEXT' | 'FILE' | 'RESOURCE_LINK';
export type AttachmentScanStatus = 'PENDING' | 'CLEAN' | 'REJECTED';

export interface ParticipantDto {
  id: number;
  employeeId: number;
  userId?: number;
  employeeNumber?: string;
  fullName?: string;
  email?: string;
  jobTitle?: string;
  role: ConversationParticipantRole;
  status: ParticipantStatus;
  joinedAt: string;
  leftAt?: string;
}

export interface AttachmentDto {
  id: number;
  messageId?: number | null;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  downloadUrl: string;
  scanStatus: AttachmentScanStatus;
  createdAt: string;
}

export interface MessageDto {
  id: number;
  conversationId: number;
  senderEmployeeId: number;
  senderUserId: number;
  senderName: string;
  senderRole?: ConversationParticipantRole;
  messageType: MessageType;
  content: string;
  clientMessageId?: string;
  replyToMessageId?: number;
  replyToSnippet?: string;
  replyToSenderName?: string;
  pinned: boolean;
  pinnedByName?: string;
  pinnedAt?: string;
  deleted: boolean;
  createdAt: string;
  attachments: AttachmentDto[];
}

export interface ConversationSummaryDto {
  id: number;
  conversationType: ConversationType;
  contextType: ConversationContextType;
  assignmentId?: number;
  skillRequestId?: number;
  mentoringRelationshipId?: number | null;
  skillId?: number | null;
  peerEmployeeAId?: number;
  peerEmployeeBId?: number;
  title: string;
  status: ConversationStatus;
  unreadCount: number;
  lastMessageSnippet?: string;
  lastMessageAt?: string;
  lastMessageSenderName?: string;
  updatedAt?: string;
  participants: ParticipantDto[];
  pinnedMessages: MessageDto[];
}

export interface SendMessageRequest {
  messageType?: MessageType;
  content: string;
  clientMessageId?: string;
  replyToMessageId?: number;
  attachmentIds?: number[];
}

export interface CreatePeerConversationRequest {
  skillRequestId: number;
  targetEmployeeId: number;
}

export const coachingCommunicationApi = {
  /**
   * Retrieves all active coaching conversations for the current authenticated user.
   */
  getMyConversations: async (): Promise<ConversationSummaryDto[]> => {
    const res = await apiClient.get<ApiResponse<ConversationSummaryDto[]>>('/coaching/conversations');
    return res.data.data;
  },

  /**
   * Retrieves metadata and participants of a specific conversation.
   */
  getConversation: async (id: number): Promise<ConversationSummaryDto> => {
    const res = await apiClient.get<ApiResponse<ConversationSummaryDto>>(`/coaching/conversations/${id}`);
    return res.data.data;
  },

  /**
   * Retrieves message history or incremental updates with cursor pagination.
   */
  getMessages: async (
    conversationId: number,
    params?: { beforeId?: number; afterId?: number; limit?: number }
  ): Promise<MessageDto[]> => {
    const res = await apiClient.get<ApiResponse<MessageDto[]>>(
      `/coaching/conversations/${conversationId}/messages`,
      { params }
    );
    return res.data.data;
  },

  /**
   * Sends a message into a conversation.
   */
  sendMessage: async (conversationId: number, request: SendMessageRequest): Promise<MessageDto> => {
    const res = await apiClient.post<ApiResponse<MessageDto>>(
      `/coaching/conversations/${conversationId}/messages`,
      request
    );
    return res.data.data;
  },

  /**
   * Advances the user's read marker in the conversation.
   */
  markRead: async (conversationId: number, lastReadMessageId: number): Promise<void> => {
    await apiClient.post(`/coaching/conversations/${conversationId}/read`, { lastReadMessageId });
  },

  /**
   * Toggles the pinned status of a message (Coach only).
   */
  togglePinMessage: async (conversationId: number, messageId: number): Promise<MessageDto> => {
    const res = await apiClient.post<ApiResponse<MessageDto>>(
      `/coaching/conversations/${conversationId}/messages/${messageId}/pin`
    );
    return res.data.data;
  },

  /**
   * Resolves or starts a private 1-on-1 peer chat between two cohort employees.
   */
  getOrCreatePeerConversation: async (request: CreatePeerConversationRequest): Promise<ConversationSummaryDto> => {
    const res = await apiClient.post<ApiResponse<ConversationSummaryDto>>(
      '/coaching/conversations/peer',
      request
    );
    return res.data.data;
  },

  /**
   * Uploads an attachment to be associated with an upcoming message.
   */
  uploadAttachment: async (conversationId: number, file: File): Promise<AttachmentDto> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<ApiResponse<AttachmentDto>>(
      `/coaching/conversations/${conversationId}/attachments`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return res.data.data;
  },

  /**
   * Helper to build the authenticated download URL.
   */
  getAttachmentDownloadUrl: (attachmentId: number): string => {
    return `/api/v1/coaching/conversations/attachments/${attachmentId}`;
  },

  /**
   * Downloads an attachment using the authenticated apiClient and triggers browser file save.
   */
  downloadAttachment: async (attachmentId: number, fileName: string): Promise<void> => {
    const res = await apiClient.get<Blob>(
      `/coaching/conversations/attachments/${attachmentId}`,
      { responseType: 'blob' }
    );
    const blob = new Blob([res.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

