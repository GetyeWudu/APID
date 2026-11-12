import { useState, type FormEvent } from 'react';
import { Check, RotateCcw, XCircle } from 'lucide-react';
import {
  DataSourceBadge,
  EmptyState,
  PermissionGate,
  StatusPill,
  useToast,
} from '../../../shared/components/ui';
import type { PreviewSkillDevRequest } from '../../../shared/mocks/boaPreviewFixtures';
import { coachingPreviewAdapter } from '../api/coachingDashboardApi';

export function SkillDevApprovalTab({
  requests,
  onRequestUpdated,
}: {
  requests: PreviewSkillDevRequest[];
  onRequestUpdated: (
    id: string,
    status: PreviewSkillDevRequest['status'],
    reason?: string
  ) => void;
}) {
  const { pushToast } = useToast();
  const [decisionTarget, setDecisionTarget] = useState<{
    req: PreviewSkillDevRequest;
    action: 'RETURNED' | 'REJECTED';
  } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleApprove = async (req: PreviewSkillDevRequest) => {
    setBusyId(req.id);
    try {
      const res = await coachingPreviewAdapter.simulateDecisionRequest(
        req.id,
        'APPROVED',
        'Approved by PMS Admin'
      );
      onRequestUpdated(req.id, 'APPROVED', 'Approved by PMS Admin');
      pushToast({ title: 'Request Approved (Preview)', message: res.message, tone: 'ok' });
    } finally {
      setBusyId(null);
    }
  };

  const handleSubmitDecisionReason = async (e: FormEvent) => {
    e.preventDefault();
    if (!decisionTarget) return;
    if (!reasonText.trim()) {
      setReasonError('A clear reason is mandatory before returning or rejecting a request.');
      return;
    }
    setBusyId(decisionTarget.req.id);
    try {
      const res = await coachingPreviewAdapter.simulateDecisionRequest(
        decisionTarget.req.id,
        decisionTarget.action,
        reasonText.trim()
      );
      onRequestUpdated(decisionTarget.req.id, decisionTarget.action, reasonText.trim());
      pushToast({
        title: `Request ${decisionTarget.action} (Preview)`,
        message: res.message,
        tone: 'info',
      });
      setDecisionTarget(null);
      setReasonText('');
      setReasonError('');
    } finally {
      setBusyId(null);
    }
  };

  const renderStatus = (status: PreviewSkillDevRequest['status']) => {
    if (status === 'APPROVED') return <StatusPill label="APPROVED" tone="ok" />;
    if (status === 'RETURNED') return <StatusPill label="RETURNED" tone="warn" />;
    if (status === 'REJECTED') return <StatusPill label="REJECTED" tone="err" />;
    return <StatusPill label="PENDING APPROVAL" tone="info" />;
  };

  return (
    <div className="apid-card">
      <div className="boa-card-header">
        <div>
          <h3 className="boa-card-title">Skill-Development Requests</h3>
          <p className="boa-card-subtitle">
            Review manager requests for employees rated 3 or above. Returning or rejecting
            requires a reason visible to the manager.
          </p>
        </div>
        <DataSourceBadge source="preview" />
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="No Skill-Development Requests"
          description="No requests match the selected Directorate filter."
        />
      ) : (
        <div className="apid-table-wrap">
          <table className="apid-table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Requesting Manager</th>
                <th>Scope &amp; Count</th>
                <th>Skill Focus</th>
                <th>Target Quarter</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="tabular-nums"><strong>{r.id}</strong></td>
                  <td>
                    <div>{r.requesterManager}</div>
                    <div className="boa-muted" style={{ fontSize: '0.76rem' }}>
                      {r.directorate}
                    </div>
                  </td>
                  <td>
                    <StatusPill label={r.scope} tone="neutral" />{' '}
                    <span className="tabular-nums" style={{ fontSize: '0.8rem', marginLeft: '0.3rem' }}>
                      ({r.participantCount} staff)
                    </span>
                  </td>
                  <td>{r.skillFocus}</td>
                  <td>{r.targetQuarter}</td>
                  <td>
                    <div>{renderStatus(r.status)}</div>
                    {r.reviewReason && (
                      <div className="boa-muted" style={{ fontSize: '0.74rem', marginTop: '0.2rem' }}>
                        {r.reviewReason}
                      </div>
                    )}
                  </td>
                  <td className="apid-actions-cell">
                    <PermissionGate permission="COACHING_REQUEST_APPROVE">
                      {r.status === 'PENDING_APPROVAL' ? (
                        <>
                          <button
                            type="button"
                            className="apid-btn apid-btn-primary apid-btn-sm"
                            disabled={busyId === r.id}
                            onClick={() => void handleApprove(r)}
                          >
                            <Check size={13} /> Approve
                          </button>
                          <button
                            type="button"
                            className="apid-btn apid-btn-outline apid-btn-sm"
                            disabled={busyId === r.id}
                            onClick={() => {
                              setDecisionTarget({ req: r, action: 'RETURNED' });
                              setReasonText('');
                              setReasonError('');
                            }}
                          >
                            <RotateCcw size={13} /> Return
                          </button>
                          <button
                            type="button"
                            className="apid-btn apid-btn-danger apid-btn-sm"
                            disabled={busyId === r.id}
                            onClick={() => {
                              setDecisionTarget({ req: r, action: 'REJECTED' });
                              setReasonText('');
                              setReasonError('');
                            }}
                          >
                            <XCircle size={13} /> Reject
                          </button>
                        </>
                      ) : (
                        <span className="boa-muted" style={{ fontSize: '0.78rem' }}>
                          Reviewed
                        </span>
                      )}
                    </PermissionGate>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {decisionTarget && (
        <div
          className="apid-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Decision Reason Required"
        >
          <div className="apid-card apid-modal">
            <h3 style={{ marginTop: 0 }}>
              {decisionTarget.action === 'RETURNED' ? 'Return Request for Clarification' : 'Reject Request'} ·{' '}
              {decisionTarget.req.id}
            </h3>
            <p className="boa-muted" style={{ fontSize: '0.84rem' }}>
              Requester: <strong>{decisionTarget.req.requesterManager}</strong> ({decisionTarget.req.skillFocus})
            </p>
            <form onSubmit={handleSubmitDecisionReason} className="apid-form">
              <div className="apid-field">
                <label htmlFor="pms-decision-reason">Reason (Mandatory)</label>
                <textarea
                  id="pms-decision-reason"
                  className="apid-input"
                  rows={3}
                  value={reasonText}
                  onChange={(e) => {
                    setReasonText(e.target.value);
                    setReasonError('');
                  }}
                  placeholder="Provide feedback or policy rationale..."
                />
                {reasonError && (
                  <div style={{ color: 'var(--err)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    {reasonError}
                  </div>
                )}
              </div>
              <div className="apid-modal-actions">
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  onClick={() => setDecisionTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`apid-btn ${
                    decisionTarget.action === 'REJECTED' ? 'apid-btn-danger' : 'apid-btn-primary'
                  }`}
                >
                  Confirm {decisionTarget.action}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

