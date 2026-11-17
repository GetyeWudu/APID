import { useState } from 'react';
import axios from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, MessageCircle, Video } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  StatusPill,
} from '../../../shared/components/ui';
import { mentoringPairingApi, type MentoringSession } from '../api/mentoringPairingApi';
import { MentoringDailyVideoModal } from '../components/MentoringDailyVideoModal';
import {
  MentoringFeedbackForm,
  MentoringProgressPanel,
  MentoringRelationshipClosure,
} from '../components/MentoringCollaborationTools';

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
  if (status === 'COMPLETED') return 'ok';
  if (status === 'SCHEDULED' || status === 'IN PROGRESS') return 'info';
  if (status === 'MISSED') return 'err';
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
  const previousSessions = sessions.filter((session) => {
    const start = new Date(session.scheduledStart).getTime();
    const end = new Date(session.scheduledEnd).getTime();
    return session.status === 'COMPLETED' || (session.status === 'SCHEDULED' && start <= Date.now() && end > Date.now());
  });
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
        session.status === 'SCHEDULED' && start <= Date.now() && end > Date.now()
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
            </div>
            <StatusPill label={status} tone={sessionStatusTone(status)} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.7rem', flexWrap: 'wrap' }}>
            <StatusPill label={session.deliveryMode.replace('_', ' ')} tone="neutral" />
            {(session.deliveryMode === 'ONLINE' || session.deliveryMode === 'HYBRID') &&
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
                  <Video size={14} /> Join Daily.co Video
                </button>
            )}

            {activeTab === 'progress' && (
              <section className="apid-card boa-stack">
                <div>
                  <h2 className="boa-card-title">Progress and milestones</h2>
                  <p className="boa-card-subtitle">Record and review learning milestones, observations, and next steps.</p>
                </div>
                <MentoringProgressPanel relationshipId={relationshipId} canAdd={detail.status === 'ACTIVE'} />
              </section>
            )}
          </div>
          {session.agenda && <p className="boa-muted">{session.agenda}</p>}
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
                <h2 className="boa-card-title">Completed and in-progress sessions</h2>
                <p className="boa-card-subtitle">Sessions already underway or completed for this pairing.</p>
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
            ) : previousSessions.length === 0 ? (
              <EmptyState
                title="No completed or in-progress sessions"
                description="Completed sessions and sessions currently underway will appear here."
              />
            ) : (
              <div className="boa-stack">{renderSessionCards(previousSessions.slice(0, 3))}</div>
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
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
          ) : previousSessions.length === 0 ? (
            <div className="apid-card">
              <EmptyState
                title="No completed or in-progress sessions"
                description="Completed sessions and sessions currently underway will appear here."
              />
            </div>
          ) : (
            <section className="apid-card boa-stack">
              <div className="boa-card-header">
                <div>
                  <h2 className="boa-card-title">Session history</h2>
                  <p className="boa-card-subtitle">Completed and in-progress sessions for this pairing.</p>
                </div>
              </div>
              {renderSessionCards(previousSessions)}
            </section>
          )}
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
