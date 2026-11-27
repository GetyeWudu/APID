import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { BriefcaseBusiness, Eye, Search, ShieldAlert, UserPlus, UsersRound, X } from 'lucide-react';
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
import {
  filterByOrganizationLocation,
  OrganizationLocationFilter,
} from './OrganizationLocationFilter';
import './TrainerRosterTab.css';

interface SkillOption {
  id: number;
  name: string;
}

export function TrainerRosterTab({
  trainers,
  candidates,
  skills,
  mode = 'roster',
}: {
  trainers: TrainerRosterItem[];
  candidates: TrainerEmployeeCandidate[];
  skills: SkillOption[];
  mode?: 'roster' | 'access';
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [showAppoint, setShowAppoint] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState<TrainerRosterItem | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [appointSkills, setAppointSkills] = useState<number[]>([]);
  const [appointMax, setAppointMax] = useState(3);
  const [appointmentReason, setAppointmentReason] = useState('');
  const [appointBusy, setAppointBusy] = useState(false);
  const [statusTarget, setStatusTarget] = useState<{
    trainer: TrainerRosterItem;
    skill: TrainerRosterItem['skills'][number];
    nextStatus: TrainerAuthorizationStatus;
  } | null>(null);
  const [policy, setPolicy] = useState<TrainerInFlightPolicy>('BLOCK_NEW_SESSIONS_ONLY');
  const [statusReason, setStatusReason] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'ALL' | 'ACTIVE' | 'LIMITED'>('ALL');
  const [locationFilter, setLocationFilter] = useState('');

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
        skillId: statusTarget.skill.id,
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

  const authTone = (status: TrainerAuthorizationStatus) =>
    status === 'ACTIVE' ? 'ok' : status === 'SUSPENDED' ? 'warn' : 'err';
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const locationFilteredTrainers = filterByOrganizationLocation(trainers, locationFilter);
  const filteredTrainers = locationFilteredTrainers.filter((trainer) => {
    const committed = trainer.activeTrainees + trainer.pendingTrainees;
    const atCap = committed >= trainer.maxConcurrentTrainees;
    if (availabilityFilter === 'ACTIVE' &&
      (trainer.acceptingNewPairings === false || trainer.status !== 'ACTIVE' || atCap)) return false;
    if (availabilityFilter === 'LIMITED' &&
      (trainer.status !== 'ACTIVE' || atCap === false)) return false;
    if (!normalizedSearch) return true;
    return [
      trainer.fullName,
      trainer.employeeNumber,
      trainer.departmentName,
      trainer.sourceType,
      ...trainer.skills.map((skill) => skill.name),
    ].filter(Boolean).join(' ').toLowerCase().includes(normalizedSearch);
  });
  const activeTrainerCount = trainers.filter((trainer) =>
    trainer.status === 'ACTIVE' && trainer.acceptingNewPairings !== false).length;
  const atCapacityCount = trainers.filter((trainer) =>
    trainer.activeTrainees + trainer.pendingTrainees >= trainer.maxConcurrentTrainees).length;
  const activeSkillCount = trainers.reduce(
    (total, trainer) => total + trainer.skills.filter((skill) =>
      (skill.status ?? trainer.status) === 'ACTIVE').length,
    0
  );

  return (
    <div className="trainer-roster">
      <div className="trainer-roster-header">
        <div>
          <h3>{mode === 'access' ? 'Manage mentor access' : 'Approved Trainers'}</h3>
          <p>
            {mode === 'access'
              ? 'Suspend, revoke, or restore mentor skill authorizations.'
              : 'Manage live trainer authorizations, mentoring capacity, and current workload.'}
          </p>
        </div>
        {mode === 'roster' && (
          <PermissionGate permission="TRAINER_DIRECT_APPOINT">
            <button
              type="button"
              className="trainer-roster-appoint"
              disabled={candidates.length === 0 || skills.length === 0}
              onClick={() => setShowAppoint(true)}
            >
              <UserPlus size={14} /> Appoint Trainer
            </button>
          </PermissionGate>
        )}
      </div>

      {trainers.length === 0 ? (
        <EmptyState
          title="No mentor authorizations"
          description="Mentor authorizations will appear here when available."
        />
      ) : (
        <>
          <div className="trainer-roster-summary">
            <div><span>Mentors</span><strong>{trainers.length}</strong></div>
            <div><span>Accepting matches</span><strong>{activeTrainerCount}</strong></div>
            <div><span>Active skills</span><strong>{activeSkillCount}</strong></div>
            <div><span>At capacity</span><strong>{atCapacityCount}</strong></div>
          </div>

          <div className="trainer-roster-controls">
            <label className="trainer-roster-search">
              <Search size={16} />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search trainer, employee number, or skill"
                aria-label="Search approved trainers"
              />
            </label>
            <OrganizationLocationFilter
              paths={trainers.map((trainer) => trainer.organizationPath ?? [])}
              value={locationFilter}
              onChange={setLocationFilter}
            />
            <div className="trainer-roster-filters" aria-label="Filter trainer availability">
              {([
                ['ALL', 'All trainers'],
                ['ACTIVE', 'Accepting matches'],
                ['LIMITED', 'At capacity'],
              ] as const).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={availabilityFilter === value ? 'is-active' : ''}
                  onClick={() => setAvailabilityFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filteredTrainers.length === 0 ? (
            <EmptyState title="No trainers match" description="Try another search, availability, or organizational location filter." />
          ) : (
            <div className="trainer-roster-table-wrap">
              <table className="trainer-roster-table">
                <thead>
                  <tr>
                    <th>Trainer</th>
                    <th>Authorization</th>
                    <th>Availability</th>
                    <th>Capacity</th>
                    <th>Skills</th>
                    <th><span className="sr-only">Details</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrainers.map((trainer) => {
                    const committed = trainer.activeTrainees + trainer.pendingTrainees;
                    const atCap = committed >= trainer.maxConcurrentTrainees;
                    const initials = trainer.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
                    return (
                      <tr
                        key={trainer.id}
                        data-testid={`trainer-row-${trainer.id}`}
                        tabIndex={0}
                        aria-label={`View trainer details for ${trainer.fullName}`}
                        onClick={() => setSelectedTrainer(trainer)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedTrainer(trainer);
                          }
                        }}
                      >
                        <td>
                          <div className="trainer-roster-table-person">
                            <span className="trainer-roster-avatar" aria-hidden="true">{initials}</span>
                            <span>
                              <strong>{trainer.fullName}</strong>
                              <small>
                                {trainer.employeeNumber} · {
                                  trainer.organizationPath?.map((location) => location.name).join(' / ')
                                  || trainer.departmentName
                                  || 'Unassigned department'
                                }
                              </small>
                            </span>
                          </div>
                        </td>
                        <td><StatusPill label={trainer.status} tone={authTone(trainer.status)} /></td>
                        <td>
                          <StatusPill
                            label={trainer.acceptingNewPairings === false ? 'Not accepting' : 'Accepting matches'}
                            tone={trainer.acceptingNewPairings === false ? 'neutral' : 'ok'}
                          />
                        </td>
                        <td>
                          <span className="trainer-roster-table-capacity">
                            {committed} / {trainer.maxConcurrentTrainees}
                            {atCap && <small>At capacity</small>}
                          </span>
                        </td>
                        <td><span className="trainer-roster-table-skill-count">{trainer.skills.length} skills</span></td>
                        <td><Eye size={16} aria-hidden="true" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {selectedTrainer && (
        <div
          className="apid-modal-backdrop trainer-roster-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedTrainer(null);
          }}
        >
          <section
            className="apid-card apid-modal trainer-roster-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="trainer-roster-modal-title"
          >
            {(() => {
              const trainer = selectedTrainer;
              const committed = trainer.activeTrainees + trainer.pendingTrainees;
              const atCap = committed >= trainer.maxConcurrentTrainees;
              const capacityPercent = Math.min(
                100,
                Math.round((committed / Math.max(1, trainer.maxConcurrentTrainees)) * 100)
              );
              const initials = trainer.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
              return (
                <>
                  <header className="trainer-roster-modal-header">
                    <div className="trainer-roster-person">
                      <div className="trainer-roster-avatar" aria-hidden="true">{initials}</div>
                      <div>
                        <span className="trainer-roster-modal-kicker">Trainer details</span>
                        <h3 id="trainer-roster-modal-title">{trainer.fullName}</h3>
                        <p>{trainer.employeeNumber} · {trainer.departmentName ?? 'Unassigned department'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="apid-btn apid-btn-outline apid-btn-sm"
                      aria-label="Close trainer details"
                      onClick={() => setSelectedTrainer(null)}
                    >
                      <X size={15} />
                    </button>
                  </header>

                  <div className="trainer-roster-modal-status">
                    <StatusPill label={`Employment: ${trainer.employmentStatus}`} tone={trainer.employmentStatus === 'ACTIVE' ? 'ok' : 'warn'} />
                    <StatusPill label={`Authorization: ${trainer.status}`} tone={authTone(trainer.status)} />
                    <StatusPill
                      label={trainer.acceptingNewPairings === false ? 'Not accepting matches' : 'Accepting matches'}
                      tone={trainer.acceptingNewPairings === false ? 'neutral' : 'ok'}
                    />
                  </div>

                  <div className="trainer-roster-modal-meta">
                    <div><BriefcaseBusiness size={16} /><span>Appointment source</span><strong>{trainer.sourceType.replace('_', ' ')}</strong></div>
                    <div><UsersRound size={16} /><span>Current workload</span><strong>{trainer.activeTrainees} active · {trainer.pendingTrainees} pending</strong></div>
                  </div>

                  <div className="trainer-roster-capacity trainer-roster-modal-capacity">
                    <div><span>Trainee capacity</span><strong>{committed} / {trainer.maxConcurrentTrainees}</strong></div>
                    <div className="trainer-roster-progress" aria-label={`${capacityPercent}% of capacity committed`}>
                      <span style={{ width: `${capacityPercent}%` }} />
                    </div>
                    <p>{atCap ? 'At capacity' : `${trainer.maxConcurrentTrainees - committed} places available`}</p>
                  </div>

                  <div className="trainer-roster-modal-skills">
                    <div className="trainer-roster-section-title">
                      <span>Approved skills</span>
                      <strong>{trainer.skills.length}</strong>
                    </div>
                    {trainer.skills.map((skill) => {
                      const skillStatus = skill.status ?? trainer.status;
                      return (
                        <div className="trainer-roster-skill" key={skill.id}>
                          <div>
                            <strong>{skill.name}</strong>
                            <StatusPill label={skillStatus} tone={authTone(skillStatus)} />
                          </div>
                          <PermissionGate permission="TRAINER_STATUS_MANAGE">
                            {skillStatus === 'ACTIVE' ? (
                              <div className="trainer-roster-actions">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStatusTarget({ trainer, skill, nextStatus: 'SUSPENDED' });
                                    setPolicy('BLOCK_NEW_SESSIONS_ONLY');
                                    setStatusReason('');
                                    setSelectedTrainer(null);
                                  }}
                                >Suspend</button>
                                <button
                                  type="button"
                                  className="is-danger"
                                  onClick={() => {
                                    setStatusTarget({ trainer, skill, nextStatus: 'REVOKED' });
                                    setPolicy('REQUIRE_HR_REASSIGNMENT');
                                    setStatusReason('');
                                    setSelectedTrainer(null);
                                  }}
                                >Revoke</button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="trainer-roster-restore"
                                onClick={() => {
                                  setStatusTarget({ trainer, skill, nextStatus: 'ACTIVE' });
                                  setStatusReason('');
                                  setSelectedTrainer(null);
                                }}
                              >
                                {skillStatus === 'SUSPENDED' ? 'Restore' : 'Reauthorize'}
                              </button>
                            )}
                          </PermissionGate>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </section>
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
                ? `Restore ${statusTarget.skill.name} authorization`
                : `${statusTarget.nextStatus === 'SUSPENDED' ? 'Suspend' : 'Revoke'} ${statusTarget.skill.name} authorization`}
            </h3>
            <div className="apid-alert apid-alert-warn" style={{ fontSize: '0.82rem' }}>
              <ShieldAlert size={14} style={{ verticalAlign: 'text-bottom', marginRight: '0.35rem' }} />
              <strong>Impact:</strong> This change applies only to {statusTarget.skill.name}. Other skills and their pairings remain unchanged.
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
                    <option value="BLOCK_NEW_SESSIONS_ONLY">Keep this skill's active relationships; block new sessions</option>
                    <option value="REQUIRE_HR_REASSIGNMENT">Pause this skill's relationships for HR reassignment</option>
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
