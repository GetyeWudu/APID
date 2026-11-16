import { useState } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Link2 } from 'lucide-react';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import { EmptyState, StatusPill, useToast } from '../../../shared/components/ui';
import type { MentoringMatchRequest } from '../api/mentoringMatchApi';
import { mentoringMatchApi } from '../api/mentoringMatchApi';
import type { TrainerRosterItem } from '../api/mentoringTrainerApi';

export function HrMatchingTab({
  requests,
  trainers,
}: {
  requests: MentoringMatchRequest[];
  trainers: TrainerRosterItem[];
}) {
  const [selectedTrainers, setSelectedTrainers] = useState<Record<number, string>>({});
  const [capacityOverrides, setCapacityOverrides] = useState<Record<number, boolean>>({});
  const [overrideReasons, setOverrideReasons] = useState<Record<number, string>>({});
  const [selectedReassignmentTrainers, setSelectedReassignmentTrainers] = useState<Record<number, string>>({});
  const [reassignmentReasons, setReassignmentReasons] = useState<Record<number, string>>({});
  const [reassignmentCapacityOverrides, setReassignmentCapacityOverrides] = useState<Record<number, boolean>>({});
  const [reassignmentOverrideReasons, setReassignmentOverrideReasons] = useState<Record<number, string>>({});
  const [reassignmentSkillOverrideReasons, setReassignmentSkillOverrideReasons] = useState<Record<number, string>>({});
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const reassignmentQueue = useQuery({
    queryKey: ['mentoring', 'hr-reassignment-queue'],
    queryFn: mentoringMatchApi.listReassignmentQueue,
  });
  const matchMutation = useMutation({
    mutationFn: (input: {
      requestId: number;
      trainerUserId: number;
      overrideCapacity?: boolean;
      overrideReason?: string;
    }) => mentoringMatchApi.match(input.requestId, input),
    onSuccess: async (request) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'hr-match-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'hr-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'trainers'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'relationships'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'requests'] }),
      ]);
      pushToast({
        title: 'Trainee matched',
        message: `${request.traineeName} is now paired with an authorized mentor.`,
        tone: 'ok',
      });
    },
    onError: (error: unknown) => {
      const message = axios.isAxiosError<ApiErrorPayload>(error)
        ? error.response?.data?.message ?? error.message
        : error instanceof Error ? error.message : 'Unable to match the trainee.';
      pushToast({ title: 'Matching failed', message, tone: 'err' });
    },
  });
  const reassignMutation = useMutation({
    mutationFn: (input: {
      relationshipId: number;
      trainerUserId: number;
      reason: string;
      overrideCapacity?: boolean;
      overrideReason?: string;
      skillOverrideReason?: string;
    }) => mentoringMatchApi.reassign(input.relationshipId, input),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'hr-reassignment-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'hr-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'trainers'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'relationships'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'requests'] }),
      ]);
      pushToast({
        title: 'Relationship reassigned',
        message: `${result.reassignedTrainees} trainee(s) were matched with ${result.trainerName}.`,
        tone: 'ok',
      });
    },
    onError: (error: unknown) => {
      const message = axios.isAxiosError<ApiErrorPayload>(error)
        ? error.response?.data?.message ?? error.message
        : error instanceof Error ? error.message : 'Unable to reassign the relationship.';
      pushToast({ title: 'Reassignment failed', message, tone: 'err' });
    },
  });

  const openRequests = requests.filter((request) => request.status === 'OPEN');

  return (
    <div className="boa-stack">
      <div className="apid-card">
        <div className="boa-card-header">
          <div>
            <h3 className="boa-card-title">Trainee–Trainer Match Requests</h3>
            <p className="boa-card-subtitle">
              Requests and trainer capacity are live. Matching creates an active mentoring relationship and notifies both participants.
            </p>
          </div>
        </div>
        {openRequests.length === 0 ? (
          <EmptyState title="No open HR matching requests" description="New trainee requests will appear here." />
        ) : (
          <div className="apid-table-wrap">
          <table className="apid-table">
            <thead>
              <tr>
                <th>Trainee</th>
                <th>Requested skill</th>
                <th>Message</th>
                <th>Status</th>
                <th>Eligible trainer</th>
              </tr>
            </thead>
            <tbody>
              {openRequests.map((request) => {
                const eligible = trainers.filter((trainer) =>
                  trainer.userId !== null &&
                  trainer.status === 'ACTIVE' &&
                  trainer.employmentStatus === 'ACTIVE' &&
                  trainer.skills.some((skill) => skill.id === request.skillId)
                );
                const selectedTrainer = eligible.find(
                  (trainer) => String(trainer.userId) === selectedTrainers[request.id]
                );
                const selectedTrainerAtCapacity = selectedTrainer !== undefined
                  && selectedTrainer.activeTrainees + selectedTrainer.pendingTrainees
                    >= selectedTrainer.maxConcurrentTrainees;
                return (
                  <tr key={request.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{request.traineeName}</div>
                      <div className="boa-muted" style={{ fontSize: '0.77rem' }}>
                        {request.traineeEmployeeNumber} · {request.departmentName ?? 'Unassigned department'}
                      </div>
                    </td>
                    <td><StatusPill label={request.skillName} tone="neutral" /></td>
                    <td>{request.message || '—'}</td>
                    <td><StatusPill label={request.status} tone="info" /></td>
                    <td>
                      {eligible.length === 0 ? (
                        <span className="boa-muted" style={{ fontSize: '0.78rem' }}>
                          No active trainer with matching skill and capacity
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                          <select
                            className="apid-input"
                            aria-label={`Trainer for ${request.traineeName}`}
                            value={selectedTrainers[request.id] ?? ''}
                            onChange={(event) => setSelectedTrainers((previous) => ({
                              ...previous,
                              [request.id]: event.target.value,
                            }))}
                          >
                            <option value="">Select active trainer</option>
                            {eligible.map((trainer) => (
                              <option key={trainer.userId ?? trainer.id} value={trainer.userId ?? ''}>
                                {trainer.fullName} · {trainer.activeTrainees + trainer.pendingTrainees}/{trainer.maxConcurrentTrainees}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="apid-btn apid-btn-primary apid-btn-sm"
                            disabled={!selectedTrainers[request.id] || matchMutation.isPending}
                            onClick={() => matchMutation.mutate({
                              requestId: request.id,
                              trainerUserId: Number(selectedTrainers[request.id]),
                              overrideCapacity: capacityOverrides[request.id] ?? false,
                              overrideReason: overrideReasons[request.id],
                            })}
                          >
                            <Link2 size={13} /> Match
                          </button>
                        </div>
                      )}
                      {selectedTrainerAtCapacity && (
                        <div className="boa-stack" style={{ gap: '0.35rem', marginTop: '0.35rem' }}>
                          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.8rem' }}>
                            <input
                              type="checkbox"
                              checked={capacityOverrides[request.id] ?? false}
                              onChange={(event) => setCapacityOverrides((previous) => ({
                                ...previous,
                                [request.id]: event.target.checked,
                              }))}
                            />
                            HR override capacity
                          </label>
                          {capacityOverrides[request.id] && (
                            <input
                              className="apid-input"
                              aria-label={`Capacity override reason for ${request.traineeName}`}
                              maxLength={1000}
                              placeholder="Required reason for override"
                              value={overrideReasons[request.id] ?? ''}
                              onChange={(event) => setOverrideReasons((previous) => ({
                                ...previous,
                                [request.id]: event.target.value,
                              }))}
                            />
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
        {requests.some((request) => request.status === 'MATCHED') && (
          <div className="boa-stack" style={{ marginTop: '1rem' }}>
            <h4 style={{ margin: 0 }}>Completed matches</h4>
            {requests.filter((request) => request.status === 'MATCHED').map((request) => (
              <article key={request.id} className="apid-card" style={{ border: '1px solid var(--border)' }}>
                <strong>{request.traineeName}</strong> · {request.skillName} · {request.matchedTrainerName}
                {request.mentoringRelationshipId && (
                  <Link
                    to={`/mentoring/pairing/${request.mentoringRelationshipId}`}
                    className="apid-btn apid-btn-outline apid-btn-sm"
                    style={{ marginLeft: '0.6rem' }}
                  >
                    View relationship
                  </Link>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      <section className="apid-card">
        <div className="boa-card-header">
          <div>
            <h3 className="boa-card-title">Paused relationships requiring reassignment</h3>
            <p className="boa-card-subtitle">
              Reassignment preserves the original relationship history and creates a new active relationship for its trainees.
            </p>
          </div>
        </div>
        {reassignmentQueue.isLoading ? (
          <p className="boa-muted">Loading paused relationships…</p>
        ) : reassignmentQueue.isError ? (
          <p role="alert" className="boa-muted">Unable to load the reassignment queue.</p>
        ) : reassignmentQueue.data?.length === 0 ? (
          <EmptyState title="No paused relationships" description="Paused relationships with active trainees will appear here." />
        ) : (
          <div className="boa-stack">
            {reassignmentQueue.data?.map((relationship) => {
              const eligible = trainers.filter((trainer) =>
                trainer.userId !== null &&
                trainer.userId !== relationship.formerTrainerUserId &&
                trainer.status === 'ACTIVE' &&
                trainer.employmentStatus === 'ACTIVE'
              );
              const selectedTrainer = eligible.find(
                (trainer) => String(trainer.userId) === selectedReassignmentTrainers[relationship.relationshipId]
              );
              const selectedTrainerHasSkill = selectedTrainer !== undefined
                && (relationship.skillId === null
                  || selectedTrainer.skills.some((skill) => skill.id === relationship.skillId));
              const selectedTrainerNeedsSkillOverride = selectedTrainer !== undefined && !selectedTrainerHasSkill;
              const selectedTrainerAtCapacity = selectedTrainer !== undefined
                && selectedTrainer.activeTrainees + selectedTrainer.pendingTrainees + relationship.trainees.length
                  > selectedTrainer.maxConcurrentTrainees;
              return (
                <article
                  key={relationship.relationshipId}
                  className="apid-card"
                  style={{ border: '1px solid var(--border)' }}
                >
                  <div className="boa-card-header">
                    <div>
                      <strong>{relationship.skillName ?? 'General mentoring'} · Former trainer: {relationship.formerTrainerName}</strong>
                      <p className="boa-card-subtitle">
                        {relationship.trainees.length} active trainee(s) · Started {new Date(relationship.startedAt).toLocaleDateString()}
                      </p>
                      <div className="boa-muted">
                        Trainees: {relationship.trainees.map((trainee) => trainee.name).join(', ')}
                      </div>
                    </div>
                    <Link
                      to={`/mentoring/pairing/${relationship.relationshipId}`}
                      className="apid-btn apid-btn-outline apid-btn-sm"
                    >
                      View history
                    </Link>
                  </div>
                  {eligible.length === 0 ? (
                    <span className="boa-muted">
                      No other active, employed trainer is available. Authorize a replacement trainer before reassignment.
                    </span>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                        <select
                          className="apid-input"
                          aria-label={`Replacement trainer for relationship ${relationship.relationshipId}`}
                          value={selectedReassignmentTrainers[relationship.relationshipId] ?? ''}
                          onChange={(event) => setSelectedReassignmentTrainers((previous) => ({
                            ...previous,
                            [relationship.relationshipId]: event.target.value,
                          }))}
                        >
                          <option value="">Select replacement trainer</option>
                          {eligible.map((trainer) => (
                            <option key={trainer.userId ?? trainer.id} value={trainer.userId ?? ''}>
                              {trainer.fullName}
                              {relationship.skillId !== null && !trainer.skills.some((skill) => skill.id === relationship.skillId)
                                ? ' · Skill mismatch—HR override required'
                                : ''}
                              {` · ${trainer.activeTrainees + trainer.pendingTrainees}/${trainer.maxConcurrentTrainees}`}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="apid-btn apid-btn-primary apid-btn-sm"
                          disabled={
                            !selectedReassignmentTrainers[relationship.relationshipId] ||
                            !reassignmentReasons[relationship.relationshipId]?.trim() ||
                            (selectedTrainerNeedsSkillOverride
                              && !reassignmentSkillOverrideReasons[relationship.relationshipId]?.trim()) ||
                            reassignMutation.isPending
                          }
                          onClick={() => reassignMutation.mutate({
                            relationshipId: relationship.relationshipId,
                            trainerUserId: Number(selectedReassignmentTrainers[relationship.relationshipId]),
                            reason: (reassignmentReasons[relationship.relationshipId] ?? '').trim(),
                            overrideCapacity: reassignmentCapacityOverrides[relationship.relationshipId] ?? false,
                            overrideReason: reassignmentOverrideReasons[relationship.relationshipId],
                            skillOverrideReason: reassignmentSkillOverrideReasons[relationship.relationshipId],
                          })}
                        >
                          <Link2 size={13} /> Reassign
                        </button>
                      </div>
                      <label className="boa-stack" style={{ gap: '0.25rem', marginTop: '0.55rem' }}>
                        Reassignment reason
                        <textarea
                          className="apid-input"
                          aria-label={`Reassignment reason for relationship ${relationship.relationshipId}`}
                          maxLength={1000}
                          required
                          rows={2}
                          value={reassignmentReasons[relationship.relationshipId] ?? ''}
                          onChange={(event) => setReassignmentReasons((previous) => ({
                            ...previous,
                            [relationship.relationshipId]: event.target.value,
                          }))}
                        />
                      </label>
                      {selectedTrainerNeedsSkillOverride && (
                        <label className="boa-stack" style={{ gap: '0.25rem', marginTop: '0.35rem' }}>
                          Required skill-mismatch override reason for {relationship.skillName}
                          <textarea
                            className="apid-input"
                            aria-label={`Skill override reason for relationship ${relationship.relationshipId}`}
                            maxLength={1000}
                            placeholder="Required reason for assigning a trainer without this skill"
                            required
                            rows={2}
                            value={reassignmentSkillOverrideReasons[relationship.relationshipId] ?? ''}
                            onChange={(event) => setReassignmentSkillOverrideReasons((previous) => ({
                              ...previous,
                              [relationship.relationshipId]: event.target.value,
                            }))}
                          />
                        </label>
                      )}
                      {selectedTrainerAtCapacity && (
                        <div className="boa-stack" style={{ gap: '0.35rem', marginTop: '0.35rem' }}>
                          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.8rem' }}>
                            <input
                              type="checkbox"
                              checked={reassignmentCapacityOverrides[relationship.relationshipId] ?? false}
                              onChange={(event) => setReassignmentCapacityOverrides((previous) => ({
                                ...previous,
                                [relationship.relationshipId]: event.target.checked,
                              }))}
                            />
                            HR override capacity
                          </label>
                          {reassignmentCapacityOverrides[relationship.relationshipId] && (
                            <input
                              className="apid-input"
                              aria-label={`Capacity override reason for relationship ${relationship.relationshipId}`}
                              maxLength={1000}
                              placeholder="Required reason for override"
                              value={reassignmentOverrideReasons[relationship.relationshipId] ?? ''}
                              onChange={(event) => setReassignmentOverrideReasons((previous) => ({
                                ...previous,
                                [relationship.relationshipId]: event.target.value,
                              }))}
                            />
                          )}
                        </div>
                      )}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
