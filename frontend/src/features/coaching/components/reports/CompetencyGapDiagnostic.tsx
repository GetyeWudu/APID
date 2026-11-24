import React from 'react';
import { Target } from 'lucide-react';
import type { DistrictBranchAnalytics } from '../../api/pmsReportApi';

interface CompetencyGapDiagnosticProps {
  analytics: DistrictBranchAnalytics | null;
}

export const CompetencyGapDiagnostic: React.FC<CompetencyGapDiagnosticProps> = ({ analytics }) => {
  if (!analytics) return null;

  // Aggregate competency focus gaps from branches
  const gapCounts: Record<string, number> = {};
  for (const d of analytics.districts) {
    for (const b of d.branches) {
      if (b.coacheesCount > 0) {
        const gap = b.primarySkillGap || 'Branch FX & Deposit Mobilization';
        gapCounts[gap] = (gapCounts[gap] || 0) + b.coacheesCount;
      }
    }
  }

  const gapEntries = Object.entries(gapCounts).map(([name, count]) => ({
    name,
    count,
    percentage:
      analytics.totalCoachingAssignments > 0
        ? Math.round((count / analytics.totalCoachingAssignments) * 100)
        : 0,
  }));

  gapEntries.sort((a, b) => b.count - a.count);

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '1.25rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
      className="dark:bg-slate-900 dark:border-slate-800"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
        <div
          style={{
            padding: '0.4rem',
            borderRadius: '8px',
            backgroundColor: 'rgba(202, 138, 4, 0.12)',
            color: '#b45309',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Target size={16} />
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }} className="dark:text-white">
            Organizational Competency &amp; Skill Gap Diagnostic
          </h4>
          <p style={{ margin: '0.1rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
            Primary performance evaluation deficiencies triggering mandatory coaching remediation.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {gapEntries.map((item, idx) => (
          <div key={`gap-${idx}`}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
              <span style={{ fontWeight: 600, color: '#1e293b' }} className="dark:text-slate-200">
                {item.name}
              </span>
              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                <strong style={{ color: '#0f172a' }} className="dark:text-white">{item.count}</strong> coachees ({item.percentage}%)
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: '7px',
                backgroundColor: '#f1f5f9',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
              className="dark:bg-slate-800"
            >
              <div
                style={{
                  width: `${item.percentage}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #ca8a04 0%, #f59e0b 100%)',
                  borderRadius: '4px',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
