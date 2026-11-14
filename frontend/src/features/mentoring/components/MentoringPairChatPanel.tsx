import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatusPill,
  useToast,
} from '../../../shared/components/ui';
import { mentoringPairingApi } from '../api/mentoringPairingApi';

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    return error.response?.data?.message ?? error.message;
  }
  return error instanceof Error ? error.message : fallback;
}

export function MentoringPairChatPanel({ relationshipId }: { relationshipId: number }) {
  const { user } = useAuth();
  const [messageBody, setMessageBody] = useState('');
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const detailQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'detail', relationshipId],
    queryFn: () => mentoringPairingApi.getRelationshipDetail(relationshipId),
  });
  const chatQuery = useInfiniteQuery({
    queryKey: ['mentoring', 'pairing', 'messages', relationshipId],
    queryFn: ({ pageParam }) => mentoringPairingApi.listMessages(relationshipId, pageParam, 50),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    refetchInterval: 10000,
  });
  const sendMessageMutation = useMutation({
    mutationFn: (body: string) => mentoringPairingApi.sendMessage(relationshipId, body),
    onSuccess: async () => {
      setMessageBody('');
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['mentoring', 'pairing', 'messages', relationshipId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['mentoring', 'pairing', 'messages-preview', relationshipId],
        }),
      ]);
    },
    onError: (error: unknown) =>
      pushToast({
        title: 'Unable to send message',
        message: getErrorMessage(error, 'Please try again.'),
        tone: 'err',
      }),
  });

  if (detailQuery.isLoading) {
    return <LoadingSkeleton rows={5} height={28} />;
  }
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorState
        message={getErrorMessage(detailQuery.error, 'Unable to load this mentoring pairing.')}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const detail = detailQuery.data;
  const currentTrainee = detail.trainees.find((trainee) => trainee.userId === user?.id);
  const canChat =
    (detail.status === 'ACTIVE' || detail.status === 'PAUSED') &&
    (detail.currentUserRole === 'MENTOR' || currentTrainee?.status === 'ACTIVE');
  const messages = (chatQuery.data?.pages ?? [])
    .slice()
    .reverse()
    .flatMap((page) => page.messages);

  const handleSendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = messageBody.trim();
    if (body && canChat) {
      sendMessageMutation.mutate(body);
    }
  };

  return (
    <section className="apid-card">
      <div className="boa-card-header">
        <div>
          <h2 className="boa-card-title">Chat with {detail.requestType === 'GROUP' ? 'your class' : 'your pairing'}</h2>
          <p className="boa-card-subtitle">
            Mentor: {detail.mentorName} · {detail.trainees.length} trainee
            {detail.trainees.length === 1 ? '' : 's'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <StatusPill label={detail.status} tone={detail.status === 'ACTIVE' ? 'ok' : 'neutral'} />
          <MessageCircle size={20} aria-hidden="true" />
        </div>
      </div>
      {chatQuery.isLoading ? (
        <LoadingSkeleton rows={5} height={28} />
      ) : chatQuery.isError ? (
        <ErrorState
          message={getErrorMessage(chatQuery.error, 'Unable to load chat history.')}
          onRetry={() => void chatQuery.refetch()}
        />
      ) : messages.length === 0 ? (
        <EmptyState title="No messages yet" description="Start the conversation with your mentoring pairing." />
      ) : (
        <div className="boa-stack" aria-live="polite">
          {chatQuery.hasNextPage && (
            <div>
              <button
                type="button"
                className="apid-btn apid-btn-outline apid-btn-sm"
                disabled={chatQuery.isFetchingNextPage}
                onClick={() => void chatQuery.fetchNextPage()}
              >
                {chatQuery.isFetchingNextPage ? 'Loading...' : 'Load older messages'}
              </button>
            </div>
          )}
          {messages.map((message) => (
            <article
              key={message.id}
              className="apid-card"
              style={{
                border: '1px solid var(--border)',
                alignSelf: message.mine ? 'flex-end' : 'flex-start',
                maxWidth: 'min(90%, 680px)',
              }}
            >
              <div className="boa-muted" style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                {message.mine ? 'You' : message.senderName} | {formatDateTime(message.createdAt)}
              </div>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.body}</p>
            </article>
          ))}
        </div>
      )}
      <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.55rem', marginTop: '1rem' }}>
        <textarea
          className="apid-input"
          aria-label="Write a message"
          placeholder={canChat ? 'Write a message to this pairing...' : 'This pairing chat is read-only.'}
          maxLength={4000}
          rows={2}
          value={messageBody}
          onChange={(event) => setMessageBody(event.target.value)}
          disabled={!canChat || sendMessageMutation.isPending}
        />
        <button
          type="submit"
          className="apid-btn apid-btn-primary apid-btn-sm"
          aria-label="Send message"
          disabled={!canChat || !messageBody.trim() || sendMessageMutation.isPending}
        >
          <Send size={16} />
        </button>
      </form>
      {!canChat && (
        <p className="boa-muted" style={{ marginBottom: 0, fontSize: '0.82rem' }}>
          This relationship is closed or your membership is inactive. Chat history remains available to read.
        </p>
      )}
      <div style={{ marginTop: '0.75rem' }}>
        <Link to={`/mentoring/pairing/${relationshipId}`} className="apid-btn apid-btn-outline apid-btn-sm">
          Back to pairing details
        </Link>
      </div>
    </section>
  );
}
