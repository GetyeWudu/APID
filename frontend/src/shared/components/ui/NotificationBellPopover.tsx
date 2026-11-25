import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CheckCheck,
  Clock,
  AlertTriangle,
  Award,
  Users,
  Sparkles,
  ChevronRight,
  Inbox,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import { notificationsApi, type NotificationItem } from '../../api/notificationsApi';

export interface PreviewNotificationItem {
  id: string;
  title: string;
  body: string;
  timeAgo: string;
  module: 'COACHING' | 'MENTORING' | 'SYSTEM';
  targetRoute: string;
  read: boolean;
}

function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ModuleTheme {
  icon: typeof AlertTriangle;
  label: string;
  bg: string;
  text: string;
  border: string;
}

function resolveModuleTheme(item: NotificationItem): ModuleTheme {
  const titleLower = item.title.toLowerCase();
  const eventLower = (item.eventType || '').toLowerCase();

  if (
    eventLower.includes('stalled') ||
    titleLower.includes('stalled') ||
    titleLower.includes('critical') ||
    titleLower.includes('inactivity')
  ) {
    return {
      icon: AlertTriangle,
      label: 'PACING ALERT',
      bg: '#fef2f2',
      text: '#dc2626',
      border: '#fecaca',
    };
  }

  if (
    eventLower.includes('pacing') ||
    titleLower.includes('pacing') ||
    titleLower.includes('reminder') ||
    titleLower.includes('gate')
  ) {
    return {
      icon: Clock,
      label: 'PACING REMINDER',
      bg: '#fffbeb',
      text: '#b45309',
      border: '#fde68a',
    };
  }

  if (item.module === 'COACHING') {
    return {
      icon: Award,
      label: 'COACHING',
      bg: '#eff6ff',
      text: '#1d4ed8',
      border: '#bfdbfe',
    };
  }

  if (item.module === 'MENTORING') {
    return {
      icon: Users,
      label: 'MENTORING',
      bg: '#f0fdfa',
      text: '#0f766e',
      border: '#99f6e4',
    };
  }

  return {
    icon: Sparkles,
    label: 'SYSTEM',
    bg: '#f8fafc',
    text: '#475569',
    border: '#e2e8f0',
  };
}

