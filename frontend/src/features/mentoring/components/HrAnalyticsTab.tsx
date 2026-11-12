import { Download } from 'lucide-react';
import { DataSourceBadge, SvgHorizontalBarChart, useToast } from '../../../shared/components/ui';
import type { PreviewCertifiedTrainer } from '../../../shared/mocks/boaPreviewFixtures';

export function HrAnalyticsTab({
  trainers,
  completionRatePct,
  avgCompletionRating,
}: {
  trainers: PreviewCertifiedTrainer[];
  completionRatePct: number;
  avgCompletionRating: number;
}) {
  const { pushToast } = useToast();

  return (
    <div className="apid-card">
      <div className="boa-card-header">
        <div>
          <h3 className="boa-card-title">Mentoring Program Outcomes &amp; Trainer Utilization</h3>
          <p className="boa-card-subtitle">
            Cohort completion rate: <strong>{completionRatePct}%</strong> · Avg feedback:{' '}
            <strong>{avgCompletionRating.toFixed(1)} / 5.0</strong>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <DataSourceBadge source="preview" />
          <button
            type="button"
            className="apid-btn apid-btn-outline apid-btn-sm"
            onClick={() =>
              pushToast({
                title: 'Export Preview',
                message: 'HR mentoring CSV exports will be enabled when backend reporting connects.',
                tone: 'info',
              })
            }
          >
            <Download size={14} /> Export Report
          </button>
        </div>
      </div>

      <SvgHorizontalBarChart
        title="Trainer Utilization"
        description="Current trainee count compared against capacity limit per Trainer"
        items={trainers.map((t) => ({
          id: t.id,
          label: t.fullName,
          value: t.activeTrainees,
          secondaryLabel: `${t.activeTrainees} / ${t.maxTrainees} trainees · ${t.trainerAuthStatus}`,
          color: t.trainerAuthStatus === 'ACTIVE' ? '#0f172a' : '#94a3b8',
        }))}
        maxOverride={5}
      />
    </div>
  );
}

