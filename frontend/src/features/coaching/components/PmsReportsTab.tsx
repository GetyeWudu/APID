import { Download } from 'lucide-react';
import { DataSourceBadge, SvgHorizontalBarChart, useToast } from '../../../shared/components/ui';
import type { PreviewPmsAssignment } from '../../../shared/mocks/boaPreviewFixtures';

export function PmsReportsTab({
  directorateCounts,
  assignments,
}: {
  directorateCounts: Array<{ directorate: string; mandatory: number; skillDev: number; overdue: number }>;
  assignments: PreviewPmsAssignment[];
}) {
  const { pushToast } = useToast();

  const handlePreviewExport = () => {
    pushToast({
      title: 'Export Preview',
      message: 'CSV report downloads will be enabled when backend reporting connects.',
      tone: 'info',
    });
  };

  const totalSessionsCompleted = assignments.reduce((acc, a) => acc + a.sessionsCompleted, 0);
  const totalSessionsPlanned = assignments.reduce((acc, a) => acc + a.sessionsTotal, 0);
  const totalOverdue = assignments.reduce((acc, a) => acc + a.overdueReports, 0);

  return (
    <div className="boa-stack">
      <div className="apid-card">
        <div className="boa-card-header">
          <div>
            <h3 className="boa-card-title">Directorate Coaching Compliance &amp; Escalations</h3>
            <p className="boa-card-subtitle">
              Completed sessions: <strong>{totalSessionsCompleted}</strong> / {totalSessionsPlanned}{' '}
              planned · Overdue reports flagged: <strong>{totalOverdue}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <DataSourceBadge source="preview" />
            <button
              type="button"
              className="apid-btn apid-btn-outline apid-btn-sm"
              onClick={handlePreviewExport}
            >
              <Download size={14} /> Export Summary
            </button>
          </div>
        </div>

        <SvgHorizontalBarChart
          title="Coaching Load by Directorate"
          description="Mandatory plus skill-development assignments and overdue reports per directorate"
          items={directorateCounts.map((d) => ({
            id: d.directorate,
            label: d.directorate,
            value: d.mandatory + d.skillDev,
            secondaryLabel: `${d.mandatory} mandatory · ${d.skillDev} skill-dev · ${d.overdue} overdue`,
            color: d.overdue > 1 ? '#b91c1c' : '#0f172a',
          }))}
        />
      </div>
    </div>
  );
}

