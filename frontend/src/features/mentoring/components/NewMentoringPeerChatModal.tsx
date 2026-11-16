import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Users, User, ArrowRight, Loader2, MessageSquare } from 'lucide-react';
import type { ConversationSummaryDto } from '../../coaching/api/coachingCommunicationApi';
import { mentoringPairingApi, type EligibleMentoringPeerDto } from '../api/mentoringPairingApi';

interface NewMentoringPeerChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationCreated: (conversation: ConversationSummaryDto) => void;
}

export const NewMentoringPeerChatModal: React.FC<NewMentoringPeerChatModalProps> = ({
  isOpen,
  onClose,
  onConversationCreated,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const peersQuery = useQuery<EligibleMentoringPeerDto[]>({
    queryKey: ['mentoring', 'eligible-peers'],
    queryFn: mentoringPairingApi.getEligibleMentoringPeers,
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const eligiblePeers = peersQuery.data ?? [];

  const handleStartPeerChat = async (peer: EligibleMentoringPeerDto) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const conv = await mentoringPairingApi.createPeerConversation(
        peer.relationshipId,
        peer.employeeId
      );
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(2, 132, 199, 0.12)',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageSquare size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-main, #1e293b)' }}>
                Start Trainee Peer Chat
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
                Collaborate privately with fellow trainees in your class
              </p>
            </div>
          </div>
          <button
            type="button"
            className="boa-btn-icon"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted, #64748b)',
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
              color: '#ef4444',
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Peer List */}
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main, #1e293b)', marginBottom: '0.5rem' }}>
            Available Class Peers
          </label>

          {peersQuery.isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted, #64748b)' }}>
              <Loader2 size={24} className="animate-spin" style={{ display: 'inline-block', marginBottom: '0.5rem' }} />
              <p style={{ margin: 0, fontSize: '0.875rem' }}>Discovering classmates...</p>
            </div>
          ) : eligiblePeers.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2.5rem 1rem',
                border: '1px dashed var(--border-light, #e2e8f0)',
                borderRadius: '12px',
                color: 'var(--text-muted, #64748b)',
              }}
            >
              <Users size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>No other trainees found</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem' }}>
                You are currently the only trainee enrolled with your mentor for this skill.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '320px', overflowY: 'auto' }}>
              {eligiblePeers.map((peer) => (
                <div
                  key={peer.employeeId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    border: '1px solid var(--border-light, #e2e8f0)',
                    borderRadius: '10px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(100, 116, 139, 0.12)',
                        color: '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                      }}
                    >
                      {peer.fullName ? peer.fullName.charAt(0).toUpperCase() : <User size={18} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main, #1e293b)' }}>
                        {peer.fullName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
                        {peer.skillName ? `${peer.skillName} · ` : ''}Mentor: {peer.mentorName ?? 'Assigned'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="boa-btn-primary"
                    disabled={isSubmitting}
                    onClick={() => handleStartPeerChat(peer)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      fontSize: '0.8rem',
                      padding: '0.4rem 0.85rem',
                      borderRadius: '8px',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      background: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 600,
                    }}
                  >
                    <span>Start Chat</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="boa-btn-secondary"
            onClick={onClose}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border-light, #e2e8f0)',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '0.85rem',
              color: 'var(--text-muted, #64748b)',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
