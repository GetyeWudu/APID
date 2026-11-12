import type { ReactNode } from 'react';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  extraContent,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  extraContent?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="apid-modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="apid-card apid-modal">
        <h3 style={{ marginTop: 0, marginBottom: '0.45rem' }}>{title}</h3>
        <p style={{ marginBottom: '1rem' }}>{message}</p>
        {extraContent}
        <div className="apid-modal-actions">
          <button type="button" className="apid-btn apid-btn-outline" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`apid-btn ${danger ? 'apid-btn-danger' : 'apid-btn-primary'}`}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

