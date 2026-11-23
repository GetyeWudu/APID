import { useState, useEffect } from 'react';
import axios from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import { apiClient, type ApiErrorPayload } from '../../../shared/api/apiClient';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatusPill,
} from '../../../shared/components/ui';
import { mentoringPairingApi } from '../api/mentoringPairingApi';
import type { MessageDto } from '../../coaching/api/coachingCommunicationApi';
import { MessageThreadView } from '../../coaching/components/chat/MessageThreadView';
import { MessageComposer } from '../../coaching/components/chat/MessageComposer';

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    return error.response?.data?.message ?? error.message;
  }
  return error instanceof Error ? error.message : fallback;
}

export function MentoringPairChatPanel({
  relationshipId,
  showPairingLink = true,
}: {
  relationshipId: number;
  showPairingLink?: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [replyToMessage, setReplyToMessage] = useState<MessageDto | null>(null);

  // 1. Fetch relationship metadata
  const detailQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'detail', relationshipId],
    queryFn: () => mentoringPairingApi.getRelationshipDetail(relationshipId),
  });

  // 2. Fetch or auto-provision the conversation for this relationship
  const conversationQuery = useQuery({
    queryKey: ['mentoring', 'relationship', 'conversation', relationshipId],
    queryFn: () => mentoringPairingApi.getRelationshipConversation(relationshipId),
    enabled: !!detailQuery.data,
  });

  const conversationId = conversationQuery.data?.id;

  // 3. Fetch conversation messages with 3s live polling fallback
  const messagesQuery = useQuery({
    queryKey: ['mentoring', 'conversation', conversationId, 'messages'],
    queryFn: () => mentoringPairingApi.getConversationMessages(conversationId!),
    enabled: !!conversationId,
    refetchInterval: 3000,
  });

  const messages = messagesQuery.data ?? [];

  // 4. Automatically advance read marker when new messages are loaded
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.id) {
        void mentoringPairingApi.markConversationRead(conversationId, lastMessage.id);
      }
    }
  }, [conversationId, messages]);

  const detail = detailQuery.data;
  const traineeLabel = detail
    ? detail.requestType === 'GROUP'
      ? `${detail.trainees.length} trainee${detail.trainees.length === 1 ? '' : 's'}`
      : `Trainee: ${detail.trainees[0]?.name ?? 'Not listed'}`
    : '';
  const currentTrainee = detail?.trainees.find((t) => t.userId === user?.id);
  const canSendMessages =
    detail?.status === 'ACTIVE' &&
    (detail.currentUserRole === 'MENTOR' || currentTrainee?.status === 'ACTIVE');

  const handleTogglePin = async (msg: MessageDto) => {
    if (!conversationId) return;
    try {
      await apiClient.post(`/mentoring/conversations/${conversationId}/messages/${msg.id}/pin`);
      await queryClient.invalidateQueries({
        queryKey: ['mentoring', 'conversation', conversationId, 'messages'],
      });
    } catch (err) {
      console.error('Failed to toggle pin on message', err);
    }
  };

  if (detailQuery.isLoading || (detailQuery.data && conversationQuery.isLoading)) {
    return <LoadingSkeleton rows={5} height={28} />;
  }

  if (detailQuery.isError || !detail) {
    return (
      <ErrorState
        message={getErrorMessage(detailQuery.error, 'Unable to load this mentoring pairing.')}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  if (conversationQuery.isError || !conversationQuery.data) {
    return (
      <ErrorState
        message={getErrorMessage(conversationQuery.error, 'Unable to load conversation for this relationship.')}
        onRetry={() => void conversationQuery.refetch()}
      />
    );
  }

  return (
    <section className="apid-card mentoring-chat-panel">
      <div className="boa-card-header" style={{ flexShrink: 0 }}>
        <div>
          <h2 className="boa-card-title">
            Chat with {detail.requestType === 'GROUP' ? 'your class' : 'your pairing'}
          </h2>
          <p className="boa-card-subtitle">
            Mentor: {detail.mentorName} · {traineeLabel}
            {detail.skillName ? ` · ${detail.skillName}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <StatusPill label={detail.status} tone={detail.status === 'ACTIVE' ? 'ok' : 'neutral'} />
          <MessageCircle size={20} aria-hidden="true" />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        {messagesQuery.isLoading ? (
          <LoadingSkeleton rows={5} height={28} />
        ) : messagesQuery.isError ? (
          <ErrorState
            message={getErrorMessage(messagesQuery.error, 'Unable to load chat history.')}
            onRetry={() => void messagesQuery.refetch()}
          />
        ) : messages.length === 0 ? (
          <EmptyState
            title="No messages yet"
            description="Start the conversation with your mentoring pairing. You can send messages, attach files, and share resources."
          />
        ) : (
          <MessageThreadView
            messages={messages}
            currentUserId={user?.id}
            isCoachOrAdmin={detail.currentUserRole === 'MENTOR'}
            onReplyMessage={(msg) => setReplyToMessage(msg)}
            onTogglePinMessage={(msg) => void handleTogglePin(msg)}
            downloadAttachmentFn={(attId, fName) =>
              mentoringPairingApi.downloadConversationAttachment(attId, fName)
            }
          />
        )}
      </div>

      {conversationId && (
        <MessageComposer
          conversationId={conversationId}
          replyToMessage={replyToMessage}
          onCancelReply={() => setReplyToMessage(null)}
          onMessageSent={() => {
            setReplyToMessage(null);
            void messagesQuery.refetch();
          }}
          disabled={!canSendMessages}
          uploadAttachmentFn={(cId, file) =>
            mentoringPairingApi.uploadConversationAttachment(cId, file)
          }
          sendMessageFn={(cId, req) =>
            mentoringPairingApi.sendConversationMessage(cId, {
              ...req,
              content: req.content ?? '',
            })
          }
        />
      )}

      {!canSendMessages && (
        <p className="boa-muted" style={{ marginTop: '0.5rem', marginBottom: 0, fontSize: '0.82rem', flexShrink: 0 }}>
          {detail.status === 'PAUSED'
            ? 'This relationship is paused. You can still read chat history, but sending messages is unavailable.'
            : 'This relationship is closed or your membership is inactive. Chat history remains available to read.'}
        </p>
      )}

      {showPairingLink && (
        <div style={{ marginTop: '0.75rem', flexShrink: 0 }}>
          <Link to={`/mentoring/pairing/${relationshipId}`} className="apid-btn apid-btn-outline apid-btn-sm">
            Back to pairing details
          </Link>
        </div>
      )}
    </section>
  );
}
