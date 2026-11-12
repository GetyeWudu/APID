import type { ReactNode } from 'react';

export function FilterBar({
  left,
  right,
}: {
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="apid-toolbar">
      <div className="apid-toolbar-left">{left}</div>
      {right && <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>{right}</div>}
    </div>
  );
}

