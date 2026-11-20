import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
  XCircle,
  FileText,
  Sparkles,
} from 'lucide-react';
import { pmsReferralApi, type PmsReferralCaseDto, type QuarterScoreItem } from '../api/pmsReferralApi';
import { ResolveReferralModal } from './ResolveReferralModal';

export function PmsReferralsTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('PENDING_ADMIN_ACTION');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReferral, setSelectedReferral] = useState<PmsReferralCaseDto | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const { data: referrals = [], isLoading, refetch } = useQuery({
    queryKey: ['coaching', 'pms-referrals', statusFilter],
    queryFn: () => pmsReferralApi.getReferrals(statusFilter),
  });

  const scanMutation = useMutation({
    mutationFn: () => pmsReferralApi.scanReferrals(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['coaching', 'pms-referrals'] });
      setScanMessage(
        res.newReferralsGenerated > 0
          ? `Scan complete: Detected and created ${res.newReferralsGenerated} new low-performer referral cases.`
          : 'Scan complete: No new persistent low-performer cases detected.'
      );
      setTimeout(() => setScanMessage(null), 6000);
    },
  });

  const filteredReferrals = referrals.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.coacheeFullName.toLowerCase().includes(q) ||
      r.coacheeEmployeeNumber.toLowerCase().includes(q) ||
      (r.currentCoachFullName && r.currentCoachFullName.toLowerCase().includes(q)) ||
      (r.coacheeDepartment && r.coacheeDepartment.toLowerCase().includes(q))
    );
  });

  const parseScores = (jsonStr: string): QuarterScoreItem[] => {
    try {
      return JSON.parse(jsonStr) || [];
    } catch {
      return [];
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ────────────────── BANNER CARD ────────────────── */}
      <div
        className="apid-card"
        style={{
          background: 'linear-gradient(135deg, rgba(201, 122, 0, 0.08) 0%, #ffffff 100%)',
          border: '1px solid rgba(201, 122, 0, 0.3)',
          borderRadius: '12px',
          padding: '1.25rem 1.5rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '10px',
                background: 'rgba(201, 122, 0, 0.15)',
                color: 'var(--brand-primary, #c97a00)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ShieldAlert size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Persistent Low-Performer Escalations &amp; Referrals
                </h2>
                <span
                  style={{
                    background: '#fef3c7',
                    color: '#b45309',
                    border: '1px solid #fde68a',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                  }}
                >
                  Bank Policy &lt; 3.0
                </span>
              </div>
              <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.85rem', color: '#475569', lineHeight: 1.45 }}>
                Coachees scoring below 3.0 across 2 or more consecutive quarters despite mandatory coaching are flagged for
                PMS Admin intervention, reassignment to a new designated coach, or formal HR Performance Improvement Plan (PIP).
              </p>
            </div>
          </div>

          <div>
            <button
              type="button"
              className="apid-btn apid-btn-primary"
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.6rem 1.1rem',
                fontSize: '0.86rem',
                fontWeight: 600,
                boxShadow: '0 2px 4px rgba(201, 122, 0, 0.25)',
              }}
            >
              <RefreshCw size={15} style={{ animation: scanMutation.isPending ? 'spin 1s linear infinite' : 'none' }} />
              {scanMutation.isPending ? 'Scanning Records...' : 'Scan & Detect Referrals'}
            </button>
          </div>
        </div>

        {scanMessage && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.65rem 0.9rem',
              background: '#fef3c7',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              color: '#92400e',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Sparkles size={16} color="#d97706" />
            <span>{scanMessage}</span>
          </div>
        )}
      </div>

      {/* ────────────────── FILTERS BAR ────────────────── */}
      <div
        className="apid-card"
        style={{
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          borderRadius: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Filter size={15} color="#64748b" />
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b', marginRight: '0.25rem' }}>Status:</span>
          {[
            { id: 'PENDING_ADMIN_ACTION', label: 'Pending Action' },
            { id: 'REASSIGNED', label: 'Reassigned' },
            { id: 'HR_ACTION_TAKEN', label: 'HR PIP' },
            { id: 'DISMISSED', label: 'Dismissed' },
            { id: 'ALL', label: 'All Cases' },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  padding: '0.35rem 0.8rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: isActive ? 700 : 500,
                  border: isActive ? '1px solid #c97a00' : '1px solid #e2e8f0',
                  background: isActive ? '#fef3c7' : '#ffffff',
                  color: isActive ? '#92400e' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div style={{ position: 'relative', minWidth: 260 }}>
          <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="apid-input"
            placeholder="Search coachee, coach, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.1rem', fontSize: '0.82rem', margin: 0, width: '100%' }}
          />
        </div>
      </div>

      {/* ────────────────── REFERRAL CARDS ────────────────── */}
      {isLoading ? (
        <div className="apid-card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
          <RefreshCw size={24} color="#c97a00" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.5rem' }} />
          Loading referral cases...
        </div>
      ) : filteredReferrals.length === 0 ? (
        <div
          className="apid-card"
          style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            border: '2px dashed #cbd5e1',
            borderRadius: '14px',
            background: 'var(--surface-subtle, #f8fafc)',
          }}
        >
          <CheckCircle2 size={38} color="#15803d" style={{ margin: '0 auto 0.5rem', opacity: 0.8 }} />
          <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: '0.25rem 0', color: '#0f172a' }}>
            No Referral Cases Found
          </h3>
          <p style={{ fontSize: '0.84rem', color: '#64748b', maxWidth: 460, margin: '0 auto' }}>
            {statusFilter === 'PENDING_ADMIN_ACTION'
              ? 'No coachees currently have consecutive quarters below 3.0 awaiting administrative action. Click "Scan & Detect Referrals" above to evaluate recent appraisal records.'
              : 'No referral cases match your selected filter criteria.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {filteredReferrals.map((referral) => {
            const quarterScores = parseScores(referral.latestScoresJson);
            const isPending = referral.status === 'PENDING_ADMIN_ACTION';

            return (
              <div
                key={referral.id}
                className="apid-card"
                style={{
                  padding: '1.25rem 1.5rem',
                  borderRadius: '12px',
                  border: isPending ? '1px solid #fde68a' : '1px solid #e2e8f0',
                  background: isPending ? '#fffdf7' : '#ffffff',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                {/* Left: Info & Scores */}
                <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                      {referral.coacheeFullName}
                    </span>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontFamily: 'monospace',
                        color: '#64748b',
                        background: '#f1f5f9',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      #{referral.coacheeEmployeeNumber}
                    </span>
                    <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                      • {referral.coacheeDepartment || 'Branch Operations'} {referral.coacheeJobTitle ? `(${referral.coacheeJobTitle})` : ''}
                    </span>

                    {/* Status Pill */}
                    {referral.status === 'PENDING_ADMIN_ACTION' && (
                      <span
                        style={{
                          background: '#fef3c7',
                          color: '#b45309',
                          border: '1px solid #fde68a',
                          padding: '3px 9px',
                          borderRadius: '20px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <AlertTriangle size={12} /> Action Required
                      </span>
                    )}
                    {referral.status === 'REASSIGNED' && (
                      <span
                        style={{
                          background: '#dcfce7',
                          color: '#15803d',
                          border: '1px solid #bbf7d0',
                          padding: '3px 9px',
                          borderRadius: '20px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <UserCheck size={12} /> Reassigned to {referral.newCoachFullName}
                      </span>
                    )}
                    {referral.status === 'HR_ACTION_TAKEN' && (
                      <span
                        style={{
                          background: '#fee2e2',
                          color: '#b91c1c',
                          border: '1px solid #fecaca',
                          padding: '3px 9px',
                          borderRadius: '20px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <ShieldAlert size={12} /> Escalated to HR PIP
                      </span>
                    )}
                    {referral.status === 'DISMISSED' && (
                      <span
                        style={{
                          background: '#f1f5f9',
                          color: '#64748b',
                          border: '1px solid #cbd5e1',
                          padding: '3px 9px',
                          borderRadius: '20px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <XCircle size={12} /> Dismissed
                      </span>
                    )}
                  </div>

                  {/* Consecutive Low Scores */}
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.45rem', fontSize: '0.8rem' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Consecutive Low Scores:</span>
                    {quarterScores.map((qs, i) => (
                      <span
                        key={i}
                        style={{
                          background: '#fee2e2',
                          color: '#991b1b',
                          border: '1px solid #fecaca',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontFamily: 'monospace',
                          fontSize: '0.78rem',
                        }}
                      >
                        {qs.quarter}: <strong style={{ fontWeight: 800 }}>{qs.score.toFixed(1)}</strong>
                      </span>
                    ))}
                    <span
                      style={{
                        background: '#f1f5f9',
                        color: '#334155',
                        border: '1px solid #e2e8f0',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                      }}
                    >
                      {referral.consecutiveLowQuartersCount} consecutive quarters &lt; 3.0
                    </span>
                  </div>

                  {/* Coach & History metadata */}
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.82rem', color: '#64748b' }}>
                    <div>
                      <span>Current Coach:</span>{' '}
                      <strong style={{ color: '#0f172a' }}>{referral.currentCoachFullName || 'None'}</strong>
                    </div>
                    <div>
                      <span>Sessions Attended:</span>{' '}
                      <strong style={{ color: '#0f172a' }}>{referral.coachingSessionsAttended} Completed</strong>
                    </div>
                    <div>
                      <span>Escalated:</span>{' '}
                      <strong style={{ color: '#0f172a' }}>{new Date(referral.escalatedAt).toLocaleDateString()}</strong>
                    </div>
                  </div>

                  {/* Resolution Notes (if resolved) */}
                  {referral.resolutionNotes && (
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '0.65rem 0.85rem',
                        fontSize: '0.8rem',
                        color: '#334155',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                      }}
                    >
                      <FileText size={15} color="#c97a00" style={{ flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <strong style={{ color: '#0f172a' }}>Admin Resolution Notes:</strong> {referral.resolutionNotes}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Action Button */}
                <div style={{ flexShrink: 0 }}>
                  {isPending ? (
                    <button
                      type="button"
                      className="apid-btn apid-btn-primary"
                      onClick={() => setSelectedReferral(referral)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        padding: '0.55rem 1rem',
                        fontSize: '0.84rem',
                        fontWeight: 600,
                      }}
                    >
                      <UserCheck size={15} />
                      Take Action / Resolve
                    </button>
                  ) : (
                    <div
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: '#15803d',
                        background: '#dcfce7',
                        border: '1px solid #bbf7d0',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <CheckCircle2 size={14} /> Case Resolved
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ────────────────── RESOLUTION MODAL ────────────────── */}
      {selectedReferral && (
        <ResolveReferralModal
          referral={selectedReferral}
          onClose={() => setSelectedReferral(null)}
          onSuccess={() => {
            setSelectedReferral(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
