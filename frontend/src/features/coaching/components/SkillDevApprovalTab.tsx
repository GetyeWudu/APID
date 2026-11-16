import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCircle2, XCircle, Users, Building2, Clock, AlertCircle } from 'lucide-react';
import {
  skillCoachingRequestApi,
  type SkillCoachingRequestItem,
  type SkillRequestStatus,
} from '../api/skillCoachingRequestApi';
import { organizationApi } from '../../admin/organization/api/organizationApi';
import {
  DataSourceBadge,
  EmptyState,
  LoadingSkeleton,
  PermissionGate,
  StatusPill,
  useToast,
} from '../../../shared/components/ui';

interface SkillDevApprovalTabProps {
  requests?: any[];
  onRequestUpdated?: (id: string, status: any, reason?: string) => void;
}

export function SkillDevApprovalTab({}: SkillDevApprovalTabProps = {}) {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const [statusTab, setStatusTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');

  const [approveTarget, setApproveTarget] = useState<SkillCoachingRequestItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SkillCoachingRequestItem | null>(null);

  // Approval modal state
  const [selectedCoachId, setSelectedCoachId] = useState<number | ''>('');
  const [approvalNotes, setApprovalNotes] = useState('');

  // Rejection modal state
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [rejectionError, setRejectionError] = useState('');

  // Query all requests from live backend
  const allRequestsQuery = useQuery({
    queryKey: ['coaching', 'skill-requests', 'all'],
    queryFn: () => skillCoachingRequestApi.getAllRequests(),
  });

  // Query active employees for coach override option
  const activeEmployeesQuery = useQuery({
    queryKey: ['core', 'active-employees-for-coaching'],
    queryFn: () => organizationApi.searchEmployees({ status: 'ACTIVE', size: 100 }),
    staleTime: 60_000,
  });

  const approveMutation = useMutation({
    mutationFn: ({
      id,
      overrideCoachEmployeeId,
      reviewNotes,
    }: {
      id: number;
      overrideCoachEmployeeId?: number | null;
      reviewNotes?: string;
    }) =>
      skillCoachingRequestApi.approveRequest(id, {
        overrideCoachEmployeeId: overrideCoachEmployeeId || undefined,
        reviewNotes: reviewNotes?.trim() || undefined,
      }),
    onSuccess: (data) => {
      pushToast({
        title: 'Request Approved',
        message: `Approved skill coaching request REQ-${data.id}. Coaching assignments created for ${data.targets.length} staff.`,
        tone: 'ok',
      });
      void queryClient.invalidateQueries({ queryKey: ['coaching', 'skill-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['coaching', 'assignments'] });
      void queryClient.invalidateQueries({ queryKey: ['coaching', 'pms-preview'] });
      setApproveTarget(null);
      setSelectedCoachId('');
      setApprovalNotes('');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to approve skill coaching request.';
      pushToast({ title: 'Approval Failed', message: msg, tone: 'err' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reviewNotes }: { id: number; reviewNotes: string }) =>
      skillCoachingRequestApi.rejectRequest(id, { reviewNotes }),
    onSuccess: (data) => {
      pushToast({
        title: 'Request Rejected',
        message: `Rejected skill coaching request REQ-${data.id}. Feedback recorded for line manager.`,
        tone: 'info',
      });
      void queryClient.invalidateQueries({ queryKey: ['coaching', 'skill-requests'] });
      setRejectTarget(null);
      setRejectionNotes('');
      setRejectionError('');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to reject skill coaching request.';
      setRejectionError(msg);
      pushToast({ title: 'Rejection Failed', message: msg, tone: 'err' });
    },
  });

  const openApproveModal = (req: SkillCoachingRequestItem) => {
    setApproveTarget(req);
    setSelectedCoachId(req.proposedCoachEmployeeId);
    setApprovalNotes('');
  };

  const handleConfirmApprove = (e: FormEvent) => {
    e.preventDefault();
    if (!approveTarget) return;

    const overrideId =
      selectedCoachId && selectedCoachId !== approveTarget.proposedCoachEmployeeId
        ? Number(selectedCoachId)
        : undefined;

    approveMutation.mutate({
      id: approveTarget.id,
      overrideCoachEmployeeId: overrideId,
      reviewNotes: approvalNotes,
    });
  };

  const handleConfirmReject = (e: FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;

    if (!rejectionNotes.trim()) {
      setRejectionError('Mandatory justification reason is required to reject a manager request.');
      return;
    }

    rejectMutation.mutate({
      id: rejectTarget.id,
      reviewNotes: rejectionNotes.trim(),
    });
  };

  if (allRequestsQuery.isLoading) {
    return <LoadingSkeleton rows={5} height={36} />;
  }

  const allRequests: SkillCoachingRequestItem[] = Array.isArray(allRequestsQuery.data)
    ? allRequestsQuery.data
    : [];

  const pendingRequests = allRequests.filter(
    (r) => r.status === ('PENDING_APPROVAL' as SkillRequestStatus) || r.status === 'PENDING_PMS_APPROVAL'
  );
  const approvedRequests = allRequests.filter((r) => r.status === 'APPROVED');
  const rejectedRequests = allRequests.filter((r) => r.status === 'REJECTED');

  const displayedRequests = allRequests.filter((r) => {
    if (statusTab === 'PENDING') {
      return r.status === ('PENDING_APPROVAL' as SkillRequestStatus) || r.status === 'PENDING_PMS_APPROVAL';
    }
    if (statusTab === 'APPROVED') return r.status === 'APPROVED';
    if (statusTab === 'REJECTED') return r.status === 'REJECTED';
    return true;
  });

  const employeeOptions = (activeEmployeesQuery.data?.content ?? []) as Array<{
    id: number;
    fullName: string;
    employeeNumber: string;
    jobTitle?: string | null;
    departmentName?: string | null;
  }>;

  const renderStatus = (status: SkillCoachingRequestItem['status']) => {
    switch (status) {
      case 'APPROVED':
        return <StatusPill label="APPROVED" tone="ok" />;
      case 'REJECTED':
        return <StatusPill label="REJECTED" tone="err" />;
      case 'PENDING_PMS_APPROVAL':
      case 'PENDING_APPROVAL' as any:
      default:
        return <StatusPill label="PENDING APPROVAL" tone="warn" />;
    }
  };

  return (
    <div className="apid-card" data-testid="skill-dev-approval-panel">
      <div className="boa-card-header">
        <div>
          <h3 className="boa-card-title">PMS Skill-Development Coaching Requests</h3>
          <p className="boa-card-subtitle">
            Formal requests submitted by Line Managers and Higher Managers. PMS Admin approval
            auto-generates mandatory coaching assignments with confirmed or overridden coach.
          </p>
        </div>
        <DataSourceBadge source="live" />
      </div>

      {/* Status Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.4rem',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          padding: '0 0.5rem 0.5rem 0.5rem',
          marginBottom: '0.85rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          className={`apid-btn apid-btn-sm ${statusTab === 'PENDING' ? 'apid-btn-primary' : 'apid-btn-outline'}`}
          onClick={() => setStatusTab('PENDING')}
        >
          <Clock size={13} style={{ marginRight: 3 }} />
          Pending Review ({pendingRequests.length})
        </button>
        <button
          type="button"
          className={`apid-btn apid-btn-sm ${statusTab === 'APPROVED' ? 'apid-btn-primary' : 'apid-btn-outline'}`}
          onClick={() => setStatusTab('APPROVED')}
        >
          <CheckCircle2 size={13} style={{ marginRight: 3 }} />
          Approved ({approvedRequests.length})
        </button>
        <button
          type="button"
          className={`apid-btn apid-btn-sm ${statusTab === 'REJECTED' ? 'apid-btn-primary' : 'apid-btn-outline'}`}
          onClick={() => setStatusTab('REJECTED')}
        >
          <XCircle size={13} style={{ marginRight: 3 }} />
          Rejected ({rejectedRequests.length})
        </button>
        <button
          type="button"
          className={`apid-btn apid-btn-sm ${statusTab === 'ALL' ? 'apid-btn-primary' : 'apid-btn-outline'}`}
          onClick={() => setStatusTab('ALL')}
        >
          All Requests ({allRequests.length})
        </button>
      </div>

      {displayedRequests.length === 0 ? (
        <EmptyState
          title={
            statusTab === 'PENDING'
              ? 'Approval Queue Clear'
              : statusTab === 'APPROVED'
              ? 'No Approved Requests Yet'
              : statusTab === 'REJECTED'
              ? 'No Rejected Requests'
              : 'No Requests Found'
          }
          description={
            statusTab === 'PENDING'
              ? 'There are currently no pending skill-development coaching requests awaiting PMS Admin review.'
              : `No requests with status "${statusTab}".`
          }
          icon={statusTab === 'PENDING' ? <CheckCircle2 size={32} /> : <AlertCircle size={32} />}
        />
      ) : (
        <div className="apid-table-wrap">
          <table className="apid-table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Requesting Manager</th>
                <th>Target Coachees</th>
                <th>Skill Focus &amp; Justification</th>
                <th>Assigned Coach</th>
                <th>Quarter</th>
                <th>Status &amp; Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedRequests.map((r) => {
                const isPending =
                  r.status === 'PENDING_PMS_APPROVAL' || (r.status as string) === 'PENDING_APPROVAL';
                return (
                  <tr key={r.id}>
                    <td className="tabular-nums">
                      <strong>REQ-{r.id}</strong>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.requesterFullName}</div>
                      <div className="boa-muted" style={{ fontSize: '0.78rem' }}>
                        {r.requesterEmployeeNumber}
                      </div>
                      {r.requesterDepartment && (
                        <div className="boa-muted" style={{ fontSize: '0.74rem' }}>
                          <Building2 size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                          {r.requesterDepartment}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <span className="tabular-nums" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                          <Users size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                          {r.targets.length} Employee{r.targets.length > 1 ? 's' : ''}:
                        </span>
                        {r.targets.map((t) => (
                          <div
                            key={t.id}
                            style={{
                              padding: '0.2rem 0.4rem',
                              backgroundColor: 'rgba(0, 0, 0, 0.03)',
                              borderRadius: 4,
                              fontSize: '0.78rem',
                            }}
                          >
                            <strong>{t.employeeFullName}</strong>{' '}
                            <span className="boa-muted">({t.employeeNumber})</span>
                            {t.position && (
                              <div className="boa-muted" style={{ fontSize: '0.72rem' }}>
                                {t.position}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td style={{ maxWidth: 300 }}>
                      <div style={{ fontWeight: 600, color: 'var(--brand-navy, #0f172a)' }}>
                        {r.skillTitle}
                      </div>
                      <div
                        className="boa-muted"
                        style={{
                          fontSize: '0.78rem',
                          marginTop: '0.25rem',
                          lineHeight: 1.35,
                        }}
                      >
                        {r.businessJustification}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{r.proposedCoachFullName}</div>
                      <div className="boa-muted" style={{ fontSize: '0.74rem' }}>
                        {r.proposedCoachEmployeeNumber}
                      </div>
                    </td>
                    <td>
                      <StatusPill label={r.coachingQuarterLabel} tone="info" />
                    </td>
                    <td className="apid-actions-cell">
                      {isPending ? (
                        <PermissionGate permission="COACHING_REQUEST_APPROVE">
                          <button
                            type="button"
                            className="apid-btn apid-btn-primary apid-btn-sm"
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            onClick={() => openApproveModal(r)}
                          >
                            <Check size={13} /> Approve
                          </button>
                          <button
                            type="button"
                            className="apid-btn apid-btn-danger apid-btn-sm"
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            onClick={() => {
                              setRejectTarget(r);
                              setRejectionNotes('');
                              setRejectionError('');
                            }}
                          >
                            <XCircle size={13} /> Reject
                          </button>
                        </PermissionGate>
                      ) : (
                        <div>
                          <div>{renderStatus(r.status)}</div>
                          {r.reviewNotes && (
                            <div
                              style={{
                                fontSize: '0.75rem',
                                marginTop: '0.35rem',
                                padding: '0.25rem 0.45rem',
                                borderRadius: 4,
                                backgroundColor: r.status === 'APPROVED' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                                borderLeft: r.status === 'APPROVED' ? '2px solid #22c55e' : '2px solid #ef4444',
                              }}
                            >
                              <strong>{r.reviewedByUsername ?? 'Admin'}:</strong> {r.reviewNotes}
                            </div>
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

      {/* APPROVE MODAL (With Coach Override Option) */}
      {approveTarget && (
        <div
          className="apid-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Approve Skill Coaching Request"
        >
          <div className="apid-card apid-modal" style={{ maxWidth: 540 }}>
            <h3 style={{ marginTop: 0 }}>
              Approve Skill Coaching Request · REQ-{approveTarget.id}
            </h3>
            <p className="boa-muted" style={{ fontSize: '0.84rem' }}>
              Skill: <strong>{approveTarget.skillTitle}</strong> · Proposed by{' '}
              <strong>{approveTarget.requesterFullName}</strong>
            </p>

            <form onSubmit={handleConfirmApprove} className="apid-form">
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.05)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: 6,
                  fontSize: '0.84rem',
                  marginBottom: '1rem',
                }}
              >
                Approving this request will automatically generate{' '}
                <strong>{approveTarget.targets.length} active coaching assignments</strong> under cycle{' '}
                <strong>{approveTarget.coachingQuarterLabel}</strong>.
              </div>

              {/* Coach Selection (Option to Override Proposed Coach) */}
              <div className="apid-field">
                <label htmlFor="pms-approve-coach-select">
                  Assigned Coach (Proposed: {approveTarget.proposedCoachFullName})
                </label>
                <select
                  id="pms-approve-coach-select"
                  className="apid-input"
                  value={selectedCoachId}
                  onChange={(e) =>
                    setSelectedCoachId(e.target.value ? Number(e.target.value) : '')
                  }
                >
                  <option value={approveTarget.proposedCoachEmployeeId}>
                    {approveTarget.proposedCoachFullName} ({approveTarget.proposedCoachEmployeeNumber}) — Proposed Coach
                  </option>
                  {employeeOptions
                    .filter((emp) => emp.id !== approveTarget.proposedCoachEmployeeId)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.employeeNumber}) — {emp.jobTitle ?? emp.departmentName}
                      </option>
                    ))}
                </select>
                <div className="boa-muted" style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
                  You can keep the proposed coach (line manager or higher manager) or assign a specialized Bank Coach.
                </div>
              </div>

              {/* Optional Approval Review Notes */}
              <div className="apid-field">
                <label htmlFor="pms-approval-notes">Approval Notes / Recommendations (Optional)</label>
                <textarea
                  id="pms-approval-notes"
                  className="apid-input"
                  rows={2}
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="e.g. Approved. Focus sessions on Letter of Credit compliance and risk controls."
                />
              </div>

              <div className="apid-modal-actions">
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  disabled={approveMutation.isPending}
                  onClick={() => setApproveTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="apid-btn apid-btn-primary"
                  disabled={approveMutation.isPending}
                >
                  {approveMutation.isPending ? 'Approving...' : 'Confirm & Auto-Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT MODAL (Mandatory Justification Reason) */}
      {rejectTarget && (
        <div
          className="apid-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Reject Skill Coaching Request"
        >
          <div className="apid-card apid-modal" style={{ maxWidth: 520 }}>
            <h3 style={{ marginTop: 0, color: 'var(--err, #ef4444)' }}>
              Reject Skill Coaching Request · REQ-{rejectTarget.id}
            </h3>
            <p className="boa-muted" style={{ fontSize: '0.84rem' }}>
              Requester: <strong>{rejectTarget.requesterFullName}</strong> ({rejectTarget.skillTitle})
            </p>

            <form onSubmit={handleConfirmReject} className="apid-form">
              <div className="apid-field">
                <label htmlFor="pms-reject-reason">
                  Rejection Justification <span style={{ color: 'var(--err)' }}>*</span>
                </label>
                <textarea
                  id="pms-reject-reason"
                  className="apid-input"
                  rows={3}
                  value={rejectionNotes}
                  onChange={(e) => {
                    setRejectionNotes(e.target.value);
                    setRejectionError('');
                  }}
                  placeholder="Provide mandatory feedback explaining why this request cannot be approved at this time..."
                  required
                />
                {rejectionError && (
                  <div style={{ color: 'var(--err)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    {rejectionError}
                  </div>
                )}
              </div>

              <div className="apid-modal-actions">
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  disabled={rejectMutation.isPending}
                  onClick={() => {
                    setRejectTarget(null);
                    setRejectionNotes('');
                    setRejectionError('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="apid-btn apid-btn-danger"
                  disabled={rejectMutation.isPending}
                >
                  {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
