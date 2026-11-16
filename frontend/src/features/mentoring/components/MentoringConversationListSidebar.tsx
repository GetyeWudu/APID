import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  Users,
  UserCheck,
  Search,
  PlusCircle,
  GraduationCap,
} from 'lucide-react';
import type { ConversationSummaryDto } from '../../coaching/api/coachingCommunicationApi';

export type MentoringFilterContext = 'ALL' | 'DIRECT' | 'GROUP' | 'PEER';

interface MentoringConversationListSidebarProps {
  conversations: ConversationSummaryDto[];
  activeConversationId: number | null;
  filterContext: MentoringFilterContext;
  onFilterChange: (filter: MentoringFilterContext) => void;
  onSelectConversation: (conv: ConversationSummaryDto) => void;
  onOpenPeerModal: () => void;
  currentUserId?: number;
}

export const MentoringConversationListSidebar: React.FC<MentoringConversationListSidebarProps> = ({
  conversations,
  activeConversationId,
  filterContext,
  onFilterChange,
  onSelectConversation,
  onOpenPeerModal,
}) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      // Type filter based on filterContext
      if (filterContext === 'DIRECT' && c.contextType !== 'MENTORING_RELATIONSHIP_DIRECT') return false;
      if (filterContext === 'GROUP' && c.contextType !== 'MENTORING_COHORT_GROUP') return false;
      if (filterContext === 'PEER' && c.contextType !== 'MENTORING_PEER_DIRECT') return false;

      // Search query
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const titleMatch = c.title.toLowerCase().includes(q);
      const participantMatch = c.participants.some(
        (p) => p.fullName?.toLowerCase().includes(q) || p.employeeNumber?.toLowerCase().includes(q)
      );
      const lastMsgMatch = c.lastMessageSnippet?.toLowerCase().includes(q);
      return titleMatch || participantMatch || lastMsgMatch;
    });
  }, [conversations, filterContext, search]);

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    try {
      const date = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const getContextBadge = (contextType: string) => {
    switch (contextType) {
      case 'MENTORING_RELATIONSHIP_DIRECT':
        return (
          <span
            className="boa-pill"
            style={{
              fontSize: '0.68rem',
              padding: '0.12rem 0.45rem',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#059669',
              fontWeight: 600,
            }}
          >
            1:1 Mentoring
          </span>
        );
      case 'MENTORING_COHORT_GROUP':
        return (
          <span
            className="boa-pill"
            style={{
              fontSize: '0.68rem',
              padding: '0.12rem 0.45rem',
              background: 'rgba(2, 132, 199, 0.12)',
              color: '#0284c7',
              fontWeight: 600,
            }}
          >
            Class Group
          </span>
        );
      case 'MENTORING_PEER_DIRECT':
        return (
          <span
            className="boa-pill"
            style={{
              fontSize: '0.68rem',
              padding: '0.12rem 0.45rem',
              background: 'rgba(139, 92, 246, 0.12)',
              color: '#7c3aed',
              fontWeight: 600,
            }}
          >
            Trainee Peer
          </span>
        );
      default:
        return null;
    }
  };

  // Unread count tally for tabs
  const unreadDirect = conversations
    .filter((c) => c.contextType === 'MENTORING_RELATIONSHIP_DIRECT')
    .reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);

  const unreadGroup = conversations
    .filter((c) => c.contextType === 'MENTORING_COHORT_GROUP')
    .reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);

  const unreadPeer = conversations
    .filter((c) => c.contextType === 'MENTORING_PEER_DIRECT')
    .reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);

  return (
    <aside
      className="apid-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '620px',
        padding: '0.85rem',
        background: 'var(--surface, #ffffff)',
        borderRight: '1px solid var(--border-light, #e2e8f0)',
        boxShadow: 'none',
      }}
    >
      {/* Top Header & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <GraduationCap size={20} color="var(--primary, #0f172a)" />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>
            Mentoring Chats
          </h3>
        </div>

        <button
          type="button"
          onClick={onOpenPeerModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.35rem 0.65rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            borderRadius: '6px',
            backgroundColor: 'rgba(2, 132, 199, 0.1)',
            color: '#0284c7',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
          }}
          title="Start private chat with a fellow trainee"
        >
          <PlusCircle size={14} />
          <span>New Peer Chat</span>
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.25rem',
          backgroundColor: 'var(--bg-subtle, #f1f5f9)',
          padding: '0.25rem',
          borderRadius: '8px',
          marginBottom: '0.75rem',
        }}
      >
        <button
          type="button"
          onClick={() => onFilterChange('ALL')}
          style={{
            padding: '0.35rem 0.2rem',
            fontSize: '0.75rem',
            fontWeight: filterContext === 'ALL' ? 700 : 500,
            color: filterContext === 'ALL' ? 'var(--text-main, #0f172a)' : 'var(--text-muted, #64748b)',
            backgroundColor: filterContext === 'ALL' ? '#ffffff' : 'transparent',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: filterContext === 'ALL' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          All
        </button>

        <button
          type="button"
          onClick={() => onFilterChange('DIRECT')}
          style={{
            position: 'relative',
            padding: '0.35rem 0.2rem',
            fontSize: '0.75rem',
            fontWeight: filterContext === 'DIRECT' ? 700 : 500,
            color: filterContext === 'DIRECT' ? 'var(--text-main, #0f172a)' : 'var(--text-muted, #64748b)',
            backgroundColor: filterContext === 'DIRECT' ? '#ffffff' : 'transparent',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: filterContext === 'DIRECT' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          1:1 Pairs
          {unreadDirect > 0 && (
            <span
              style={{
                marginLeft: '0.25rem',
                padding: '0.05rem 0.35rem',
                borderRadius: '999px',
                backgroundColor: '#ef4444',
                color: '#fff',
                fontSize: '0.65rem',
                fontWeight: 700,
              }}
            >
              {unreadDirect}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onFilterChange('GROUP')}
          style={{
            position: 'relative',
            padding: '0.35rem 0.2rem',
            fontSize: '0.75rem',
            fontWeight: filterContext === 'GROUP' ? 700 : 500,
            color: filterContext === 'GROUP' ? 'var(--text-main, #0f172a)' : 'var(--text-muted, #64748b)',
            backgroundColor: filterContext === 'GROUP' ? '#ffffff' : 'transparent',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: filterContext === 'GROUP' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          Class Groups
          {unreadGroup > 0 && (
            <span
              style={{
                marginLeft: '0.25rem',
                padding: '0.05rem 0.35rem',
                borderRadius: '999px',
                backgroundColor: '#ef4444',
                color: '#fff',
                fontSize: '0.65rem',
                fontWeight: 700,
              }}
            >
              {unreadGroup}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onFilterChange('PEER')}
          style={{
            position: 'relative',
            padding: '0.35rem 0.2rem',
            fontSize: '0.75rem',
            fontWeight: filterContext === 'PEER' ? 700 : 500,
            color: filterContext === 'PEER' ? 'var(--text-main, #0f172a)' : 'var(--text-muted, #64748b)',
            backgroundColor: filterContext === 'PEER' ? '#ffffff' : 'transparent',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: filterContext === 'PEER' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          Peer Chat
          {unreadPeer > 0 && (
            <span
              style={{
                marginLeft: '0.25rem',
                padding: '0.05rem 0.35rem',
                borderRadius: '999px',
                backgroundColor: '#ef4444',
                color: '#fff',
                fontSize: '0.65rem',
                fontWeight: 700,
              }}
            >
              {unreadPeer}
            </span>
          )}
        </button>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: '0.65rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted, #94a3b8)',
          }}
        />
        <input
          type="text"
          placeholder="Filter conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '0.45rem 0.65rem 0.45rem 2rem',
            fontSize: '0.8rem',
            borderRadius: '6px',
            border: '1px solid var(--border-light, #e2e8f0)',
            backgroundColor: 'var(--bg-subtle, #f8fafc)',
            outline: 'none',
          }}
        />
      </div>

      {/* Conversation List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              padding: '2rem 1rem',
              textAlign: 'center',
              color: 'var(--text-muted, #94a3b8)',
              fontSize: '0.85rem',
            }}
          >
            <MessageSquare size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
            <p style={{ margin: 0 }}>No conversations in this section</p>
          </div>
        ) : (
          filtered.map((c) => {
            const isSelected = c.id === activeConversationId;
            const hasUnread = (c.unreadCount ?? 0) > 0;

            return (
              <div
                key={c.id}
                onClick={() => onSelectConversation(c)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                  padding: '0.65rem',
                  borderRadius: '8px',
                  backgroundColor: isSelected
                    ? 'rgba(2, 132, 199, 0.08)'
                    : 'transparent',
                  border: isSelected
                    ? '1px solid rgba(2, 132, 199, 0.3)'
                    : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Title & Badge & Time */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, overflow: 'hidden' }}>
                    {c.contextType === 'MENTORING_COHORT_GROUP' ? (
                      <Users size={16} color="#0284c7" style={{ flexShrink: 0 }} />
                    ) : c.contextType === 'MENTORING_PEER_DIRECT' ? (
                      <UserCheck size={16} color="#7c3aed" style={{ flexShrink: 0 }} />
                    ) : (
                      <MessageSquare size={16} color="#059669" style={{ flexShrink: 0 }} />
                    )}
                    <span
                      style={{
                        fontSize: '0.84rem',
                        fontWeight: hasUnread ? 700 : isSelected ? 600 : 500,
                        color: 'var(--text-main, #0f172a)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={c.title}
                    >
                      {c.title}
                    </span>
                  </div>

                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', flexShrink: 0 }}>
                    {formatTime(c.lastMessageAt || c.updatedAt)}
                  </span>
                </div>

                {/* Subtitle / Snippet */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: hasUnread ? 'var(--text-main, #0f172a)' : 'var(--text-muted, #64748b)',
                      fontWeight: hasUnread ? 600 : 400,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '80%',
                    }}
                  >
                    {c.lastMessageSnippet || 'No messages yet'}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {getContextBadge(c.contextType)}
                    {hasUnread && (
                      <span
                        style={{
                          backgroundColor: '#ef4444',
                          color: '#fff',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          borderRadius: '999px',
                          padding: '0.1rem 0.4rem',
                        }}
                      >
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
