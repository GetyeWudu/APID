import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { Check, FileText, XCircle } from 'lucide-react';
import { DataSourceBadge, EmptyState, StatusPill, useToast } from '../../../shared/components/ui';
import type { MentorApplication } from '../api/mentorApplicationApi';
import { mentorApplicationApi } from '../api/mentorApplicationApi';

export function TrainerApplicationsTab({
  applications,
}: {
  applications: MentorApplication[];
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [decisionTarget, setDecisionTarget] = useState<MentorApplication | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const handleApprove = async (application: MentorApplication) => {
    setBusyId(application.id);
    try {
      await mentorApplicationApi.review(application.id, { decision: 'APPROVED' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'applications'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'active-mentor-count'] }),
      ]);
      pushToast({
        title: 'Application approved',
        message: `${application.applicantUsername} is now an approved mentor.`,
        tone: 'ok',
      });
    } catch (error) {
      pushToast({
        title: 'Unable to approve application',
        message: axios.isAxiosError(error)
          ? error.response?.data?.message || 'Please try again.'
          : 'Please try again.',
        tone: 'err',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (event: FormEvent) => {
    event.preventDefault();
    if (!decisionTarget) return;
    if (!reason.trim()) {
      setReasonError('A reason is required when declining an application.');
      return;
    }

    setBusyId(decisionTarget.id);
    try {
      await mentorApplicationApi.review(decisionTarget.id, {
        decision: 'DECLINED',
        reason: reason.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ['mentoring', 'applications'] });
      pushToast({
        title: 'Application declined',
        message: 'The applicant has been notified of the decision.',
        tone: 'info',
      });
      setDecisionTarget(null);
      setReason('');
      setReasonError('');
    } catch (error) {
      pushToast({
        title: 'Unable to decline application',
        message: axios.isAxiosError(error)
          ? error.response?.data?.message || 'Please try again.'
          : 'Please try again.',
        tone: 'err',
      });
    } finally {
      setBusyId(null);
    }
  };

  const renderStatus = (status: MentorApplication['status']) => {
    if (status === 'APPROVED') return <StatusPill label="APPROVED" tone="ok" />;
    if (status === 'DECLINED') return <StatusPill label="DECLINED" tone="err" />;
    return <StatusPill label="PENDING REVIEW" tone="warn" />;
  };

  return (
    <div className="apid-card">
      <div className="boa-card-header">
        <div>
          <h3 className="boa-card-title">Mentor Applications</h3>
          <p className="boa-card-subtitle">
            Review submitted applications and supporting certificate evidence.
          </p>
        </div>
        <DataSourceBadge source="live" />
      </div>

      {applications.length === 0 ? (
        <EmptyState
          title="No Trainer Applications"
          description="No mentor applications have been submitted."
        />
      ) : (
        <div className="apid-table-wrap">
          <table className="apid-table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Skill</th>
                <th>Certificate Evidence</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Applicant Note</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{app.applicantUsername}</div>
                    <div className="boa-muted" style={{ fontSize: '0.77rem' }}>
                      Application #{app.id}
                    </div>
                  </td>
                  <td>
                    <StatusPill label={app.skillName} tone="neutral" />
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}>
                      <FileText size={14} /> {app.proofFileName}
                    </span>
                  </td>
                  <td>
                    {renderStatus(app.status)}
                    {app.reviewReason && (
                      <div className="boa-muted" style={{ fontSize: '0.74rem', marginTop: '0.2rem' }}>
                        Reason: {app.reviewReason}
                      </div>
                    )}
                  </td>
                  <td>{new Date(app.submittedAt).toLocaleString()}</td>
                  <td>{app.note || '—'}</td>
                  <td className="apid-actions-cell">
                    {app.status === 'PENDING' ? (
                      <>
                        <button
                          type="button"
                          className="apid-btn apid-btn-primary apid-btn-sm"
                          disabled={busyId !== null}
                          onClick={() => void handleApprove(app)}
                        >
                          <Check size={13} /> Approve
                        </button>
                        <button
                          type="button"
                          className="apid-btn apid-btn-danger apid-btn-sm"
                          disabled={busyId !== null}
                          onClick={() => {
                            setDecisionTarget(app);
                            setReason('');
                            setReasonError('');
                          }}
                        >
                          <XCircle size={13} /> Reject
                        </button>
                      </>
                    ) : (
                      <span className="boa-muted" style={{ fontSize: '0.78rem' }}>
                        Reviewed{app.reviewedByUsername ? ` by ${app.reviewedByUsername}` : ''}
                      </span>
                    )}
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
          aria-label="Decline mentor application"
        >
          <div className="apid-card apid-modal">
            <h3 style={{ marginTop: 0 }}>Decline Application #{decisionTarget.id}</h3>
            <p className="boa-muted" style={{ fontSize: '0.84rem' }}>
              Applicant: <strong>{decisionTarget.applicantUsername}</strong>
            </p>
            <form onSubmit={handleDecline} className="apid-form">
              <div className="apid-field">
                <label htmlFor="mentor-application-decline-reason">Reason (required)</label>
                <textarea
                  id="mentor-application-decline-reason"
                  className="apid-input"
                  rows={4}
                  maxLength={750}
                  required
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setReasonError('');
                  }}
                  placeholder="Explain why this application is being declined."
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
                  disabled={busyId !== null}
                  onClick={() => setDecisionTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="apid-btn apid-btn-danger"
                  disabled={busyId === decisionTarget.id}
                >
                  {busyId === decisionTarget.id ? 'Declining…' : 'Confirm Decline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

