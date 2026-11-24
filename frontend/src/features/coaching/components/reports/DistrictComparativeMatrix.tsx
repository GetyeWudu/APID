import React, { useState } from 'react';
import { Building, MapPin, ChevronDown, ChevronRight, ArrowUpRight, Download, Loader2 } from 'lucide-react';
import { pmsReportApi, type DistrictBranchAnalytics, DistrictAnalytics, BranchAnalytics } from '../../api/pmsReportApi';

interface DistrictComparativeMatrixProps {
  analytics: DistrictBranchAnalytics | null;
  loading: boolean;
  selectedDistrict: string;
  onSelectDistrict: (district: string) => void;
  onSelectBranch?: (district: string, branch: string) => void;
}

export const DistrictComparativeMatrix: React.FC<DistrictComparativeMatrixProps> = ({
  analytics,
  loading,
  selectedDistrict,
  onSelectDistrict,
  onSelectBranch,
}) => {
  const [expandedDistricts, setExpandedDistricts] = useState<Record<string, boolean>>({
    'Central District': true,
    'Central': true,
  });
  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      await pmsReportApi.downloadDistrictExcel(2, selectedDistrict);
    } catch (err) {
      console.error('Failed to export district Excel scorecard', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          padding: '2.5rem',
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: '0.85rem',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
        }}
        className="dark:bg-slate-900 dark:border-slate-800"
      >
        Loading Bank of Abyssinia regional performance grid...
      </div>
    );
  }

  if (!analytics || !analytics.districts || analytics.districts.length === 0) {
    return null;
  }

  const toggleExpand = (distName: string) => {
    setExpandedDistricts((prev) => ({
      ...prev,
      [distName]: !prev[distName],
    }));
  };

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
      className="dark:bg-slate-900 dark:border-slate-800"
    >
      {/* Header */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          backgroundColor: '#f8fafc',
        }}
        className="dark:bg-slate-800/50 dark:border-slate-800"
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: '0.95rem',
              fontWeight: 800,
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
            className="dark:text-white"
          >
            <Building size={16} style={{ color: '#ca8a04' }} />
            Regional &amp; Branch Comparative Performance Matrix
          </h3>
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
            Multi-tier comparison of staff volume, remediation enrollment, critical risk concentrations, and session completion velocity.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportExcel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#0f172a',
              backgroundColor: isExporting ? '#f3f4f6' : '#ffffff',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '0.3rem 0.65rem',
              cursor: isExporting ? 'not-allowed' : 'pointer',
            }}
            title="Export official Bank of Abyssinia Excel Scorecard"
          >
            {isExporting ? (
              <Loader2 size={13} className="spin" style={{ color: '#16a34a' }} />
            ) : (
              <Download size={13} style={{ color: '#16a34a' }} />
            )}
            <span>{isExporting ? 'Exporting...' : 'Export Excel'}</span>
          </button>

          {selectedDistrict !== 'ALL' && (
            <button
              type="button"
              onClick={() => onSelectDistrict('ALL')}
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#b45309',
                backgroundColor: '#fef08a',
                border: '1px solid #fde047',
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {/* Grid Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
          <thead>
            <tr
              style={{
                backgroundColor: '#f1f5f9',
                borderBottom: '1px solid #e2e8f0',
                color: '#475569',
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
            >
              <th style={{ padding: '0.65rem 1rem' }}>Regional District / Branch</th>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Monitored Staff</th>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>In Remediation</th>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Critical Risk (&lt; 2.0)</th>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Target Sessions</th>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Execution Rate</th>
              <th style={{ padding: '0.65rem 0.75rem' }}>Primary Skill Deficit</th>
              <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {analytics.districts.map((dist: DistrictAnalytics) => {
              const isSelected =
                selectedDistrict.toLowerCase() === dist.districtName.toLowerCase() ||
                dist.districtName.toLowerCase().includes(selectedDistrict.toLowerCase());
              const isExpanded = !!expandedDistricts[dist.districtName];
              const criticalPct =
                dist.coacheesCount > 0
                  ? Math.round((dist.criticalCount / dist.coacheesCount) * 100)
                  : 0;

              return (
                <React.Fragment key={dist.districtName}>
                  {/* District Row */}
                  <tr
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      backgroundColor: isSelected ? 'rgba(202, 138, 4, 0.08)' : '#ffffff',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    className="dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    onClick={() => toggleExpand(dist.districtName)}
                  >
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(dist.districtName);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            color: '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <span style={{ color: '#0f172a', fontWeight: 700 }} className="dark:text-white">
                          {dist.districtName}
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                          }}
                          className="dark:bg-slate-800 dark:text-slate-300"
                        >
                          {dist.branches.length} branches
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '0.75rem', textAlign: 'center', color: '#475569' }} className="dark:text-slate-300">
                      {dist.totalStaff}
                    </td>

                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: '#ca8a04',
                          backgroundColor: 'rgba(202, 138, 4, 0.1)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '999px',
                        }}
                      >
                        {dist.coacheesCount}
                      </span>
                    </td>

                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      {dist.criticalCount > 0 ? (
                        <span
                          style={{
                            fontWeight: 700,
                            color: '#dc2626',
                            backgroundColor: '#fee2e2',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                          }}
                        >
                          {dist.criticalCount} ({criticalPct}%)
                        </span>
                      ) : (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>0 (0%)</span>
                      )}
                    </td>

                    <td style={{ padding: '0.75rem', textAlign: 'center', color: '#475569' }} className="dark:text-slate-300">
                      <strong>{dist.completedSessions}</strong> / {dist.targetSessions}
                    </td>

                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: dist.completionRate > 0 ? '#16a34a' : '#64748b' }}>
                          {dist.completionRate}%
                        </span>
                        <div style={{ width: '60px', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, dist.completionRate)}%`,
                              height: '100%',
                              backgroundColor: dist.completionRate > 0 ? '#10b981' : '#94a3b8',
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '0.75rem', color: '#334155' }} className="dark:text-slate-300">
                      <span style={{ fontSize: '0.76rem' }}>{dist.primarySkillGap || 'Branch FX & Deposit Mobilization'}</span>
                    </td>

                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDistrict(dist.districtName);
                        }}
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#ca8a04',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                        }}
                      >
                        Drill Down <ArrowUpRight size={12} />
                      </button>
                    </td>
                  </tr>

                  {/* Branch Nested Sub-Rows when Expanded */}
                  {isExpanded &&
                    dist.branches.map((br: BranchAnalytics) => (
                      <tr
                        key={br.branchName}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: '#f8fafc',
                          fontSize: '0.76rem',
                        }}
                        className="dark:bg-slate-950/40 dark:border-slate-800"
                      >
                        <td style={{ padding: '0.55rem 1rem 0.55rem 2.5rem', color: '#334155' }} className="dark:text-slate-300">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <MapPin size={11} style={{ color: '#94a3b8' }} />
                            <span>{br.branchName.replace(' Branch Operations', '')}</span>
                          </div>
                        </td>

                        <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', color: '#64748b' }}>
                          {br.totalStaff}
                        </td>

                        <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', fontWeight: 600, color: '#ca8a04' }}>
                          {br.coacheesCount}
                        </td>

                        <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center' }}>
                          {br.criticalCount > 0 ? (
                            <span style={{ color: '#dc2626', fontWeight: 700 }}>
                              {br.criticalCount}
                            </span>
                          ) : (
                            <span style={{ color: '#16a34a' }}>0</span>
                          )}
                        </td>

                        <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', color: '#64748b' }}>
                          {br.completedSessions} / {br.targetSessions}
                        </td>

                        <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', color: '#64748b' }}>
                          {br.completionRate}%
                        </td>

                        <td style={{ padding: '0.55rem 0.75rem', color: '#64748b' }}>
                          {br.primarySkillGap}
                        </td>

                        <td style={{ padding: '0.55rem 1rem', textAlign: 'right' }}>
                          {onSelectBranch && (
                            <button
                              type="button"
                              onClick={() => onSelectBranch(dist.districtName, br.branchName)}
                              style={{
                                fontSize: '0.72rem',
                                color: '#4338ca',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                              }}
                              className="dark:text-indigo-400"
                            >
                              Filter Staff
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
