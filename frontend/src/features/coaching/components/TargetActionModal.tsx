import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusCircle, Award, X, AlertTriangle } from 'lucide-react';
import { coachingGovernanceApi, CoachingSessionTargetItem } from '../api/coachingSessionApi';

interface TargetActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: CoachingSessionTargetItem;
  mode: 'EXTENSION' | 'EARLY_COMPLETION';
}

export const TargetActionModal: React.FC<TargetActionModalProps> = ({
  isOpen,
  onClose,
  target,
  mode,
}) => {
  const queryClient = useQueryClient();

  const [additionalSessions, setAdditionalSessions] = useState<number>(2);
  const [reason, setReason] = useState('');
  const [objectivesSummary, setObjectivesSummary] = useState('');
  const [error, setError] = useState<string | null>(null);

  const extensionMutation = useMutation({
    mutationFn: () =>
      coachingGovernanceApi.requestExtension(target.id, {
        additionalSessions,
        reason: reason.trim(),
        remainingObjectivesSummary: objectivesSummary.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching-target'] });
      queryClient.invalidateQueries({ queryKey: ['coaching-sessions'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to submit extension request.');
    },
  });

  const earlyCompletionMutation = useMutation({
    mutationFn: () =>
      coachingGovernanceApi.requestEarlyCompletion(target.id, {
        reason: reason.trim(),
        masteryEvidenceSummary: objectivesSummary.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching-target'] });
      queryClient.invalidateQueries({ queryKey: ['coaching-sessions'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to submit early completion request.');
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (reason.trim().length < 5) {
      setError('Please provide a descriptive reason of at least 5 characters.');
      return;
    }

    if (mode === 'EXTENSION') {
      extensionMutation.mutate();
    } else {
      earlyCompletionMutation.mutate();
    }
  };

  const isPending = extensionMutation.isPending || earlyCompletionMutation.isPending;

  return (
    <div
      className="apid-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 1060,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="apid-card"
        style={{
          width: '100%',
          maxWidth: 540,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
          borderRadius: '10px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '1.25rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {mode === 'EXTENSION' ? (
              <PlusCircle size={22} color="var(--gold-primary)" />
            ) : (
              <Award size={22} color="var(--success)" />
            )}
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text)' }}>
                {mode === 'EXTENSION' ? 'Request Additional Coaching Sessions' : 'Mark Objectives Achieved Early'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {mode === 'EXTENSION'
                  ? `Current approved target: ${target.approvedTarget} sessions (${target.completedSessions} completed)`
                  : `Target: ${target.approvedTarget} sessions (${target.completedSessions} completed)`}
              </p>
            </div>
          </div>
          <button type="button" className="apid-btn apid-btn-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.25rem' }}>
          {error && (
            <div className="apid-alert apid-alert-err" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {mode === 'EXTENSION' ? (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                Additional Sessions Needed
              </label>
              <select
                className="apid-input"
                value={additionalSessions}
                onChange={(e) => setAdditionalSessions(Number(e.target.value))}
              >
                <option value={1}>+1 Additional Session (Revised Target: {target.approvedTarget + 1})</option>
                <option value={2}>+2 Additional Sessions (Revised Target: {target.approvedTarget + 2})</option>
                <option value={3}>+3 Additional Sessions (Revised Target: {target.approvedTarget + 3})</option>
                <option value={4}>+4 Additional Sessions (Revised Target: {target.approvedTarget + 4})</option>
              </select>
            </div>
          ) : (
            <div
              style={{
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                borderRadius: '6px',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                color: 'var(--text)',
              }}
            >
              <strong>Early Graduation:</strong> Remaining future planned meetings will be cleanly cancelled.
              The system retains all {target.completedSessions} completed sessions with their verified assessment scores.
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              {mode === 'EXTENSION' ? 'Reason for Additional Coaching' : 'Evidence of Goal Mastery'}
            </label>
            <textarea
              className="apid-input"
              rows={3}
              placeholder={
                mode === 'EXTENSION'
                  ? 'Explain why extra sessions are required to resolve remaining performance gaps...'
                  : 'Document how the talent demonstrated full competence in the development objectives...'
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              {mode === 'EXTENSION' ? 'Specific Remaining Objectives' : 'Final Notes / Next Steps'}
            </label>
            <input
              type="text"
              className="apid-input"
              placeholder={
                mode === 'EXTENSION'
                  ? 'e.g. Swift MT700 amendment checklist validation'
                  : 'e.g. Talent authorized for independent branch transaction processing'
              }
              value={objectivesSummary}
              onChange={(e) => setObjectivesSummary(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <button type="button" className="apid-btn apid-btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className={`apid-btn ${mode === 'EXTENSION' ? 'apid-btn-primary' : 'apid-btn-success'}`}
              disabled={isPending}
            >
              {isPending
                ? 'Submitting...'
                : mode === 'EXTENSION'
                ? 'Request Extension'
                : 'Confirm Early Completion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

