import React, { useState } from 'react';
import { X, Calendar, Clock, AlertCircle } from 'lucide-react';
import { CoachingSessionItem, coachingSessionApi } from '../api/coachingSessionApi';

interface RescheduleModalProps {
  session: CoachingSessionItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  session,
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!isOpen || !session) return null;

  const [proposedStartTime, setProposedStartTime] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposedStartTime) {
      setError('Please select a new proposed start time.');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason for the reschedule proposal.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Convert datetime-local string to ISO format with local timezone offset
      const localDate = new Date(proposedStartTime);
      const isoString = localDate.toISOString();

      await coachingSessionApi.proposeReschedule(session.id, {
        proposedStartTime: isoString,
        reason: reason.trim(),
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to propose reschedule.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="apid-card"
        style={{
          width: '100%',
          maxWidth: '520px',
          margin: 0,
          background: 'var(--surface, #ffffff)',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '1.15rem',
                fontWeight: 700,
                margin: 0,
                color: 'var(--text-primary, #0f172a)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <Calendar size={18} style={{ color: 'var(--brand-gold, #ca8a04)' }} />
              Propose New Session Time
            </h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--muted, #64748b)' }}>
              Currently scheduled: {new Date(session.scheduledStartTime).toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="apid-btn apid-btn-outline"
            style={{ padding: '0.35rem', border: 'none', background: 'transparent' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {error && (
            <div
              className="apid-alert apid-alert-err"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.85rem' }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.86rem',
                fontWeight: 600,
                marginBottom: '0.35rem',
              }}
            >
              <Clock size={15} />
              New Proposed Date & Time <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="datetime-local"
              required
              value={proposedStartTime}
              onChange={(e) => setProposedStartTime(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border, #cbd5e1)',
                fontSize: '0.88rem',
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.86rem',
                fontWeight: 600,
                marginBottom: '0.35rem',
              }}
            >
              Reason for Reschedule <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Conflict with urgent branch audit; requesting to move to afternoon slot..."
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border, #cbd5e1)',
                fontSize: '0.88rem',
              }}
            />
          </div>

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              marginTop: '0.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border, #e2e8f0)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="apid-btn apid-btn-outline"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="apid-btn apid-btn-primary"
              disabled={loading}
              style={{
                backgroundColor: 'var(--brand-gold, #ca8a04)',
                borderColor: 'var(--brand-gold, #ca8a04)',
                color: '#fff',
              }}
            >
              {loading ? 'Submitting...' : 'Submit Reschedule Proposal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

