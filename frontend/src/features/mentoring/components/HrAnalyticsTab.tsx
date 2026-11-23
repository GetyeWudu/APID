import { useState } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Award, CalendarDays, CheckCircle2, Download, Users } from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  SlideOverDrawer,
  StatusPill,
  SvgHorizontalBarChart,
  useToast,
} from '../../../shared/components/ui';
import { mentoringTrainerApi } from '../api/mentoringTrainerApi';
import { SkillSupplyDemandCard } from './SkillSupplyDemandCard';
import '../pages/MentoringDashboard.css';
import type {
  MentoringHrOverview,
  MentoringPairingReportSummary,
  TrainerRosterItem,
} from '../api/mentoringTrainerApi';

function formatReportDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function relationshipStatusTone(status: MentoringPairingReportSummary['status']) {
  if (status === 'COMPLETED') return 'ok';
  if (status === 'ACTIVE') return 'info';
  if (status === 'PAUSED') return 'warn';
  return 'neutral';
}

function sessionStatusTone(status: string) {
  if (status === 'COMPLETED') return 'ok';
  if (status === 'SCHEDULED') return 'info';
  if (status === 'MISSED') return 'err';
  return 'neutral';
}

export function HrAnalyticsTab({
  overview,
  trainers,
}: {
  overview: MentoringHrOverview;
  trainers: TrainerRosterItem[];
}) {
  const [exportingFormat, setExportingFormat] = useState<'xlsx' | 'pdf' | null>(null);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<number | null>(null);
  const { pushToast } = useToast();
  const pairingReportsQuery = useQuery({
    queryKey: ['mentoring', 'hr-pairing-reports'],
    queryFn: mentoringTrainerApi.getPairingReportOverview,
  });
  const selectedPairReportQuery = useQuery({
    queryKey: ['mentoring', 'hr-pairing-report', selectedRelationshipId],
    queryFn: () => {
      if (selectedRelationshipId === null) {
        throw new Error('Select a pairing to view its report.');
      }
      return mentoringTrainerApi.getPairingReport(selectedRelationshipId);
    },
    enabled: selectedRelationshipId !== null,
  });
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

  const selectedPairReport = selectedPairReportQuery.data;
  const pairingReport =
    selectedPairReport?.pairing.relationshipId === selectedRelationshipId
      ? selectedPairReport
      : undefined;
  const selectedPairing = pairingReportsQuery.data?.pairings.find(
    (item) => item.relationshipId === selectedRelationshipId
  );
  const overviewMetrics = [
    {
      label: 'Trainer applications',
      value: totalApplications,
      detail: `${overview.pendingApplications} pending · ${overview.approvedApplications} approved · ${overview.declinedApplications} declined`,
      icon: <Award size={18} />,
    },
    {
      label: 'Active trainers',
      value: overview.activeTrainers,
      detail: `${overview.suspendedTrainers} suspended · ${overview.revokedTrainers} revoked`,
      icon: <Users size={18} />,
    },
    {
      label: 'Relationships completed',
      value: `${overview.completionRatePct}%`,
      detail: `${overview.completedRelationships} completed overall`,
      icon: <CheckCircle2 size={18} />,
    },
    {
      label: 'Sessions conducted',
      value: overview.completedSessions,
      detail: `${overview.totalSessions} total scheduled`,
      icon: <CheckCircle2 size={18} />,
    },
    {
      label: 'Active relationships',
      value: overview.activeRelationships,
      detail: 'Mentor-trainee pairings currently in progress',
      icon: <Users size={18} />,
    },
  ];

  return (
    <div className="boa-stack mentoring-dashboard mentoring-analytics">
      <div className="mentoring-dashboard__toolbar">
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
      <div className="mentoring-dashboard__metrics mentoring-analytics__metrics" aria-label="Mentoring program summary">
        {overviewMetrics.map((metric) => (
          <div className="mentoring-dashboard__metric" key={metric.label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--mentoring-accent)' }}>
              <span aria-hidden="true">{metric.icon}</span>
              <span className="mentoring-dashboard__metric-value">{metric.value}</span>
            </div>
            <div className="mentoring-dashboard__metric-label">{metric.label}</div>
            <div className="mentoring-dashboard__section-description">{metric.detail}</div>
          </div>
        ))}
      </div>
      <div className="mentoring-analytics__charts">
      <section className="mentoring-analytics__chart">
        <h3 className="mentoring-dashboard__section-title">Trainer Utilization</h3>
        <p className="mentoring-dashboard__section-description">Active trainees and pending requests compared with each trainer&apos;s approved capacity.</p>
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
      <SkillSupplyDemandCard
        liveSkillNames={overview.skillSupplyDemand.map((row) => row.skillName)}
        skillSupplyDemand={overview.skillSupplyDemand}
      />
      </div>
      <section className="mentoring-dashboard__section">
        <div className="mentoring-dashboard__section-header">
          <div>
            <h3 className="mentoring-dashboard__section-title">Pairing Reports</h3>
            <p className="mentoring-dashboard__section-description">
              Overall pairing and session completion, with session and completion notes for each pairing.
            </p>
          </div>
        </div>
        {pairingReportsQuery.isLoading ? (
          <LoadingSkeleton rows={4} height={28} />
        ) : pairingReportsQuery.isError || !pairingReportsQuery.data ? (
          <ErrorState
            message="Unable to load pairing reports."
            onRetry={() => void pairingReportsQuery.refetch()}
          />
        ) : (
          <>
            <div className="mentoring-dashboard__metrics" aria-label="Pairing report summary">
              {[
                {
                  label: 'Total pairings',
                  value: pairingReportsQuery.data.totalPairings,
                  detail: `${pairingReportsQuery.data.completedPairings} completed`,
                  icon: <Users size={18} />,
                },
                {
                  label: 'Pairing completion',
                  value: `${pairingReportsQuery.data.pairingCompletionRatePct}%`,
                  detail: `${pairingReportsQuery.data.completedPairings} of ${pairingReportsQuery.data.totalPairings}`,
                  icon: <CheckCircle2 size={18} />,
                },
                {
                  label: 'Total sessions',
                  value: pairingReportsQuery.data.totalSessions,
                  detail: `${pairingReportsQuery.data.completedSessions} completed`,
                  icon: <CalendarDays size={18} />,
                },
                {
                  label: 'Session completion',
                  value: `${pairingReportsQuery.data.sessionCompletionRatePct}%`,
                  detail: `${pairingReportsQuery.data.completedSessions} of ${pairingReportsQuery.data.totalSessions}`,
                  icon: <CheckCircle2 size={18} />,
                },
              ].map((metric) => (
                <div className="mentoring-dashboard__metric" key={metric.label}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--mentoring-accent)' }}>
                    <span aria-hidden="true">{metric.icon}</span>
                    <span className="mentoring-dashboard__metric-value">{metric.value}</span>
                  </div>
                  <div className="mentoring-dashboard__metric-label">{metric.label}</div>
                  <div className="mentoring-dashboard__section-description">{metric.detail}</div>
                </div>
              ))}
            </div>
            {pairingReportsQuery.data.pairings.length === 0 ? (
              <EmptyState title="No Mentoring Pairings" description="Pairing reports will appear here when relationships are created." />
            ) : (
              <div className="mentoring-report-list">
                {pairingReportsQuery.data.pairings.map((pairing) => (
                  <button
                    key={pairing.relationshipId}
                    type="button"
                    className="mentoring-analytics__report-row"
                    aria-expanded={selectedRelationshipId === pairing.relationshipId}
                    onClick={() =>
                      setSelectedRelationshipId((current) =>
                        current === pairing.relationshipId ? null : pairing.relationshipId
                      )
                    }
                  >
                    <div className="mentoring-analytics__report-main">
                        <strong>
                          {pairing.requestType === 'GROUP' ? 'Mentoring class' : 'One-to-one mentoring'}
                        </strong>
                        <div className="mentoring-analytics__report-meta">
                          {pairing.mentorName} → {pairing.traineeNames.join(', ') || 'Trainee not available'}
                          · {pairing.skillName ?? 'No skill specified'}
                        </div>
                    </div>
                    <span className="mentoring-analytics__report-progress">
                      {pairing.completedSessions}/{pairing.totalSessions} sessions · {pairing.sessionCompletionRatePct}%
                    </span>
                    <div>
                      <StatusPill label={pairing.status} tone={relationshipStatusTone(pairing.status)} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </section>
      <SlideOverDrawer
        open={selectedRelationshipId !== null}
        title={selectedPairing?.requestType === 'GROUP' ? 'Mentoring Class Report' : 'Pairing Report'}
        subtitle={
          selectedPairing
            ? `${selectedPairing.mentorName} → ${selectedPairing.traineeNames.join(', ')}${selectedPairing.skillName ? ` · ${selectedPairing.skillName}` : ''}`
            : undefined
        }
        onClose={() => setSelectedRelationshipId(null)}
      >
        {selectedRelationshipId !== null ? (
          selectedPairReportQuery.isLoading ? (
            <LoadingSkeleton rows={5} height={28} />
          ) : selectedPairReportQuery.isError || !pairingReport ? (
            <ErrorState
              message="Unable to load this pairing report."
              onRetry={() => void selectedPairReportQuery.refetch()}
            />
          ) : (
            <div className="boa-stack">
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <StatusPill
                  label={pairingReport.pairing.status}
                  tone={relationshipStatusTone(pairingReport.pairing.status)}
                />
              </div>
              <p className="boa-muted" style={{ margin: 0 }}>
                {pairingReport.pairing.completedSessions} of {pairingReport.pairing.totalSessions} sessions completed
                ({pairingReport.pairing.sessionCompletionRatePct}%).
              </p>
              {pairingReport.pairing.status === 'COMPLETED' && (
                <div>
                  <h4 style={{ margin: '0 0 0.4rem' }}>Pair Completion Report Note</h4>
                  <p className="boa-muted" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {pairingReport.completionNote || 'No completion report note was recorded.'}
                  </p>
                </div>
              )}
              <div>
                <h4 style={{ margin: '0 0 0.5rem' }}>Session Reports</h4>
                {pairingReport.sessions.length === 0 ? (
                  <EmptyState title="No Sessions" description="No sessions have been scheduled for this pairing." />
                ) : (
                  <div className="boa-stack" style={{ gap: '0.5rem' }}>
                    {pairingReport.sessions.map((session) => (
                      <article key={session.id} className="apid-card" style={{ border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <div>
                            <strong>{session.title}</strong>
                            <p className="boa-muted" style={{ margin: '0.25rem 0 0', fontSize: '0.82rem' }}>
                              {formatReportDate(session.scheduledStart)}
                            </p>
                          </div>
                          <StatusPill label={session.status} tone={sessionStatusTone(session.status)} />
                        </div>
                        {session.agenda && <p className="boa-muted">{session.agenda}</p>}
                        <div style={{ marginTop: '0.5rem' }}>
                          <strong style={{ fontSize: '0.85rem' }}>Session Report Note</strong>
                          <p className="boa-muted" style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap' }}>
                            {session.reportNote || 'No session report note was recorded.'}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        ) : null}
      </SlideOverDrawer>
    </div>
  );
}
