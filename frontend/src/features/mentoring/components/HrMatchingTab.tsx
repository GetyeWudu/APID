import { useState } from 'react';
import { Link2 } from 'lucide-react';
import {
  DataSourceBadge,
  EmptyState,
  PermissionGate,
  StatusPill,
  useToast,
} from '../../../shared/components/ui';
import type {
  PreviewCertifiedTrainer,
  PreviewMentoringRequest,
} from '../../../shared/mocks/boaPreviewFixtures';
import { mentoringPreviewAdapter } from '../api/mentoringDashboardApi';

export function HrMatchingTab({
  requests,
  trainers,
  onMatched,
}: {
  requests: PreviewMentoringRequest[];
  trainers: PreviewCertifiedTrainer[];
  onMatched: (requestId: string) => void;
}) {
  const { pushToast } = useToast();
  const [selectedTrainers, setSelectedTrainers] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleMatch = async (req: PreviewMentoringRequest) => {
    const trainerId = selectedTrainers[req.id];
    if (!trainerId) return;
    setBusyId(req.id);
    try {
      const res = await mentoringPreviewAdapter.simulateMatch(req.id, trainerId);
      onMatched(req.id);
      pushToast({ title: 'Match Assigned (Preview)', message: res.message, tone: 'ok' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="apid-card">
      <div className="boa-card-header">
        <div>
          <h3 className="boa-card-title">Trainee–Trainer Match Requests</h3>
          <p className="boa-card-subtitle">
            Only active, approved Trainers with matching skills and open capacity are available to select.
          </p>
        </div>
        <DataSourceBadge source="preview" />
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="No Open Mentoring Requests"
          description="All trainee learning requests have been matched."
        />
      ) : (
        <div className="apid-table-wrap">
          <table className="apid-table">
            <thead>
              <tr>
                <th>Trainee</th>
                <th>Requested Skill &amp; Schedule</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Match Eligible Trainer</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => {
                const eligible = trainers.filter(
                  (t) =>
                    t.employmentStatus === 'ACTIVE' &&
                    t.trainerAuthStatus === 'ACTIVE' &&
                    t.activeTrainees < t.maxTrainees &&
                    t.approvedSkills.includes(req.requestedSkill)
                );
                return (
                  <tr key={req.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{req.traineeName}</div>
                      <div className="boa-muted" style={{ fontSize: '0.77rem' }}>
                        {req.traineeCode} · {req.department}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{req.requestedSkill}</div>
                      <div className="boa-muted" style={{ fontSize: '0.76rem' }}>
                        Prefers: {req.preferredSchedule}
                      </div>
                    </td>
                    <td>
                      <StatusPill label={req.channel} tone="neutral" />
                    </td>
                    <td>
                      <StatusPill
                        label={req.status}
                        tone={req.status === 'MATCHED' ? 'ok' : 'warn'}
                      />
                    </td>
                    <td>
                      <PermissionGate permission="MENTORING_MATCH_MANAGE">
                        {req.status === 'AWAITING_HR_MATCH' ? (
                          eligible.length === 0 ? (
                            <span className="boa-muted" style={{ fontSize: '0.78rem' }}>
                              No free trainer slots for skill
                            </span>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                              <select
                                className="apid-input"
                                value={selectedTrainers[req.id] ?? ''}
                                onChange={(e) =>
                                  setSelectedTrainers((prev) => ({
                                    ...prev,
                                    [req.id]: e.target.value,
                                  }))
                                }
                              >
                                <option value="">Select eligible trainer...</option>
                                {eligible.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.fullName} ({t.activeTrainees}/{t.maxTrainees})
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="apid-btn apid-btn-primary apid-btn-sm"
                                disabled={!selectedTrainers[req.id] || busyId === req.id}
                                onClick={() => void handleMatch(req)}
                              >
                                <Link2 size={13} /> Match
                              </button>
                            </div>
                          )
                        ) : (
                          <span className="boa-muted" style={{ fontSize: '0.78rem' }}>
                            Handled
                          </span>
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
    </div>
  );
}

