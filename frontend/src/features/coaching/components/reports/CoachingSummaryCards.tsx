import React from 'react';
import { Users, TrendingUp, CalendarCheck, AlertTriangle } from 'lucide-react';
import type { PmsReportSummary } from '../../api/pmsReportApi';

interface CoachingSummaryCardsProps {
  summary: PmsReportSummary | null;
  loading: boolean;
  onFilterAtRisk?: () => void;
  onFilterImproving?: () => void;
  onFilterAll?: () => void;
}

export const CoachingSummaryCards: React.FC<CoachingSummaryCardsProps> = ({
  summary,
  loading,
  onFilterAtRisk,
  onFilterImproving,
  onFilterAll,
}) => {
  if (loading || !summary) {
    return (
      <div className="boa-kpi-grid" style={{ marginBottom: '1.25rem' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="boa-stat-card" style={{ minHeight: 120, opacity: 0.6 }}>
            <div className="boa-stat-label">Loading summary...</div>
            <div className="boa-stat-value" style={{ color: 'var(--muted)' }}>--</div>
          </div>
        ))}
      </div>
    );
  }

  const recoveryRate = summary.totalInRemediation > 0
    ? Math.round((summary.showingImprovementCount / summary.totalInRemediation) * 100)
    : 0;

  return (
    <div className="boa-kpi-grid" style={{ marginBottom: '1.25rem' }}>
      {/* 1. Total in Remediation */}
      <div
        className="boa-stat-card"
        style={{
          cursor: 'pointer',
          borderLeft: '4px solid #ca8a04',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
        onClick={onFilterAll}
        title="Click to view all employees in remediation"
      >
        <div className="boa-stat-top">
          <span className="boa-stat-label">REMEDIATION COHORT</span>
          <span
            className="boa-stat-icon"
            style={{ color: '#ca8a04', background: 'rgba(202, 138, 4, 0.12)' }}
          >
            <Users size={16} />
          </span>
        </div>
        <div className="boa-stat-value-row">
          <span className="boa-stat-value">{summary.totalInRemediation}</span>
          <span className="boa-pill boa-pill-neutral">Total Coached</span>
        </div>
        <div className="boa-stat-meta" style={{ marginTop: '0.25rem' }}>
          <span style={{ color: 'var(--err)', fontWeight: 600 }}>
            {summary.criticalCount} Critical (&lt;2.0)
          </span>
          <span>•</span>
          <span style={{ color: 'var(--warn)', fontWeight: 600 }}>
            {summary.moderateCount} Moderate
          </span>
        </div>
      </div>

      {/* 2. Showing Improvement */}
      <div
        className="boa-stat-card"
        style={{
          cursor: 'pointer',
          borderLeft: '4px solid var(--ok)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
        onClick={onFilterImproving}
        title="Click to view employees showing improvement"
      >
        <div className="boa-stat-top">
          <span className="boa-stat-label">SHOWING IMPROVEMENT</span>
          <span
            className="boa-stat-icon"
            style={{ color: 'var(--ok)', background: 'var(--ok-soft)' }}
          >
            <TrendingUp size={16} />
          </span>
        </div>
        <div className="boa-stat-value-row">
          <span className="boa-stat-value">{summary.showingImprovementCount}</span>
          <span className="boa-pill boa-pill-ok">{recoveryRate}% Turnaround</span>
        </div>
        <div className="boa-stat-meta" style={{ marginTop: '0.25rem' }}>
          <span>
            <strong style={{ color: 'var(--ok)' }}>{summary.masteredCount}</strong> Mastered ·{' '}
            <strong>{summary.onTrackCount}</strong> On Track
          </span>
        </div>
      </div>

      {/* 3. Session Delivery Rate */}
      <div
        className="boa-stat-card"
        style={{
          borderLeft: '4px solid var(--info)',
        }}
      >
        <div className="boa-stat-top">
          <span className="boa-stat-label">TARGET COMMITMENT</span>
          <span
            className="boa-stat-icon"
            style={{ color: 'var(--info)', background: 'var(--info-soft)' }}
          >
            <CalendarCheck size={16} />
          </span>
        </div>
        <div className="boa-stat-value-row">
          <span className="boa-stat-value">{summary.sessionDeliveryRate}%</span>
          <span className="boa-pill boa-pill-info">Delivered</span>
        </div>
        <div style={{ marginTop: '0.35rem' }}>
          <div
            style={{
              width: '100%',
              height: '6px',
              background: 'var(--border)',
              borderRadius: '999px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, summary.sessionDeliveryRate)}%`,
                height: '100%',
                background: 'var(--info)',
                borderRadius: '999px',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <div className="boa-stat-meta" style={{ marginTop: '0.35rem' }}>
            <span>
              {summary.totalCompletedSessions} of {summary.totalApprovedSessions} verified
            </span>
          </div>
        </div>
      </div>

      {/* 4. Needs Attention */}
      <div
        className="boa-stat-card"
        style={{
          cursor: 'pointer',
          borderLeft:
            summary.attentionRequiredCount > 0
              ? '4px solid var(--err)'
              : '4px solid var(--border)',
          background:
            summary.attentionRequiredCount > 0 ? 'rgba(239, 68, 68, 0.04)' : 'var(--surface)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
        onClick={onFilterAtRisk}
        title="Click to filter employees needing immediate intervention"
      >
        <div className="boa-stat-top">
          <span className="boa-stat-label">NEEDS ATTENTION</span>
          <span
            className="boa-stat-icon"
            style={{
              color: summary.attentionRequiredCount > 0 ? 'var(--err)' : 'var(--muted)',
              background:
                summary.attentionRequiredCount > 0 ? 'var(--err-soft)' : 'var(--surface-subtle)',
            }}
          >
            <AlertTriangle size={16} />
          </span>
        </div>
        <div className="boa-stat-value-row">
          <span
            className="boa-stat-value"
            style={{
              color: summary.attentionRequiredCount > 0 ? 'var(--err)' : 'inherit',
            }}
          >
            {summary.attentionRequiredCount}
          </span>
          {summary.attentionRequiredCount > 0 ? (
            <span className="boa-pill boa-pill-err">Action Needed</span>
          ) : (
            <span className="boa-pill boa-pill-ok">On Schedule</span>
          )}
        </div>
        <div className="boa-stat-meta" style={{ marginTop: '0.25rem' }}>
          {summary.attentionRequiredCount > 0 ? (
            <span style={{ color: 'var(--err)', fontWeight: 600 }}>
              Inactive &gt;14d or missed
            </span>
          ) : (
            <span style={{ color: 'var(--ok)' }}>All pacing on schedule</span>
          )}
        </div>
      </div>
    </div>
  );
};
