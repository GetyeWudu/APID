import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Users,
  UserCheck,
  GraduationCap,
  Info,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type {
  ConversationSummaryDto,
  MessageDto,
} from '../../coaching/api/coachingCommunicationApi';
import { mentoringPairingApi } from '../api/mentoringPairingApi';
import {
  MentoringConversationListSidebar,
  type MentoringFilterContext,
} from './MentoringConversationListSidebar';
import { MessageThreadView } from '../../coaching/components/chat/MessageThreadView';
import { MessageComposer } from '../../coaching/components/chat/MessageComposer';
import { NewMentoringPeerChatModal } from './NewMentoringPeerChatModal';

interface MentoringChatHubProps {
  currentUserId?: number;
  currentEmployeeId?: number;
  initialConversationId?: number | null;
  initialRelationshipId?: number | null;
}

export const MentoringChatHub: React.FC<MentoringChatHubProps> = ({
  currentUserId,
  currentEmployeeId,
  initialConversationId,
  initialRelationshipId,
}) => {
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<number | null>(
    initialConversationId ?? null
  );
  const [replyTarget, setReplyTarget] = useState<MessageDto | null>(null);
  const [isPeerModalOpen, setIsPeerModalOpen] = useState(false);
  const [showParticipantsDrawer, setShowParticipantsDrawer] = useState(false);
  const [filterContext, setFilterContext] = useState<MentoringFilterContext>('ALL');

  // 1. Fetch conversations list
  const conversationsQuery = useQuery({
    queryKey: ['mentoring', 'conversations'],
    queryFn: () => mentoringPairingApi.getMyMentoringConversations(),
    refetchInterval: 6000,
  });

  const conversations = conversationsQuery.data ?? [];

  // When conversations load, if initialRelationshipId is passed and no conversation selected, match it
  useEffect(() => {
    if (initialRelationshipId && !activeConversationId && conversations.length > 0) {
      const match = conversations.find(
        (c) => c.mentoringRelationshipId === initialRelationshipId
      );
      if (match) {
        setActiveConversationId(match.id);
      }
    }
  }, [initialRelationshipId, activeConversationId, conversations]);

  // Filtered conversations based on selected tab
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (filterContext === 'DIRECT') return c.contextType === 'MENTORING_RELATIONSHIP_DIRECT';
      if (filterContext === 'GROUP') return c.contextType === 'MENTORING_COHORT_GROUP';
      if (filterContext === 'PEER') return c.contextType === 'MENTORING_PEER_DIRECT';
      return true;
    });
  }, [conversations, filterContext]);

  // Active conversation
  const activeConversation = useMemo(() => {
    if (!activeConversationId) return null;
    return filteredConversations.find((c) => c.id === activeConversationId) || null;
  }, [filteredConversations, activeConversationId]);

  // Sync activeConversationId with active filter
  useEffect(() => {
    if (activeConversationId && filteredConversations.some((c) => c.id === activeConversationId)) {
      return;
    }
    if (filteredConversations.length > 0) {
      setActiveConversationId(filteredConversations[0].id);
      setReplyTarget(null);
    } else {
      setActiveConversationId(null);
      setReplyTarget(null);
    }
  }, [filteredConversations, activeConversationId]);

  const handleFilterChange = (newFilter: MentoringFilterContext) => {
    setFilterContext(newFilter);
    setReplyTarget(null);
  };

  // 2. Fetch messages for active conversation
  const messagesQuery = useQuery({
    queryKey: ['mentoring', 'messages', activeConversationId],
    queryFn: () =>
      activeConversationId
        ? mentoringPairingApi.getConversationMessages(activeConversationId, undefined, undefined, 60)
        : Promise.resolve([]),
    enabled: activeConversationId != null && activeConversation != null,
    refetchInterval: 3500,
  });

  const messages = messagesQuery.data ?? [];

  // 3. Mark read when active conversation has messages
  useEffect(() => {
    if (activeConversationId && activeConversation && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.id) {
        queryClient.setQueryData<ConversationSummaryDto[]>(
          ['mentoring', 'conversations'],
          (old) =>
            old
              ? old.map((c) =>
                  c.id === activeConversationId ? { ...c, unreadCount: 0 } : c
                )
              : []
        );

        void mentoringPairingApi.markConversationRead(activeConversationId, lastMsg.id).then(() => {
          void queryClient.invalidateQueries({ queryKey: ['mentoring', 'conversations'] });
        });
      }
    }
  }, [activeConversationId, activeConversation, messages, queryClient]);

  const isTrainerOrAdmin = Boolean(
    activeConversation?.participants.some(
      (p) =>
        (p.userId === currentUserId || (currentEmployeeId && p.employeeId === currentEmployeeId)) &&
        (p.role === 'TRAINER' || p.role === 'COACH') &&
        p.status === 'ACTIVE'
    )
  );

  const handleTogglePin = async (msg: MessageDto) => {
    if (!activeConversationId) return;
    try {
      await mentoringPairingApi.togglePinMessage(activeConversationId, msg.id);
      await queryClient.invalidateQueries({ queryKey: ['mentoring', 'messages', activeConversationId] });
      await queryClient.invalidateQueries({ queryKey: ['mentoring', 'conversations'] });
    } catch (err) {
      console.error('Failed to toggle pin', err);
    }
  };

  const handleMessageSent = () => {
    setReplyTarget(null);
    void queryClient.invalidateQueries({ queryKey: ['mentoring', 'messages', activeConversationId] });
    void queryClient.invalidateQueries({ queryKey: ['mentoring', 'conversations'] });
  };

  const handlePeerConversationCreated = (newConv: ConversationSummaryDto) => {
    setFilterContext('PEER');
    setActiveConversationId(newConv.id);
    void queryClient.invalidateQueries({ queryKey: ['mentoring', 'conversations'] });
  };

  const getContextBadge = (contextType?: string) => {
    switch (contextType) {
      case 'MENTORING_RELATIONSHIP_DIRECT':
        return (
          <span
            className="boa-pill"
            style={{
              fontSize: '0.72rem',
              padding: '0.15rem 0.5rem',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#059669',
              fontWeight: 600,
            }}
          >
            1:1 Mentoring Pair
          </span>
        );
      case 'MENTORING_COHORT_GROUP':
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
            Class / Cohort Group
          </span>
        );
      case 'MENTORING_PEER_DIRECT':
        return (
          <span
            className="boa-pill"
            style={{
              fontSize: '0.72rem',
              padding: '0.15rem 0.5rem',
              background: 'rgba(139, 92, 246, 0.12)',
              color: '#7c3aed',
              fontWeight: 600,
            }}
          >
            Trainee Peer Chat
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '340px 1fr',
        gap: '1rem',
        height: 'calc(100vh - 170px)',
        minHeight: '620px',
        position: 'relative',
      }}
    >
      {/* Sidebar with Filter Tabs */}
      <MentoringConversationListSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        filterContext={filterContext}
        onFilterChange={handleFilterChange}
        onSelectConversation={(c) => {
          setActiveConversationId(c.id);
          setReplyTarget(null);
        }}
        onOpenPeerModal={() => setIsPeerModalOpen(true)}
        currentUserId={currentUserId}
      />

      {/* Main Conversation Window */}
      <main
        className="apid-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: 0,
          overflow: 'hidden',
          background: 'var(--surface, #ffffff)',
          position: 'relative',
        }}
      >
        {activeConversation ? (
          <>
            {/* Conversation Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1.25rem',
                borderBottom: '1px solid var(--border-light, #e2e8f0)',
                background: 'var(--surface, #ffffff)',
                zIndex: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    backgroundColor:
                      activeConversation.contextType === 'MENTORING_COHORT_GROUP'
                        ? 'rgba(2, 132, 199, 0.12)'
                        : activeConversation.contextType === 'MENTORING_PEER_DIRECT'
                        ? 'rgba(139, 92, 246, 0.12)'
                        : 'rgba(16, 185, 129, 0.12)',
                    color:
                      activeConversation.contextType === 'MENTORING_COHORT_GROUP'
                        ? '#0284c7'
                        : activeConversation.contextType === 'MENTORING_PEER_DIRECT'
                        ? '#7c3aed'
                        : '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {activeConversation.contextType === 'MENTORING_COHORT_GROUP' ? (
                    <Users size={20} />
                  ) : activeConversation.contextType === 'MENTORING_PEER_DIRECT' ? (
                    <UserCheck size={20} />
                  ) : (
                    <GraduationCap size={20} />
                  )}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: 'var(--text-main, #0f172a)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {activeConversation.title}
                    </h2>
                    {getContextBadge(activeConversation.contextType)}
                  </div>

                  <p
                    style={{
                      margin: '0.1rem 0 0',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted, #64748b)',
                    }}
                  >
                    {activeConversation.participants.length} participant
                    {activeConversation.participants.length === 1 ? '' : 's'}
                    {' • '}
                    {activeConversation.participants.map((p) => p.fullName || p.employeeNumber).join(', ')}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowParticipantsDrawer((prev) => !prev)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    backgroundColor: showParticipantsDrawer
                      ? 'rgba(2, 132, 199, 0.15)'
                      : 'var(--bg-subtle, #f1f5f9)',
                    color: showParticipantsDrawer ? '#0284c7' : 'var(--text-main, #0f172a)',
                    border: '1px solid var(--border-light, #e2e8f0)',
                    cursor: 'pointer',
                  }}
                  title="Toggle participants info"
                >
                  <Info size={14} />
                  <span>Participants</span>
                </button>

                <button
                  type="button"
                  onClick={() => void messagesQuery.refetch()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '30px',
                    height: '30px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-light, #e2e8f0)',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--text-muted, #64748b)',
                  }}
                  title="Refresh messages"
                >
                  <RefreshCw size={14} className={messagesQuery.isFetching ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Participants Drawer (Collapsible) */}
            {showParticipantsDrawer && (
              <div
                style={{
                  padding: '0.75rem 1.25rem',
                  borderBottom: '1px solid var(--border-light, #e2e8f0)',
                  background: 'var(--bg-subtle, #f8fafc)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>
                  Enrolled Members ({activeConversation.participants.length})
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem' }}>
                  {activeConversation.participants.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: '0.45rem 0.65rem',
                        borderRadius: '8px',
                        background: '#ffffff',
                        border: '1px solid var(--border-light, #e2e8f0)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main, #0f172a)' }}>
                          {p.fullName || `Staff #${p.employeeNumber}`}
                        </span>
                        <span
                          className="boa-pill"
                          style={{
                            fontSize: '0.62rem',
                            padding: '0.05rem 0.35rem',
                            fontWeight: 700,
                            background:
                              p.role === 'TRAINER' || p.role === 'COACH'
                                ? 'rgba(16, 185, 129, 0.15)'
                                : p.role === 'TRAINEE' || p.role === 'COACHEE'
                                ? 'rgba(2, 132, 199, 0.12)'
                                : 'rgba(139, 92, 246, 0.12)',
                            color:
                              p.role === 'TRAINER' || p.role === 'COACH'
                                ? '#059669'
                                : p.role === 'TRAINEE' || p.role === 'COACHEE'
                                ? '#0284c7'
                                : '#7c3aed',
                          }}
                        >
                          {p.role}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)', marginTop: '0.1rem' }}>
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
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                  <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto 0.5rem' }} />
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>Loading conversation history...</p>
                </div>
              ) : (
                <MessageThreadView
                  messages={messages}
                  currentUserId={currentUserId}
                  isCoachOrAdmin={isTrainerOrAdmin}
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
              uploadAttachmentFn={mentoringPairingApi.uploadConversationAttachment}
              sendMessageFn={(convId, req) =>
                mentoringPairingApi.sendConversationMessage(convId, {
                  ...req,
                  content: req.content ?? '',
                })
              }
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
              color: 'var(--text-muted, #94a3b8)',
              padding: '2rem',
            }}
          >
            <MessageSquare size={48} style={{ marginBottom: '1rem', opacity: 0.4 }} />
            <h4 style={{ margin: '0 0 0.4rem', fontSize: '1.1rem', color: 'var(--text-main, #1e293b)' }}>
              {filterContext === 'GROUP'
                ? 'No Mentoring Class Groups'
                : filterContext === 'PEER'
                ? 'No Trainee Peer Chats'
                : filterContext === 'DIRECT'
                ? 'No 1:1 Mentoring Pairs'
                : 'Select a Mentoring Conversation'}
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', maxWidth: '380px', textAlign: 'center' }}>
              {filterContext === 'GROUP'
                ? 'Mentoring class groups are automatically created for your skill cohorts with your trainer and fellow trainees.'
                : filterContext === 'PEER'
                ? 'Use the "+ New Peer Chat" button on the left to start a 1-on-1 private discussion with a classmate in your mentoring program.'
                : filterContext === 'DIRECT'
                ? 'Direct 1-on-1 mentoring discussions between you and your mentor or assigned trainee appear here.'
                : 'Choose a conversation from the sidebar to inspect messages, discuss skill topics, or collaborate with peers.'}
            </p>
          </div>
        )}
      </main>

      {/* Trainee Peer Chat Modal */}
      <NewMentoringPeerChatModal
        isOpen={isPeerModalOpen}
        onClose={() => setIsPeerModalOpen(false)}
        onConversationCreated={handlePeerConversationCreated}
      />
    </div>
  );
};
