import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Download, Eye, FileText, X, XCircle } from 'lucide-react';
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
  const [previewTarget, setPreviewTarget] = useState<{
    fileName: string;
    objectUrl: string;
    contentType: string;
  } | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<MentorApplication | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);

  useEffect(() => () => {
    if (previewTarget) URL.revokeObjectURL(previewTarget.objectUrl);
  }, [previewTarget]);

  const handleDownloadEvidence = async (fileId: number, fileName: string) => {
    setDownloadingId(fileId);
    try {
      const blob = await mentorApplicationApi.downloadProofDocument(fileId);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      pushToast({
        title: 'Unable to download certificate',
        message: axios.isAxiosError(error)
          ? error.response?.data?.message || 'Please try again.'
          : error instanceof Error ? error.message : 'Please try again.',
        tone: 'err',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleViewEvidence = async (fileId: number, fileName: string) => {
    setViewingId(fileId);
    try {
      const blob = await mentorApplicationApi.downloadProofDocument(fileId);
      setPreviewTarget({
        fileName,
        objectUrl: URL.createObjectURL(blob),
        contentType: blob.type,
      });
    } catch (error) {
      pushToast({
        title: 'Unable to view certificate',
        message: axios.isAxiosError(error)
          ? error.response?.data?.message || 'Please try again.'
          : error instanceof Error ? error.message : 'Please try again.',
        tone: 'err',
      });
    } finally {
      setViewingId(null);
    }
  };

  const handleApprove = async (application: MentorApplication) => {
    setBusyId(application.id);
    try {
      await mentorApplicationApi.review(application.id, { decision: 'APPROVED' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'applications'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'trainers'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'hr-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'directory'] }),
      ]);
      pushToast(application.applicationType === 'SKILL_ADDITION'
        ? {
            title: 'Skill request approved',
            message: `The approved skills were added to ${application.applicantUsername}'s mentor profile.`,
            tone: 'ok',
          }
        : {
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'applications'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'hr-overview'] }),
      ]);
      pushToast({
        title: decisionTarget.applicationType === 'SKILL_ADDITION'
          ? 'Skill request declined'
          : 'Application declined',
        message: `${decisionTarget.applicantUsername} has been notified of the decision.`,
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
                <th>Request type</th>
                <th>Skill</th>
                <th>Certificate Evidence</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Mentor details</th>
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
                  <td>{app.applicationType === 'SKILL_ADDITION' ? 'Additional skills' : 'Initial mentor application'}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {(app.skillNames?.length ? app.skillNames : [app.skillName]).map((skillName) => (
                        <StatusPill key={skillName} label={skillName} tone="neutral" />
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="boa-stack" style={{ gap: '0.35rem' }}>
                      {(app.evidenceFiles?.length
                        ? app.evidenceFiles
                        : [{ fileId: app.proofFileId, fileName: app.proofFileName }]
                      ).map((evidence) => (
                        <div key={evidence.fileId}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}>
                            <FileText size={14} /> {evidence.fileName}
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
                            <button
                              type="button"
                              className="apid-btn apid-btn-outline apid-btn-sm"
                              disabled={viewingId !== null}
                              onClick={() => void handleViewEvidence(evidence.fileId, evidence.fileName)}
                            >
                              <Eye size={13} />
                              {viewingId === evidence.fileId ? 'Opening…' : 'View'}
                            </button>
                            <button
                              type="button"
                              className="apid-btn apid-btn-outline apid-btn-sm"
                              disabled={downloadingId !== null}
                              onClick={() => void handleDownloadEvidence(evidence.fileId, evidence.fileName)}
                            >
                              <Download size={13} />
                              {downloadingId === evidence.fileId ? 'Downloading…' : 'Download evidence'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
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
                  <td>
                    <div>
                      Experience: {app.experienceYears == null
                        ? 'Not provided'
                        : `${app.experienceYears} year${app.experienceYears === 1 ? '' : 's'}`}
                    </div>
                    <div className="boa-muted" style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>
                      Mentoring approach: {app.mentoringApproach || app.expertiseSummary || 'Not provided'}
                    </div>
                    {app.sessionsPerWeek != null ? (
                      <div className="boa-muted" style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>
                        Sessions per week: {app.sessionsPerWeek}
                      </div>
                    ) : app.availabilityNotes ? (
                      <div className="boa-muted" style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>
                        Previous availability note: {app.availabilityNotes}
                      </div>
                    ) : null}
                    {app.maxConcurrentTrainees !== null && (
                      <div className="boa-muted" style={{ fontSize: '0.78rem' }}>
                        Requested capacity: {app.maxConcurrentTrainees}
                      </div>
                    )}
                  </td>
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

      {previewTarget && (
        <div className="apid-modal-backdrop">
          <div
            className="apid-card apid-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mentor-evidence-preview-title"
            style={{ maxWidth: 900 }}
          >
            <div className="boa-card-header">
              <div>
                <h3 id="mentor-evidence-preview-title" className="boa-card-title">
                  Certificate evidence
                </h3>
                <p className="boa-card-subtitle">{previewTarget.fileName}</p>
              </div>
              <button
                type="button"
                className="apid-btn apid-btn-outline apid-btn-sm"
                aria-label="Close certificate preview"
                onClick={() => setPreviewTarget(null)}
              >
                <X size={15} />
              </button>
            </div>
            {previewTarget.contentType === 'application/pdf' ? (
              <iframe
                title={previewTarget.fileName}
                src={previewTarget.objectUrl}
                style={{ width: '100%', height: '70vh', border: 0 }}
              />
            ) : previewTarget.contentType.startsWith('image/') ? (
              <img
                src={previewTarget.objectUrl}
                alt={previewTarget.fileName}
                style={{ display: 'block', maxWidth: '100%', maxHeight: '70vh', margin: '0 auto' }}
              />
            ) : (
              <p className="boa-muted">
                This file type cannot be previewed in the browser. Download the evidence to view it.
              </p>
            )}
            <div className="apid-modal-actions">
              <button
                type="button"
                className="apid-btn apid-btn-outline"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = previewTarget.objectUrl;
                  link.download = previewTarget.fileName;
                  link.click();
                }}
              >
                <Download size={14} /> Download
              </button>
              <button
                type="button"
                className="apid-btn apid-btn-outline"
                onClick={() => setPreviewTarget(null)}
              >
                Close
              </button>
            </div>
          </div>
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
            <h3 style={{ marginTop: 0 }}>
              Decline {decisionTarget.applicationType === 'SKILL_ADDITION' ? 'Skill Request' : 'Application'} #{decisionTarget.id}
            </h3>
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

