import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Users, User, ArrowRight, Loader2, MessageSquare } from 'lucide-react';
import { coachingCommunicationApi, ConversationSummaryDto } from '../../api/coachingCommunicationApi';
import { skillCoachingRequestApi, SkillCoachingRequestItem, SkillCoachingTargetItem } from '../../api/skillCoachingRequestApi';

interface NewPeerChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmployeeId: number;
  onConversationCreated: (conversation: ConversationSummaryDto) => void;
}

export const NewPeerChatModal: React.FC<NewPeerChatModalProps> = ({
  isOpen,
  onClose,
  currentEmployeeId,
  onConversationCreated,
}) => {
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch approved skill coaching requests
  const requestsQuery = useQuery<SkillCoachingRequestItem[]>({
    queryKey: ['coaching', 'skill-requests', 'approved'],
    queryFn: () => skillCoachingRequestApi.getAllRequests({ status: 'APPROVED' }),
    enabled: isOpen,
  });

  if (!isOpen) return null;

  // Filter cohorts where the current employee is an approved target (coachee)
  const myApprovedCohorts: SkillCoachingRequestItem[] = (requestsQuery.data ?? []).filter((req: SkillCoachingRequestItem) =>
    req.targets?.some((t: SkillCoachingTargetItem) => t.employeeId === currentEmployeeId)
  );

  const activeCohort: SkillCoachingRequestItem | undefined =
    myApprovedCohorts.find((c: SkillCoachingRequestItem) => c.id === selectedRequestId) || myApprovedCohorts[0];
  const eligiblePeers: SkillCoachingTargetItem[] =
    activeCohort?.targets?.filter((t: SkillCoachingTargetItem) => t.employeeId !== currentEmployeeId) ?? [];

  const handleStartPeerChat = async (targetEmployeeId: number) => {
    if (!activeCohort) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const conv = await coachingCommunicationApi.getOrCreatePeerConversation({
        skillRequestId: activeCohort.id,
        targetEmployeeId,
      });
      onConversationCreated(conv);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize peer conversation';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="apid-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--surface, #ffffff)',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'rgba(2, 132, 199, 0.1)',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                Start Skill Peer Chat
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted, #64748b)' }}>
                Private 1-on-1 discussion with a peer in your approved skill cohort
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted, #64748b)',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {errorMessage && (
          <div
            style={{
              padding: '0.75rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#dc2626',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            {errorMessage}
          </div>
        )}

        {requestsQuery.isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted, #64748b)' }}>
            <Loader2 className="apid-spin" size={24} style={{ margin: '0 auto 0.5rem' }} />
            <p style={{ margin: 0, fontSize: '0.85rem' }}>Loading approved cohorts...</p>
          </div>
        ) : myApprovedCohorts.length === 0 ? (
          <div
            style={{
              padding: '2rem',
              textAlign: 'center',
              background: 'var(--surface-subtle, #f8fafc)',
              borderRadius: '12px',
              border: '1px dashed var(--border, #e2e8f0)',
            }}
          >
            <Users size={32} style={{ color: 'var(--muted, #94a3b8)', marginBottom: '0.5rem' }} />
            <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.95rem', color: 'var(--text, #1e293b)' }}>
              No Active Skill Cohorts Found
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted, #64748b)' }}>
              Peer chats are only available between employees sharing an approved skill development cohort.
            </p>
          </div>
        ) : (
          <div>
            {/* Cohort Selector (if member of multiple) */}
            {myApprovedCohorts.length > 1 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Select Skill Cohort:
                </label>
                <select
                  className="apid-input"
                  value={activeCohort?.id ?? ''}
                  onChange={(e) => setSelectedRequestId(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px' }}
                >
                  {myApprovedCohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.skillTitle} ({c.targets?.length ?? 0} members)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Peer List */}
            <div style={{ marginBottom: '0.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.65rem',
                }}
              >
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text, #334155)' }}>
                  Cohort: <span style={{ color: '#0284c7' }}>{activeCohort?.skillTitle}</span>
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--muted, #64748b)' }}>
                  {eligiblePeers.length} eligible peer(s)
                </span>
              </div>

              {eligiblePeers.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--muted, #64748b)' }}>
                  No other employees in this cohort.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '280px', overflowY: 'auto' }}>
                  {eligiblePeers.map((peer) => (
                    <div
                      key={peer.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid var(--border, #e2e8f0)',
                        background: 'var(--surface-subtle, #f8fafc)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            background: 'rgba(100, 116, 139, 0.12)',
                            color: '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                          }}
                        >
                          <User size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text, #0f172a)' }}>
                            {peer.employeeFullName || `Employee #${peer.employeeId}`}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted, #64748b)' }}>
                            {peer.department || 'Coachee Peer'} • {peer.employeeNumber}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="apid-btn apid-btn-primary"
                        disabled={isSubmitting}
                        onClick={() => handleStartPeerChat(peer.employeeId)}
                        style={{
                          padding: '0.4rem 0.85rem',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          borderRadius: '8px',
                        }}
                      >
                        {isSubmitting ? (
                          <Loader2 className="apid-spin" size={14} />
                        ) : (
                          <>
                            <MessageSquare size={14} />
                            <span>Chat</span>
                            <ArrowRight size={13} />
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="apid-btn apid-btn-outline"
            onClick={onClose}
            style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
