import { useState, type FormEvent } from 'react';
import { ShieldAlert, UserPlus } from 'lucide-react';
import {
  DataSourceBadge,
  PermissionGate,
  StatusPill,
  useToast,
} from '../../../shared/components/ui';
import type { PreviewCertifiedTrainer } from '../../../shared/mocks/boaPreviewFixtures';
import { mentoringPreviewAdapter } from '../api/mentoringDashboardApi';
import type { TrainerSuspensionPolicy } from '../api/mentoringDashboardTypes';

export function TrainerRosterTab({
  trainers,
  liveSkillNames,
  onTrainerAppointed,
  onTrainerStatusChanged,
}: {
  trainers: PreviewCertifiedTrainer[];
  liveSkillNames: string[];
  onTrainerAppointed: (trainer: PreviewCertifiedTrainer) => void;
  onTrainerStatusChanged: (
    trainerId: string,
    nextStatus: PreviewCertifiedTrainer['trainerAuthStatus']
  ) => void;
}) {
  const { pushToast } = useToast();

  // Direct appoint state
  const [showAppoint, setShowAppoint] = useState(false);
  const [appointName, setAppointName] = useState('');
  const [appointSkills, setAppointSkills] = useState<string[]>([]);
  const [appointMax, setAppointMax] = useState(3);
  const [appointBusy, setAppointBusy] = useState(false);

  // Lifecycle transition state
  const [statusTarget, setStatusTarget] = useState<{
    trainer: PreviewCertifiedTrainer;
    nextStatus: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  } | null>(null);
  const [policy, setPolicy] = useState<TrainerSuspensionPolicy>('BLOCK_NEW_SESSIONS_ONLY');
  const [statusReason, setStatusReason] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);

  const toggleSkill = (name: string) => {
    setAppointSkills((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    );
  };

  const handleAppointSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!appointName.trim() || appointSkills.length === 0) return;
    setAppointBusy(true);
    try {
      const res = await mentoringPreviewAdapter.simulateDirectAppoint(
        appointName.trim(),
        appointSkills,
        appointMax
      );
      onTrainerAppointed(res.trainer);
      pushToast({ title: 'Trainer Direct-Appointed (Preview)', message: res.message, tone: 'ok' });
      setShowAppoint(false);
      setAppointName('');
      setAppointSkills([]);
      setAppointMax(3);
    } finally {
      setAppointBusy(false);
    }
  };

  const handleStatusSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!statusTarget || !statusReason.trim()) return;
    setStatusBusy(true);
    try {
      const appliedPolicy = statusTarget.nextStatus === 'ACTIVE' ? null : policy;
      const res = await mentoringPreviewAdapter.simulateTrainerStatusChange(
        statusTarget.trainer.id,
        statusTarget.nextStatus,
        appliedPolicy,
        statusReason.trim()
      );
      onTrainerStatusChanged(statusTarget.trainer.id, statusTarget.nextStatus);
      pushToast({
        title: `Trainer ${statusTarget.nextStatus} (Preview)`,
        message: res.message,
        tone: 'info',
      });
      setStatusTarget(null);
      setStatusReason('');
    } finally {
      setStatusBusy(false);
    }
  };

  const employmentTone = (s: PreviewCertifiedTrainer['employmentStatus']) =>
    s === 'ACTIVE' ? 'ok' : s === 'ON_LEAVE' ? 'warn' : 'err';

  const authTone = (s: PreviewCertifiedTrainer['trainerAuthStatus']) =>
    s === 'ACTIVE' ? 'ok' : s === 'SUSPENDED' ? 'warn' : 'err';

  return (
    <div className="apid-card">
      <div className="boa-card-header">
        <div>
          <h3 className="boa-card-title">Approved Trainers</h3>
          <p className="boa-card-subtitle">
            Manage each trainer&apos;s employment status, trainer approval, and trainee capacity independently.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <DataSourceBadge source="preview" />
          <PermissionGate permission="TRAINER_DIRECT_APPOINT">
            <button
              type="button"
              className="apid-btn apid-btn-primary apid-btn-sm"
              onClick={() => setShowAppoint(true)}
            >
              <UserPlus size={14} /> Appoint Trainer
            </button>
          </PermissionGate>
        </div>
      </div>

      <div className="apid-table-wrap">
        <table className="apid-table">
          <thead>
            <tr>
              <th>Trainer</th>
              <th>Employment</th>
              <th>Trainer Auth</th>
              <th>Capacity</th>
              <th>Certified Skills</th>
              <th>Lifecycle Actions</th>
            </tr>
          </thead>
          <tbody>
            {trainers.map((t) => {
              const atCap = t.activeTrainees >= t.maxTrainees;
              return (
                <tr key={t.id} data-testid={`trainer-row-${t.id}`}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{t.fullName}</div>
                    <div className="boa-muted" style={{ fontSize: '0.77rem' }}>
                      {t.employeeCode} · {t.department} · Avg {t.avgRating.toFixed(1)}★
                    </div>
                  </td>
                  <td>
                    <StatusPill
                      label={`Emp: ${t.employmentStatus}`}
                      tone={employmentTone(t.employmentStatus)}
                    />
                  </td>
                  <td>
                    <StatusPill
                      label={`Auth: ${t.trainerAuthStatus}`}
                      tone={authTone(t.trainerAuthStatus)}
                    />
                  </td>
                  <td>
                    <StatusPill
                      label={
                        atCap
                          ? `${t.activeTrainees}/${t.maxTrainees} AT CAPACITY`
                          : `${t.activeTrainees}/${t.maxTrainees} OPEN`
                      }
                      tone={atCap ? 'warn' : 'info'}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {t.approvedSkills.map((sk) => (
                        <StatusPill key={sk} label={sk} tone="neutral" />
                      ))}
                    </div>
                  </td>
                  <td className="apid-actions-cell">
                    <PermissionGate permission="TRAINER_STATUS_MANAGE">
                      {t.trainerAuthStatus !== 'ACTIVE' ? (
                        <button
                          type="button"
                          className="apid-btn apid-btn-outline apid-btn-sm"
                          onClick={() => {
                            setStatusTarget({ trainer: t, nextStatus: 'ACTIVE' });
                            setStatusReason('');
                          }}
                        >
                          Restore
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="apid-btn apid-btn-outline apid-btn-sm"
                            onClick={() => {
                              setStatusTarget({ trainer: t, nextStatus: 'SUSPENDED' });
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
                              setStatusTarget({ trainer: t, nextStatus: 'REVOKED' });
                              setPolicy('REQUIRE_HR_REASSIGNMENT');
                              setStatusReason('');
                            }}
                          >
                            Revoke
                          </button>
                        </>
                      )}
                    </PermissionGate>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAppoint && (
        <div
          className="apid-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Direct Appoint Trainer"
        >
          <div className="apid-card apid-modal">
            <h3 style={{ marginTop: 0 }}>Appoint Internal Trainer</h3>
            <p className="boa-muted" style={{ fontSize: '0.82rem' }}>
              Approve an employee directly as a trainer using active catalog skills.
            </p>
            <form onSubmit={handleAppointSubmit} className="apid-form">
              <div className="apid-field">
                <label htmlFor="appoint-name">Employee Full Name</label>
                <input
                  id="appoint-name"
                  type="text"
                  required
                  value={appointName}
                  onChange={(e) => setAppointName(e.target.value)}
                  placeholder="e.g., Dawit Mekonnen"
                />
              </div>
              <div className="apid-field">
                <label htmlFor="appoint-cap">Concurrent Trainee Cap</label>
                <input
                  id="appoint-cap"
                  type="number"
                  min={1}
                  max={8}
                  value={appointMax}
                  onChange={(e) => setAppointMax(Number(e.target.value) || 3)}
                />
              </div>
              <div className="apid-field">
                <label>Approved Skills (select at least one)</label>
                <div className="apid-checkbox-list">
                  {liveSkillNames.map((sk) => (
                    <label key={sk} className="apid-checkbox-row">
                      <input
                        type="checkbox"
                        checked={appointSkills.includes(sk)}
                        onChange={() => toggleSkill(sk)}
                      />
                      <span>{sk}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="apid-modal-actions">
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  onClick={() => setShowAppoint(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="apid-btn apid-btn-primary"
                  disabled={appointBusy || appointSkills.length === 0}
                >
                  {appointBusy ? 'Appointing...' : 'Appoint Trainer (Preview)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {statusTarget && (
        <div
          className="apid-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Trainer Authorization Transition"
        >
          <div className="apid-card apid-modal">
            <h3 style={{ marginTop: 0 }}>
              {statusTarget.nextStatus === 'ACTIVE'
                ? 'Restore Trainer Authorization'
                : `${statusTarget.nextStatus === 'SUSPENDED' ? 'Suspend' : 'Revoke'} Trainer Authorization`}
            </h3>
            <div className="apid-alert apid-alert-warn" style={{ fontSize: '0.82rem' }}>
              <ShieldAlert size={14} style={{ verticalAlign: 'text-bottom', marginRight: '0.35rem' }} />
              <strong>Impact Assessment:</strong> {statusTarget.trainer.fullName} currently mentors{' '}
              <strong>{statusTarget.trainer.activeTrainees}</strong> active trainee(s) (Employment:{' '}
              <strong>{statusTarget.trainer.employmentStatus}</strong>).
            </div>

            <form onSubmit={handleStatusSubmit} className="apid-form">
              {statusTarget.nextStatus !== 'ACTIVE' && (
                <div className="apid-field">
                  <label htmlFor="trainer-policy">In-Flight Relationship Policy</label>
                  <select
                    id="trainer-policy"
                    className="apid-input"
                    value={policy}
                    onChange={(e) => setPolicy(e.target.value as TrainerSuspensionPolicy)}
                  >
                    <option value="BLOCK_NEW_SESSIONS_ONLY">
                      Block new sessions only (finish scheduled sessions)
                    </option>
                    <option value="PAUSE_EXISTING_RELATIONSHIPS">
                      Pause all active mentoring relationships immediately
                    </option>
                    <option value="REQUIRE_HR_REASSIGNMENT">
                      Flag active trainees for urgent HR reassignment
                    </option>
                  </select>
                </div>
              )}
              <div className="apid-field">
                <label htmlFor="trainer-status-reason">Governance Reason (Mandatory)</label>
                <textarea
                  id="trainer-status-reason"
                  className="apid-input"
                  rows={3}
                  required
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="Document HR rationale for audit trail..."
                />
              </div>
              <div className="apid-modal-actions">
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  onClick={() => setStatusTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`apid-btn ${
                    statusTarget.nextStatus === 'REVOKED' ? 'apid-btn-danger' : 'apid-btn-primary'
                  }`}
                  disabled={statusBusy}
                >
                  {statusBusy ? 'Applying...' : `Confirm ${statusTarget.nextStatus}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

