import { useRef, useState, type FormEvent } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Video } from 'lucide-react';
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
import { mentoringPairingApi, type MentoringDeliveryMode, type MentoringSession } from '../api/mentoringPairingApi';

type SessionView = 'mentor' | 'trainee';

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
  const [isCreateFormOpen, setCreateFormOpen] = useState(Boolean(searchParams.get('relationshipId')));
  const formRef = useRef<HTMLFormElement>(null);
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const relationshipsQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'relationships', user?.id],
    queryFn: mentoringPairingApi.listMyRelationships,
  });
  const sessionsQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'my-sessions', user?.id],
    queryFn: mentoringPairingApi.listMySessions,
  });

  const createSessionMutation = useMutation({
    mutationFn: (input: {
      relationshipId: number;
      title: string;
      agenda?: string;
      scheduledStart: string;
      scheduledEnd: string;
      deliveryMode: MentoringDeliveryMode;
      meetingUrl?: string;
    }) => {
      const { relationshipId, ...sessionInput } = input;
      return mentoringPairingApi.createSession(relationshipId, sessionInput);
    },
    onSuccess: async (session) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'my-sessions', user?.id] }),
        queryClient.invalidateQueries({
          queryKey: ['mentoring', 'pairing', 'sessions', session.relationshipId],
        }),
      ]);
      formRef.current?.reset();
      pushToast({ title: 'Session scheduled', message: 'Your pairing can now see the session.', tone: 'ok' });
    },
    onError: (error: unknown) =>
      pushToast({
        title: 'Unable to schedule session',
        message: getErrorMessage(error, 'Please try again.'),
        tone: 'err',
      }),
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

  const handleCreateSession = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const relationshipId = Number(formData.get('relationshipId'));
    const scheduledStart = String(formData.get('scheduledStart') ?? '');
    const scheduledEnd = String(formData.get('scheduledEnd') ?? '');
    const startDate = new Date(scheduledStart);
    const endDate = new Date(scheduledEnd);
    if (
      !selectedRelationship ||
      relationshipId !== selectedRelationship.relationshipId ||
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate.getTime() <= Date.now() ||
      endDate.getTime() <= startDate.getTime()
    ) {
      pushToast({
        title: 'Invalid session details',
        message: 'Choose an active pairing, a future start time, and an end time after the start.',
        tone: 'err',
      });
      return;
    }

    createSessionMutation.mutate({
      relationshipId,
      title: String(formData.get('title') ?? '').trim(),
      agenda: String(formData.get('agenda') ?? '').trim() || undefined,
      scheduledStart: startDate.toISOString(),
      scheduledEnd: endDate.toISOString(),
      deliveryMode: String(formData.get('deliveryMode')) as MentoringDeliveryMode,
      meetingUrl: String(formData.get('meetingUrl') ?? '').trim() || undefined,
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
          view === 'mentor' && activeMentorRelationships.length > 0 ? (
            <button
              type="button"
              className="apid-btn apid-btn-primary apid-btn-sm"
              onClick={() => setCreateFormOpen((open) => !open)}
            >
              <CalendarDays size={15} />
              {isCreateFormOpen ? 'Close form' : 'Create session'}
            </button>
          ) : undefined
        }
      />

      {view === 'mentor' && isCreateFormOpen && (
        <form ref={formRef} className="apid-card boa-stack" onSubmit={handleCreateSession}>
          <div>
            <h2 className="boa-card-title">Create a mentoring session</h2>
            <p className="boa-card-subtitle">The session will be shared with everyone in the selected pairing.</p>
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
              disabled={createSessionMutation.isPending || !selectedRelationship}
            >
              <CalendarDays size={15} />
              {createSessionMutation.isPending ? 'Scheduling...' : 'Schedule session'}
            </button>
          </div>
        </form>
      )}

      {sessions.length === 0 ? (
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
            <p className="boa-card-subtitle">Sessions across your mentoring pairings.</p>
          </div>
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
