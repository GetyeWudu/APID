import { useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DataSourceBadge } from './DataSourceBadge';

export interface PreviewNotificationItem {
  id: string;
  title: string;
  body: string;
  timeAgo: string;
  module: 'COACHING' | 'MENTORING' | 'SYSTEM';
  targetRoute: string;
  read: boolean;
}

/**
 * Persistent user-targeted notifications (strictly separate from Audit Logs and immediate Toasts).
 * Currently backed by preview items until Phase 4 core.notifications is implemented.
 */
export function NotificationBellPopover({
  initialItems,
  onNavigate,
}: {
  initialItems: PreviewNotificationItem[];
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PreviewNotificationItem[]>(initialItems);
  const navigate = useNavigate();

  const unreadCount = items.filter((i) => !i.read).length;

  const markAllRead = () => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  const handleOpenItem = (item: PreviewNotificationItem) => {
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, read: true } : x)));
    setOpen(false);
    navigate(item.targetRoute);
    onNavigate?.();
  };

  return (
    <div className="boa-popover-anchor">
      <button
        type="button"
        className="apid-btn apid-btn-outline"
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ padding: '0.42rem 0.65rem', position: 'relative' }}
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span
            className="tabular-nums"
            style={{
              background: '#b91c1c',
              color: '#ffffff',
              fontSize: '0.68rem',
              fontWeight: 700,
              borderRadius: 999,
              padding: '0.05rem 0.38rem',
              lineHeight: 1.3,
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="boa-popover-panel" role="dialog" aria-label="User notifications">
          <div
            style={{
              padding: '0.8rem 1rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <strong style={{ fontSize: '0.9rem' }}>Notifications</strong>
              <DataSourceBadge source="preview" />
            </div>
            {unreadCount > 0 && (
              <button type="button" className="apid-btn apid-btn-sm" onClick={markAllRead}>
                <CheckCheck size={13} />
                Mark read
              </button>
            )}
          </div>

          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
                No user notifications.
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleOpenItem(item)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.8rem 1rem',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    background: item.read ? 'var(--surface)' : '#fffbeb',
                    cursor: 'pointer',
                    display: 'block',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brand)' }}>
                      {item.module}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-soft)' }}>{item.timeAgo}</span>
                  </div>
                  <div style={{ fontWeight: item.read ? 500 : 700, fontSize: '0.85rem', marginTop: '0.15rem', color: 'var(--text)' }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: '0.79rem', color: 'var(--muted)', marginTop: '0.15rem', lineHeight: 1.35 }}>
                    {item.body}
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

