import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function SlideOverDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="boa-drawer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div className="boa-drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="boa-drawer-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{title}</h3>
            {subtitle && (
              <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            className="apid-btn apid-btn-outline apid-btn-sm"
            aria-label="Close drawer"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="boa-drawer-body">{children}</div>
      </div>
    </div>
  );
}

