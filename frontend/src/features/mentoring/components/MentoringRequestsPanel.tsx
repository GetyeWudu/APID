import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { mentoringPairingApi, type MentoringPairing } from '../api/mentoringPairingApi';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import { EmptyState, StatusPill, useToast } from '../../../shared/components/ui';

type PairingView = 'all' | 'mentor' | 'trainee';

export function MentoringRequestsPanel({
  requests,
  currentUserId,
  view = 'all',
}: {
  requests: MentoringPairing[];
  currentUserId: number;
  view?: PairingView;
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const responseMutation = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: 'ACCEPTED' | 'DECLINED' }) =>
      mentoringPairingApi.respond(id, decision),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'requests'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'relationships'] }),
        queryClient.invalidateQueries({ queryKey: ['core', 'notifications'] }),
      ]);
      pushToast({
        title: result.status === 'ACCEPTED' ? 'Mentoring request approved' : 'Mentoring request declined',
        message: 'The other participant has been notified.',
        tone: 'ok',
      });
    },
    onError: (error: unknown) => {
      const message = axios.isAxiosError<ApiErrorPayload>(error)
        ? error.response?.data?.message ?? error.message
        : error instanceof Error
          ? error.message
          : 'Unable to respond to the mentoring request.';
      pushToast({ title: 'Request update failed', message, tone: 'err' });
    },
  });

  const isRelevantAsMentor = (item: MentoringPairing) =>
    view === 'all' || (view === 'mentor' && item.mentorUserId === currentUserId);
  const isRelevantAsTrainee = (item: MentoringPairing) =>
    view === 'all' || (view === 'trainee' && item.traineeUserId === currentUserId);

  const incoming = requests.filter(
    (item) =>
      item.status === 'PENDING' &&
      item.incoming &&
      (item.initiatedByMentor ? isRelevantAsTrainee(item) : isRelevantAsMentor(item))
  );
  const outgoing = requests.filter(
    (item) =>
      !item.incoming &&
      item.status !== 'ACCEPTED' &&
      (item.initiatedByMentor ? isRelevantAsMentor(item) : isRelevantAsTrainee(item))
  );
  const active = requests.filter(
    (item) =>
      item.status === 'ACCEPTED' &&
      (view === 'all' ||
        (view === 'mentor' && item.mentorUserId === currentUserId) ||
        (view === 'trainee' && item.traineeUserId === currentUserId))
  );

  const requestCard = (item: MentoringPairing, canRespond: boolean) => (
    <article
      key={item.id}
      className="apid-card"
      style={{ border: '1px solid var(--border)', marginBottom: 0 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <strong>
            {item.requestType === 'GROUP' ? 'Mentoring class' : 'One-to-one mentoring'}
          </strong>
          <div className="boa-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
            {item.mentorName} → {item.traineeName}
            {item.skillName ? ` · ${item.skillName}` : ''}
          </div>
        </div>
        <StatusPill
          label={item.status}
          tone={item.status === 'ACCEPTED' ? 'ok' : item.status === 'PENDING' ? 'warn' : 'neutral'}
        />
      </div>
      {item.message && (
        <p className="boa-muted" style={{ margin: '0.6rem 0 0', fontSize: '0.84rem' }}>
          {item.message}
        </p>
      )}
      {canRespond && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button
            type="button"
            className="apid-btn apid-btn-primary apid-btn-sm"
            disabled={responseMutation.isPending}
            onClick={() => responseMutation.mutate({ id: item.id, decision: 'ACCEPTED' })}
          >
            Approve
          </button>
          <button
            type="button"
            className="apid-btn apid-btn-outline apid-btn-sm"
            disabled={responseMutation.isPending}
            onClick={() => responseMutation.mutate({ id: item.id, decision: 'DECLINED' })}
          >
            Decline
          </button>
        </div>
      )}
    </article>
  );

  return (
    <div className="boa-stack">
      <section className="apid-card">
        <div className="boa-card-header">
          <div>
            <h3 className="boa-card-title">Incoming Requests</h3>
            <p className="boa-card-subtitle">Approve or decline each invitation or mentorship request.</p>
          </div>
        </div>
        {incoming.length === 0 ? (
          <EmptyState title="No Incoming Requests" description="New mentoring requests will appear here." />
        ) : (
          <div className="boa-grid-2" style={{ marginBottom: 0 }}>
            {incoming.map((item) => requestCard(item, true))}
          </div>
        )}
      </section>

      <section className="apid-card">
        <div className="boa-card-header">
          <div>
            <h3 className="boa-card-title">Sent Requests</h3>
            <p className="boa-card-subtitle">Track invitations and requests you have sent.</p>
          </div>
        </div>
        {outgoing.length === 0 ? (
          <EmptyState title="No Sent Requests" description="Requests you send will be tracked here." />
        ) : (
          <div className="boa-grid-2" style={{ marginBottom: 0 }}>
            {outgoing.map((item) => requestCard(item, false))}
          </div>
        )}
      </section>

      <section className="apid-card">
        <div className="boa-card-header">
          <div>
            <h3 className="boa-card-title">{view === 'mentor' ? 'Active Trainees' : 'Active Mentoring'}</h3>
            <p className="boa-card-subtitle">Approved pairings and accepted class memberships.</p>
          </div>
        </div>
        {active.length === 0 ? (
          <EmptyState
            title="No Active Mentoring Relationships"
            description="Accepted one-to-one pairings and class memberships will appear here."
          />
        ) : (
          <div className="boa-grid-2" style={{ marginBottom: 0 }}>
            {active.map((item) => requestCard(item, false))}
          </div>
        )}
      </section>
    </div>
  );
}
