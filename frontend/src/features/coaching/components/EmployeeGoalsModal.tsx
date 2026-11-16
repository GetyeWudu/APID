import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Target, AlertTriangle, TrendingDown } from 'lucide-react';
import { coachingAssignmentApi, EmployeePerformanceGoals } from '../api/coachingAssignmentApi';
import { StatusPill } from '../../../shared/components/ui';

interface EmployeeGoalsModalProps {
  employeeId: number | null;
  employeeName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const EmployeeGoalsModal: React.FC<EmployeeGoalsModalProps> = ({
  employeeId,
  employeeName,
  isOpen,
  onClose,
}) => {
  const goalsQuery = useQuery<EmployeePerformanceGoals>({
    queryKey: ['employee-performance-goals', employeeId],
    queryFn: () => coachingAssignmentApi.getEmployeePerformanceGoals(employeeId!),
    enabled: isOpen && typeof employeeId === 'number' && employeeId > 0,
  });

  if (!isOpen) return null;

  const data = goalsQuery.data;
  const goalLines = data?.goalLines ?? [];

  // Identify weakest goal (lowest goalScore)
  const weakestGoal = goalLines.reduce<{
    minScore: number;
    goal: (typeof goalLines)[0] | null;
  }>(
    (acc, line) => {
      const score = typeof line.goalScore === 'number' ? line.goalScore : Number(line.goalScore);
      if (!isNaN(score) && score < acc.minScore) {
        return { minScore: score, goal: line };
      }
      return acc;
    },
    { minScore: Infinity, goal: null }
  ).goal;

  return (
    <div
      className="apid-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="apid-card"
        style={{
          width: '100%',
          maxWidth: 860,
          maxHeight: '90vh',
          overflowY: 'auto',
          margin: 0,
          background: 'var(--surface)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
          border: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="boa-card-header"
          style={{
            paddingBottom: '1rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'rgba(217, 119, 6, 0.12)',
                  color: 'var(--gold-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Target size={22} />
              </div>
              <div>
                <h3 className="boa-card-title" style={{ margin: 0, fontSize: '1.25rem' }}>
                  {data?.fullName || employeeName || 'Employee Performance Goals'}
                </h3>
                <p className="boa-card-subtitle" style={{ margin: 0 }}>
                  Emp #{data?.employeeNumber ?? '—'} · {data?.departmentName ?? '—'} ·{' '}
                  {data?.position ?? '—'}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="apid-btn apid-btn-ghost"
            onClick={onClose}
            style={{ padding: '0.35rem', color: 'var(--muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.25rem 0' }}>
          {goalsQuery.isLoading && (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--muted)' }}>
              <div className="apid-spinner" style={{ margin: '0 auto 1rem auto' }} />
              Loading employee individual PMS performance goals...
            </div>
          )}

          {goalsQuery.isError && (
            <div className="apid-alert apid-alert-err">
              <AlertTriangle size={18} style={{ marginRight: '0.5rem' }} />
              Failed to load performance goals for this employee. Ensure you have proper managerial or coaching authorization.
            </div>
          )}

          {!goalsQuery.isLoading && !goalsQuery.isError && (
            <>
              {/* PMS Overall Summary Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div
                  style={{
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '0.9rem 1rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                    Overall Final Rating
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.2rem', color: 'var(--foreground)' }}>
                    {typeof data?.overallFinalRating === 'number'
                      ? data.overallFinalRating.toFixed(4)
                      : data?.overallFinalRating ?? 'N/A'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                    Evaluation Cycle: {data?.coachingQuarterLabel || `${data?.pmsYear ?? ''} Q${data?.pmsQuarter ?? ''}`}
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '0.9rem 1rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                    Performance Band
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 700 }}>
                      Band {data?.roundedOverallFinalRating ?? '—'}
                    </span>
                    {data?.roundedOverallFinalRating && data.roundedOverallFinalRating < 3 ? (
                      <StatusPill label="MANDATORY COACHING" tone="err" />
                    ) : (
                      <StatusPill label="STANDARD / HIGH" tone="ok" />
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                    Cutoff: Rounded &lt; 3 enters mandatory coaching
                  </div>
                </div>
              </div>

              {/* Weakest Area / Primary Focus Alert */}
              {weakestGoal && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 8,
                    padding: '1rem',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    gap: '0.85rem',
                    alignItems: 'flex-start',
                  }}
                >
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: 'var(--danger)',
                      padding: '0.5rem',
                      borderRadius: 6,
                    }}
                  >
                    <TrendingDown size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '0.92rem',
                          color: 'var(--danger)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Identified Weakest Goal · Coaching Focus Area
                      </span>
                      <span
                        style={{
                          background: 'var(--danger)',
                          color: '#fff',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.1rem 0.45rem',
                          borderRadius: 999,
                        }}
                      >
                        Lowest Score: {Number(weakestGoal.goalScore).toFixed(2)}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: '0.25rem', color: 'var(--foreground)' }}>
                      {weakestGoal.goalName}
                    </div>
                    <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.84rem', color: 'var(--muted)' }}>
                      Target: <strong>{weakestGoal.targetValue ?? '—'}</strong> · Actual:{' '}
                      <strong>{weakestGoal.actualValue ?? '—'}</strong> · Weight:{' '}
                      <strong>{Number(weakestGoal.weight).toFixed(0)}%</strong>. Coaching sessions and action plans should specifically target this capability gap.
                    </p>
                  </div>
                </div>
              )}

