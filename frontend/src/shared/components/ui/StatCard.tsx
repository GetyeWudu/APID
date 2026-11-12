import type { ReactNode } from 'react';
import { StatusPill, type PillTone } from './StatusPill';

export function StatCard({
  label,
  value,
  subtext,
  badge,
  badgeTone = 'neutral',
  icon,
  sparkline,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  badge?: string;
  badgeTone?: PillTone;
  icon?: ReactNode;
  sparkline?: ReactNode;
}) {
  return (
    <div className="boa-stat-card">
      <div className="boa-stat-top">
        <span className="boa-stat-label">{label}</span>
        {icon && <span className="boa-stat-icon">{icon}</span>}
      </div>
      <div className="boa-stat-value-row">
        <span className="boa-stat-value">{value}</span>
        {sparkline}
      </div>
      {(subtext || badge) && (
        <div className="boa-stat-meta">
          <span>{subtext}</span>
          {badge && <StatusPill label={badge} tone={badgeTone} />}
        </div>
      )}
    </div>
  );
}

