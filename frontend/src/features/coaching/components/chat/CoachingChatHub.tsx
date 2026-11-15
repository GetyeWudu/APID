import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Users,
  UserCheck,
  Sparkles,
  Info,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  coachingCommunicationApi,
  ConversationSummaryDto,
  MessageDto,
} from '../../api/coachingCommunicationApi';
import { ConversationListSidebar } from './ConversationListSidebar';
import { MessageThreadView } from './MessageThreadView';
import { MessageComposer } from './MessageComposer';
import { NewPeerChatModal } from './NewPeerChatModal';

interface CoachingChatHubProps {
  currentEmployeeId: number;
  currentUserId?: number;
  initialConversationId?: number | null;
}

export const CoachingChatHub: React.FC<CoachingChatHubProps> = ({
  currentEmployeeId,
  currentUserId,
  initialConversationId,
}) => {
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<number | null>(initialConversationId ?? null);
  const [replyTarget, setReplyTarget] = useState<MessageDto | null>(null);
  const [isPeerModalOpen, setIsPeerModalOpen] = useState(false);
  const [showParticipantsDrawer, setShowParticipantsDrawer] = useState(false);

  // 1. Fetch conversations list
  const conversationsQuery = useQuery({
    queryKey: ['coaching', 'conversations'],
    queryFn: coachingCommunicationApi.getMyConversations,
    refetchInterval: 8000, // Background sync every 8s
  });

  const conversations = conversationsQuery.data ?? [];

  // Default select first conversation if none selected
  useEffect(() => {
    if (!activeConversationId && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  // 2. Fetch messages for active conversation with incremental/polling sync
  const messagesQuery = useQuery({
    queryKey: ['coaching', 'messages', activeConversationId],
    queryFn: () => (activeConversationId ? coachingCommunicationApi.getMessages(activeConversationId, { limit: 60 }) : Promise.resolve([])),
    enabled: activeConversationId != null,
    refetchInterval: 3500, // Live poll every 3.5s for instant feel
  });

  const messages = messagesQuery.data ?? [];

  // 3. Mark read when active conversation has unread messages
  useEffect(() => {
    if (activeConversationId && messages.length > 0 && activeConversation && activeConversation.unreadCount > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.id) {
        void coachingCommunicationApi.markRead(activeConversationId, lastMsg.id).then(() => {
          // Invalidate conversations to clear badge
          void queryClient.invalidateQueries({ queryKey: ['coaching', 'conversations'] });
        });
      }
    }
  }, [activeConversationId, messages, activeConversation, queryClient]);

  // Determine if current user is Coach in the active conversation
  const isCoachOrAdmin = Boolean(
    activeConversation?.participants.some(
      (p) => p.employeeId === currentEmployeeId && p.role === 'COACH' && p.status === 'ACTIVE'
    )
  );

  const handleTogglePin = async (msg: MessageDto) => {
    if (!activeConversationId) return;
    try {
      await coachingCommunicationApi.togglePinMessage(activeConversationId, msg.id);
      await queryClient.invalidateQueries({ queryKey: ['coaching', 'messages', activeConversationId] });
      await queryClient.invalidateQueries({ queryKey: ['coaching', 'conversations'] });
    } catch (err) {
      console.error('Failed to toggle pin', err);
    }
  };

  const handleMessageSent = () => {
    setReplyTarget(null);
    void queryClient.invalidateQueries({ queryKey: ['coaching', 'messages', activeConversationId] });
    void queryClient.invalidateQueries({ queryKey: ['coaching', 'conversations'] });
  };

  const handlePeerConversationCreated = (newConv: ConversationSummaryDto) => {
    void queryClient.invalidateQueries({ queryKey: ['coaching', 'conversations'] });
    setActiveConversationId(newConv.id);
  };

  const getContextBadge = (contextType?: string) => {
    switch (contextType) {
      case 'MANDATORY_ASSIGNMENT':
        return (
          <span
            className="boa-pill"
            style={{
              fontSize: '0.72rem',
              padding: '0.15rem 0.5rem',
              background: 'rgba(245, 158, 11, 0.12)',
              color: '#d97706',
              fontWeight: 600,
            }}
          >
            Mandatory PMS (1-on-1)
          </span>
        );
      case 'SKILL_COHORT_GROUP':
        return (
          <span
            className="boa-pill"
            style={{
              fontSize: '0.72rem',
              padding: '0.15rem 0.5rem',
              background: 'rgba(2, 132, 199, 0.12)',
              color: '#0284c7',
              fontWeight: 600,
            }}
          >
            Skill Cohort Group
          </span>
        );
      case 'SKILL_PEER_DIRECT':
        return (
          <span
            className="boa-pill"
            style={{
              fontSize: '0.72rem',
              padding: '0.15rem 0.5rem',
              background: 'rgba(100, 116, 139, 0.12)',
              color: '#475569',
              fontWeight: 600,
            }}
          >
            Peer Direct (Private)
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="apid-card"
      style={{
        display: 'flex',
        height: '650px',
        background: 'var(--surface, #ffffff)',
        borderRadius: '16px',
        border: '1px solid var(--border, #e2e8f0)',
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Left Sidebar (320px) */}
      <div style={{ width: '320px', flexShrink: 0, height: '100%' }}>
        <ConversationListSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={(c) => {
            setActiveConversationId(c.id);
            setReplyTarget(null);
          }}
          onOpenPeerModal={() => setIsPeerModalOpen(true)}
          currentUserId={currentUserId}
        />
      </div>

      {/* Right Main Thread Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, position: 'relative' }}>
        {activeConversation ? (
          <>
            {/* Conversation Header */}
            <div
              style={{
                padding: '0.85rem 1.25rem',
                borderBottom: '1px solid var(--border, #e2e8f0)',
                background: 'var(--surface, #ffffff)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '10px',
                    background:
                      activeConversation.contextType === 'MANDATORY_ASSIGNMENT'
                        ? 'rgba(245, 158, 11, 0.12)'
                        : activeConversation.contextType === 'SKILL_COHORT_GROUP'
                        ? 'rgba(2, 132, 199, 0.12)'
                        : 'rgba(100, 116, 139, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {activeConversation.contextType === 'MANDATORY_ASSIGNMENT' ? (
                    <UserCheck size={20} style={{ color: '#d97706' }} />
                  ) : activeConversation.contextType === 'SKILL_COHORT_GROUP' ? (
                    <Users size={20} style={{ color: '#0284c7' }} />
                  ) : (
                    <Sparkles size={20} style={{ color: '#6366f1' }} />
                  )}
                </div>

                <div style={{ overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: '0.98rem',
                        fontWeight: 700,
                        color: 'var(--text, #0f172a)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {activeConversation.title}
                    </h4>
                    {getContextBadge(activeConversation.contextType)}
                  </div>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--muted, #64748b)' }}>
                    {activeConversation.participants.length} participant(s) • End-to-end audit logged & authenticated
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowParticipantsDrawer((prev) => !prev)}
                  className="apid-btn apid-btn-outline"
                  style={{
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                  title="View participants"
                >
                  <Info size={14} />
                  <span>Participants</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void messagesQuery.refetch();
                    void conversationsQuery.refetch();
                  }}
                  className="apid-btn apid-btn-outline"
                  style={{ padding: '0.35rem 0.55rem' }}
                  title="Refresh messages"
                >
                  <RefreshCw size={13} className={messagesQuery.isFetching ? 'apid-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Participants Popover / Drawer */}
            {showParticipantsDrawer && (
              <div
                style={{
                  position: 'absolute',
                  top: '60px',
                  right: '15px',
                  width: '280px',
                  maxHeight: '320px',
                  background: 'var(--surface, #ffffff)',
                  border: '1px solid var(--border, #cbd5e1)',
                  borderRadius: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  zIndex: 20,
                  padding: '0.85rem',
                  overflowY: 'auto',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                    Participants ({activeConversation.participants.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowParticipantsDrawer(false)}
                    style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: 'var(--muted, #64748b)', cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {activeConversation.participants.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: '0.45rem 0.65rem',
                        borderRadius: '8px',
                        background: 'var(--surface-subtle, #f8fafc)',
                        border: '1px solid var(--border, #e2e8f0)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text, #0f172a)' }}>
                          {p.fullName || `Staff #${p.employeeNumber}`}
                        </span>
                        <span
                          className="boa-pill"
                          style={{
                            fontSize: '0.62rem',
                            padding: '0.05rem 0.35rem',
                            fontWeight: 700,
                            background:
                              p.role === 'COACH'
                                ? 'rgba(245, 158, 11, 0.15)'
                                : p.role === 'COACHEE'
                                ? 'rgba(2, 132, 199, 0.12)'
                                : 'rgba(100, 116, 139, 0.12)',
                            color:
                              p.role === 'COACH' ? '#d97706' : p.role === 'COACHEE' ? '#0284c7' : '#475569',
                          }}
                        >
                          {p.role}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted, #64748b)', marginTop: '0.1rem' }}>
                        {p.jobTitle || 'Active Member'} • {p.employeeNumber}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Thread View */}
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              {messagesQuery.isLoading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted, #64748b)' }}>
                  <Loader2 className="apid-spin" size={24} style={{ margin: '0 auto 0.5rem' }} />
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>Loading conversation history...</p>
                </div>
              ) : (
                <MessageThreadView
                  messages={messages}
                  currentUserId={currentUserId}
                  isCoachOrAdmin={isCoachOrAdmin}
                  onReplyMessage={(msg) => setReplyTarget(msg)}
                  onTogglePinMessage={(msg) => void handleTogglePin(msg)}
                />
              )}
            </div>

            {/* Composer */}
            <MessageComposer
              conversationId={activeConversation.id}
              replyToMessage={replyTarget}
              onCancelReply={() => setReplyTarget(null)}
              onMessageSent={handleMessageSent}
              disabled={activeConversation.status !== 'ACTIVE'}
            />
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted, #94a3b8)',
              padding: '2rem',
            }}
          >
            <MessageSquare size={48} style={{ marginBottom: '1rem', opacity: 0.4 }} />
            <h4 style={{ margin: '0 0 0.4rem', fontSize: '1.1rem', color: 'var(--text, #1e293b)' }}>
              Select a Coaching Channel
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', maxWidth: '360px', textAlign: 'center' }}>
              Choose a conversation from the sidebar to inspect messages, share exercises, or start a peer chat.
            </p>
          </div>
        )}
      </div>

      {/* New Peer Chat Modal */}
      <NewPeerChatModal
        isOpen={isPeerModalOpen}
        onClose={() => setIsPeerModalOpen(false)}
        currentEmployeeId={currentEmployeeId}
        onConversationCreated={handlePeerConversationCreated}
      />
    </div>
  );
};
