import type { ReactNode } from 'react';

export type PillTone = 'ok' | 'warn' | 'err' | 'info' | 'neutral';

export function StatusPill({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: PillTone;
  icon?: ReactNode;
}) {
  return (
    <span className={`boa-pill boa-pill-${tone}`}>
      {icon}
      <span>{label}</span>
    </span>
  );
}

