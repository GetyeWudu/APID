import type { ReactNode } from 'react';
import { FolderOpen } from 'lucide-react';

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="boa-empty">
      <div style={{ color: 'var(--muted-soft)', display: 'inline-flex' }}>
        {icon ?? <FolderOpen size={30} />}
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

