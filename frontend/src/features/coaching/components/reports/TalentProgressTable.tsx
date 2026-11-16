import React from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Award,
  Eye,
} from 'lucide-react';
import type { PmsTalentProgressItem } from '../../api/pmsReportApi';

interface TalentProgressTableProps {
  talents: PmsTalentProgressItem[];
  loading: boolean;
  activeStatusTab: string;
  onStatusTabChange: (status: string) => void;
  selectedDirectorate: string;
  onDirectorateChange: (dir: string) => void;
  directorateOptions: string[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectTalent: (assignmentId: number) => void;
}

export const TalentProgressTable: React.FC<TalentProgressTableProps> = ({
  talents,
  loading,
  activeStatusTab,
  onStatusTabChange,
  selectedDirectorate,
  onDirectorateChange,
  directorateOptions,
  searchQuery,
  onSearchChange,
  onSelectTalent,
}) => {
  const getTrajectoryBadge = (trajectory: PmsTalentProgressItem['progressTrajectory']) => {
    switch (trajectory) {
      case 'MASTERED':
        return (
          <span className="boa-pill boa-pill-ok">
            <CheckCircle2 size={12} /> Mastered
          </span>
        );
      case 'ON_TRACK':
        return (
          <span className="boa-pill boa-pill-info">
            <CheckCircle2 size={12} /> On Track
          </span>
        );
      case 'IMPROVING':
        return (
          <span className="boa-pill boa-pill-warn">
            <Clock size={12} /> Improving
          </span>
        );
      case 'NEEDS_IMPROVEMENT':
        return (
          <span className="boa-pill boa-pill-err">
            <AlertTriangle size={12} /> Needs Improvement
          </span>
        );
      default:
        return (
          <span className="boa-pill boa-pill-neutral">
            <Clock size={12} /> Not Started
          </span>
        );
    }
  };

  return (
    <div className="apid-card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Table Controls & Filter Bar */}
      <div
        style={{
          padding: '0.85rem 1.15rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.85rem',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--surface-subtle)',
        }}
      >
        {/* Status Tab Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: 'All Employees' },
            { id: 'IMPROVING', label: 'Showing Improvement' },
            { id: 'ATTENTION', label: '⚠️ Needs Attention' },
            { id: 'MASTERED', label: '⭐ Mastered' },
          ].map((tab) => {
            const active = activeStatusTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onStatusTabChange(tab.id)}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: active ? 700 : 500,
                  borderRadius: '6px',
                  border: active ? '1px solid var(--brand-gold, #ca8a04)' : '1px solid var(--border)',
                  background: active ? '#fffbeb' : 'var(--surface)',
                  color: active ? '#b45309' : 'var(--text)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: active ? '0 1px 2px rgba(180, 83, 9, 0.1)' : 'none',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Directorate & Search Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {directorateOptions.length > 0 && (
            <select
              value={selectedDirectorate}
              onChange={(e) => onDirectorateChange(e.target.value)}
              className="apid-input"
              style={{
                fontSize: '0.8rem',
                padding: '0.4rem 0.75rem',
                minWidth: 170,
                height: 'auto',
                background: 'var(--surface)',
              }}
            >
              <option value="ALL">All Bank Directorates</option>
              {directorateOptions.map((dir) => (
                <option key={dir} value={dir}>
                  {dir}
                </option>
              ))}
            </select>
          )}

          <div style={{ position: 'relative', minWidth: 220 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '0.65rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search talent or coach..."
              className="apid-input"
              style={{
                fontSize: '0.8rem',
                paddingLeft: '2rem',
                paddingTop: '0.4rem',
                paddingBottom: '0.4rem',
                height: 'auto',
                width: '100%',
                background: 'var(--surface)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="apid-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
        <table className="apid-table">
          <thead>
            <tr>
              <th style={{ width: '22%' }}>Employee</th>
              <th style={{ width: '13%' }}>Starting Score</th>
              <th style={{ width: '23%' }}>Primary Focus Gap</th>
              <th style={{ width: '15%' }}>Coach</th>
              <th style={{ width: '13%' }}>Sessions (Done/Target)</th>
              <th style={{ width: '14%' }}>Competency Trajectory</th>
              <th style={{ width: '10%', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2, 3, 4].map((i) => (
                <tr key={i}>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--muted)' }}>
                    Loading coaching progress data...
                  </td>
                </tr>
              ))
            ) : talents.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--muted)' }}>
                  <Award size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text)' }}>
                    No coached employees match the selected criteria.
                  </div>
                  <div style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>
                    Try switching filter tabs or clearing your search query.
                  </div>
                </td>
              </tr>
            ) : (
              talents.map((t) => (
                <tr
                  key={t.assignmentId}
                  style={{
                    background: t.attentionRequired ? 'rgba(239, 68, 68, 0.03)' : undefined,
                  }}
                >
                  {/* 1. Employee */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <strong style={{ color: 'var(--text)' }}>{t.coacheeName}</strong>
                      {t.attentionRequired && (
                        <span
                          style={{
                            display: 'inline-block',
                            width: 7,
                            height: 7,
                            borderRadius: '999px',
                            background: 'var(--err)',
                          }}
                          title={t.attentionReason || 'Needs Attention'}
                        />
                      )}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                      {t.coacheeStaffId} • {t.department}
                    </div>
                  </td>

                  {/* 2. Starting Rating */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <strong style={{ fontSize: '0.92rem', color: 'var(--text)' }}>
                        {Number(t.startingRating).toFixed(2)}
                      </strong>
                      {t.ratingBand === 'CRITICAL' ? (
                        <span className="boa-pill boa-pill-err" style={{ fontSize: '0.68rem', padding: '0.1rem 0.45rem' }}>
                          Critical
                        </span>
                      ) : (
                        <span className="boa-pill boa-pill-warn" style={{ fontSize: '0.68rem', padding: '0.1rem 0.45rem' }}>
                          Moderate
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 3. Primary Focus Gap */}
                  <td>
                    <div
                      style={{
                        fontWeight: 500,
                        color: 'var(--text)',
                        maxWidth: 240,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={t.targetWeaknessKpi}
                    >
                      {t.targetWeaknessKpi}
                    </div>
                  </td>

                  {/* 4. Coach */}
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {t.coachName}
                    </div>
                  </td>

                  {/* 5. Sessions Done/Target */}
                  <td>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: 'var(--text)',
                        marginBottom: '0.25rem',
                      }}
                    >
                      <span>{t.completedSessions} of {t.approvedTarget}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                        ({t.deliveryPercentage}%)
                      </span>
                    </div>
                    <div
                      style={{
                        width: '100px',
                        height: '5px',
                        background: 'var(--border)',
                        borderRadius: '999px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, t.deliveryPercentage)}%`,
                          height: '100%',
                          background: t.deliveryPercentage >= 100 ? 'var(--ok)' : 'var(--info)',
                          borderRadius: '999px',
                        }}
                      />
                    </div>
                  </td>

                  {/* 6. Competency Status */}
                  <td>
                    {getTrajectoryBadge(t.progressTrajectory)}
                  </td>

                  {/* 7. Action Button */}
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => onSelectTalent(t.assignmentId)}
                      className="apid-btn apid-btn-outline apid-btn-sm"
                      style={{
                        padding: '0.3rem 0.65rem',
                        fontSize: '0.75rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <Eye size={13} style={{ color: 'var(--brand-gold, #ca8a04)' }} />
                      <span>View Dossier</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div
        style={{
          padding: '0.75rem 1.15rem',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.78rem',
          color: 'var(--muted)',
          background: 'var(--surface-subtle)',
        }}
      >
        <span>
          Showing <strong>{talents.length}</strong> active remediation talent records
        </span>
        <span>
          Click &quot;View Dossier&quot; to inspect session minutes, coach notes, and coachee practice submissions.
        </span>
      </div>
    </div>
  );
};
