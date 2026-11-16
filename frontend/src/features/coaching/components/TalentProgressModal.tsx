import React, { useState, useEffect } from 'react';
import { Award, CheckCircle2, X } from 'lucide-react';

interface TalentProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionTitle: string;
  existingNotes?: string;
  onSubmitProgress: (notes: string) => Promise<void>;
}

export const TalentProgressModal: React.FC<TalentProgressModalProps> = ({
  isOpen,
  onClose,
  sessionTitle,
  existingNotes = '',
  onSubmitProgress,
}) => {
  const [notes, setNotes] = useState(existingNotes);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNotes(existingNotes || '');
  }, [existingNotes, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (notes.trim().length < 5) {
      setError('Please provide at least a few words describing your progress (minimum 5 characters).');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmitProgress(notes.trim());
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to submit progress update. Please try again.');
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
          maxWidth: '520px',
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
            background: 'linear-gradient(135deg, rgba(202, 138, 4, 0.06) 0%, rgba(255, 255, 255, 1) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'rgba(202, 138, 4, 0.12)',
                color: 'var(--brand-gold, #ca8a04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Award size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                My Progress & Action Update
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

          <div
            style={{
              padding: '0.75rem 0.9rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              marginBottom: '1.2rem',
              fontSize: '0.82rem',
              color: '#475569',
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem' }}>
              💡 What should you include?
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <li>What action steps or homework did you complete?</li>
              <li>Did you face any obstacles or need further support from your coach?</li>
            </ul>
          </div>

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
              Your Progress Notes <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              rows={4}
              className="apid-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., I reviewed 15 Trade Finance LC checklists this week and reduced error turnaround to 10 minutes..."
              style={{
                width: '100%',
                padding: '0.65rem 0.75rem',
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
              <span>Keep your coach informed</span>
              <span>{notes.trim().length} chars</span>
            </div>
          </div>

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
              className="apid-btn apid-btn-primary"
              disabled={isSubmitting || notes.trim().length < 5}
              style={{
                padding: '0.45rem 1.15rem',
                fontSize: '0.84rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: notes.trim().length < 5 ? 'not-allowed' : 'pointer',
                opacity: notes.trim().length < 5 ? 0.6 : 1,
              }}
            >
              <CheckCircle2 size={16} />
              {isSubmitting ? 'Saving...' : 'Save Progress Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
