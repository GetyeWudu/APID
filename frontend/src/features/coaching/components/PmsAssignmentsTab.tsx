import { useState, type FormEvent } from 'react';
import { History, Plus, UserCheck } from 'lucide-react';
import {
  DataSourceBadge,
  EmptyState,
  PermissionGate,
  SlideOverDrawer,
  StatusPill,
  useToast,
} from '../../../shared/components/ui';
import type { PreviewPmsAssignment } from '../../../shared/mocks/boaPreviewFixtures';
import { coachingPreviewAdapter } from '../api/coachingDashboardApi';
import { classifyRating, RATING_BAND_METADATA } from '../utils/ratingClassification';

export function PmsAssignmentsTab({
  assignments,
  onAssignmentCoachUpdated,
  onCreateInitiative,
}: {
  assignments: PreviewPmsAssignment[];
  onAssignmentCoachUpdated: (assignmentId: string, nextCoach: string, reason: string) => void;
  onCreateInitiative: (item: PreviewPmsAssignment) => void;
}) {
  const { pushToast } = useToast();
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<PreviewPmsAssignment | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<PreviewPmsAssignment | null>(null);
  const [newCoachName, setNewCoachName] = useState('');
  const [replaceReason, setReplaceReason] = useState('');
  const [busy, setBusy] = useState(false);

  // Create Initiative modal state
  const [showInitiativeModal, setShowInitiativeModal] = useState(false);
  const [initEmployeeName, setInitEmployeeName] = useState('');
  const [initDepartment, setInitDepartment] = useState('Retail & Branch Banking');
  const [initCoachName, setInitCoachName] = useState('');

  const handleReplaceCoach = async (e: FormEvent) => {
    e.preventDefault();
    if (!replaceTarget || !newCoachName.trim() || !replaceReason.trim()) return;
    setBusy(true);
    try {
      const res = await coachingPreviewAdapter.simulateReplaceCoach(
        replaceTarget.id,
        newCoachName.trim(),
        replaceReason.trim()
      );
      onAssignmentCoachUpdated(replaceTarget.id, newCoachName.trim(), replaceReason.trim());
      pushToast({ title: 'Coach replaced (Preview)', message: res.message, tone: 'info' });
      setReplaceTarget(null);
      setNewCoachName('');
      setReplaceReason('');
    } finally {
      setBusy(false);
    }
  };

  const handleInitiativeSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!initEmployeeName.trim() || !initCoachName.trim()) return;
    const created: PreviewPmsAssignment = {
      id: `PA-${Math.floor(200 + Math.random() * 799)}`,
      employeeCode: `DEMO-${Math.floor(100 + Math.random() * 899)}`,
      employeeName: initEmployeeName.trim(),
      directorate: initDepartment,
      department: `${initDepartment} Unit`,
      performanceQuarter: 'FY26/27 Q1',
      coachingQuarter: 'FY26/27 Q2',
      pathway: 'SKILL_DEVELOPMENT',
      status: 'ACTIVE',
      unroundedRating: 3.45,
      roundedRating: 3,
      coachName: initCoachName.trim(),
      sessionsCompleted: 0,
      sessionsTotal: 4,
      overdueReports: 0,
      coachHistory: [
        {
          date: new Date().toISOString().slice(0, 10),
          fromCoach: 'Unassigned',
          toCoach: initCoachName.trim(),
          reason: 'PMS-initiated Skill-Development Coaching preview assignment',
        },
      ],
    };
    onCreateInitiative(created);
    pushToast({
      title: 'Coaching initiative added (Preview)',
      message: `Added coaching initiative for ${created.employeeName} in this preview session.`,
      tone: 'info',
    });
    setShowInitiativeModal(false);
    setInitEmployeeName('');
    setInitCoachName('');
  };

  const renderStatusPill = (status: PreviewPmsAssignment['status']) => {
    if (status === 'AT_RISK') return <StatusPill label="AT RISK" tone="err" />;
    if (status === 'PENDING_COACH_ASSIGNMENT') return <StatusPill label="NEEDS COACH" tone="warn" />;
    if (status === 'CLEARED') return <StatusPill label="CLEARED" tone="ok" />;
    return <StatusPill label="ACTIVE" tone="info" />;
  };

  return (
    <div className="apid-card">
      <div className="boa-card-header">
        <div>
          <h3 className="boa-card-title">Quarterly Coaching Roster</h3>
          <p className="boa-card-subtitle">
            Tracks mandatory (<code>RoundedOverallFinalRating &lt; 3</code>) and PMS skill-development coaching assignments.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <DataSourceBadge source="preview" />
          <PermissionGate permission="COACHING_INITIATIVE_CREATE">
            <button
              type="button"
              className="apid-btn apid-btn-primary apid-btn-sm"
              onClick={() => setShowInitiativeModal(true)}
            >
              <Plus size={14} /> New Coaching Initiative
            </button>
          </PermissionGate>
        </div>
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          title="No Matching Coaching Assignments"
          description="Try broadening your Performance Quarter, Coaching Quarter, or Directorate filters."
        />
      ) : (
        <div className="apid-table-wrap">
          <table className="apid-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Quarters</th>
                <th>Avg / Rounded Band</th>
                <th>Assigned Coach</th>
                <th>Sessions</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const bandMeta = RATING_BAND_METADATA[classifyRating(a.roundedRating)];
                return (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{a.employeeName}</div>
                      <div className="boa-muted" style={{ fontSize: '0.77rem' }}>
                        {a.employeeCode} · {a.department}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem' }}>
                        <strong>PMS:</strong> {a.performanceQuarter}
                      </div>
                      <div className="boa-muted" style={{ fontSize: '0.77rem' }}>
                        <strong>Coaching:</strong> {a.coachingQuarter}
                      </div>
                    </td>
                    <td>
                      <div className="tabular-nums" style={{ fontWeight: 700 }}>
                        {a.unroundedRating.toFixed(4)}{' '}
                        <span className="boa-muted" style={{ fontWeight: 400, fontSize: '0.76rem' }}>
                          (Round {a.roundedRating})
                        </span>
                      </div>
                      <div style={{ marginTop: '0.2rem' }}>
                        <StatusPill label={bandMeta.shortLabel} tone={bandMeta.tone} />
                      </div>
                    </td>
                    <td>{a.coachName ?? <span className="boa-muted">Unassigned</span>}</td>
                    <td>
                      <div className="tabular-nums">
                        {a.sessionsCompleted} / {a.sessionsTotal}
                      </div>
                      {a.overdueReports > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--err)', fontWeight: 600 }}>
                          {a.overdueReports} overdue report(s)
                        </div>
                      )}
                    </td>
                    <td>{renderStatusPill(a.status)}</td>
                    <td className="apid-actions-cell">
                      <button
                        type="button"
                        className="apid-btn apid-btn-outline apid-btn-sm"
                        onClick={() => setSelectedHistoryItem(a)}
                      >
                        <History size={13} /> History
                      </button>
                      <PermissionGate permission="COACHING_COACH_REPLACE">
                        <button
                          type="button"
                          className="apid-btn apid-btn-sm"
                          onClick={() => {
                            setReplaceTarget(a);
                            setNewCoachName(a.coachName ?? '');
                            setReplaceReason('');
                          }}
                        >
                          <UserCheck size={13} /> Replace Coach
                        </button>
                      </PermissionGate>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SlideOverDrawer
        open={Boolean(selectedHistoryItem)}
        title={selectedHistoryItem ? `Coach Assignment History · ${selectedHistoryItem.employeeName}` : ''}
        subtitle={
          selectedHistoryItem
            ? `${selectedHistoryItem.employeeCode} · ${selectedHistoryItem.directorate}`
            : undefined
        }
        onClose={() => setSelectedHistoryItem(null)}
      >
        {selectedHistoryItem && (
          <div className="boa-stack">
            <div className="apid-alert apid-alert-info">
              <strong>Read-Only Audit Trail (Preview):</strong> Mid-quarter coach replacements are
              logged with previous coach, successor, timestamp, and PMS reason.
            </div>
            {selectedHistoryItem.coachHistory.map((entry, idx) => (
              <div
                key={`${entry.date}-${idx}`}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.75rem',
                  background: 'var(--surface-subtle)',
                }}
              >
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)' }}>
                  {entry.date}
                </div>
                <div style={{ marginTop: '0.25rem', fontSize: '0.86rem' }}>
                  <strong>{entry.fromCoach}</strong> → <strong>{entry.toCoach}</strong>
                </div>
                <div className="boa-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                  Reason: {entry.reason}
                </div>
              </div>
            ))}
          </div>
        )}
      </SlideOverDrawer>

      {replaceTarget && (
        <div className="apid-modal-backdrop" role="dialog" aria-modal="true" aria-label="Replace Coach">
          <div className="apid-card apid-modal">
            <h3 style={{ marginTop: 0 }}>Replace Coach · {replaceTarget.employeeName}</h3>
            <p className="boa-muted" style={{ fontSize: '0.83rem' }}>
              Current Coach: <strong>{replaceTarget.coachName ?? 'Unassigned'}</strong> · Target quarter:{' '}
              <strong>{replaceTarget.coachingQuarter}</strong>
            </p>
            <form onSubmit={handleReplaceCoach} className="apid-form">
              <div className="apid-field">
                <label htmlFor="pms-new-coach">Successor Coach Name</label>
                <input
                  id="pms-new-coach"
                  type="text"
                  required
                  value={newCoachName}
                  onChange={(e) => setNewCoachName(e.target.value)}
                  placeholder="e.g., Dawit Mekonnen"
                />
              </div>
              <div className="apid-field">
                <label htmlFor="pms-replace-reason">Audit Reason (Mandatory)</label>
                <textarea
                  id="pms-replace-reason"
                  className="apid-input"
                  rows={3}
                  required
                  value={replaceReason}
                  onChange={(e) => setReplaceReason(e.target.value)}
                  placeholder="Specify reason (transfer, leave, workload rebalance...)"
                />
              </div>
              <div className="apid-modal-actions">
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  onClick={() => setReplaceTarget(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="apid-btn apid-btn-primary" disabled={busy}>
                  {busy ? 'Saving...' : 'Confirm Replacement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInitiativeModal && (
        <div
          className="apid-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="New Coaching Initiative"
        >
          <div className="apid-card apid-modal">
            <h3 style={{ marginTop: 0 }}>New Coaching Initiative</h3>
            <form onSubmit={handleInitiativeSubmit} className="apid-form">
              <div className="apid-field">
                <label htmlFor="init-emp">Employee Full Name</label>
                <input
                  id="init-emp"
                  type="text"
                  required
                  value={initEmployeeName}
                  onChange={(e) => setInitEmployeeName(e.target.value)}
                  placeholder="e.g., Selamawit Tesfaye"
                />
              </div>
              <div className="apid-field">
                <label htmlFor="init-dir">Directorate</label>
                <select
                  id="init-dir"
                  className="apid-input"
                  value={initDepartment}
                  onChange={(e) => setInitDepartment(e.target.value)}
                >
                  <option value="Retail & Branch Banking">Retail &amp; Branch Banking</option>
                  <option value="Technology & Digital Banking">Technology &amp; Digital Banking</option>
                  <option value="Credit & Risk Management">Credit &amp; Risk Management</option>
                  <option value="Operations & Treasury">Operations &amp; Treasury</option>
                  <option value="HR & Corporate Services">HR &amp; Corporate Services</option>
                </select>
              </div>
              <div className="apid-field">
                <label htmlFor="init-coach">Assigned Coach</label>
                <input
                  id="init-coach"
                  type="text"
                  required
                  value={initCoachName}
                  onChange={(e) => setInitCoachName(e.target.value)}
                  placeholder="e.g., Bekele Tesfaye"
                />
              </div>
              <div className="apid-modal-actions">
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  onClick={() => setShowInitiativeModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="apid-btn apid-btn-primary">
                  Create Initiative
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

