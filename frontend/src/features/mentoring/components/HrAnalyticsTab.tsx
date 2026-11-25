import { useState } from 'react';
import axios from 'axios';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CalendarDays,
  CheckCircle2,
  Download,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
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

function formatFeedbackMonth(value: string) {
  const date = new Date(`${value}-01T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC',
    }).format(date);
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
  const [trainerSearch, setTrainerSearch] = useState('');
  const { pushToast } = useToast();
  const pairingReportsQuery = useQuery({
    queryKey: ['mentoring', 'hr-pairing-reports'],
    queryFn: mentoringTrainerApi.getPairingReportOverview,
  });
  const programInsightsMutation = useMutation({
    mutationFn: mentoringTrainerApi.generateProgramInsights,
    onError: (error: unknown) =>
      pushToast({
        title: 'Unable to generate AI insights',
        message: axios.isAxiosError(error)
          ? error.response?.data?.message ?? 'Please try again later.'
          : error instanceof Error ? error.message : 'Please try again later.',
        tone: 'err',
      }),
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
  const programInsights = programInsightsMutation.data;
  const feedbackReport = overview.feedbackReport;
  const maxRatingResponses = Math.max(
    0,
    ...feedbackReport.ratingDistribution.map((item) => item.responseCount)
  );
  const filteredTrainers = trainers.filter((trainer) =>
    trainer.fullName.toLowerCase().includes(trainerSearch.trim().toLowerCase())
  );

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
      <section
        className="mentoring-dashboard__section mentoring-ai-insights"
        aria-busy={programInsightsMutation.isPending}
      >
        <div className="mentoring-dashboard__section-header">
          <div className="mentoring-ai-insights__heading">
            <span className="mentoring-ai-insights__icon" aria-hidden="true">
              <Sparkles size={19} />
            </span>
            <div>
              <div className="mentoring-ai-insights__title-row">
                <h3 className="mentoring-dashboard__section-title">AI Program Insights</h3>
                <span className="mentoring-ai-insights__badge">AI-generated</span>
              </div>
              <p className="mentoring-dashboard__section-description">
                Grounded in aggregate metrics and skill supply; no names or report notes are included.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="apid-btn apid-btn-primary apid-btn-sm mentoring-ai-insights__generate"
            disabled={programInsightsMutation.isPending}
            onClick={() => programInsightsMutation.mutate()}
          >
            <Sparkles size={14} aria-hidden="true" />
            {programInsightsMutation.isPending
              ? 'Analyzing…'
              : programInsights ? 'Refresh insights' : 'Generate insights'}
          </button>
        </div>
        {programInsightsMutation.isPending && (
          <div className="mentoring-ai-insights__loading" role="status">
            <span className="mentoring-ai-insights__spinner" aria-hidden="true" />
            <span>Reviewing the current mentoring metrics and preparing recommendations…</span>
          </div>
        )}
        {programInsights && (
          <div className="mentoring-ai-insights__content" aria-live="polite">
            <div className="mentoring-ai-insights__summary">
              <span className="mentoring-ai-insights__summary-label">Executive summary</span>
              <p>{programInsights.summary}</p>
            </div>
            <div className="mentoring-ai-insights__grid">
              {[
                {
                  title: 'Strengths',
                  items: programInsights.strengths,
                  icon: <TrendingUp size={16} aria-hidden="true" />,
                  className: 'is-strength',
                },
                {
                  title: 'Attention areas',
                  items: programInsights.attentionAreas,
                  icon: <AlertTriangle size={16} aria-hidden="true" />,
                  className: 'is-attention',
                },
                {
                  title: 'Suggested actions',
                  items: programInsights.recommendedActions,
                  icon: <ArrowRight size={16} aria-hidden="true" />,
                  className: 'is-action',
                },
              ].map((group) => (
                <article className={`mentoring-ai-insights__card ${group.className}`} key={group.title}>
                  <div className="mentoring-ai-insights__card-heading">
                    <span className="mentoring-ai-insights__card-icon">{group.icon}</span>
                    <h4>{group.title}</h4>
                    <span className="mentoring-ai-insights__count">{group.items.length}</span>
                  </div>
                  {group.items.length > 0 ? (
                    <ul className="mentoring-ai-insights__list">
                      {group.items.map((item, index) => <li key={`${group.title}-${index}`}>{item}</li>)}
                    </ul>
                  ) : (
                    <p className="mentoring-ai-insights__empty">No items identified for this section.</p>
                  )}
                </article>
              ))}
            </div>
            <div className="mentoring-ai-insights__disclaimer">
              AI-generated observations are advisory. Review the supporting report metrics before acting.
            </div>
          </div>
        )}
        {!programInsights && !programInsightsMutation.isPending && (
          <div className="mentoring-ai-insights__empty-state">
            <span className="mentoring-ai-insights__empty-icon" aria-hidden="true">
              <Sparkles size={18} />
            </span>
            <div>
              <strong>Turn program data into practical next steps</strong>
              <p>Generate a concise summary of strengths, areas to watch, and suggested actions.</p>
            </div>
          </div>
        )}
      </section>
      <section className="mentoring-dashboard__section">
        <div className="mentoring-dashboard__section-header">
          <div>
            <h3 className="mentoring-dashboard__section-title">Request Wait Time &amp; Backlog</h3>
            <p className="mentoring-dashboard__section-description">
              Open mentor-match requests grouped by time waiting for a match.
            </p>
          </div>
        </div>
        {overview.requestBacklog.openRequests === 0 ? (
          <p className="mentoring-dashboard__section-description" role="status">
            No open mentor-match requests.
          </p>
        ) : (
          <div className="mentoring-dashboard__metrics" aria-label="Mentor-match request backlog">
            {[
              {
                label: 'Open requests',
                value: overview.requestBacklog.openRequests,
                detail: `${overview.requestBacklog.waitingSevenOrMoreDays} waiting at least 7 days`,
              },
              {
                label: 'Average wait',
                value: `${overview.requestBacklog.averageWaitDays.toFixed(1)} days`,
                detail: 'Across all open requests',
              },
              {
                label: 'Oldest request',
                value: `${overview.requestBacklog.oldestWaitDays.toFixed(1)} days`,
                detail: `${overview.requestBacklog.waitingUnderTwoDays} under 2 days · ${overview.requestBacklog.waitingTwoToSevenDays} from 2–7 days`,
              },
            ].map((metric) => (
              <div className="mentoring-dashboard__metric" key={metric.label}>
                <div className="mentoring-dashboard__metric-value">{metric.value}</div>
                <div className="mentoring-dashboard__metric-label">{metric.label}</div>
                <div className="mentoring-dashboard__section-description">{metric.detail}</div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="mentoring-dashboard__section mentoring-feedback-report">
        <div className="mentoring-dashboard__section-header">
          <div>
            <h3 className="mentoring-dashboard__section-title">Mentoring Feedback &amp; Quality</h3>
            <p className="mentoring-dashboard__section-description">
              Relationship-level trainee ratings. Written feedback is not shown in this report.
            </p>
          </div>
        </div>
        <div className="mentoring-feedback-report__stats" aria-label="Feedback summary">
          <article className="mentoring-feedback-report__stat">
            <span className="mentoring-feedback-report__stat-icon" aria-hidden="true">
              <Star size={16} />
            </span>
            <div>
              <span className="mentoring-feedback-report__stat-label">Average rating</span>
              <strong>
                {feedbackReport.averageRating === null
                  ? 'No ratings'
                  : `${feedbackReport.averageRating.toFixed(1)} / 5`}
              </strong>
            </div>
          </article>
          <article className="mentoring-feedback-report__stat">
            <span className="mentoring-feedback-report__stat-icon" aria-hidden="true">
              <Users size={16} />
            </span>
            <div>
              <span className="mentoring-feedback-report__stat-label">Responses</span>
              <strong>{feedbackReport.responseCount}</strong>
              <small>submitted relationship ratings</small>
            </div>
          </article>
        </div>
        {feedbackReport.responseCount === 0 ? (
          <p className="mentoring-feedback-report__empty" role="status">
            No feedback ratings have been submitted yet. Ratings will appear here when trainees complete feedback.
          </p>
        ) : (
          <div className="mentoring-feedback-report__charts">
            <section className="mentoring-feedback-report__panel" aria-labelledby="feedback-rating-distribution">
              <h4 id="feedback-rating-distribution">Rating distribution</h4>
              <div className="mentoring-feedback-report__distribution">
                {[...feedbackReport.ratingDistribution].reverse().map((item) => (
                  <div className="mentoring-feedback-report__rating-row" key={item.rating}>
                    <span className="mentoring-feedback-report__rating-label">{item.rating} stars</span>
                    <span className="mentoring-feedback-report__rating-track" aria-hidden="true">
                      <span
                        style={{
                          width: `${maxRatingResponses === 0 ? 0 : item.responseCount / maxRatingResponses * 100}%`,
                        }}
                      />
                    </span>
                    <span className="mentoring-feedback-report__rating-count">{item.responseCount}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="mentoring-feedback-report__panel" aria-labelledby="feedback-monthly-trend">
              <div className="mentoring-feedback-report__trend-heading">
                <h4 id="feedback-monthly-trend">Monthly average</h4>
                <span>Rating out of 5 · Last 6 months</span>
              </div>
              <div className="mentoring-feedback-report__trend">
                {feedbackReport.monthlyTrend.map((month) => (
                  <div className="mentoring-feedback-report__month" key={month.month}>
                    <strong>
                      {month.averageRating === null ? '—' : month.averageRating.toFixed(1)}
                    </strong>
                    <span className="mentoring-feedback-report__trend-track" aria-hidden="true">
                      <span
                        style={{
                          height: `${month.averageRating === null ? 0 : month.averageRating / 5 * 100}%`,
                        }}
                      />
                    </span>
                    <span className="mentoring-feedback-report__month-label">
                      {formatFeedbackMonth(month.month)}
                    </span>
                    <small>{month.responseCount} {month.responseCount === 1 ? 'response' : 'responses'}</small>
                  </div>
                ))}
              </div>
              <p className="mentoring-feedback-report__caption">
                Months without ratings show a dash. The overall average includes all submitted ratings.
              </p>
            </section>
          </div>
        )}
      </section>
      <div className="mentoring-analytics__charts">
      <section className="mentoring-analytics__chart">
        <h3 className="mentoring-dashboard__section-title">Trainer Utilization</h3>
        <p className="mentoring-dashboard__section-description">Active trainees and pending requests compared with each trainer&apos;s approved capacity.</p>
        <div className="mentoring-analytics-search-toolbar">
          <label className="mentoring-analytics-search">
            <span className="sr-only">Search trainers</span>
            <input
              type="search"
              value={trainerSearch}
              onChange={(event) => setTrainerSearch(event.target.value)}
              placeholder="Search trainers"
            />
          </label>
          <span className="mentoring-dashboard__section-description">
            Showing {filteredTrainers.length} of {trainers.length}
          </span>
        </div>
        {filteredTrainers.length === 0 ? (
          <p className="mentoring-dashboard__section-description" role="status">
            {trainers.length === 0 ? 'No trainers available.' : 'No trainers match your search.'}
          </p>
        ) : (
          <div
            key={trainerSearch}
            className="mentoring-analytics-chart-scroll"
            role="region"
            aria-label="Trainer utilization list"
            tabIndex={0}
          >
            <SvgHorizontalBarChart
              title="Active trainees by trainer"
              description="Trainees in active relationships compared to approved capacity"
              items={filteredTrainers.map((trainer) => ({
                id: String(trainer.id),
                label: trainer.fullName,
                value: trainer.activeTrainees,
                secondaryLabel: `${trainer.activeTrainees} active · ${trainer.pendingTrainees} pending · ${trainer.maxConcurrentTrainees} capacity · ${trainer.status}`,
                color: trainer.status === 'ACTIVE' ? '#0f172a' : '#94a3b8',
              }))}
            />
          </div>
        )}
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
