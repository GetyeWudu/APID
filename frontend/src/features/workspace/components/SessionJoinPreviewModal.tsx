import { Video } from 'lucide-react';
import { DataSourceBadge } from '../../../shared/components/ui';

export function SessionJoinPreviewModal({
  open,
  sessionTitle,
  scheduledTime,
  onClose,
}: {
  open: boolean;
  sessionTitle: string;
  scheduledTime: string;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="apid-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Simulated Video Session"
    >
      <div className="apid-card apid-modal">
        <div className="boa-card-header" style={{ marginBottom: '0.65rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Video size={18} /> Session Room
          </h3>
          <DataSourceBadge source="preview" />
        </div>

        <p style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{sessionTitle}</p>
        <p className="boa-muted" style={{ fontSize: '0.84rem', marginTop: 0 }}>
          Scheduled: {scheduledTime}
        </p>

        <div className="apid-alert apid-alert-info" style={{ fontSize: '0.82rem' }}>
          <strong>Preview Room:</strong> Live video meetings and automatic attendance tracking will connect when session rooms are enabled.
        </div>

        <div className="apid-modal-actions">
          <button type="button" className="apid-btn apid-btn-primary" onClick={onClose}>
            Close Room Preview
          </button>
        </div>
      </div>
    </div>
  );
}

