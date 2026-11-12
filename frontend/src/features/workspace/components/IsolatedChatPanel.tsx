import { useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import { DataSourceBadge, useToast } from '../../../shared/components/ui';
import { workspacePreviewAdapter } from '../api/workspaceDashboardApi';

export interface ChatMessageItem {
  id: string;
  sender: string;
  body: string;
  time: string;
}

export function IsolatedChatPanel({
  contextTitle,
  contextKey,
  messages,
  onSendMessage,
}: {
  contextTitle: string;
  contextKey: 'coaching' | 'mentoring';
  messages: ChatMessageItem[];
  onSendMessage: (body: string) => void;
}) {
  const { pushToast } = useToast();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const text = draft.trim();
      const res = await workspacePreviewAdapter.simulateAction(
        `${contextKey.toUpperCase()} chat message`
      );
      onSendMessage(text);
      setDraft('');
      pushToast({ title: 'Message sent (Preview)', message: res.message, tone: 'info' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="apid-card" data-testid={`isolated-chat-${contextKey}`}>
      <div className="boa-card-header">
        <div>
          <h3 className="boa-card-title">{contextTitle}</h3>
          <p className="boa-card-subtitle">
            Private thread for this {contextKey} track only.
          </p>
        </div>
        <DataSourceBadge source="preview" />
      </div>

      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: 'var(--surface-subtle)',
          padding: '0.75rem',
          maxHeight: 210,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.55rem',
          marginBottom: '0.75rem',
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              background: m.sender === 'You' ? '#fffbeb' : '#ffffff',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.5rem 0.7rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
              <strong>{m.sender}</strong>
              <span className="boa-muted">{m.time}</span>
            </div>
            <div style={{ fontSize: '0.84rem', marginTop: '0.2rem' }}>{m.body}</div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          className="apid-input"
          style={{ flex: 1 }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Write a ${contextKey} update...`}
        />
        <button type="submit" className="apid-btn apid-btn-primary apid-btn-sm" disabled={busy}>
          <Send size={14} /> Send
        </button>
      </form>
    </div>
  );
}

