import { useState, type FC, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, UserCheck, ShieldAlert, XCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { organizationApi } from '../../admin/organization/api/organizationApi';
import { pmsReferralApi, type PmsReferralCaseDto, type ResolveReferralPayload } from '../api/pmsReferralApi';

interface ResolveReferralModalProps {
  referral: PmsReferralCaseDto;
  onClose: () => void;
  onSuccess: () => void;
}

export const ResolveReferralModal: FC<ResolveReferralModalProps> = ({
  referral,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [resolutionType, setResolutionType] = useState<'REASSIGN_COACH' | 'HR_PIP' | 'DISMISSED'>('REASSIGN_COACH');
  const [newCoachEmployeeId, setNewCoachEmployeeId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch available coach candidates
  const { data: employeesData, isLoading: loadingEmployees } = useQuery({
    queryKey: ['core', 'active-employees-for-coach'],
    queryFn: () => organizationApi.searchEmployees({ status: 'ACTIVE', size: 100 }),
    staleTime: 5 * 60_000,
  });

  const coachCandidates = (employeesData?.content ?? []).filter(
    (e) => e.id !== referral.coacheeEmployeeId && e.id !== referral.currentCoachEmployeeId
  );

  const resolveMutation = useMutation({
    mutationFn: (payload: ResolveReferralPayload) =>
      pmsReferralApi.resolveReferral(referral.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching', 'pms-referrals'] });
      queryClient.invalidateQueries({ queryKey: ['coaching', 'assignments'] });
      onSuccess();
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Failed to resolve referral.');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (notes.trim().length < 5) {
      setErrorMsg('Please provide comprehensive administrative notes (at least 5 characters).');
      return;
    }

    if (resolutionType === 'REASSIGN_COACH' && !newCoachEmployeeId) {
      setErrorMsg('Please select a replacement coach from the list.');
      return;
    }

    resolveMutation.mutate({
      resolutionType,
      newCoachEmployeeId: resolutionType === 'REASSIGN_COACH' ? Number(newCoachEmployeeId) : null,
      notes: notes.trim(),
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1.25rem',
      }}
      onClick={onClose}
    >
      <div
        className="apid-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '92vh',
          overflowY: 'auto',
          margin: 0,
          background: 'var(--surface, #ffffff)',
          borderRadius: '14px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border, #e2e8f0)',
          padding: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.15rem 1.4rem',
            borderBottom: '1px solid #e2e8f0',
            background: 'linear-gradient(135deg, rgba(201, 122, 0, 0.08) 0%, #ffffff 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '8px',
                background: 'rgba(201, 122, 0, 0.15)',
                color: '#c97a00',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                Resolve Low-Performer Referral
              </h3>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Case #{referral.id} • {referral.coacheeFullName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              color: '#64748b',
              cursor: 'pointer',
              padding: '0.2rem 0.5rem',
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {errorMsg && (
            <div
              style={{
                padding: '0.7rem 0.9rem',
                background: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#b91c1c',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Coachee Summary Box */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '0.9rem 1.1rem',
              fontSize: '0.82rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Coachee:</span>
              <strong style={{ color: '#0f172a' }}>{referral.coacheeFullName} ({referral.coacheeEmployeeNumber})</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Department / Role:</span>
              <span style={{ color: '#334155' }}>{referral.coacheeDepartment || 'Branch Operations'} • {referral.coacheeJobTitle || 'Staff'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Current Coach:</span>
              <strong style={{ color: '#c97a00' }}>{referral.currentCoachFullName || 'None'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Consecutive Low Quarters (&lt; 3.0):</span>
              <span
                style={{
                  background: '#fee2e2',
                  color: '#b91c1c',
                  border: '1px solid #fecaca',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                }}
              >
                {referral.consecutiveLowQuartersCount} Quarters
              </span>
            </div>
          </div>

          {/* Action Selection Cards */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '0.5rem' }}>
              Resolution Action <span style={{ color: '#b91c1c' }}>*</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => setResolutionType('REASSIGN_COACH')}
                style={{
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: resolutionType === 'REASSIGN_COACH' ? '2px solid #c97a00' : '1px solid #e2e8f0',
                  background: resolutionType === 'REASSIGN_COACH' ? 'rgba(201, 122, 0, 0.08)' : '#ffffff',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#c97a00', fontSize: '0.82rem', fontWeight: 700 }}>
                  <UserCheck size={14} /> Reassign Coach
                </div>
                <span style={{ fontSize: '0.74rem', color: '#64748b', lineHeight: 1.3 }}>
                  Transfer to a new coach
                </span>
              </button>

              <button
                type="button"
                onClick={() => setResolutionType('HR_PIP')}
                style={{
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: resolutionType === 'HR_PIP' ? '2px solid #b91c1c' : '1px solid #e2e8f0',
                  background: resolutionType === 'HR_PIP' ? '#fee2e2' : '#ffffff',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#b91c1c', fontSize: '0.82rem', fontWeight: 700 }}>
                  <ShieldAlert size={14} /> Escalate to HR
                </div>
                <span style={{ fontSize: '0.74rem', color: '#64748b', lineHeight: 1.3 }}>
                  Initiate formal PIP review
                </span>
              </button>

              <button
                type="button"
                onClick={() => setResolutionType('DISMISSED')}
                style={{
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: resolutionType === 'DISMISSED' ? '2px solid #475569' : '1px solid #e2e8f0',
                  background: resolutionType === 'DISMISSED' ? '#f1f5f9' : '#ffffff',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#475569', fontSize: '0.82rem', fontWeight: 700 }}>
                  <XCircle size={14} /> Dismiss Case
                </div>
                <span style={{ fontSize: '0.74rem', color: '#64748b', lineHeight: 1.3 }}>
                  Maintain current coach
                </span>
              </button>
            </div>
          </div>

          {/* New Coach Dropdown */}
          {resolutionType === 'REASSIGN_COACH' && (
            <div className="apid-field" style={{ margin: 0 }}>
              <label htmlFor="new-coach-select" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>
                Designated Replacement Coach <span style={{ color: '#b91c1c' }}>*</span>
              </label>
              <select
                id="new-coach-select"
                className="apid-input"
                value={newCoachEmployeeId}
                onChange={(e) => setNewCoachEmployeeId(e.target.value ? Number(e.target.value) : '')}
                disabled={loadingEmployees}
                style={{ fontSize: '0.84rem' }}
              >
                <option value="">-- Select Coach Candidate ({coachCandidates.length} Available) --</option>
                {coachCandidates.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.fullName} ({coach.employeeNumber}) • {coach.departmentName || 'Operations'}
                  </option>
                ))}
              </select>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                All participants (coachee, previous coach, and replacement coach) will receive automated in-app &amp; email notifications.
              </p>
            </div>
          )}

          {/* Rationale & Notes */}
          <div className="apid-field" style={{ margin: 0 }}>
            <label htmlFor="referral-notes" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>
              Resolution Rationale &amp; Case Notes <span style={{ color: '#b91c1c' }}>*</span>
            </label>
            <textarea
              id="referral-notes"
              className="apid-input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detail reasons for this decision (e.g. style misalignment, technical skill gap, or administrative exception)..."
              style={{ fontSize: '0.84rem', resize: 'vertical' }}
            />
          </div>

          {/* Footer Controls */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.65rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid #e2e8f0',
            }}
          >
            <button
              type="button"
              className="apid-btn apid-btn-outline"
              onClick={onClose}
              disabled={resolveMutation.isPending}
              style={{ padding: '0.5rem 1rem', fontSize: '0.84rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="apid-btn apid-btn-primary"
              disabled={resolveMutation.isPending}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.5rem 1.15rem',
                fontSize: '0.84rem',
                fontWeight: 600,
              }}
            >
              {resolveMutation.isPending ? (
                <>
                  <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  Resolving Case...
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  Confirm &amp; Apply Action
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