export function NotificationBellPopover() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const notificationsQuery = useQuery({
    queryKey: ['core', 'notifications', 'popover'],
    queryFn: () => notificationsApi.list({ page: 0, size: 20 }),
    enabled: Boolean(isAuthenticated && user && !user.mustChangePassword),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['core', 'notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['core', 'notifications'] });
    },
  });

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEsc);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const items = notificationsQuery.data?.items ?? [];
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;

  const handleSelectItem = async (item: NotificationItem) => {
    if (!item.read) {
      await markReadMutation.mutateAsync(item.id);
    }
    setOpen(false);
    if (item.deepLink) {
      navigate(item.deepLink);
    }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* 1. Sleek Bell Trigger Button */}
      <button
        type="button"
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: '999px',
          border: '1px solid var(--border, #e2e8f0)',
          backgroundColor: open ? 'var(--surface-subtle, #f1f5f9)' : 'var(--surface, #ffffff)',
          color: 'var(--text, #0f172a)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: open ? '0 0 0 2px rgba(245, 183, 0, 0.3)' : 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--surface-subtle, #f1f5f9)';
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.backgroundColor = 'var(--surface, #ffffff)';
          }
        }}
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
              minWidth: 18,
              height: 18,
              padding: '0 4px',
              borderRadius: '999px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              fontSize: '0.65rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(220, 38, 38, 0.4)',
              border: '2px solid #ffffff',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 2. Modern Enterprise Notification Card Popover */}
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: 'min(440px, 94vw)',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow:
              '0 20px 45px -10px rgba(15, 23, 42, 0.22), 0 0 1px rgba(15, 23, 42, 0.15)',
            zIndex: 100,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '0.85rem 1.15rem',
              background: 'linear-gradient(to right, #f8fafc, #ffffff)',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0f172a',
                }}
              >
                <Bell size={15} />
              </div>
              <strong style={{ fontSize: '0.92rem', color: '#0f172a', fontWeight: 800 }}>
                Notifications
              </strong>
              {unreadCount > 0 ? (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.55rem',
                    borderRadius: '999px',
                    backgroundColor: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                  }}
                >
                  {unreadCount} unread
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
                  }}
                >
                  All caught up
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                disabled={markAllReadMutation.isPending}
                onClick={() => void markAllReadMutation.mutateAsync()}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#4f46e5',
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  padding: '0.28rem 0.65rem',
                  borderRadius: '6px',
                  cursor: markAllReadMutation.isPending ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  transition: 'background 0.15s ease',
                }}
              >
                <CheckCheck size={13} />
                <span>{markAllReadMutation.isPending ? 'Updating...' : 'Mark all read'}</span>
              </button>
            )}
          </div>

          {/* Body Content / Notifications List */}
          <div
            style={{
              maxHeight: '460px',
              overflowY: 'auto',
              padding: '0.65rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              backgroundColor: '#fafaf9',
            }}
          >
            {notificationsQuery.isLoading ? (
              <div
                style={{
                  padding: '2.5rem 1.5rem',
                  fontSize: '0.82rem',
                  color: '#64748b',
                  textAlign: 'center',
                }}
              >
                Loading activity and alerts...
              </div>
            ) : notificationsQuery.isError ? (
              <div
                style={{
                  padding: '2rem 1.5rem',
                  fontSize: '0.82rem',
                  color: '#dc2626',
                  textAlign: 'center',
                }}
              >
                Unable to load notification stream.
              </div>
            ) : items.length === 0 ? (
              <div
                style={{
                  padding: '3rem 1.5rem',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    backgroundColor: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                  }}
                >
                  <Inbox size={22} />
                </div>
                <strong style={{ fontSize: '0.88rem', color: '#1e293b' }}>
                  No notifications yet
                </strong>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', maxWidth: '240px' }}>
                  You are fully up to date with all your coaching sessions and platform updates.
                </p>
              </div>
            ) : (
              items.map((item) => {
                const theme = resolveModuleTheme(item);
                const IconComp = theme.icon;
                const cleanTitle = item.title.replace(/^⚠️\s*/, '').replace(/^📅\s*/, '');

                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => void handleSelectItem(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        void handleSelectItem(item);
                      }
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '0.75rem 0.85rem',
                      borderRadius: '12px',
                      backgroundColor: item.read ? '#ffffff' : '#f8faff',
                      border: item.read ? '1px solid #f1f5f9' : '1px solid #e0e7ff',
                      borderLeft: item.read ? '3.5px solid transparent' : '3.5px solid #f59e0b',
                      boxShadow: item.read
                        ? '0 1px 2px rgba(0,0,0,0.02)'
                        : '0 2px 8px rgba(245, 158, 11, 0.08)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = item.read ? '#f8fafc' : '#eff6ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = item.read ? '#ffffff' : '#f8faff';
                    }}
                  >
                    {/* Top Row: Module Badge + Time + Unread Dot */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.64rem',
                          fontWeight: 800,
                          letterSpacing: '0.03em',
                          padding: '0.12rem 0.5rem',
                          borderRadius: '999px',
                          backgroundColor: theme.bg,
                          color: theme.text,
                          border: `1px solid ${theme.border}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.28rem',
                        }}
                      >
                        <IconComp size={10} />
                        {theme.label}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>
                          {formatRelativeTime(item.createdAt)}
                        </span>
                        {!item.read && (
                          <span
                            title="Unread"
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              backgroundColor: '#f59e0b',
                              display: 'inline-block',
                            }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Notification Title */}
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        color: '#0f172a',
                        marginTop: '0.4rem',
                        lineHeight: 1.35,
                      }}
                    >
                      {cleanTitle}
                    </div>

                    {/* Notification Message */}
                    <div
                      style={{
                        fontSize: '0.77rem',
                        color: '#475569',
                        marginTop: '0.25rem',
                        lineHeight: 1.45,
                        wordBreak: 'break-word',
                      }}
                    >
                      {item.message}
                    </div>

                    {/* Action Deep Link Hint (if present) */}
                    {item.deepLink && (
                      <div
                        style={{
                          marginTop: '0.45rem',
                          paddingTop: '0.35rem',
                          borderTop: '1px dashed #f1f5f9',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#2563eb',
                        }}
                      >
                        <span>View details</span>
                        <ChevronRight size={12} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '0.55rem 1.15rem',
              backgroundColor: '#f8fafc',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.7rem',
              color: '#94a3b8',
            }}
          >
            <span>Bank of Abyssinia · APID Intelligence</span>
            <span>Real-time In-App Sync</span>
          </div>
        </div>
      )}
    </div>
  );
}
