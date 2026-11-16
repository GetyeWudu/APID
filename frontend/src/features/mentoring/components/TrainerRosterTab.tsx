import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, UserPlus } from 'lucide-react';
import {
  EmptyState,
  PermissionGate,
  StatusPill,
  useToast,
} from '../../../shared/components/ui';
import type {
  TrainerAuthorizationStatus,
  TrainerEmployeeCandidate,
  TrainerInFlightPolicy,
  TrainerRosterItem,
} from '../api/mentoringTrainerApi';
import { mentoringTrainerApi } from '../api/mentoringTrainerApi';

interface SkillOption {
  id: number;
  name: string;
}

export function TrainerRosterTab({
  trainers,
  candidates,
  skills,
}: {
  trainers: TrainerRosterItem[];
  candidates: TrainerEmployeeCandidate[];
  skills: SkillOption[];
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [showAppoint, setShowAppoint] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [appointSkills, setAppointSkills] = useState<number[]>([]);
  const [appointMax, setAppointMax] = useState(3);
  const [appointmentReason, setAppointmentReason] = useState('');
  const [appointBusy, setAppointBusy] = useState(false);
  const [statusTarget, setStatusTarget] = useState<{
    trainer: TrainerRosterItem;
    nextStatus: TrainerAuthorizationStatus;
  } | null>(null);
  const [policy, setPolicy] = useState<TrainerInFlightPolicy>('BLOCK_NEW_SESSIONS_ONLY');
  const [statusReason, setStatusReason] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);

  const toggleSkill = (id: number) => {
    setAppointSkills((current) =>
      current.includes(id) ? current.filter((skillId) => skillId !== id) : [...current, id]
    );
  };

  const refreshTrainerData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['mentoring', 'trainers'] }),
      queryClient.invalidateQueries({ queryKey: ['mentoring', 'appointment-candidates'] }),
      queryClient.invalidateQueries({ queryKey: ['mentoring', 'hr-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['mentoring', 'directory'] }),
    ]);
  };

  const handleAppointSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const employee = candidates.find((candidate) => String(candidate.employeeId) === employeeId);
    if (!employee || appointSkills.length === 0 || !appointmentReason.trim()) return;

    setAppointBusy(true);
    try {
      await mentoringTrainerApi.appoint({
        employeeId: employee.employeeId,
        skillIds: appointSkills,
        maxConcurrentTrainees: appointMax,
        appointmentReason: appointmentReason.trim(),
      });
      await refreshTrainerData();
      pushToast({ title: 'Trainer appointed', message: `${employee.fullName} is now an active mentor.`, tone: 'ok' });
      setShowAppoint(false);
      setEmployeeId('');
      setAppointSkills([]);
      setAppointMax(3);
      setAppointmentReason('');
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message ?? error.message
        : error instanceof Error ? error.message : 'Unable to appoint the trainer.';
      pushToast({ title: 'Unable to appoint trainer', message, tone: 'err' });
    } finally {
      setAppointBusy(false);
    }
  };

  const handleStatusSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!statusTarget || !statusReason.trim()) return;
    setStatusBusy(true);
    try {
      await mentoringTrainerApi.changeStatus(statusTarget.trainer.id, {
        status: statusTarget.nextStatus,
        inFlightPolicy: statusTarget.nextStatus === 'ACTIVE' ? undefined : policy,
        reason: statusReason.trim(),
      });
      await refreshTrainerData();
      pushToast({
        title: `Trainer ${statusTarget.nextStatus.toLowerCase()}`,
        message: 'The authorization change was saved and affected participants were notified.',
        tone: 'ok',
      });
      setStatusTarget(null);
      setStatusReason('');
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message ?? error.message
        : error instanceof Error ? error.message : 'Unable to update trainer status.';
      pushToast({ title: 'Unable to update trainer', message, tone: 'err' });
    } finally {
      setStatusBusy(false);
    }
  };

  const employmentTone = (status: string) => status === 'ACTIVE' ? 'ok' : status === 'ON_LEAVE' ? 'warn' : 'err';
  const authTone = (status: TrainerAuthorizationStatus) =>
    status === 'ACTIVE' ? 'ok' : status === 'SUSPENDED' ? 'warn' : 'err';

  return (
    <div className="apid-card">
      <div className="boa-card-header">
        <div>
          <h3 className="boa-card-title">Approved Trainers</h3>
          <p className="boa-card-subtitle">
            Manage live trainer authorizations, mentoring capacity, and current workload.
          </p>
        </div>
        <PermissionGate permission="TRAINER_DIRECT_APPOINT">
          <button
            type="button"
            className="apid-btn apid-btn-primary apid-btn-sm"
            disabled={candidates.length === 0 || skills.length === 0}
            onClick={() => setShowAppoint(true)}
          >
            <UserPlus size={14} /> Appoint Trainer
          </button>
        </PermissionGate>
      </div>

      {trainers.length === 0 ? (
        <EmptyState title="No trainer authorizations" description="Approved applications and direct appointments will appear here." />
      ) : (
        <div className="apid-table-wrap">
          <table className="apid-table">
            <thead>
              <tr>
                <th>Trainer</th>
                <th>Employment</th>
                <th>Trainer Auth</th>
                <th>Capacity</th>
                <th>Approved Skills</th>
                <th>Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody>
              {trainers.map((trainer) => {
                const atCap = trainer.activeTrainees + trainer.pendingTrainees >= trainer.maxConcurrentTrainees;
                return (
                  <tr key={trainer.id} data-testid={`trainer-row-${trainer.id}`}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{trainer.fullName}</div>
                      <div className="boa-muted" style={{ fontSize: '0.77rem' }}>
                        {trainer.employeeNumber} · {trainer.departmentName ?? 'Unassigned department'} · {trainer.sourceType.replace('_', ' ')}
                      </div>
                      {trainer.availabilityNotes && (
                        <div className="boa-muted" style={{ fontSize: '0.77rem' }}>Availability: {trainer.availabilityNotes}</div>
                      )}
                    </td>
                    <td><StatusPill label={`Emp: ${trainer.employmentStatus}`} tone={employmentTone(trainer.employmentStatus)} /></td>
                    <td><StatusPill label={`Auth: ${trainer.status}`} tone={authTone(trainer.status)} /></td>
                    <td>
                      <StatusPill
                        label={`${trainer.activeTrainees} active + ${trainer.pendingTrainees} pending / ${trainer.maxConcurrentTrainees}`}
                        tone={atCap ? 'warn' : 'info'}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {trainer.skills.map((skill) => <StatusPill key={skill.id} label={skill.name} tone="neutral" />)}
                      </div>
                    </td>
                    <td className="apid-actions-cell">
                      <PermissionGate permission="TRAINER_STATUS_MANAGE">
                        {trainer.status === 'ACTIVE' ? (
                          <>
                            <button
                              type="button"
                              className="apid-btn apid-btn-outline apid-btn-sm"
                              onClick={() => {
                                setStatusTarget({ trainer, nextStatus: 'SUSPENDED' });
                                setPolicy('BLOCK_NEW_SESSIONS_ONLY');
                                setStatusReason('');
                              }}
                            >
                              Suspend
                            </button>
                            <button
                              type="button"
                              className="apid-btn apid-btn-danger apid-btn-sm"
                              onClick={() => {
                                setStatusTarget({ trainer, nextStatus: 'REVOKED' });
                                setPolicy('REQUIRE_HR_REASSIGNMENT');
                                setStatusReason('');
                              }}
                            >
                              Revoke
                            </button>
                          </>
                        ) : trainer.status === 'SUSPENDED' ? (
                          <button
                            type="button"
                            className="apid-btn apid-btn-outline apid-btn-sm"
                            onClick={() => {
                              setStatusTarget({ trainer, nextStatus: 'ACTIVE' });
                              setStatusReason('');
                            }}
                          >
                            Restore
                          </button>
                        ) : (
                          <span className="boa-muted">Re-appointment required</span>
                        )}
                      </PermissionGate>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAppoint && (
        <div className="apid-modal-backdrop" role="dialog" aria-modal="true" aria-label="Directly appoint a trainer">
          <div className="apid-card apid-modal">
            <h3 style={{ marginTop: 0 }}>Appoint Internal Trainer</h3>
            <form onSubmit={handleAppointSubmit} className="apid-form">
              <div className="apid-field">
                <label htmlFor="appoint-employee">Employee</label>
                <select
                  id="appoint-employee"
                  className="apid-input"
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  required
                >
                  <option value="">Select an active employee</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.employeeId} value={candidate.employeeId}>
                      {candidate.fullName} · {candidate.employeeNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div className="apid-field">
                <label htmlFor="appoint-capacity">Maximum concurrent trainees</label>
                <input
                  id="appoint-capacity"
                  type="number"
                  className="apid-input"
                  min={1}
                  max={100}
                  value={appointMax}
                  onChange={(event) => setAppointMax(Number(event.target.value))}
                  required
                />
              </div>
              <div className="apid-field">
                <label>Approved skills</label>
                <div className="apid-checkbox-list">
                  {skills.map((skill) => (
                    <label key={skill.id} className="apid-checkbox-row">
                      <input
                        type="checkbox"
                        checked={appointSkills.includes(skill.id)}
                        onChange={() => toggleSkill(skill.id)}
                      />
                      <span>{skill.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="apid-field">
                <label htmlFor="appoint-reason">Appointment reason</label>
                <textarea
                  id="appoint-reason"
                  className="apid-input"
                  rows={3}
                  maxLength={1000}
                  value={appointmentReason}
                  onChange={(event) => setAppointmentReason(event.target.value)}
                  required
                />
              </div>
              <div className="apid-modal-actions">
                <button type="button" className="apid-btn apid-btn-outline" onClick={() => setShowAppoint(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="apid-btn apid-btn-primary"
                  disabled={appointBusy || !employeeId || appointSkills.length === 0 || appointmentReason.trim().length < 5}
                >
                  {appointBusy ? 'Appointing...' : 'Appoint Trainer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {statusTarget && (
        <div className="apid-modal-backdrop" role="dialog" aria-modal="true" aria-label="Trainer authorization transition">
          <div className="apid-card apid-modal">
            <h3 style={{ marginTop: 0 }}>
              {statusTarget.nextStatus === 'ACTIVE'
                ? 'Restore Trainer Authorization'
                : `${statusTarget.nextStatus === 'SUSPENDED' ? 'Suspend' : 'Revoke'} Trainer Authorization`}
            </h3>
            <div className="apid-alert apid-alert-warn" style={{ fontSize: '0.82rem' }}>
              <ShieldAlert size={14} style={{ verticalAlign: 'text-bottom', marginRight: '0.35rem' }} />
              <strong>Impact:</strong> {statusTarget.trainer.fullName} has{' '}
              <strong>{statusTarget.trainer.activeTrainees}</strong> active trainee(s) and{' '}
              <strong>{statusTarget.trainer.pendingTrainees}</strong> pending request(s).
            </div>
            <form onSubmit={handleStatusSubmit} className="apid-form">
              {statusTarget.nextStatus !== 'ACTIVE' && (
                <div className="apid-field">
                  <label htmlFor="trainer-policy">Existing relationship handling</label>
                  <select
                    id="trainer-policy"
                    className="apid-input"
                    value={policy}
                    onChange={(event) => setPolicy(event.target.value as TrainerInFlightPolicy)}
                  >
                    <option value="BLOCK_NEW_SESSIONS_ONLY">Keep active relationships; block new invitations</option>
                    <option value="REQUIRE_HR_REASSIGNMENT">Pause relationships for HR reassignment</option>
                  </select>
                </div>
              )}
              <div className="apid-field">
                <label htmlFor="trainer-status-reason">Governance reason</label>
                <textarea
                  id="trainer-status-reason"
                  className="apid-input"
                  rows={3}
                  maxLength={1000}
                  required
                  value={statusReason}
                  onChange={(event) => setStatusReason(event.target.value)}
                />
              </div>
              <div className="apid-modal-actions">
                <button type="button" className="apid-btn apid-btn-outline" disabled={statusBusy} onClick={() => setStatusTarget(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`apid-btn ${statusTarget.nextStatus === 'REVOKED' ? 'apid-btn-danger' : 'apid-btn-primary'}`}
                  disabled={statusBusy || statusReason.trim().length < 5}
                >
                  {statusBusy ? 'Saving...' : `Confirm ${statusTarget.nextStatus}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
