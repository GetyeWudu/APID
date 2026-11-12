export type DataProvenance = 'live' | 'preview';

export function DataSourceBadge({
  source,
  phaseLabel: _phaseLabel,
}: {
  source: DataProvenance;
  phaseLabel?: string;
}) {
  if (source === 'live') {
    return null;
  }

  return (
    <span
      className="boa-source-badge preview"
      title="Sample data shown here is for preview only and is not saved yet."
    >
      <span className="boa-dot" aria-hidden="true" />
      Sample Data
    </span>
  );
}

