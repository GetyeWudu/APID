import { FileText } from 'lucide-react';
import { DataSourceBadge, EmptyState, StatusPill } from '../../../shared/components/ui';
import type { MentorApplication } from '../api/mentorApplicationApi';

export function TrainerApplicationsTab({
  applications,
}: {
  applications: MentorApplication[];
}) {
  const renderStatus = (status: MentorApplication['status']) => {
    if (status === 'APPROVED') return <StatusPill label="APPROVED" tone="ok" />;
    if (status === 'DECLINED') return <StatusPill label="DECLINED" tone="err" />;
    return <StatusPill label="PENDING REVIEW" tone="warn" />;
  };

  return (
    <div className="apid-card">
      <div className="boa-card-header">
        <div>
          <h3 className="boa-card-title">Trainer Certification Applications</h3>
          <p className="boa-card-subtitle">
            Mentor applications submitted through the application form.
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
                  </td>
                  <td>{new Date(app.submittedAt).toLocaleString()}</td>
                  <td>{app.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

