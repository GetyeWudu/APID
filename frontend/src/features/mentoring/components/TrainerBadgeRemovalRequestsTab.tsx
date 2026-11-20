import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EmptyState, StatusPill, useToast } from '../../../shared/components/ui';
import {
  mentoringTrainerApi,
  type MentorBadgeRemovalDisposition,
  type MentorBadgeRemovalRequest,
} from '../api/mentoringTrainerApi';

export function TrainerBadgeRemovalRequestsTab({
  requests,
}: {
  requests: MentorBadgeRemovalRequest[];
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [dispositions, setDispositions] = useState<Record<number, MentorBadgeRemovalDisposition>>({});
  const [decisionReasons, setDecisionReasons] = useState<Record<number, string>>({});
  const decisionMutation = useMutation({
    mutationFn: mentoringTrainerApi.decideBadgeRemovalRequest,
    onSuccess: async (request) => {
      await queryClient.invalidateQueries({ queryKey: ['mentoring', 'badge-removal-requests'] });
      pushToast({
        title: request.status === 'APPROVED' ? 'Badge removal approved' : 'Request declined',
        message: `${request.mentorName}'s request has been reviewed.`,
        tone: 'ok',
      });
    },
    onError: () => pushToast({
      title: 'Unable to review request',
      message: 'The request could not be updated. Refresh the list and try again.',
      tone: 'err',
    }),
  });

  const decide = (request: MentorBadgeRemovalRequest, status: 'APPROVED' | 'DECLINED') => {
    const disposition = dispositions[request.id];
    if (status === 'APPROVED' && !disposition) {
      pushToast({
        title: 'Choose an approval outcome',
        message: 'Select whether to keep existing pairings or revoke all pairings.',
        tone: 'info',
      });
      return;
    }
    decisionMutation.mutate({
      requestId: request.id,
      status,
      disposition: status === 'APPROVED' ? disposition : undefined,
      decisionReason: decisionReasons[request.id]?.trim() || undefined,
    });
  };

  return (
    <div className="boa-stack">
      <div>
        <h2 className="boa-card-title">Badge removal requests</h2>
        <p className="boa-card-subtitle">Review mentor requests to remove their mentor authorization.</p>
      </div>
      {requests.length === 0 ? (
        <div className="apid-card">
          <EmptyState
            title="No badge removal requests"
            description="Mentor-submitted requests awaiting HR review will appear here."
          />
        </div>
      ) : requests.map((request) => (
        <article className="apid-card boa-stack" key={request.id}>
          <div className="boa-card-header">
            <div>
              <h2 className="boa-card-title">{request.mentorName}</h2>
              <p className="boa-card-subtitle">
                {request.employeeNumber}
                {request.departmentName ? ` · ${request.departmentName}` : ''}
                {' · Submitted '}
                {new Date(request.requestedAt).toLocaleString()}
              </p>
            </div>
            <StatusPill label="Pending" tone="warn" />
          </div>

          {request.skills.length > 0 && (
            <div className="boa-stack">
              <strong>Mentoring skills</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {request.skills.map((skill) => <StatusPill key={skill} label={skill} tone="neutral" />)}
              </div>
            </div>
          )}
          <div>
            <strong>Mentor’s note</strong>
            <p className="boa-muted" style={{ margin: '0.25rem 0 0' }}>
              {request.reason || 'No reason provided.'}
            </p>
          </div>

          <fieldset className="boa-stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend><strong>Approval outcome</strong></legend>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <input
                type="radio"
                name={`badge-removal-${request.id}`}
                checked={dispositions[request.id] === 'KEEP_EXISTING_PAIRINGS'}
                onChange={() => setDispositions((current) => ({
                  ...current,
                  [request.id]: 'KEEP_EXISTING_PAIRINGS',
                }))}
                disabled={decisionMutation.isPending}
              />
              <span>
                Keep existing pairings. Disable new matches and cancel pending invitations; existing pairings remain active.
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <input
                type="radio"
                name={`badge-removal-${request.id}`}
                checked={dispositions[request.id] === 'REVOKE_ALL_PAIRINGS'}
                onChange={() => setDispositions((current) => ({
                  ...current,
                  [request.id]: 'REVOKE_ALL_PAIRINGS',
                }))}
                disabled={decisionMutation.isPending}
              />
              <span>
                Revoke mentor authorization. Close active and paused pairings, cancel pending invitations and upcoming sessions.
              </span>
            </label>
          </fieldset>

          <label className="apid-field">
            HR note (optional)
            <textarea
              className="apid-input"
              rows={2}
              maxLength={1000}
              value={decisionReasons[request.id] ?? ''}
              onChange={(event) => setDecisionReasons((current) => ({
                ...current,
                [request.id]: event.target.value,
              }))}
              disabled={decisionMutation.isPending}
            />
          </label>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="apid-btn apid-btn-primary apid-btn-sm"
              disabled={decisionMutation.isPending || !dispositions[request.id]}
              onClick={() => decide(request, 'APPROVED')}
            >
              {decisionMutation.isPending ? 'Saving…' : 'Approve request'}
            </button>
            <button
              type="button"
              className="apid-btn apid-btn-outline apid-btn-sm"
              disabled={decisionMutation.isPending}
              onClick={() => decide(request, 'DECLINED')}
            >
              {decisionMutation.isPending ? 'Saving…' : 'Decline request'}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
