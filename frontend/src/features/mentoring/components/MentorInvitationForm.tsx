import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import { EmptyState, ErrorState, LoadingSkeleton, useToast } from '../../../shared/components/ui';
import {
  mentoringPairingApi,
  type MentoringRequestType,
} from '../api/mentoringPairingApi';

export function MentorInvitationForm({ currentUserId }: { currentUserId: number }) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [requestType, setRequestType] = useState<MentoringRequestType>('INDIVIDUAL');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const candidatesQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'employees', currentUserId],
    queryFn: mentoringPairingApi.listEmployeeCandidates,
  });
  const invitationMutation = useMutation({
    mutationFn: mentoringPairingApi.inviteTrainees,
    onSuccess: async (created) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'requests'] }),
        queryClient.invalidateQueries({ queryKey: ['core', 'notifications'] }),
      ]);
      setSelectedIds([]);
      setMessage('');
      pushToast({
        title: requestType === 'GROUP' ? 'Class invitations sent' : 'Mentoring invitation sent',
        message: `${created.length} employee${created.length === 1 ? '' : 's'} notified.`,
        tone: 'ok',
      });
    },
    onError: (error: unknown) => {
      const errorMessage = axios.isAxiosError<ApiErrorPayload>(error)
        ? error.response?.data?.message ?? error.message
        : error instanceof Error
          ? error.message
          : 'Unable to send the mentoring invitation.';
      pushToast({ title: 'Invitation failed', message: errorMessage, tone: 'err' });
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      (requestType === 'INDIVIDUAL' && selectedIds.length !== 1) ||
      (requestType === 'GROUP' && selectedIds.length < 2)
    ) {
      pushToast({
        title: 'Select employees',
        message:
          requestType === 'GROUP'
            ? 'A mentoring class needs at least two employees.'
            : 'Choose one employee for an individual invitation.',
        tone: 'info',
      });
      return;
    }
    invitationMutation.mutate({
      requestType,
      traineeUserIds: selectedIds,
      message: message.trim() || undefined,
    });
  };

  if (candidatesQuery.isLoading) {
    return <LoadingSkeleton rows={4} height={28} />;
  }
  if (candidatesQuery.isError) {
    return (
      <ErrorState
        message="Unable to load employees for mentoring invitations."
        onRetry={() => void candidatesQuery.refetch()}
      />
    );
  }
  const candidates = candidatesQuery.data ?? [];

  return (
    <div className="apid-card">
      <div className="boa-card-header">
        <div>
          <h3 className="boa-card-title">Invite Employees to Mentoring</h3>
          <p className="boa-card-subtitle">
            Send a one-to-one invitation or invite a class. Each employee decides individually.
          </p>
        </div>
      </div>
      {candidates.length === 0 ? (
        <EmptyState title="No Employees Available" description="There are no other active employee accounts to invite." />
      ) : (
        <form className="apid-form" onSubmit={handleSubmit}>
          <div className="apid-field">
            <label htmlFor="mentor-invitation-type">Relationship type</label>
            <select
              id="mentor-invitation-type"
              className="apid-input"
              value={requestType}
              disabled={invitationMutation.isPending}
              onChange={(event) => {
                const nextType = event.target.value as MentoringRequestType;
                setRequestType(nextType);
                if (nextType === 'INDIVIDUAL' && selectedIds.length > 1) {
                  setSelectedIds(selectedIds.slice(0, 1));
                }
              }}
            >
              <option value="INDIVIDUAL">One mentor and one trainee</option>
              <option value="GROUP">One mentor and a class</option>
            </select>
          </div>
          <div className="apid-field">
            <label htmlFor="mentor-invitation-employees">
              Employees {requestType === 'GROUP' ? '(select at least two)' : '(select one)'}
            </label>
            <select
              id="mentor-invitation-employees"
              className="apid-input"
              multiple={requestType === 'GROUP'}
              size={Math.min(6, Math.max(3, candidates.length))}
              value={
                requestType === 'GROUP'
                  ? selectedIds.map(String)
                  : String(selectedIds[0] ?? '')
              }
              disabled={invitationMutation.isPending}
              onChange={(event) => {
                const values = Array.from(event.target.selectedOptions, (option) => Number(option.value));
                setSelectedIds(requestType === 'INDIVIDUAL' ? values.slice(0, 1) : values);
              }}
            >
              {candidates.map((candidate) => (
                <option key={candidate.userId} value={candidate.userId}>
                  {candidate.fullName} · {candidate.employeeNumber}
                  {candidate.departmentName ? ` · ${candidate.departmentName}` : ''}
                </option>
              ))}
            </select>
            {requestType === 'GROUP' && (
              <span className="boa-muted" style={{ fontSize: '0.78rem' }}>
                Hold Ctrl or Command to select multiple employees.
              </span>
            )}
          </div>
          <div className="apid-field">
            <label htmlFor="mentor-invitation-message">Message (optional)</label>
            <textarea
              id="mentor-invitation-message"
              className="apid-input"
              rows={3}
              maxLength={1000}
              value={message}
              disabled={invitationMutation.isPending}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Introduce yourself and the skills you can help with."
            />
          </div>
          <button
            type="submit"
            className="apid-btn apid-btn-primary"
            disabled={
              invitationMutation.isPending ||
              (requestType === 'INDIVIDUAL' && selectedIds.length !== 1) ||
              (requestType === 'GROUP' && selectedIds.length < 2)
            }
          >
            {invitationMutation.isPending ? 'Sending...' : 'Send mentoring invitation'}
          </button>
        </form>
      )}
    </div>
  );
}
