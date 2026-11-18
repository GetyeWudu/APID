import { useState } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, Check, MessageCircle, Video, X } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  StatusPill,
  useToast,
} from '../../../shared/components/ui';
import { mentoringPairingApi, type MentoringSession } from '../api/mentoringPairingApi';
import { MentoringDailyVideoModal } from '../components/MentoringDailyVideoModal';
import { MentoringSessionDetails } from '../components/MentoringSessionDetails';
import { MentoringSessionReport } from '../components/MentoringSessionReport';
import {
  MentoringFeedbackForm,
  MentoringProgressPanel,
  MentoringRelationshipClosure,
} from '../components/MentoringCollaborationTools';
import { isMentoringSessionDay } from '../utils/mentoringSessionUtils';

type DetailTab = 'overview' | 'sessions' | 'progress';

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

function sessionStatusTone(status: MentoringSession['status'] | 'IN PROGRESS') {
  if (status === 'COMPLETED' || status === 'CONFIRMED') return 'ok';
  if (status === 'SCHEDULED' || status === 'RESCHEDULE_PROPOSED' || status === 'IN PROGRESS') return 'info';
  if (status === 'MISSED' || status === 'DECLINED' || status === 'CANCELLED') return 'err';
  return 'neutral';
}

export function MentoringPairingDetailPage() {
  const { relationshipId: rawRelationshipId } = useParams();
  const relationshipId = Number(rawRelationshipId);
  const isValidRelationshipId = Number.isSafeInteger(relationshipId) && relationshipId > 0;
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab: DetailTab =
    requestedTab === 'sessions' || requestedTab === 'progress' ? requestedTab : 'overview';
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [selectedForVideo, setSelectedForVideo] = useState<MentoringSession | null>(null);
  const setActiveTab = (tab: DetailTab) => {
    const nextParams = new URLSearchParams(searchParams);
    if (tab === 'overview') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', tab);
    }
    setSearchParams(nextParams);
  };

  const detailQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'detail', relationshipId],
    queryFn: () => mentoringPairingApi.getRelationshipDetail(relationshipId),
    enabled: isValidRelationshipId,
  });
  const sessionsQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'sessions', relationshipId],
    queryFn: () => mentoringPairingApi.listSessions(relationshipId),
    enabled: isValidRelationshipId && (activeTab === 'sessions' || activeTab === 'overview'),
  });
  const chatQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'messages-preview', relationshipId],
    queryFn: () => mentoringPairingApi.listMessages(relationshipId, 0, 20),
    enabled: isValidRelationshipId && activeTab === 'overview',
  });
  const invalidateSessionData = () => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'sessions', relationshipId] }),
      queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'my-sessions'] }),
      queryClient.invalidateQueries({ queryKey: ['scheduling', 'calendar'] }),
    ]);
  };
  const acceptSessionMutation = useMutation({
    mutationFn: (sessionId: number) =>
      mentoringPairingApi.respondSession(relationshipId, sessionId, { accept: true }),
    onSuccess: () => {
      pushToast({
        title: 'Session accepted',
        message: 'The confirmed session is now visible to both participants.',
        tone: 'ok',
      });
      invalidateSessionData();
    },
    onError: (error) => {
      pushToast({
        title: 'Unable to accept session',
        message: getErrorMessage(error, 'Could not accept this session invitation.'),
        tone: 'err',
      });
    },
  });
  const respondRescheduleMutation = useMutation({
    mutationFn: (variables: { sessionId: number; accept: boolean }) =>
      mentoringPairingApi.respondReschedule(relationshipId, variables.sessionId, variables.accept),
    onSuccess: (_, variables) => {
      pushToast({
        title: variables.accept ? 'Reschedule accepted' : 'Original time kept',
        message: variables.accept
          ? 'The session now uses the proposed time.'
          : 'The session remains scheduled at its original time.',
        tone: variables.accept ? 'ok' : 'info',
      });
      invalidateSessionData();
    },
    onError: (error) => {
      pushToast({
        title: 'Unable to respond to reschedule',
        message: getErrorMessage(error, 'Could not respond to this reschedule request.'),
        tone: 'err',
      });
    },
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
  const messages = chatQuery.data?.messages ?? [];
  const sessions = sessionsQuery.data ?? [];
  const sessionPriority = (session: MentoringSession) =>
    session.status === 'SCHEDULED' || session.status === 'RESCHEDULE_PROPOSED'
      ? 0
      : session.status === 'CONFIRMED'
        ? 1
        : 2;
  const pairingSessions = [...sessions].sort(
    (a, b) =>
      sessionPriority(a) - sessionPriority(b) ||
      new Date(b.scheduledStart).getTime() - new Date(a.scheduledStart).getTime()
  );
  const hasUnfinishedConfirmedSessions = pairingSessions.some((session) => session.status === 'CONFIRMED');
  const completionBlockedReason = sessionsQuery.isLoading
    ? 'Checking session status before completing the pairing.'
    : sessionsQuery.isError
      ? 'Session status could not be checked. Try again before completing the pairing.'
      : hasUnfinishedConfirmedSessions
        ? 'Submit the report for every confirmed session before completing the pairing.'
        : null;
  const sessionView = detail.currentUserRole === 'MENTOR' ? 'trainer-sessions' : 'trainee-sessions';
  const sessionsPath = `/mentoring?view=${sessionView}&relationshipId=${relationshipId}`;
  const sessionsAction =
    detail.currentUserRole === 'MENTOR' && detail.status === 'ACTIVE' ? 'Create session' : 'My Sessions';
  const chatPath = `/mentoring/chat?relationshipId=${relationshipId}`;
  const resourcesPath = `/mentoring/resources?relationshipId=${relationshipId}`;

  const renderSessionCards = (items: MentoringSession[]) =>
    items.map((session) => {
      const start = new Date(session.scheduledStart).getTime();
      const end = new Date(session.scheduledEnd).getTime();
      const status =
        (session.status === 'SCHEDULED' || session.status === 'CONFIRMED') &&
        start <= Date.now() &&
        end > Date.now()
          ? 'IN PROGRESS'
          : session.status;
      return (
        <article key={session.id} className="apid-card" style={{ border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.7rem', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0 }}>{session.title}</h3>
              <p className="boa-muted" style={{ margin: '0.3rem 0 0', fontSize: '0.84rem' }}>
                {formatDateTime(session.scheduledStart)} to {formatDateTime(session.scheduledEnd)}
              </p>
              <p className="boa-muted" style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
                Scheduled by {session.createdByName}
              </p>
            </div>
            <StatusPill label={status} tone={sessionStatusTone(status)} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.7rem', flexWrap: 'wrap' }}>
            <StatusPill label={session.deliveryMode.replace('_', ' ')} tone="neutral" />
            {(session.deliveryMode === 'ONLINE' || session.deliveryMode === 'HYBRID') &&
              isMentoringSessionDay(session.scheduledStart) &&
              session.status !== 'CANCELLED' &&
              session.status !== 'DECLINED' && (
                <button
                  type="button"
                  onClick={() => setSelectedForVideo(session)}
                  className="apid-btn apid-btn-sm"
                  style={{
                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 600,
                    boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    cursor: 'pointer',
                  }}
                >
                  <Video size={14} /> Join LiveKit Video
                </button>
            )}
          </div>
          <MentoringSessionDetails session={session} />
          <MentoringSessionReport
            session={session}
            isMentor={detail.currentUserRole === 'MENTOR'}
          />
          {session.agenda && <p className="boa-muted">{session.agenda}</p>}
          {session.status === 'DECLINED' && (
            <p className="boa-muted" role="status">
              Declined{session.declineReason ? `: ${session.declineReason}` : '.'}
            </p>
          )}
          {session.status === 'RESCHEDULE_PROPOSED' && (
            <div className="boa-card" style={{ border: '1px solid var(--border)' }}>
              <strong>Reschedule requested</strong>
              {session.proposedStart && session.proposedEnd && (
                <p className="boa-muted" style={{ margin: '0.35rem 0' }}>
                  Proposed: {formatDateTime(session.proposedStart)} to {formatDateTime(session.proposedEnd)}
                </p>
              )}
              {session.rescheduleReason && <p className="boa-muted" style={{ margin: '0.35rem 0' }}>{session.rescheduleReason}</p>}
              {detail.currentUserRole === 'MENTOR' ? (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.65rem' }}>
                  <button
                    type="button"
                    className="apid-btn apid-btn-primary apid-btn-sm"
                    onClick={() => respondRescheduleMutation.mutate({ sessionId: session.id, accept: true })}
                    disabled={respondRescheduleMutation.isPending}
                  >
                    <Check size={14} /> Accept new time
                  </button>
                  <button
                    type="button"
                    className="apid-btn apid-btn-outline apid-btn-sm"
                    onClick={() => respondRescheduleMutation.mutate({ sessionId: session.id, accept: false })}
                    disabled={respondRescheduleMutation.isPending}
                  >
                    <X size={14} /> Keep original time
                  </button>
                </div>
              ) : (
                <p className="boa-muted" style={{ margin: '0.35rem 0 0' }}>
                  Waiting for the mentor to respond to this proposal.
                </p>
              )}
            </div>
          )}
          {detail.currentUserRole === 'TRAINEE' && session.status === 'SCHEDULED' && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="apid-btn apid-btn-primary apid-btn-sm"
                onClick={() => acceptSessionMutation.mutate(session.id)}
                disabled={acceptSessionMutation.isPending}
              >
                <Check size={14} /> Accept session
              </button>
              <Link to={sessionsPath} className="apid-btn apid-btn-outline apid-btn-sm">
                Propose another time or decline
              </Link>
            </div>
          )}
        </article>
      );
    });

  const renderMessageCards = (items: typeof messages) =>
    items.map((message) => (
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
    ));

  const renderMessageAction = (
    <Link to={chatPath} className="apid-btn apid-btn-primary apid-btn-sm">
      <MessageCircle size={15} /> Message
    </Link>
  );

  return (
    <div className="boa-stack">
      <PageHeader
        title={detail.requestType === 'GROUP' ? 'Mentoring Class' : 'Mentoring Pair'}
        subtitle={`Mentor: ${detail.mentorName} | ${detail.trainees.length} trainee${detail.trainees.length === 1 ? '' : 's'}`}
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
          ['resources', 'Resources'],
          ['progress', 'Progress'],
        ] as const).map(([tab, label]) => (
          tab === 'chat' || tab === 'resources' ? (
            <Link
              key={tab}
              id={`pairing-tab-${tab}`}
              to={tab === 'chat' ? chatPath : resourcesPath}
              role="tab"
              aria-selected="false"
              className="apid-btn apid-btn-sm apid-btn-outline"
            >
              {label}
            </Link>
          ) : (
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
          )
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="boa-stack">
          <section className="apid-card">
            <div className="boa-card-header">
              <div>
                <h2 className="boa-card-title">Pairing details</h2>
                <p className="boa-card-subtitle">
                  Started {formatDateTime(detail.startedAt)}
                  {detail.skillName ? ` - ${detail.skillName}` : ''}
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
                      <StatusPill label={trainee.status} tone={trainee.status === 'ACTIVE' ? 'ok' : 'neutral'} />
                    </div>
                    <p className="boa-muted" style={{ margin: '0.5rem 0 0', fontSize: '0.84rem' }}>
                      Joined {formatDateTime(trainee.joinedAt)}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          {detail.currentUserRole === 'MENTOR' && (
            <section className="apid-card">
              <div className="boa-card-header">
                <div>
                  <h2 className="boa-card-title">Relationship lifecycle</h2>
                  <p className="boa-card-subtitle">Complete the mentoring objectives or close the relationship with a reason.</p>
                </div>
                <MentoringRelationshipClosure
                  relationshipId={relationshipId}
                  relationshipStatus={detail.status}
                  canCompleteRelationship={completionBlockedReason === null}
                  completionBlockedReason={completionBlockedReason}
                  onClosed={() => {
                    void Promise.all([
                      queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'detail', relationshipId] }),
                      queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'relationships'] }),
                      queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'requests'] }),
                    ]);
                  }}
                />
              </div>
            </section>
          )}

          <MentoringFeedbackForm
            relationshipId={relationshipId}
            enabled={detail.currentUserRole === 'TRAINEE' && detail.status === 'COMPLETED'}
          />

          <section className="apid-card boa-stack">
            <div className="boa-card-header">
              <div>
                <h2 className="boa-card-title">Sessions for this pairing</h2>
                <p className="boa-card-subtitle">Requests, accepted sessions, reschedules, and session history.</p>
              </div>
              <Link to={sessionsPath} className="apid-btn apid-btn-primary apid-btn-sm">
                <CalendarDays size={15} /> {sessionsAction}
              </Link>
            </div>
            {sessionsQuery.isLoading ? (
              <LoadingSkeleton rows={3} height={26} />
            ) : sessionsQuery.isError ? (
              <ErrorState
                message={getErrorMessage(sessionsQuery.error, 'Unable to load session history.')}
                onRetry={() => void sessionsQuery.refetch()}
              />
            ) : pairingSessions.length === 0 ? (
              <EmptyState
                title="No sessions scheduled yet"
                description="Session requests and confirmed sessions for this pairing will appear here."
              />
            ) : (
              <div className="boa-stack">{renderSessionCards(pairingSessions.slice(0, 3))}</div>
            )}
          </section>

          <section className="apid-card boa-stack">
            <div className="boa-card-header">
              <div>
                <h2 className="boa-card-title">Recent pair chat</h2>
                <p className="boa-card-subtitle">Recent messages shared by this pairing.</p>
              </div>
              {renderMessageAction}
            </div>
            {chatQuery.isLoading ? (
              <LoadingSkeleton rows={3} height={26} />
            ) : chatQuery.isError ? (
              <ErrorState
                message={getErrorMessage(chatQuery.error, 'Unable to load chat history.')}
                onRetry={() => void chatQuery.refetch()}
              />
            ) : messages.length === 0 ? (
              <EmptyState title="No messages yet" description="Start a conversation with this pairing." />
            ) : (
              <div className="boa-stack" aria-live="polite">
                {renderMessageCards(messages.slice(-5))}
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="boa-stack">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link to={`/mentoring/pairing/${relationshipId}`} className="apid-btn apid-btn-outline apid-btn-sm">
              <ArrowLeft size={15} /> Back to overview
            </Link>
            <Link to={sessionsPath} className="apid-btn apid-btn-primary apid-btn-sm">
              <CalendarDays size={15} /> {sessionsAction}
            </Link>
          </div>
          {sessionsQuery.isLoading ? (
            <LoadingSkeleton rows={4} height={28} />
          ) : sessionsQuery.isError ? (
            <ErrorState
              message={getErrorMessage(sessionsQuery.error, 'Unable to load session history.')}
              onRetry={() => void sessionsQuery.refetch()}
            />
          ) : pairingSessions.length === 0 ? (
            <div className="apid-card">
              <EmptyState
                title="No sessions for this pairing"
                description="Requests, accepted sessions, reschedule proposals, and declined sessions will appear here."
              />
            </div>
          ) : (
            <section className="apid-card boa-stack">
              <div className="boa-card-header">
                <div>
                  <h2 className="boa-card-title">All sessions</h2>
                  <p className="boa-card-subtitle">Requests, confirmations, reschedule proposals, and session history.</p>
                </div>
              </div>
              {renderSessionCards(pairingSessions)}
            </section>
          )}
        </div>
      )}

      {activeTab === 'progress' && (
        <div className="boa-stack">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link to={`/mentoring/pairing/${relationshipId}`} className="apid-btn apid-btn-outline apid-btn-sm">
              <ArrowLeft size={15} /> Back to overview
            </Link>
          </div>
          <section className="apid-card boa-stack">
            <div>
              <h2 className="boa-card-title">Progress and milestones</h2>
              <p className="boa-card-subtitle">Record and review learning milestones, observations, and next steps.</p>
            </div>
            <MentoringProgressPanel relationshipId={relationshipId} canAdd={detail.status === 'ACTIVE'} />
          </section>
        </div>
      )}

      {selectedForVideo && (
        <MentoringDailyVideoModal
          session={selectedForVideo}
          isOpen={Boolean(selectedForVideo)}
          onClose={() => setSelectedForVideo(null)}
          relationshipId={relationshipId}
          mentorName={detail.mentorName}
          traineeName={detail.trainees[0]?.name}
        />
      )}
    </div>
  );
}
