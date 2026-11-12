import { AlertTriangle } from 'lucide-react';

export function ErrorState({
  title = 'Unable to load data',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="apid-alert apid-alert-err" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <AlertTriangle size={18} />
        <div>
          <strong>{title}</strong>
          <div style={{ fontSize: '0.84rem', marginTop: '0.1rem' }}>{message}</div>
        </div>
      </div>
      {onRetry && (
        <button type="button" className="apid-btn apid-btn-outline apid-btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

