import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  Users,
  UserCheck,
  Search,
  PlusCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { ConversationSummaryDto } from '../../api/coachingCommunicationApi';

interface ConversationListSidebarProps {
  conversations: ConversationSummaryDto[];
  activeConversationId: number | null;
  onSelectConversation: (conv: ConversationSummaryDto) => void;
  onOpenPeerModal: () => void;
  currentUserId?: number;
}

export const ConversationListSidebar: React.FC<ConversationListSidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onOpenPeerModal,
}) => {
  const [search, setSearch] = useState('');
  const [filterContext, setFilterContext] = useState<'ALL' | 'MANDATORY' | 'SKILL_GROUP' | 'PEER'>('ALL');

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      // Type filter
      if (filterContext === 'MANDATORY' && c.contextType !== 'MANDATORY_ASSIGNMENT') return false;
      if (filterContext === 'SKILL_GROUP' && c.contextType !== 'SKILL_COHORT_GROUP') return false;
      if (filterContext === 'PEER' && c.contextType !== 'SKILL_PEER_DIRECT') return false;

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
      case 'MANDATORY_ASSIGNMENT':
        return (
          <span
            className="boa-pill"
            style={{
              fontSize: '0.68rem',
              padding: '0.12rem 0.45rem',
              background: 'rgba(245, 158, 11, 0.12)',
              color: '#d97706',
              fontWeight: 600,
            }}
          >
            PMS 1-on-1
          </span>
        );
      case 'SKILL_COHORT_GROUP':
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
            Skill Cohort
          </span>
        );
      case 'SKILL_PEER_DIRECT':
        return (
          <span
            className="boa-pill"
            style={{
              fontSize: '0.68rem',
              padding: '0.12rem 0.45rem',
              background: 'rgba(100, 116, 139, 0.12)',
              color: '#475569',
              fontWeight: 600,
            }}
          >
            Peer Direct
          </span>
        );
      default:
        return null;
    }
  };

  const getContextIcon = (contextType: string) => {
    switch (contextType) {
      case 'MANDATORY_ASSIGNMENT':
        return <UserCheck size={18} style={{ color: '#d97706' }} />;
      case 'SKILL_COHORT_GROUP':
        return <Users size={18} style={{ color: '#0284c7' }} />;
      case 'SKILL_PEER_DIRECT':
        return <Sparkles size={18} style={{ color: '#6366f1' }} />;
      default:
        return <MessageSquare size={18} />;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderRight: '1px solid var(--border, #e2e8f0)',
        background: 'var(--surface-subtle, #f8fafc)',
      }}
    >
      {/* Top action header */}
      <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text, #0f172a)' }}>
            Coaching Channels
          </h4>
          <button
            type="button"
            className="apid-btn apid-btn-outline"
            onClick={onOpenPeerModal}
            title="Start private 1-on-1 chat with a fellow cohort member"
            style={{
              padding: '0.25rem 0.55rem',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              borderColor: 'var(--brand-gold, #f59e0b)',
              color: '#b45309',
            }}
          >
            <PlusCircle size={13} />
            <span>Peer Chat</span>
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '0.65rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--muted, #94a3b8)',
            }}
          />
          <input
            type="text"
            placeholder="Search channels & people..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.4rem 0.65rem 0.4rem 2rem',
              fontSize: '0.8rem',
              borderRadius: '8px',
              border: '1px solid var(--border, #cbd5e1)',
              background: 'var(--surface, #ffffff)',
              color: 'var(--text, #0f172a)',
              outline: 'none',
            }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.6rem', overflowX: 'auto' }}>
          {(['ALL', 'MANDATORY', 'SKILL_GROUP', 'PEER'] as const).map((filter) => {
            const label =
              filter === 'ALL'
                ? 'All'
                : filter === 'MANDATORY'
                ? 'Mandatory'
                : filter === 'SKILL_GROUP'
                ? 'Cohorts'
                : 'Peers';
            const isActive = filterContext === filter;
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setFilterContext(filter)}
                style={{
                  padding: '0.18rem 0.55rem',
                  fontSize: '0.72rem',
                  fontWeight: isActive ? 700 : 500,
                  borderRadius: '20px',
                  border: isActive ? '1px solid #0284c7' : '1px solid var(--border, #e2e8f0)',
                  background: isActive ? 'rgba(2, 132, 199, 0.1)' : 'var(--surface, #ffffff)',
                  color: isActive ? '#0284c7' : 'var(--muted, #64748b)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted, #94a3b8)' }}>
            <MessageSquare size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: '0.8rem' }}>No conversations found</p>
          </div>
        ) : (
          filtered.map((conv) => {
            const isSelected = conv.id === activeConversationId;
            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv)}
                style={{
                  padding: '0.65rem 0.75rem',
                  borderRadius: '10px',
                  marginBottom: '0.35rem',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--surface, #ffffff)' : 'transparent',
                  border: isSelected ? '1px solid var(--border, #cbd5e1)' : '1px solid transparent',
                  boxShadow: isSelected ? '0 1px 3px rgba(0, 0, 0, 0.05)' : 'none',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '8px',
                      background: isSelected ? 'rgba(2, 132, 199, 0.12)' : 'rgba(100, 116, 139, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {getContextIcon(conv.contextType)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: conv.unreadCount > 0 ? 700 : 600,
                          color: 'var(--text, #0f172a)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {conv.title}
                      </span>
                      {conv.lastMessageAt && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            color: 'var(--muted, #94a3b8)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            flexShrink: 0,
                            marginLeft: '0.35rem',
                          }}
                        >
                          <Clock size={10} />
                          {formatTime(conv.lastMessageAt)}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                      {getContextBadge(conv.contextType)}
                      <span
                        style={{
                          fontSize: '0.74rem',
                          color: conv.unreadCount > 0 ? 'var(--text, #0f172a)' : 'var(--muted, #64748b)',
                          fontWeight: conv.unreadCount > 0 ? 600 : 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {conv.lastMessageSnippet || 'No messages yet'}
                      </span>
                    </div>
                  </div>

                  {conv.unreadCount > 0 && (
                    <span
                      style={{
                        padding: '0.12rem 0.4rem',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        borderRadius: '10px',
                        backgroundColor: '#ef4444',
                        color: '#ffffff',
                        flexShrink: 0,
                        marginLeft: '0.25rem',
                      }}
                    >
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

