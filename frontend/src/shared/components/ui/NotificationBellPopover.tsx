import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
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

function moduleAccent(module: NotificationItem['module']): string {
  if (module === 'COACHING') return '#1d4ed8';
  if (module === 'MENTORING') return '#0f766e';
  return '#475569';
}

export function NotificationBellPopover() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const notificationsQuery = useQuery({
    queryKey: ['core', 'notifications', 'popover'],
    queryFn: () => notificationsApi.list({ page: 0, size: 15 }),
    enabled: Boolean(isAuthenticated && user && !user.mustChangePassword),
    refetchInterval: 60_000,
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
    <div ref={rootRef} className="boa-popover-anchor">
      <button
        type="button"
        className="boa-icon-btn"
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={18} />
        {unreadCount > 0 && <span className="boa-bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="boa-popover-panel" role="dialog" aria-label="Notifications">
          <div className="boa-popover-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <strong style={{ fontSize: '0.9rem' }}>Notifications</strong>
              {unreadCount > 0 && (
                <span className="apid-badge apid-badge-warn" style={{ fontSize: '0.7rem' }}>
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="boa-link-btn"
                disabled={markAllReadMutation.isPending}
                onClick={() => void markAllReadMutation.mutateAsync()}
                style={{ fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          <div className="boa-popover-list">
            {notificationsQuery.isLoading ? (
              <div style={{ padding: '1rem', fontSize: '0.82rem', color: 'var(--muted)', textAlign: 'center' }}>
                Loading alerts...
              </div>
            ) : notificationsQuery.isError ? (
              <div style={{ padding: '1rem', fontSize: '0.82rem', color: 'var(--danger)', textAlign: 'center' }}>
                Unable to load notifications.
              </div>
            ) : items.length === 0 ? (
              <div style={{ padding: '1.25rem', fontSize: '0.84rem', color: 'var(--muted)', textAlign: 'center' }}>
                All caught up — no notifications yet.
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`boa-notif-item ${!item.read ? 'unread' : ''}`}
                  onClick={() => void handleSelectItem(item)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        color: moduleAccent(item.module),
                      }}
                    >
                      {item.module}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.84rem', marginTop: '0.15rem' }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: '0.79rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                    {item.message}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