              {/* Individual Goals Table */}
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                    Detailed Goal Lines Breakdown ({goalLines.length} goals)
                  </h4>
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                    Extracted directly from PMS appraisal evaluation
                  </span>
                </div>

                {goalLines.length === 0 ? (
                  <div
                    style={{
                      padding: '2rem 1rem',
                      textAlign: 'center',
                      background: 'var(--surface-subtle)',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      color: 'var(--muted)',
                    }}
                  >
                    No detailed PMS goal lines found for this employee in the current appraisal cycle.
                  </div>
                ) : (
                  <div className="apid-table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
                    <table className="apid-table">
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}>#</th>
                          <th>Goal Name & Tracking Metric</th>
                          <th>Target</th>
                          <th>Actual</th>
                          <th>Weight</th>
                          <th>Goal Score</th>
                          <th>Line Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {goalLines.map((line, idx) => {
                          const isWeakest = weakestGoal && weakestGoal.sourceRowNumber === line.sourceRowNumber;
                          return (
                            <tr
                              key={line.sourceRowNumber || idx}
                              style={{
                                background: isWeakest ? 'rgba(239, 68, 68, 0.05)' : undefined,
                              }}
                            >
                              <td className="tabular-nums" style={{ fontWeight: 600 }}>
                                {line.sourceRowNumber}
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span style={{ fontWeight: 600, color: isWeakest ? 'var(--danger)' : undefined }}>
                                    {line.goalName}
                                  </span>
                                  {isWeakest && (
                                    <span
                                      style={{
                                        fontSize: '0.68rem',
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        color: 'var(--danger)',
                                        fontWeight: 700,
                                        padding: '0.1rem 0.4rem',
                                        borderRadius: 4,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      Weakest Part
                                    </span>
                                  )}
                                </div>
                                {line.goalTrackingName && (
                                  <div className="boa-muted" style={{ fontSize: '0.78rem' }}>
                                    {line.goalTrackingName}
                                  </div>
                                )}
                              </td>
                              <td className="tabular-nums">{line.targetValue ?? '—'}</td>
                              <td className="tabular-nums">{line.actualValue ?? '—'}</td>
                              <td className="tabular-nums">
                                {line.weight != null ? `${Number(line.weight).toFixed(0)}%` : '—'}
                              </td>
                              <td className="tabular-nums">
                                <span
                                  style={{
                                    fontWeight: 700,
                                    color: isWeakest ? 'var(--danger)' : undefined,
                                  }}
                                >
                                  {line.goalScore != null ? Number(line.goalScore).toFixed(4) : '—'}
                                </span>
                              </td>
                              <td className="tabular-nums" style={{ fontWeight: 600 }}>
                                {line.lineScore != null ? Number(line.lineScore).toFixed(4) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            borderTop: '1px solid var(--border)',
            paddingTop: '0.85rem',
            marginTop: '0.5rem',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button type="button" className="apid-btn apid-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
