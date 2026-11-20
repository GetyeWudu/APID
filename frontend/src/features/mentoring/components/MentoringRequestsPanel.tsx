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
  showActive = true,
}: {
  requests: MentoringPairing[];
  currentUserId: number;
  view?: PairingView;
  showActive?: boolean;
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
      item.status !== 'DECLINED' &&
      (item.initiatedByMentor ? isRelevantAsMentor(item) : isRelevantAsTrainee(item))
  );
  const active = requests.filter(
    (item) =>
      item.status === 'ACCEPTED' &&
      (view === 'all' ||
        (view === 'mentor' && item.mentorUserId === currentUserId) ||
        (view === 'trainee' && item.traineeUserId === currentUserId))
  );
  const declined = requests.filter(
    (item) =>
      item.status === 'DECLINED' &&
      (view === 'all' ||
        (view === 'mentor' && item.mentorUserId === currentUserId) ||
        (view === 'trainee' && item.traineeUserId === currentUserId))
  );

  const summary = [
    { label: 'Incoming', value: incoming.length },
    { label: 'Sent', value: outgoing.length },
    { label: 'Active', value: active.length },
    { label: 'Declined', value: declined.length },
  ];

  const requestCard = (item: MentoringPairing, canRespond: boolean) => (
    <article
      key={item.id}
        className="mentoring-request-row"
    >
        <div className="mentoring-request-row__main">
          <span className="mentoring-dashboard__icon" aria-hidden="true">
            <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              {item.requestType === 'GROUP' ? 'G' : '1:1'}
          </span>
          </span>
          <div className="mentoring-request-row__details">
          <strong>
            {item.requestType === 'GROUP' ? 'Mentoring class' : 'One-to-one mentoring'}
          </strong>
            <div className="mentoring-request-row__meta">
            {item.mentorName} → {item.traineeName}
            {item.skillName ? ` · ${item.skillName}` : ''}
          </div>
            {item.message && (
              <div className="mentoring-request-row__meta">{item.message}</div>
            )}
        </div>
        </div>
        <div className="mentoring-request-row__actions">
          <StatusPill
            label={item.status}
            tone={item.status === 'ACCEPTED' ? 'ok' : item.status === 'PENDING' ? 'warn' : 'neutral'}
          />
          {canRespond && (
            <>
              <button
                type="button"
                className="apid-btn apid-btn-primary apid-btn-sm"
                disabled={responseMutation.isPending}
                onClick={() => responseMutation.mutate({ id: item.id, decision: 'ACCEPTED' })}
              >
                Accept
              </button>
              <button
                type="button"
                className="apid-btn apid-btn-outline apid-btn-sm"
                disabled={responseMutation.isPending}
                onClick={() => responseMutation.mutate({ id: item.id, decision: 'DECLINED' })}
              >
                Decline
              </button>
            </>
          )}
        </div>
    </article>
  );

  return (
    <div className="boa-stack mentoring-requests">
      <section className="mentoring-dashboard__metrics" aria-label="Mentoring request summary">
        {summary.map((item) => (
          <div className="mentoring-dashboard__metric" key={item.label}>
            <div className="mentoring-dashboard__metric-value">{item.value}</div>
            <div className="mentoring-dashboard__metric-label">{item.label} requests</div>
          </div>
        ))}
      </section>

      <section className="mentoring-dashboard__section">
        <div className="mentoring-dashboard__section-header">
          <div>
            <h3 className="mentoring-dashboard__section-title">{view === 'mentor' ? 'Trainee Requests' : 'Incoming Requests'}</h3>
            <p className="mentoring-dashboard__section-description">
              Accept or decline each invitation or mentorship request.
            </p>
          </div>
          <span className="mentoring-dashboard__count" aria-label={`${incoming.length} incoming requests`}>{incoming.length}</span>
        </div>
        {incoming.length === 0 ? (
          <EmptyState title="No Incoming Requests" description="New mentoring requests will appear here." />
        ) : (
          <div className="mentoring-request-list">
            {incoming.map((item) => requestCard(item, true))}
          </div>
        )}
      </section>

      <section className="mentoring-dashboard__section">
        <div className="mentoring-dashboard__section-header">
          <div>
            <h3 className="mentoring-dashboard__section-title">Sent Requests</h3>
            <p className="mentoring-dashboard__section-description">Track invitations and requests you have sent.</p>
          </div>
          <span className="mentoring-dashboard__count" aria-label={`${outgoing.length} sent requests`}>{outgoing.length}</span>
        </div>
        {outgoing.length === 0 ? (
          <EmptyState title="No Sent Requests" description="Requests you send will be tracked here." />
        ) : (
          <div className="mentoring-request-list">
            {outgoing.map((item) => requestCard(item, false))}
          </div>
        )}
      </section>

      {showActive && (
        <section className="mentoring-dashboard__section">
          <div className="mentoring-dashboard__section-header">
            <div>
              <h3 className="mentoring-dashboard__section-title">{view === 'mentor' ? 'Active Trainees' : 'Active Mentoring'}</h3>
              <p className="mentoring-dashboard__section-description">Approved pairings and accepted class memberships.</p>
            </div>
            <span className="mentoring-dashboard__count" aria-label={`${active.length} active relationships`}>{active.length}</span>
          </div>
          {active.length === 0 ? (
            <EmptyState
              title="No Active Mentoring Relationships"
              description="Accepted one-to-one pairings and class memberships will appear here."
            />
          ) : (
            <div className="mentoring-request-list">
              {active.map((item) => requestCard(item, false))}
            </div>
          )}
        </section>
      )}

      <section className="mentoring-dashboard__section">
        <div className="mentoring-dashboard__section-header">
          <div>
            <h3 className="mentoring-dashboard__section-title">Declined Requests</h3>
            <p className="mentoring-dashboard__section-description">Requests you sent or received that were declined.</p>
          </div>
          <span className="mentoring-dashboard__count" aria-label={`${declined.length} declined requests`}>{declined.length}</span>
        </div>
        {declined.length === 0 ? (
          <EmptyState title="No Declined Requests" description="Declined mentoring requests will appear here." />
        ) : (
          <div className="mentoring-request-list">
            {declined.map((item) => requestCard(item, false))}
          </div>
        )}
      </section>
    </div>
  );
}
