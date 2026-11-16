import { useState } from 'react';
import axios from 'axios';
import { Award, CheckCircle2, Download, Users } from 'lucide-react';
import {
  StatCard,
  SvgHorizontalBarChart,
  useToast,
} from '../../../shared/components/ui';
import { mentoringTrainerApi } from '../api/mentoringTrainerApi';
import type { MentoringHrOverview, TrainerRosterItem } from '../api/mentoringTrainerApi';

export function HrAnalyticsTab({
  overview,
  trainers,
}: {
  overview: MentoringHrOverview;
  trainers: TrainerRosterItem[];
}) {
  const [exportingFormat, setExportingFormat] = useState<'xlsx' | 'pdf' | null>(null);
  const { pushToast } = useToast();
  const totalApplications =
    overview.pendingApplications + overview.approvedApplications + overview.declinedApplications;

  const downloadReport = async (format: 'xlsx' | 'pdf') => {
    setExportingFormat(format);
    try {
      const blob = await mentoringTrainerApi.downloadReport(format);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `mentoring-report.${format}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (error: unknown) {
      pushToast({
        title: 'Report export failed',
        message: axios.isAxiosError(error)
          ? error.response?.data?.message ?? 'Unable to export the mentoring report.'
          : error instanceof Error ? error.message : 'Unable to export the mentoring report.',
        tone: 'err',
      });
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className="boa-stack">
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
        <button
          type="button"
          className="apid-btn apid-btn-outline apid-btn-sm"
          disabled={exportingFormat !== null}
          onClick={() => void downloadReport('xlsx')}
        >
          <Download size={14} /> {exportingFormat === 'xlsx' ? 'Exporting…' : 'Export Excel'}
        </button>
        <button
          type="button"
          className="apid-btn apid-btn-outline apid-btn-sm"
          disabled={exportingFormat !== null}
          onClick={() => void downloadReport('pdf')}
        >
          <Download size={14} /> {exportingFormat === 'pdf' ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>
      <div className="boa-kpi-grid" style={{ marginBottom: 0 }}>
        <StatCard
          label="Trainer Applications"
          value={totalApplications}
          subtext={`${overview.pendingApplications} pending · ${overview.approvedApplications} approved · ${overview.declinedApplications} declined`}
          icon={<Award size={16} />}
        />
        <StatCard
          label="Trainer Pipeline"
          value={overview.activeTrainers}
          subtext={`${overview.suspendedTrainers} suspended · ${overview.revokedTrainers} revoked`}
          badge="ACTIVE"
          badgeTone="ok"
          icon={<Users size={16} />}
        />
        <StatCard
          label="Relationships Completed"
          value={`${overview.completionRatePct}%`}
          subtext={`${overview.completedRelationships} of ${overview.activeRelationships + overview.completedRelationships} active/completed`}
          icon={<CheckCircle2 size={16} />}
        />
        <StatCard
          label="Sessions Conducted"
          value={overview.completedSessions}
          subtext={`${overview.totalSessions} total scheduled sessions`}
          icon={<CheckCircle2 size={16} />}
        />
        <StatCard
          label="Average Trainee Feedback"
          value={overview.averageFeedbackRating ? `${overview.averageFeedbackRating.toFixed(1)} / 5` : 'Not rated'}
          subtext="From completed mentoring relationships"
          icon={<Award size={16} />}
        />
      </div>
      <section className="apid-card">
        <h3 className="boa-card-title">Trainer Utilization</h3>
        <p className="boa-card-subtitle">Active trainees and pending requests compared with each trainer&apos;s approved capacity.</p>
        <SvgHorizontalBarChart
          title="Active trainees by trainer"
          description="Trainees in active relationships compared to approved capacity"
          items={trainers.map((trainer) => ({
            id: String(trainer.id),
            label: trainer.fullName,
            value: trainer.activeTrainees,
            secondaryLabel: `${trainer.activeTrainees} active · ${trainer.pendingTrainees} pending · ${trainer.maxConcurrentTrainees} capacity · ${trainer.status}`,
            color: trainer.status === 'ACTIVE' ? '#0f172a' : '#94a3b8',
          }))}
        />
      </section>
    </div>
  );
}
