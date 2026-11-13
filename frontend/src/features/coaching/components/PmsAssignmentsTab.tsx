import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, History, RefreshCw, Search, UserCheck, UserPlus, XCircle } from 'lucide-react';
import {
  DataSourceBadge,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PermissionGate,
  SlideOverDrawer,
  StatusPill,
  useToast,
} from '../../../shared/components/ui';
import {
  coachingAssignmentApi,
  type AssignmentClosureReason,
  type AssignmentListFilters,
  type AssignmentStatus,
  type CoachingAssignmentItem,
} from '../api/coachingAssignmentApi';
import { organizationApi } from '../../admin/organization/api/organizationApi';
import { classifyRating, RATING_BAND_METADATA } from '../utils/ratingClassification';

export function PmsAssignmentsTab() {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  // Filters state (strictly separating status, closureReason, and atRisk)
  const [filters, setFilters] = useState<AssignmentListFilters>({
    status: '',
    closureReason: '',
    atRisk: undefined,
    search: '',
    page: 0,
    size: 20,
  });

  // Selected assignment for history drawer
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);

  // Modals state
  const [assignTarget, setAssignTarget] = useState<CoachingAssignmentItem | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<CoachingAssignmentItem | null>(null);
  const [closeTarget, setCloseTarget] = useState<CoachingAssignmentItem | null>(null);

  const [selectedCoachId, setSelectedCoachId] = useState<number | ''>('');
  const [actionReason, setActionReason] = useState('');
  const [closeReason, setCloseReason] = useState<AssignmentClosureReason>('ADMINISTRATIVE_CLOSURE');

  // Query live assignments
  const assignmentsQuery = useQuery({
    queryKey: ['coaching', 'assignments', filters],
    queryFn: () => coachingAssignmentApi.listAssignments(filters),
  });

  // Query active employees for coach selection
  const employeesQuery = useQuery({
    queryKey: ['core', 'active-employees-for-coach'],
    queryFn: () => organizationApi.searchEmployees({ status: 'ACTIVE', size: 100 }),
    staleTime: 5 * 60_000,
  });

  // Query detail for history drawer
  const detailQuery = useQuery({
    queryKey: ['coaching', 'assignment-detail', selectedHistoryId],
    queryFn: () => coachingAssignmentApi.getAssignmentDetail(selectedHistoryId!),
    enabled: selectedHistoryId !== null,
  });

  // Mutation: Assign Coach
  const assignCoachMutation = useMutation({
    mutationFn: ({ id, coachId, note }: { id: number; coachId: number; note?: string }) =>
      coachingAssignmentApi.assignCoach(id, { coachEmployeeId: coachId, note }),
    onSuccess: () => {
      pushToast({ title: 'Coach Assigned', message: 'Coach was successfully assigned.', tone: 'ok' });
      queryClient.invalidateQueries({ queryKey: ['coaching', 'assignments'] });
      setAssignTarget(null);
      setSelectedCoachId('');
      setActionReason('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Failed to assign coach';
      pushToast({ title: 'Assignment Failed', message: msg, tone: 'err' });
    },
  });

  // Mutation: Replace Coach
  const replaceCoachMutation = useMutation({
    mutationFn: ({ id, coachId, reason }: { id: number; coachId: number; reason: string }) =>
      coachingAssignmentApi.replaceCoach(id, { newCoachEmployeeId: coachId, reason }),
    onSuccess: () => {
      pushToast({ title: 'Coach Replaced', message: 'Coach replacement logged and updated.', tone: 'ok' });
      queryClient.invalidateQueries({ queryKey: ['coaching', 'assignments'] });
      setReplaceTarget(null);
      setSelectedCoachId('');
      setActionReason('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Failed to replace coach';
      pushToast({ title: 'Replacement Failed', message: msg, tone: 'err' });
    },
  });

  // Mutation: Close Assignment
  const closeAssignmentMutation = useMutation({
    mutationFn: ({ id, closureReason, notes }: { id: number; closureReason: AssignmentClosureReason; notes?: string }) =>
      coachingAssignmentApi.closeAssignment(id, { closureReason, notes }),
    onSuccess: () => {
      pushToast({ title: 'Assignment Closed', message: 'Coaching assignment has been closed.', tone: 'info' });
      queryClient.invalidateQueries({ queryKey: ['coaching', 'assignments'] });
      setCloseTarget(null);
      setActionReason('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Failed to close assignment';
      pushToast({ title: 'Close Failed', message: msg, tone: 'err' });
    },
  });

  const handleAssignSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!assignTarget || !selectedCoachId) return;
    assignCoachMutation.mutate({
      id: assignTarget.id,
      coachId: Number(selectedCoachId),
      note: actionReason.trim() || undefined,
    });
  };

  const handleReplaceSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!replaceTarget || !selectedCoachId || !actionReason.trim()) return;
    replaceCoachMutation.mutate({
      id: replaceTarget.id,
      coachId: Number(selectedCoachId),
      reason: actionReason.trim(),
    });
  };

  const handleCloseSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!closeTarget || !actionReason.trim()) return;
    closeAssignmentMutation.mutate({
      id: closeTarget.id,
      closureReason: closeReason,
      notes: actionReason.trim(),
    });
  };

  const renderStatusPill = (status: AssignmentStatus) => {
    switch (status) {
      case 'PENDING_COACH_ASSIGNMENT':
        return <StatusPill label="NEEDS COACH" tone="warn" />;
      case 'ACTIVE':
        return <StatusPill label="ACTIVE" tone="info" />;
      case 'COMPLETED':
        return <StatusPill label="COMPLETED" tone="ok" />;
      case 'CLOSED':
        return <StatusPill label="CLOSED" tone="neutral" />;
      case 'CANCELLED':
        return <StatusPill label="CANCELLED" tone="err" />;
      default:
        return <StatusPill label={status} tone="neutral" />;
    }
  };

  const activeEmployees = employeesQuery.data?.content ?? [];
  const assignments = assignmentsQuery.data?.content ?? [];
  const totalElements = assignmentsQuery.data?.totalElements ?? 0;

  return (
    <div className="apid-card">
      <div className="boa-card-header">
        <div>
          <h3 className="boa-card-title">Quarterly Coaching Roster</h3>
          <p className="boa-card-subtitle">
            Manage mandatory (<code>RoundedOverallFinalRating &lt; 3</code>) and self-development coaching assignments.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <DataSourceBadge source="live" />
          <button
            type="button"
            className="apid-btn apid-btn-outline apid-btn-sm"
            onClick={() => void assignmentsQuery.refetch()}
            disabled={assignmentsQuery.isFetching}
          >
            <RefreshCw size={13} className={assignmentsQuery.isFetching ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Structured Filter Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          padding: '0.75rem 0',
          borderBottom: '1px solid var(--border)',
          marginBottom: '1rem',
        }}
      >
        <div className="apid-field" style={{ marginBottom: 0 }}>
          <label htmlFor="filter-status">Lifecycle Status</label>
          <select
            id="filter-status"
            className="apid-input"
            value={filters.status ?? ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, status: (e.target.value as AssignmentStatus) || '', page: 0 }))
            }
          >
            <option value="">All Statuses</option>
            <option value="PENDING_COACH_ASSIGNMENT">Pending Coach Assignment</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div className="apid-field" style={{ marginBottom: 0 }}>
          <label htmlFor="filter-closure">Closure Reason</label>
          <select
            id="filter-closure"
            className="apid-input"
            value={filters.closureReason ?? ''}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                closureReason: (e.target.value as AssignmentClosureReason) || '',
                page: 0,
              }))
            }
          >
            <option value="">All Closure Reasons</option>
            <option value="CLEARED_BY_PMS">Cleared by PMS</option>
            <option value="CONTINUED_NEXT_QUARTER">Continued Next Quarter</option>
            <option value="SUCCESSFULLY_COMPLETED">Successfully Completed</option>
            <option value="ADMINISTRATIVE_CLOSURE">Administrative Closure</option>
          </select>
        </div>

        <div className="apid-field" style={{ marginBottom: 0 }}>
          <label htmlFor="filter-risk">Risk Condition</label>
          <select
            id="filter-risk"
            className="apid-input"
            value={filters.atRisk === undefined ? '' : String(filters.atRisk)}
            onChange={(e) => {
              const val = e.target.value;
              setFilters((f) => ({
                ...f,
                atRisk: val === '' ? undefined : val === 'true',
                page: 0,
              }));
            }}
          >
            <option value="">All (Risk &amp; Non-Risk)</option>
            <option value="true">At Risk Only</option>
            <option value="false">On Track Only</option>
          </select>
        </div>

        <div className="apid-field" style={{ marginBottom: 0 }}>
          <label htmlFor="filter-search">Search Staff</label>
          <div style={{ position: 'relative' }}>
            <input
              id="filter-search"
              type="text"
              placeholder="Name or employee code..."
              value={filters.search ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 0 }))}
              style={{ width: '100%', paddingLeft: '2rem' }}
            />
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '0.65rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--muted)',
              }}
            />
          </div>
        </div>
      </div>

      {assignmentsQuery.isLoading ? (
        <LoadingSkeleton rows={6} height={28} />
      ) : assignmentsQuery.isError ? (
        <ErrorState
          message="Failed to load live coaching assignments from server."
          onRetry={() => void assignmentsQuery.refetch()}
        />
      ) : assignments.length === 0 ? (
        <EmptyState
          title="No Coaching Assignments Found"
          description={
            totalElements === 0
              ? 'No coaching assignments exist in the database yet. Import PMS appraisal reports or create assignments to populate this roster.'
              : 'No assignments match the selected status, closure reason, or search filters.'
          }
        />
      ) : (
        <div className="apid-table-wrap">
          <table className="apid-table">
            <thead>
              <tr>
                <th>Coachee</th>
                <th>Quarter</th>
                <th>Rating &amp; Band</th>
                <th>Assigned Coach</th>
                <th>Status</th>
                <th>Risk / Closure</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const bandMeta =
                  a.roundedOverallFinalRating != null
                    ? RATING_BAND_METADATA[classifyRating(a.roundedOverallFinalRating)]
                    : null;
                return (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{a.coacheeFullName}</div>
                      <div className="boa-muted" style={{ fontSize: '0.77rem' }}>
                        {a.coacheeEmployeeNumber} · {a.coacheeDepartment ?? '—'}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem' }}>
                        <strong>Coaching:</strong> {a.coachingQuarterLabel ?? '—'}
                      </div>
                      {a.performanceQuarterLabel && (
                        <div className="boa-muted" style={{ fontSize: '0.77rem' }}>
                          <strong>PMS:</strong> {a.performanceQuarterLabel}
                        </div>
                      )}
                    </td>
                    <td>
                      {a.overallFinalRating != null ? (
                        <>
                          <div className="tabular-nums" style={{ fontWeight: 700 }}>
                            {a.overallFinalRating.toFixed(4)}{' '}
                            <span className="boa-muted" style={{ fontWeight: 400, fontSize: '0.76rem' }}>
                              (Round {a.roundedOverallFinalRating})
                            </span>
                          </div>
                          {bandMeta && (
                            <div style={{ marginTop: '0.2rem' }}>
                              <StatusPill label={bandMeta.shortLabel} tone={bandMeta.tone} />
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="boa-muted" style={{ fontSize: '0.82rem' }}>
                          Self Development
                        </span>
                      )}
                    </td>
                    <td>
                      {a.coachFullName ? (
                        <div>
                          <div style={{ fontWeight: 600 }}>{a.coachFullName}</div>
                          <div className="boa-muted" style={{ fontSize: '0.76rem' }}>
                            {a.coachEmployeeNumber}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--warn)', fontWeight: 600, fontSize: '0.82rem' }}>
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td>{renderStatusPill(a.status)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {a.atRisk && <StatusPill label="AT RISK" tone="err" />}
                        {a.closureReason && (
                          <span className="boa-muted" style={{ fontSize: '0.76rem' }}>
                            {a.closureReason.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="apid-actions-cell">
                      <button
                        type="button"
                        className="apid-btn apid-btn-outline apid-btn-sm"
                        onClick={() => setSelectedHistoryId(a.id)}
                        title="View assignment details and immutable coach replacement history"
                      >
                        <History size={13} /> History
                      </button>

                      {a.status === 'PENDING_COACH_ASSIGNMENT' && (
                        <PermissionGate permission="COACHING_COACH_REPLACE">
                          <button
                            type="button"
                            className="apid-btn apid-btn-primary apid-btn-sm"
                            onClick={() => {
                              setAssignTarget(a);
                              setSelectedCoachId('');
                              setActionReason('');
                            }}
                          >
                            <UserPlus size={13} /> Assign Coach
                          </button>
                        </PermissionGate>
                      )}

                      {a.status === 'ACTIVE' && (
                        <PermissionGate permission="COACHING_COACH_REPLACE">
                          <button
                            type="button"
                            className="apid-btn apid-btn-sm"
                            onClick={() => {
                              setReplaceTarget(a);
                              setSelectedCoachId('');
                              setActionReason('');
                            }}
                          >
                            <UserCheck size={13} /> Replace Coach
                          </button>
                        </PermissionGate>
                      )}

                      {(a.status === 'ACTIVE' || a.status === 'PENDING_COACH_ASSIGNMENT') && (
                        <PermissionGate permission="COACHING_COACH_REPLACE">
                          <button
                            type="button"
                            className="apid-btn apid-btn-outline apid-btn-sm"
                            style={{ color: 'var(--err)', borderColor: 'var(--border)' }}
                            onClick={() => {
                              setCloseTarget(a);
                              setCloseReason('ADMINISTRATIVE_CLOSURE');
                              setActionReason('');
                            }}
                            title="Administratively close assignment"
                          >
                            <XCircle size={13} /> Close
                          </button>
                        </PermissionGate>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* History & Details SlideOverDrawer */}
      <SlideOverDrawer
        open={selectedHistoryId !== null}
        title={`Assignment Details · #${selectedHistoryId}`}
        subtitle={
          detailQuery.data
            ? `${detailQuery.data.assignment.coacheeFullName} (${detailQuery.data.assignment.coacheeEmployeeNumber})`
            : undefined
        }
        onClose={() => setSelectedHistoryId(null)}
      >
        {detailQuery.isLoading ? (
          <LoadingSkeleton rows={5} height={28} />
        ) : detailQuery.data ? (
          <div className="boa-stack">
            {/* Status overview */}
            <div
              style={{
                background: 'var(--surface-subtle)',
                padding: '0.85rem',
                borderRadius: 8,
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Lifecycle Status</span>
                {renderStatusPill(detailQuery.data.assignment.status)}
              </div>
              {detailQuery.data.assignment.closureReason && (
                <div style={{ marginTop: '0.4rem', fontSize: '0.82rem' }}>
                  <strong>Closure Reason:</strong>{' '}
                  {detailQuery.data.assignment.closureReason.replace(/_/g, ' ')}
                </div>
              )}
              {detailQuery.data.assignment.atRisk && (
                <div style={{ marginTop: '0.4rem', color: 'var(--err)', fontWeight: 600, fontSize: '0.82rem' }}>
                  <AlertTriangle size={13} style={{ display: 'inline', marginRight: 4 }} /> Flagged as At Risk
                </div>
              )}
            </div>

            {/* Replacement History Trail */}
            <div>
              <h4 style={{ margin: '0.75rem 0 0.4rem 0' }}>Coach Replacement Audit Log</h4>
              {detailQuery.data.replacementHistory.length === 0 ? (
                <div className="boa-muted" style={{ fontSize: '0.84rem' }}>
                  No coach replacements recorded.
                </div>
              ) : (
                <div className="boa-stack">
                  {detailQuery.data.replacementHistory.map((h) => (
                    <div
                      key={h.id}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '0.75rem',
                        background: 'var(--surface-subtle)',
                      }}
                    >
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)' }}>
                        {new Date(h.changedAt).toLocaleString()} · Actor: {h.changedByUsername ?? 'Admin'}
                      </div>
                      <div style={{ marginTop: '0.25rem', fontSize: '0.86rem' }}>
                        <strong>{h.fromCoachFullName || 'Unassigned'}</strong> →{' '}
                        <strong>{h.toCoachFullName}</strong>
                      </div>
                      <div className="boa-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                        Reason: {h.reason}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Participants */}
            <div>
              <h4 style={{ margin: '0.75rem 0 0.4rem 0' }}>Coaching Participants</h4>
              <div className="apid-table-wrap">
                <table className="apid-table">
                  <thead>
                    <tr>
                      <th>Participant</th>
                      <th>Role</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailQuery.data.participants.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{p.employeeFullName}</div>
                          <div className="boa-muted" style={{ fontSize: '0.75rem' }}>
                            {p.employeeNumber}
                          </div>
                        </td>
                        <td>{p.role}</td>
                        <td>
                          <StatusPill
                            label={p.active ? 'ACTIVE' : 'INACTIVE'}
                            tone={p.active ? 'ok' : 'neutral'}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Triggering Goals Breakdown */}
            {detailQuery.data.triggeringGoals.length > 0 && (
              <div>
                <h4 style={{ margin: '0.75rem 0 0.4rem 0' }}>Triggering PMS Goal Breakdown</h4>
                <div className="apid-table-wrap">
                  <table className="apid-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Goal</th>
                        <th>Score</th>
                        <th>Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailQuery.data.triggeringGoals.map((g) => (
                        <tr key={g.sourceRowNumber}>
                          <td className="tabular-nums">{g.sourceRowNumber}</td>
                          <td>{g.goalName}</td>
                          <td className="tabular-nums">{g.goalScore?.toFixed(4) ?? '—'}</td>
                          <td className="tabular-nums">{g.weight != null ? `${g.weight}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </SlideOverDrawer>

      {/* Assign Coach Modal */}
      {assignTarget && (
        <div className="apid-modal-backdrop" role="dialog" aria-modal="true" aria-label="Assign Coach">
          <div className="apid-card apid-modal">
            <h3 style={{ marginTop: 0 }}>Assign Coach · {assignTarget.coacheeFullName}</h3>
            <p className="boa-muted" style={{ fontSize: '0.83rem' }}>
              Resolving pending assignment for quarter: <strong>{assignTarget.coachingQuarterLabel}</strong>
            </p>
            <form onSubmit={handleAssignSubmit} className="apid-form">
              <div className="apid-field">
                <label htmlFor="assign-coach-select">Select Active Bank Coach (Mandatory)</label>
                <select
                  id="assign-coach-select"
                  className="apid-input"
                  required
                  value={selectedCoachId}
                  onChange={(e) => setSelectedCoachId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">-- Choose Eligible Employee --</option>
                  {activeEmployees
                    .filter((emp) => emp.id !== assignTarget.coacheeEmployeeId)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.employeeNumber}) · {emp.departmentName ?? 'General'}
                      </option>
                    ))}
                </select>
              </div>

              <div className="apid-field">
                <label htmlFor="assign-note">Optional Assignment Note</label>
                <input
                  id="assign-note"
                  type="text"
                  placeholder="e.g., Assigned direct line manager as designated coach"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                />
              </div>

              <div className="apid-modal-actions">
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  onClick={() => setAssignTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="apid-btn apid-btn-primary"
                  disabled={!selectedCoachId || assignCoachMutation.isPending}
                >
                  {assignCoachMutation.isPending ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Replace Coach Modal */}
      {replaceTarget && (
        <div className="apid-modal-backdrop" role="dialog" aria-modal="true" aria-label="Replace Coach">
          <div className="apid-card apid-modal">
            <h3 style={{ marginTop: 0 }}>Replace Coach · {replaceTarget.coacheeFullName}</h3>
            <p className="boa-muted" style={{ fontSize: '0.83rem' }}>
              Current Coach: <strong>{replaceTarget.coachFullName ?? 'Unassigned'}</strong> · Quarter:{' '}
              <strong>{replaceTarget.coachingQuarterLabel}</strong>
            </p>
            <form onSubmit={handleReplaceSubmit} className="apid-form">
              <div className="apid-field">
                <label htmlFor="replace-coach-select">Select Successor Coach (Mandatory)</label>
                <select
                  id="replace-coach-select"
                  className="apid-input"
                  required
                  value={selectedCoachId}
                  onChange={(e) => setSelectedCoachId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">-- Choose Successor Active Employee --</option>
                  {activeEmployees
                    .filter(
                      (emp) =>
                        emp.id !== replaceTarget.coacheeEmployeeId &&
                        emp.id !== replaceTarget.coachEmployeeId
                    )
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.employeeNumber}) · {emp.departmentName ?? 'General'}
                      </option>
                    ))}
                </select>
              </div>

              <div className="apid-field">
                <label htmlFor="replace-audit-reason">Mandatory Audit Reason</label>
                <textarea
                  id="replace-audit-reason"
                  className="apid-input"
                  rows={3}
                  required
                  placeholder="Specify reason (e.g., branch reassignment, medical leave, workload rebalance)..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
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
                <button
                  type="submit"
                  className="apid-btn apid-btn-primary"
                  disabled={!selectedCoachId || !actionReason.trim() || replaceCoachMutation.isPending}
                >
                  {replaceCoachMutation.isPending ? 'Updating...' : 'Confirm Replacement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Assignment Modal */}
      {closeTarget && (
        <div className="apid-modal-backdrop" role="dialog" aria-modal="true" aria-label="Close Assignment">
          <div className="apid-card apid-modal">
            <h3 style={{ marginTop: 0 }}>Close Assignment · {closeTarget.coacheeFullName}</h3>
            <p className="boa-muted" style={{ fontSize: '0.83rem' }}>
              Are you sure you want to administratively close this coaching assignment?
            </p>
            <form onSubmit={handleCloseSubmit} className="apid-form">
              <div className="apid-field">
                <label htmlFor="close-reason-select">Closure Reason</label>
                <select
                  id="close-reason-select"
                  className="apid-input"
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value as AssignmentClosureReason)}
                >
                  <option value="ADMINISTRATIVE_CLOSURE">Administrative Closure</option>
                  <option value="CLEARED_BY_PMS">Cleared by PMS</option>
                  <option value="CONTINUED_NEXT_QUARTER">Continued Next Quarter</option>
                </select>
              </div>

              <div className="apid-field">
                <label htmlFor="close-audit-reason">Mandatory Audit Reason</label>
                <textarea
                  id="close-audit-reason"
                  className="apid-input"
                  rows={3}
                  required
                  placeholder="State the justification for closing this assignment..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                />
              </div>

              <div className="apid-modal-actions">
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  onClick={() => setCloseTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="apid-btn apid-btn-primary"
                  style={{ background: 'var(--err)', borderColor: 'var(--err)' }}
                  disabled={!actionReason.trim() || closeAssignmentMutation.isPending}
                >
                  {closeAssignmentMutation.isPending ? 'Closing...' : 'Close Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
