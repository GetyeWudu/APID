import React, { useState } from 'react';
import { X, Star, AlertCircle, MessageSquare } from 'lucide-react';
import { CoachingSessionItem, coachingSessionApi } from '../api/coachingSessionApi';

interface SessionFeedbackModalProps {
  session: CoachingSessionItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SessionFeedbackModal: React.FC<SessionFeedbackModalProps> = ({
  session,
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!isOpen || !session) return null;

  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating || rating < 1 || rating > 5) {
      setError('Please provide a rating between 1 and 5 stars.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await coachingSessionApi.submitFeedback(session.id, {
        rating,
        comment: comment.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit feedback.';
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
          maxWidth: '480px',
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
              <Star size={18} style={{ color: 'var(--brand-gold, #ca8a04)' }} />
              Session Experience & Feedback
            </h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--muted, #64748b)' }}>
              Session: <strong>{session.title}</strong>
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
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && (
            <div
              className="apid-alert apid-alert-err"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.85rem' }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Star Rating */}
          <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              How valuable was this coaching session?
            </label>
            <div style={{ display: 'inline-flex', gap: '0.5rem', justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = (hoverRating !== null ? hoverRating : rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    onClick={() => setRating(star)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.2rem',
                    }}
                  >
                    <Star
                      size={28}
                      fill={filled ? '#ca8a04' : 'none'}
                      stroke={filled ? '#ca8a04' : '#cbd5e1'}
                      style={{ transition: 'transform 0.15s ease' }}
                    />
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--muted, #64748b)', fontWeight: 500 }}>
              {rating === 5 && 'Outstanding & Highly Impactful'}
              {rating === 4 && 'Very Helpful'}
              {rating === 3 && 'Good / Met Expectations'}
              {rating === 2 && 'Needs Improvement'}
              {rating === 1 && 'Not Effective'}
            </div>
          </div>

          {/* Comments */}
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
              <MessageSquare size={15} />
              Comments or Specific Takeaways
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share what worked best, coaching techniques that helped, or areas to follow up in future sessions..."
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
              {loading ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

