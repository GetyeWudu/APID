import type { ReactNode } from 'react';
import { DataSourceBadge, type DataProvenance } from './DataSourceBadge';

export function PageHeader({
  title,
  subtitle,
  source,
  phaseLabel,
  actions,
}: {
  title: string;
  subtitle?: string;
  source?: DataProvenance;
  phaseLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="boa-page-header">
      <div>
        <div className="boa-page-title-row">
          <h1>{title}</h1>
          {source && <DataSourceBadge source={source} phaseLabel={phaseLabel} />}
        </div>
        {subtitle && <p className="boa-page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="boa-page-actions">{actions}</div>}
    </div>
  );
}

