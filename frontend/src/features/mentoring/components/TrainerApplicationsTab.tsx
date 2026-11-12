import { useState, type FormEvent } from 'react';
import { Check, Eye, FileText, XCircle } from 'lucide-react';
import {
  DataSourceBadge,
  EmptyState,
  PermissionGate,
  SlideOverDrawer,
  StatusPill,
  useToast,
} from '../../../shared/components/ui';
import type { PreviewTrainerApplication } from '../../../shared/mocks/boaPreviewFixtures';
import { mentoringPreviewAdapter } from '../api/mentoringDashboardApi';

export function TrainerApplicationsTab({
  applications,
  onApplicationDecided,
}: {
  applications: PreviewTrainerApplication[];
  onApplicationDecided: (
    appId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason?: string
  ) => void;
}) {
  const { pushToast } = useToast();
  const [inspectApp, setInspectApp] = useState<PreviewTrainerApplication | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PreviewTrainerApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleApprove = async (app: PreviewTrainerApplication) => {
    setBusyId(app.id);
    try {
      const res = await mentoringPreviewAdapter.simulateApplicationDecision(
        app.id,
        'APPROVED',
        'Verified credentials'
      );
      onApplicationDecided(app.id, 'APPROVED', 'Verified credentials');
      pushToast({ title: 'Trainer Approved (Preview)', message: res.message, tone: 'ok' });
      if (inspectApp?.id === app.id) {
        setInspectApp({ ...app, status: 'APPROVED', reviewReason: 'Verified credentials' });
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      setRejectError('A clear rejection reason is required for applicant transparency.');
      return;
    }
    setBusyId(rejectTarget.id);
    try {
      const res = await mentoringPreviewAdapter.simulateApplicationDecision(
        rejectTarget.id,
        'REJECTED',
        rejectReason.trim()
      );
      onApplicationDecided(rejectTarget.id, 'REJECTED', rejectReason.trim());
      pushToast({ title: 'Application Rejected (Preview)', message: res.message, tone: 'info' });
      if (inspectApp?.id === rejectTarget.id) {
        setInspectApp({
          ...rejectTarget,
          status: 'REJECTED',
          reviewReason: rejectReason.trim(),
        });
      }
      setRejectTarget(null);
      setRejectReason('');
      setRejectError('');
    } finally {
      setBusyId(null);
    }
  };

  const renderStatus = (status: PreviewTrainerApplication['status']) => {
    if (status === 'APPROVED') return <StatusPill label="APPROVED" tone="ok" />;
    if (status === 'REJECTED') return <StatusPill label="REJECTED" tone="err" />;
    return <StatusPill label="PENDING REVIEW" tone="warn" />;
  };

  return (
    <div className="apid-card">
      <div className="boa-card-header">
        <div>
          <h3 className="boa-card-title">Trainer Certification Applications</h3>
          <p className="boa-card-subtitle">
            Inspect submitted skill evidence and certificates before certifying internal Trainers.
          </p>
        </div>
        <DataSourceBadge source="preview" />
      </div>

      {applications.length === 0 ? (
        <EmptyState
          title="No Trainer Applications"
          description="There are no Trainer applications awaiting HR review."
        />
      ) : (
        <div className="apid-table-wrap">
          <table className="apid-table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Employment</th>
                <th>Claimed Skills</th>
                <th>Certificate Evidence</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{app.applicantName}</div>
                    <div className="boa-muted" style={{ fontSize: '0.77rem' }}>
                      {app.applicantCode} · {app.department} · {app.yearsExperience}y exp
                    </div>
                  </td>
                  <td>
                    <StatusPill
                      label={app.employmentStatus}
                      tone={app.employmentStatus === 'ACTIVE' ? 'ok' : 'warn'}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {app.claimedSkills.map((s) => (
                        <StatusPill key={s} label={s} tone="neutral" />
                      ))}
                    </div>
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}>
                      <FileText size={14} /> {app.certificateFileName}
                    </span>
                  </td>
                  <td>
                    {renderStatus(app.status)}
                    {app.reviewReason && (
                      <div className="boa-muted" style={{ fontSize: '0.74rem', marginTop: '0.2rem' }}>
                        {app.reviewReason}
                      </div>
                    )}
                  </td>
                  <td className="apid-actions-cell">
                    <button
                      type="button"
                      className="apid-btn apid-btn-outline apid-btn-sm"
                      onClick={() => setInspectApp(app)}
                    >
                      <Eye size={13} /> Review File
                    </button>
                    <PermissionGate permission="TRAINER_APPLICATION_REVIEW">
                      {app.status === 'PENDING_REVIEW' && (
                        <>
                          <button
                            type="button"
                            className="apid-btn apid-btn-primary apid-btn-sm"
                            disabled={busyId === app.id}
                            onClick={() => void handleApprove(app)}
                          >
                            <Check size={13} /> Approve
                          </button>
                          <button
                            type="button"
                            className="apid-btn apid-btn-danger apid-btn-sm"
                            disabled={busyId === app.id}
                            onClick={() => {
                              setRejectTarget(app);
                              setRejectReason('');
                              setRejectError('');
                            }}
                          >
                            <XCircle size={13} /> Reject
                          </button>
                        </>
                      )}
                    </PermissionGate>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SlideOverDrawer
        open={Boolean(inspectApp)}
        title={inspectApp ? `Application Dossier · ${inspectApp.applicantName}` : ''}
        subtitle={
          inspectApp
            ? `${inspectApp.applicantCode} · Submitted ${inspectApp.submittedAt}`
            : undefined
        }
        onClose={() => setInspectApp(null)}
      >
        {inspectApp && (
          <div className="boa-stack">
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '0.9rem',
                background: 'var(--surface-subtle)',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>
                Certificate Preview (Metadata Sandbox)
              </div>
              <div style={{ fontSize: '0.84rem' }}>
                <strong>File:</strong> <code>{inspectApp.certificateFileName}</code>
              </div>
              <div className="boa-muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                Department: {inspectApp.department} · Experience: {inspectApp.yearsExperience} years
              </div>
              <div className="apid-alert apid-alert-info" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                Uploaded PDF and image certificates will open directly once document storage is connected.
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                Claimed Master Skills
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {inspectApp.claimedSkills.map((sk) => (
                  <StatusPill key={sk} label={sk} tone="info" />
                ))}
              </div>
            </div>
          </div>
        )}
      </SlideOverDrawer>

      {rejectTarget && (
        <div
          className="apid-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Reject Trainer Application"
        >
          <div className="apid-card apid-modal">
            <h3 style={{ marginTop: 0 }}>Reject Application · {rejectTarget.applicantName}</h3>
            <form onSubmit={handleRejectSubmit} className="apid-form">
              <div className="apid-field">
                <label htmlFor="hr-reject-reason">Rejection Reason (Mandatory)</label>
                <textarea
                  id="hr-reject-reason"
                  className="apid-input"
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => {
                    setRejectReason(e.target.value);
                    setRejectError('');
                  }}
                  placeholder="Explain missing certificate verification or skill prerequisite..."
                />
                {rejectError && (
                  <div style={{ color: 'var(--err)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    {rejectError}
                  </div>
                )}
              </div>
              <div className="apid-modal-actions">
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  onClick={() => setRejectTarget(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="apid-btn apid-btn-danger">
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

