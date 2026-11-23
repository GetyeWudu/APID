import { useRef, useState, type KeyboardEvent } from 'react';
import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { mentoringPairingApi, type MentoringPairing } from '../api/mentoringPairingApi';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import { EmptyState, StatusPill, useToast } from '../../../shared/components/ui';

type PairingView = 'all' | 'mentor' | 'trainee';
type RequestTab = 'incoming' | 'sent' | 'active' | 'declined';

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
  const [selectedTab, setSelectedTab] = useState<RequestTab>('incoming');
  const tabRefs = useRef<Record<RequestTab, HTMLButtonElement | null>>({
    incoming: null,
    sent: null,
    active: null,
    declined: null,
  });
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

  const tabs: {
    id: RequestTab;
    label: string;
    title: string;
    description: string;
    requests: MentoringPairing[];
    canRespond: boolean;
    emptyTitle: string;
    emptyDescription: string;
  }[] = [
    {
      id: 'incoming',
      label: 'Incoming',
      title: view === 'mentor' ? 'Trainee Requests' : 'Incoming Requests',
      description: 'Accept or decline mentoring requests from employees.',
      requests: incoming,
      canRespond: true,
      emptyTitle: 'No Incoming Requests',
      emptyDescription: 'New mentoring requests will appear here.',
    },
    {
      id: 'sent',
      label: 'Sent',
      title: 'Sent Requests',
      description: 'Track requests you have sent.',
      requests: outgoing,
      canRespond: false,
      emptyTitle: 'No Sent Requests',
      emptyDescription: 'Requests you send will be tracked here.',
    },
    ...(showActive
      ? [{
          id: 'active' as const,
          label: 'Active',
          title: view === 'mentor' ? 'Active Trainees' : 'Active Mentoring',
          description: 'Approved pairings and accepted class memberships.',
          requests: active,
          canRespond: false,
          emptyTitle: 'No Active Mentoring Relationships',
          emptyDescription: 'Accepted pairings and class memberships will appear here.',
        }]
      : []),
    {
      id: 'declined',
      label: 'Declined',
      title: 'Declined Requests',
      description: 'Requests you sent or received that were declined.',
      requests: declined,
      canRespond: false,
      emptyTitle: 'No Declined Requests',
      emptyDescription: 'Declined mentoring requests will appear here.',
    },
  ];
  const currentTab = tabs.find((tab) => tab.id === selectedTab) ?? tabs[0];

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | undefined;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    setSelectedTab(nextTab.id);
    tabRefs.current[nextTab.id]?.focus();
  };

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
      <div className="mentoring-requests__tabs" role="tablist" aria-label="Mentoring request status">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => { tabRefs.current[tab.id] = element; }}
            id={`mentoring-requests-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={currentTab.id === tab.id}
            aria-controls="mentoring-requests-panel"
            tabIndex={currentTab.id === tab.id ? 0 : -1}
            className="mentoring-requests__tab"
            onClick={() => setSelectedTab(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            <span>{tab.label}</span>
            <span className="mentoring-requests__tab-count">{tab.requests.length}</span>
          </button>
        ))}
      </div>

      <section
        id="mentoring-requests-panel"
        className="mentoring-dashboard__section mentoring-requests__panel"
        role="tabpanel"
        aria-labelledby={`mentoring-requests-tab-${currentTab.id}`}
        tabIndex={0}
      >
        <div className="mentoring-dashboard__section-header">
          <div>
            <h3 className="mentoring-dashboard__section-title">{currentTab.title}</h3>
            <p className="mentoring-dashboard__section-description">{currentTab.description}</p>
          </div>
        </div>
        {currentTab.requests.length === 0 ? (
          <EmptyState title={currentTab.emptyTitle} description={currentTab.emptyDescription} />
        ) : (
          <div className="mentoring-request-list">
            {currentTab.requests.map((item) => requestCard(item, currentTab.canRespond))}
          </div>
        )}
      </section>
    </div>
  );
}
