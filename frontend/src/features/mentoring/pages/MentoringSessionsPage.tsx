import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, Video } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { mentoringPairingApi, type MentoringSession } from '../api/mentoringPairingApi';

type SessionView = 'mentor' | 'trainee';
type SessionMeetingMode = 'IN_PERSON' | 'VIDEO_CALL' | 'PHONE_CALL';

interface LocalSessionDraft {
  id: string;
  relationshipId: number;
  title: string;
  purpose: string;
  scheduledStart: string;
  scheduledEnd: string;
  meetingMode: SessionMeetingMode;
  meetingUrl: string;
}

function formatLocalSessionMode(mode: SessionMeetingMode) {
  switch (mode) {
    case 'IN_PERSON':
      return 'In-person meeting';
    case 'VIDEO_CALL':
      return 'Video call';
    case 'PHONE_CALL':
      return 'Phone call';
  }
}

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

function statusLabel(session: MentoringSession, now: number) {
  const start = new Date(session.scheduledStart).getTime();
  const end = new Date(session.scheduledEnd).getTime();
  return session.status === 'SCHEDULED' && start <= now && end > now
    ? 'IN PROGRESS'
    : session.status;
}

export function MentoringSessionsPage({ view }: { view: SessionView }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRelationshipId, setSelectedRelationshipId] = useState(
    searchParams.get('relationshipId') ?? ''
  );
  const selectedRelationshipNumber = Number(selectedRelationshipId);
  const pairingOverviewPath =
    Number.isSafeInteger(selectedRelationshipNumber) && selectedRelationshipNumber > 0
      ? `/mentoring/pairing/${selectedRelationshipNumber}`
      : null;
  const [isCreateFormOpen, setCreateFormOpen] = useState(Boolean(searchParams.get('relationshipId')));
  const [localSessionDrafts, setLocalSessionDrafts] = useState<LocalSessionDraft[]>([]);
  const { pushToast } = useToast();
  const relationshipsQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'relationships', user?.id],
    queryFn: mentoringPairingApi.listMyRelationships,
  });
  const sessionsQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'my-sessions', user?.id],
    queryFn: mentoringPairingApi.listMySessions,
  });

  if (relationshipsQuery.isLoading || sessionsQuery.isLoading) {
    return <LoadingSkeleton rows={6} height={28} />;
  }
  if (relationshipsQuery.isError || sessionsQuery.isError) {
    const error = relationshipsQuery.error ?? sessionsQuery.error;
    return (
      <ErrorState
        message={getErrorMessage(error, 'Unable to load your mentoring sessions.')}
        onRetry={() => {
          void relationshipsQuery.refetch();
          void sessionsQuery.refetch();
        }}
      />
    );
  }

  const allRelationships = relationshipsQuery.data ?? [];
  const roleRelationships = allRelationships.filter((pair) =>
    view === 'mentor' ? pair.currentUserRole === 'MENTOR' : pair.currentUserRole === 'TRAINEE'
  );
  const relationshipsById = new Map<number, (typeof roleRelationships)[number]>();
  roleRelationships.forEach((pair) => relationshipsById.set(pair.relationshipId, pair));
  const relationshipIds = new Set(relationshipsById.keys());
  const sessions = (sessionsQuery.data ?? []).filter((session) =>
    relationshipIds.has(session.relationshipId)
  );
  const traineesByRelationship = new Map<number, string[]>();
  for (const pair of allRelationships) {
    const names = traineesByRelationship.get(pair.relationshipId) ?? [];
    if (!names.includes(pair.traineeName)) {
      names.push(pair.traineeName);
      traineesByRelationship.set(pair.relationshipId, names);
    }
  }
  const activeMentorRelationships = roleRelationships
    .filter((pair) => pair.currentUserRole === 'MENTOR' && pair.relationshipStatus === 'ACTIVE')
    .filter((pair, index, pairs) =>
      pairs.findIndex((candidate) => candidate.relationshipId === pair.relationshipId) === index
    );
  const selectedRelationship = activeMentorRelationships.find(
    (pair) => String(pair.relationshipId) === selectedRelationshipId
  );
  const title = view === 'mentor' ? 'Mentor Sessions' : 'My Sessions';
  const localDraftsForView = localSessionDrafts.filter((draft) =>
    relationshipsById.has(draft.relationshipId)
  );

  const handleCreateSession = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const relationshipId = Number(formData.get('relationshipId'));
    const scheduledStart = String(formData.get('scheduledStart') ?? '');
    const scheduledEnd = String(formData.get('scheduledEnd') ?? '');
    const purpose = String(formData.get('purpose') ?? '').trim();
    const meetingMode = String(formData.get('meetingMode') ?? '') as SessionMeetingMode;
    const meetingUrl = String(formData.get('meetingUrl') ?? '').trim();
    const startDate = new Date(scheduledStart);
    const endDate = new Date(scheduledEnd);
    if (
      !selectedRelationship ||
      relationshipId !== selectedRelationship.relationshipId ||
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate.getTime() <= Date.now() ||
      endDate.getTime() <= startDate.getTime() ||
      !purpose ||
      !['IN_PERSON', 'VIDEO_CALL', 'PHONE_CALL'].includes(meetingMode) ||
      (meetingMode === 'VIDEO_CALL' && meetingUrl && !/^https?:\/\//i.test(meetingUrl))
    ) {
      pushToast({
        title: 'Invalid session details',
        message: 'Choose an active pairing, describe the session, and enter a valid future schedule.',
        tone: 'err',
      });
      return;
    }

    const localDraft: LocalSessionDraft = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      relationshipId,
      title: String(formData.get('title') ?? '').trim(),
      purpose,
      scheduledStart: startDate.toISOString(),
      scheduledEnd: endDate.toISOString(),
      meetingMode,
      meetingUrl: meetingMode === 'VIDEO_CALL' ? meetingUrl : '',
    };
    setLocalSessionDrafts((drafts) => [localDraft, ...drafts]);
    event.currentTarget.reset();
    setSelectedRelationshipId(String(relationshipId));
    pushToast({
      title: 'Session plan added',
      message: 'This is a local preview only and has not been saved to the mentoring service.',
      tone: 'info',
    });
  };

  return (
    <div className="boa-stack">
      <PageHeader
        title={title}
        subtitle={
          view === 'mentor'
            ? 'View sessions with your trainees and schedule a session for an active pairing.'
            : 'View sessions shared with your mentor and pairing.'
        }
        source="live"
        actions={
          pairingOverviewPath || (view === 'mentor' && activeMentorRelationships.length > 0) ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {pairingOverviewPath && (
                <Link to={pairingOverviewPath} className="apid-btn apid-btn-outline apid-btn-sm">
                  <ArrowLeft size={15} /> Back to Pairing Overview
                </Link>
              )}
              {view === 'mentor' && activeMentorRelationships.length > 0 && (
                <button
                  type="button"
                  className="apid-btn apid-btn-primary apid-btn-sm"
                  onClick={() => setCreateFormOpen((open) => !open)}
                >
                  <CalendarDays size={15} />
                  {isCreateFormOpen ? 'Close form' : 'Create session'}
                </button>
              )}
            </div>
          ) : undefined
        }
      />

      {view === 'mentor' && isCreateFormOpen && (
        <form className="apid-card boa-stack" onSubmit={handleCreateSession}>
          <div>
            <h2 className="boa-card-title">Plan a mentoring session</h2>
            <p className="boa-card-subtitle">
              Describe the session and choose how it will happen. This frontend-only plan is not saved or shared yet.
            </p>
          </div>
          <label>
            Pairing
            <select
              className="apid-input"
              name="relationshipId"
              value={selectedRelationshipId}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedRelationshipId(value);
                const nextParams = new URLSearchParams(searchParams);
                if (value) nextParams.set('relationshipId', value);
                else nextParams.delete('relationshipId');
                setSearchParams(nextParams, { replace: true });
              }}
              required
            >
              <option value="">Select an active pairing</option>
              {activeMentorRelationships.map((pair) => (
                <option key={pair.relationshipId} value={pair.relationshipId}>
                  {pair.requestType === 'GROUP' ? 'Class' : 'Pair'} ·{' '}
                  {(traineesByRelationship.get(pair.relationshipId) ?? [pair.traineeName]).join(', ')}
                  {pair.skillName ? ` · ${pair.skillName}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Session title
            <input className="apid-input" name="title" maxLength={180} required />
          </label>
          <label>
            What will you work on?
            <textarea
              className="apid-input"
              name="purpose"
              maxLength={2000}
              rows={3}
              placeholder="Describe the topic, activities, or goal for this session."
              required
            />
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
              How will you meet?
              <select className="apid-input" name="meetingMode" defaultValue="VIDEO_CALL">
                <option value="IN_PERSON">In-person meeting</option>
                <option value="VIDEO_CALL">Video call</option>
                <option value="PHONE_CALL">Phone call</option>
              </select>
            </label>
            <label>
              Video meeting link (optional)
              <input
                className="apid-input"
                name="meetingUrl"
                type="url"
                maxLength={1000}
                placeholder="https://..."
              />
            </label>
          </div>
          <div>
            <button
              type="submit"
              className="apid-btn apid-btn-primary apid-btn-sm"
              disabled={!selectedRelationship}
            >
              <CalendarDays size={15} />
              Add session plan
            </button>
          </div>
        </form>
      )}

      {sessions.length === 0 && localDraftsForView.length === 0 ? (
        <section className="apid-card">
          <EmptyState
            title="No sessions yet"
            description={
              view === 'mentor'
                ? 'Sessions you create for your active pairings will appear here.'
                : 'Sessions scheduled by your mentor will appear here.'
            }
          />
        </section>
      ) : (
        <section className="apid-card boa-stack">
          <div>
            <h2 className="boa-card-title">Session history</h2>
            <p className="boa-card-subtitle">Saved sessions and local-only plans across your mentoring pairings.</p>
          </div>
          {localDraftsForView.map((draft) => {
            const pair = relationshipsById.get(draft.relationshipId);
            const partnerLabel = pair
              ? view === 'mentor'
                ? (traineesByRelationship.get(pair.relationshipId) ?? [pair.traineeName]).join(', ')
                : pair.mentorName
              : 'Mentoring pairing';
            return (
              <article
                key={draft.id}
                className="apid-card"
                style={{ border: '1px solid var(--border)' }}
                data-testid="local-session-plan"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.7rem', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{draft.title}</h3>
                    <p className="boa-muted" style={{ margin: '0.3rem 0 0', fontSize: '0.84rem' }}>
                      {partnerLabel} · {formatDateTime(draft.scheduledStart)} to {formatDateTime(draft.scheduledEnd)}
                    </p>
                  </div>
                  <StatusPill label="LOCAL PREVIEW" tone="warn" />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.7rem', flexWrap: 'wrap' }}>
                  <StatusPill label={formatLocalSessionMode(draft.meetingMode)} tone="neutral" />
                  <Link
                    to={`/mentoring/pairing/${draft.relationshipId}`}
                    className="apid-btn apid-btn-outline apid-btn-sm"
                  >
                    View pairing
                  </Link>
                  {draft.meetingUrl && (
                    <a href={draft.meetingUrl} target="_blank" rel="noreferrer" className="apid-btn apid-btn-outline apid-btn-sm">
                      <Video size={15} /> Meeting link
                    </a>
                  )}
                </div>
                <p className="boa-muted">{draft.purpose}</p>
              </article>
            );
          })}
          {sessions.map((session) => {
            const pair = relationshipsById.get(session.relationshipId);
            const partnerLabel = pair
              ? view === 'mentor'
                ? (traineesByRelationship.get(pair.relationshipId) ?? [pair.traineeName]).join(', ')
                : pair.mentorName
              : 'Mentoring pairing';
            const status = statusLabel(session, Date.now());
            const tone = status === 'COMPLETED' ? 'ok' : status === 'MISSED' ? 'err' : status === 'IN PROGRESS' ? 'info' : 'neutral';
            return (
              <article key={session.id} className="apid-card" style={{ border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.7rem', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{session.title}</h3>
                    <p className="boa-muted" style={{ margin: '0.3rem 0 0', fontSize: '0.84rem' }}>
                      {partnerLabel} · {formatDateTime(session.scheduledStart)} to {formatDateTime(session.scheduledEnd)}
                    </p>
                  </div>
                  <StatusPill label={status} tone={tone} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.7rem', flexWrap: 'wrap' }}>
                  <StatusPill label={session.deliveryMode.replace('_', ' ')} tone="neutral" />
                  <Link
                    to={`/mentoring/pairing/${session.relationshipId}`}
                    className="apid-btn apid-btn-outline apid-btn-sm"
                  >
                    View pairing
                  </Link>
                  {session.meetingUrl && (
                    <a href={session.meetingUrl} target="_blank" rel="noreferrer" className="apid-btn apid-btn-outline apid-btn-sm">
                      <Video size={15} /> Join meeting
                    </a>
                  )}
                </div>
                {session.agenda && <p className="boa-muted">{session.agenda}</p>}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
