import React, { useState } from 'react';
import { AlertCircle, Calendar, X } from 'lucide-react';

interface DeclineInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionTitle: string;
  onConfirmDecline: (reason: string) => Promise<void>;
  onRequestReschedule?: () => void;
}

export const DeclineInvitationModal: React.FC<DeclineInvitationModalProps> = ({
  isOpen,
  onClose,
  sessionTitle,
  onConfirmDecline,
  onRequestReschedule,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 5) {
      setError('Please provide a short explanation (at least 5 characters).');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirmDecline(reason.trim());
      setReason('');
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to record response. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
    >
      <div
        className="apid-card"
        style={{
          width: '100%',
          maxWidth: '480px',
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e2e8f0',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(255, 255, 255, 1) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertCircle size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                Unable to Attend Session
              </h3>
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748b' }}>
                Session: {sessionTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '0.25rem',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem' }}>
          {error && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.65rem 0.85rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                fontSize: '0.8rem',
                color: '#b91c1c',
              }}
            >
              {error}
            </div>
          )}

          <p style={{ margin: '0 0 1rem 0', fontSize: '0.86rem', color: '#475569', lineHeight: 1.5 }}>
            Please let your coach know why you cannot make this session so you can plan the next step together.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#1e293b',
                marginBottom: '0.4rem',
              }}
            >
              Reason for not attending <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              rows={3}
              className="apid-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., I have an urgent client escalation during this time slot..."
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.86rem',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
              required
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.74rem',
                color: '#64748b',
                marginTop: '0.25rem',
              }}
            >
              <span>Minimum 5 characters</span>
              <span>{reason.trim().length} chars</span>
            </div>
          </div>

          {/* Shortcut to Reschedule */}
          {onRequestReschedule && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 0.9rem',
                background: 'rgba(202, 138, 4, 0.08)',
                border: '1px solid rgba(202, 138, 4, 0.25)',
                borderRadius: '8px',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={16} style={{ color: 'var(--brand-gold, #ca8a04)' }} />
                <span style={{ fontSize: '0.8rem', color: '#1e293b' }}>
                  Need a different time instead?
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequestReschedule();
                }}
                className="apid-btn apid-btn-outline"
                style={{
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.78rem',
                  borderColor: 'var(--brand-gold, #ca8a04)',
                  color: 'var(--brand-gold, #ca8a04)',
                  fontWeight: 600,
                }}
              >
                Request New Time
              </button>
            </div>
          )}

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid #f1f5f9',
            }}
          >
            <button
              type="button"
              className="apid-btn apid-btn-outline"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ padding: '0.45rem 1rem', fontSize: '0.84rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="apid-btn"
              disabled={isSubmitting || reason.trim().length < 5}
              style={{
                padding: '0.45rem 1.1rem',
                fontSize: '0.84rem',
                fontWeight: 600,
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: reason.trim().length < 5 ? 'not-allowed' : 'pointer',
                opacity: reason.trim().length < 5 ? 0.6 : 1,
              }}
            >
              {isSubmitting ? 'Sending...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
