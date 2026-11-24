import React from 'react';
import { Clock, MapPin, ShieldAlert, ArrowRight } from 'lucide-react';
import type { DistrictBranchAnalytics } from '../../api/pmsReportApi';

interface OperationalAlertsRadarProps {
  analytics: DistrictBranchAnalytics | null;
  onFilterBranch?: (district: string, branch: string) => void;
  onFilterCritical?: () => void;
}

export const OperationalAlertsRadar: React.FC<OperationalAlertsRadarProps> = ({
  analytics,
  onFilterBranch,
  onFilterCritical,
}) => {
  if (!analytics) return null;

  // Scan for high-risk branches (critical > 0 && completedSessions === 0)
  const highRiskBranches: Array<{
    district: string;
    branch: string;
    criticalCount: number;
    totalCoachees: number;
    topGap: string;
  }> = [];

  for (const dist of analytics.districts) {
    for (const br of dist.branches) {
      if (br.criticalCount > 0 && br.completedSessions === 0) {
        highRiskBranches.push({
          district: dist.districtName,
          branch: br.branchName,
          criticalCount: br.criticalCount,
          totalCoachees: br.coacheesCount,
          topGap: br.primarySkillGap,
        });
      }
    }
  }

  // Sort by highest critical count
  highRiskBranches.sort((a, b) => b.criticalCount - a.criticalCount);
  const displayAlerts = highRiskBranches.slice(0, 3);

  return (
    <div
      style={{
        backgroundColor: 'rgba(245, 158, 11, 0.04)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              padding: '0.4rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldAlert size={16} />
          </div>
          <div>
            <h4
              style={{
                margin: 0,
                fontSize: '0.88rem',
                fontWeight: 700,
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              Operational Priority &amp; Remediation Bottlenecks
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '999px',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  border: '1px solid #fecaca',
                }}
              >
                {analytics.criticalCount} Critical Bank-Wide
              </span>
            </h4>
            <p style={{ margin: '0.1rem 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>
              Remediation areas requiring proactive PMS administrative intervention
            </p>
          </div>
        </div>

        {onFilterCritical && (
          <button
            type="button"
            onClick={onFilterCritical}
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#b45309',
              background: 'none',
              border: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
              borderRadius: '6px',
            }}
          >
            Inspect All Critical ({analytics.criticalCount})
            <ArrowRight size={13} />
          </button>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '0.75rem',
        }}
      >
        {displayAlerts.map((alert, idx) => (
          <div
            key={`alert-${idx}`}
            style={{
              padding: '0.85rem 1rem',
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #fed7aa',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
            className="dark:bg-slate-900 dark:border-amber-900/40"
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                }}
              >
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#0f172a',
                  }}
                  className="dark:text-white"
                >
                  {alert.branch.replace(' Branch Operations', '')}
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    backgroundColor: '#fee2e2',
                    color: '#b91c1c',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {alert.criticalCount} Critical
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                  color: '#64748b',
                  marginTop: '0.25rem',
                }}
              >
                <MapPin size={11} style={{ color: '#94a3b8' }} />
                <span>{alert.district.replace(' District', '')}</span>
                <span>•</span>
                <span>{alert.totalCoachees} coachees</span>
              </div>

              <div
                style={{
                  marginTop: '0.45rem',
                  fontSize: '0.75rem',
                  color: '#334155',
                }}
                className="dark:text-slate-300"
              >
                <span style={{ color: '#64748b' }}>Primary Gap:</span> {alert.topGap}
              </div>
            </div>

            <div
              style={{
                marginTop: '0.65rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
              }}
              className="dark:border-slate-800"
            >
              <span
                style={{
                  color: '#d97706',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <Clock size={11} /> 0 Sessions Done
              </span>

              {onFilterBranch && (
                <button
                  type="button"
                  onClick={() => onFilterBranch(alert.district, alert.branch)}
                  style={{
                    color: '#4338ca',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                  className="dark:text-indigo-400"
                >
                  View Staff &rarr;
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
