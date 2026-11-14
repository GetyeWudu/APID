import { useRef, useState, type FormEvent } from 'react';
import axios from 'axios';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  MessageCircle,
  Send,
  Video,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  StatusPill,
  useToast,
} from '../../../shared/components/ui';
import {
  mentoringPairingApi,
  type MentoringDeliveryMode,
  type MentoringSession,
} from '../api/mentoringPairingApi';

type DetailTab = 'overview' | 'sessions' | 'chat';

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

function sessionStatusTone(status: MentoringSession['status']) {
  if (status === 'COMPLETED') return 'ok';
  if (status === 'SCHEDULED') return 'info';
  if (status === 'MISSED') return 'err';
  return 'neutral';
}

export function MentoringPairingDetailPage() {
  const { relationshipId: rawRelationshipId } = useParams();
  const relationshipId = Number(rawRelationshipId);
  const isValidRelationshipId = Number.isSafeInteger(relationshipId) && relationshipId > 0;
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [messageBody, setMessageBody] = useState('');
  const sessionFormRef = useRef<HTMLFormElement>(null);
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const detailQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'detail', relationshipId],
    queryFn: () => mentoringPairingApi.getRelationshipDetail(relationshipId),
    enabled: isValidRelationshipId,
  });
  const sessionsQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'sessions', relationshipId],
    queryFn: () => mentoringPairingApi.listSessions(relationshipId),
    enabled: isValidRelationshipId && activeTab === 'sessions',
  });
  const chatQuery = useInfiniteQuery({
    queryKey: ['mentoring', 'pairing', 'messages', relationshipId],
    queryFn: ({ pageParam }) => mentoringPairingApi.listMessages(relationshipId, pageParam, 50),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    enabled: isValidRelationshipId && activeTab === 'chat',
    refetchInterval: activeTab === 'chat' ? 10000 : false,
  });

  const createSessionMutation = useMutation({
    mutationFn: (input: {
      title: string;
      agenda?: string;
      scheduledStart: string;
      scheduledEnd: string;
      deliveryMode: MentoringDeliveryMode;
      meetingUrl?: string;
    }) => mentoringPairingApi.createSession(relationshipId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['mentoring', 'pairing', 'sessions', relationshipId],
      });
      sessionFormRef.current?.reset();
      pushToast({ title: 'Session scheduled', message: 'Your pairing can now see the session.', tone: 'ok' });
    },
    onError: (error: unknown) =>
      pushToast({
        title: 'Unable to schedule session',
        message: getErrorMessage(error, 'Please try again.'),
        tone: 'err',
      }),
  });

  const sendMessageMutation = useMutation({
    mutationFn: (body: string) => mentoringPairingApi.sendMessage(relationshipId, body),
    onSuccess: async () => {
      setMessageBody('');
      await queryClient.invalidateQueries({
        queryKey: ['mentoring', 'pairing', 'messages', relationshipId],
      });
    },
    onError: (error: unknown) =>
      pushToast({
        title: 'Unable to send message',
        message: getErrorMessage(error, 'Please try again.'),
        tone: 'err',
      }),
  });

  if (!isValidRelationshipId) {
    return (
      <div className="apid-card">
        <EmptyState
          title="Invalid Pairing"
          description="The pairing identifier in this link is not valid."
          action={<Link className="apid-btn apid-btn-primary apid-btn-sm" to="/mentoring/pairing">Back to My Pairing</Link>}
        />
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return <LoadingSkeleton rows={6} height={28} />;
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
    detail.status === 'ACTIVE' &&
    (detail.currentUserRole === 'MENTOR' || currentTrainee?.status === 'ACTIVE');
  const messages = (chatQuery.data?.pages ?? [])
    .slice()
    .reverse()
    .flatMap((page) => page.messages);

  const handleCreateSession = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const scheduledStart = String(formData.get('scheduledStart') ?? '');
    const scheduledEnd = String(formData.get('scheduledEnd') ?? '');
    if (!scheduledStart || !scheduledEnd) return;

    createSessionMutation.mutate({
      title: String(formData.get('title') ?? '').trim(),
      agenda: String(formData.get('agenda') ?? '').trim() || undefined,
      scheduledStart: new Date(scheduledStart).toISOString(),
      scheduledEnd: new Date(scheduledEnd).toISOString(),
      deliveryMode: String(formData.get('deliveryMode')) as MentoringDeliveryMode,
      meetingUrl: String(formData.get('meetingUrl') ?? '').trim() || undefined,
    });
  };

  const handleSendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = messageBody.trim();
    if (body && canChat) {
      sendMessageMutation.mutate(body);
    }
  };

  return (
    <div className="boa-stack">
      <PageHeader
        title={detail.requestType === 'GROUP' ? 'Mentoring Class' : 'Mentoring Pair'}
        subtitle={`Mentor: ${detail.mentorName} · ${detail.trainees.length} trainee${detail.trainees.length === 1 ? '' : 's'}`}
        source="live"
        actions={
          <Link to="/mentoring/pairing" className="apid-btn apid-btn-outline apid-btn-sm">
            <ArrowLeft size={15} /> My Pairing
          </Link>
        }
      />

      <div role="tablist" aria-label="Pairing details" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {([
          ['overview', 'Overview'],
          ['sessions', 'Sessions'],
          ['chat', 'Pair chat'],
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            id={`pairing-tab-${tab}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`apid-btn apid-btn-sm ${activeTab === tab ? 'apid-btn-primary' : 'apid-btn-outline'}`}
            onClick={() => setActiveTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <section className="apid-card">
          <div className="boa-card-header">
            <div>
              <h2 className="boa-card-title">Pairing details</h2>
              <p className="boa-card-subtitle">
                Started {formatDateTime(detail.startedAt)}
                {detail.skillName ? ` · ${detail.skillName}` : ''}
              </p>
            </div>
            <StatusPill label={detail.status} tone={detail.status === 'ACTIVE' ? 'ok' : 'neutral'} />
          </div>
          {detail.requestMessage && <p className="boa-muted">{detail.requestMessage}</p>}
          <h3 style={{ margin: '1.1rem 0 0.6rem' }}>Trainees in this pairing</h3>
          {detail.trainees.length === 0 ? (
            <EmptyState title="No trainees listed" description="No trainee memberships were found." />
          ) : (
            <div className="boa-grid-2" style={{ marginBottom: 0 }}>
              {detail.trainees.map((trainee) => (
                <article key={trainee.userId} className="apid-card" style={{ border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.7rem' }}>
                    <strong>{trainee.name}</strong>
                    <StatusPill
                      label={trainee.status}
                      tone={trainee.status === 'ACTIVE' ? 'ok' : 'neutral'}
                    />
                  </div>
                  <p className="boa-muted" style={{ margin: '0.5rem 0 0', fontSize: '0.84rem' }}>
                    Joined {formatDateTime(trainee.joinedAt)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'sessions' && (
        <div className="boa-stack">
          {detail.currentUserRole === 'MENTOR' && detail.status === 'ACTIVE' && (
            <form ref={sessionFormRef} className="apid-card boa-stack" onSubmit={handleCreateSession}>
              <div>
                <h2 className="boa-card-title">Schedule a session</h2>
                <p className="boa-card-subtitle">This session will be shared with the whole pairing or class.</p>
              </div>
              <label>
                Session title
                <input className="apid-input" name="title" maxLength={180} required />
              </label>
              <label>
                Agenda
                <textarea className="apid-input" name="agenda" maxLength={2000} rows={3} />
              </label>
              <div className="boa-grid-2">
                <label>
                  Starts
                  <input className="apid-input" name="scheduledStart" type="datetime-local" required />
                </label>
                <label>
                  Ends
                  <input className="apid-input" name="scheduledEnd" type="datetime-local" required />
                </label>
              </div>
              <div className="boa-grid-2">
                <label>
                  Delivery mode
                  <select className="apid-input" name="deliveryMode" defaultValue="ONLINE">
                    <option value="ONLINE">Online</option>
                    <option value="IN_PERSON">In person</option>
                    <option value="HYBRID">Hybrid</option>
                  </select>
                </label>
                <label>
                  Meeting link (optional)
                  <input className="apid-input" name="meetingUrl" type="url" maxLength={1000} />
                </label>
              </div>
              <div>
                <button
                  type="submit"
                  className="apid-btn apid-btn-primary apid-btn-sm"
                  disabled={createSessionMutation.isPending}
                >
                  <CalendarDays size={15} />
                  {createSessionMutation.isPending ? 'Scheduling…' : 'Schedule session'}
                </button>
              </div>
            </form>
          )}
          {sessionsQuery.isLoading ? (
            <LoadingSkeleton rows={4} height={28} />
          ) : sessionsQuery.isError ? (
            <ErrorState
              message={getErrorMessage(sessionsQuery.error, 'Unable to load session history.')}
              onRetry={() => void sessionsQuery.refetch()}
            />
          ) : (sessionsQuery.data ?? []).length === 0 ? (
            <div className="apid-card">
              <EmptyState title="No sessions yet" description="Scheduled and previous sessions will appear here." />
            </div>
          ) : (
            <section className="apid-card">
              <div className="boa-card-header">
                <div>
                  <h2 className="boa-card-title">Session history</h2>
                  <p className="boa-card-subtitle">Upcoming sessions and previous meetings for this pairing.</p>
                </div>
              </div>
              <div className="boa-stack">
                {(sessionsQuery.data ?? []).map((session) => (
                  <article key={session.id} className="apid-card" style={{ border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.7rem', flexWrap: 'wrap' }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{session.title}</h3>
                        <p className="boa-muted" style={{ margin: '0.3rem 0 0', fontSize: '0.84rem' }}>
                          {formatDateTime(session.scheduledStart)} – {formatDateTime(session.scheduledEnd)}
                        </p>
                      </div>
                      <StatusPill label={session.status} tone={sessionStatusTone(session.status)} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.7rem' }}>
                      <StatusPill label={session.deliveryMode.replace('_', ' ')} tone="neutral" />
                      {session.meetingUrl && (
                        <a
                          href={session.meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="apid-btn apid-btn-outline apid-btn-sm"
                        >
                          <Video size={15} /> Join meeting
                        </a>
                      )}
                    </div>
                    {session.agenda && <p className="boa-muted">{session.agenda}</p>}
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {activeTab === 'chat' && (
        <section className="apid-card">
          <div className="boa-card-header">
            <div>
              <h2 className="boa-card-title">Pair chat</h2>
              <p className="boa-card-subtitle">Conversation shared by the mentor and all trainees in this pairing.</p>
            </div>
            <MessageCircle size={20} aria-hidden="true" />
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
                    {chatQuery.isFetchingNextPage ? 'Loading…' : 'Load older messages'}
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
                    {message.mine ? 'You' : message.senderName} · {formatDateTime(message.createdAt)}
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
              placeholder={canChat ? 'Write a message to this pairing…' : 'This pairing chat is read-only.'}
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
        </section>
      )}
    </div>
  );
}
