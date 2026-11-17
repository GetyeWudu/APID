import React, { useRef, useEffect, useState } from 'react';
import {
  Pin,
  Reply,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File as GenericFile,
  Download,
  CheckCheck,
  ShieldCheck,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { MessageDto, AttachmentDto, ConversationParticipantRole, coachingCommunicationApi } from '../../api/coachingCommunicationApi';

interface MessageThreadViewProps {
  messages: MessageDto[];
  currentUserId?: number;
  isCoachOrAdmin: boolean;
  onReplyMessage: (msg: MessageDto) => void;
  onTogglePinMessage: (msg: MessageDto) => void;
  downloadAttachmentFn?: (attachmentId: number, fileName: string) => Promise<void>;
}

export const MessageThreadView: React.FC<MessageThreadViewProps> = ({
  messages,
  currentUserId,
  isCoachOrAdmin,
  onReplyMessage,
  onTogglePinMessage,
  downloadAttachmentFn,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const handleDownloadAttachment = async (att: AttachmentDto) => {
    if (downloadingId === att.id) return;
    setDownloadingId(att.id);
    try {
      const downloader = downloadAttachmentFn ?? coachingCommunicationApi.downloadAttachment;
      await downloader(att.id, att.fileName);
    } catch (err) {
      console.error('Failed to download attachment', err);
    } finally {
      setDownloadingId(null);
    }
  };

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatMessageTime = (iso: string): string => {
    try {
      const date = new Date(iso);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText size={20} style={{ color: '#ef4444' }} />;
    if (ext === 'xlsx' || ext === 'csv') return <FileSpreadsheet size={20} style={{ color: '#10b981' }} />;
    if (ext === 'docx' || ext === 'doc') return <FileText size={20} style={{ color: '#0284c7' }} />;
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp')
      return <ImageIcon size={20} style={{ color: '#8b5cf6' }} />;
    return <GenericFile size={20} style={{ color: '#64748b' }} />;
  };

  const renderRoleBadge = (role?: ConversationParticipantRole) => {
    if (!role) return null;
    switch (role) {
      case 'COACH':
        return (
          <span
            className="boa-pill"
            style={{
              fontSize: '0.65rem',
              padding: '0.08rem 0.35rem',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#d97706',
              fontWeight: 700,
            }}
          >
            Coach
          </span>
        );
      case 'COACHEE':
        return (
          <span
            className="boa-pill"
            style={{
              fontSize: '0.65rem',
              padding: '0.08rem 0.35rem',
              background: 'rgba(2, 132, 199, 0.12)',
              color: '#0284c7',
              fontWeight: 600,
            }}
          >
            Talent
          </span>
        );
      case 'PEER':
        return (
          <span
            className="boa-pill"
            style={{
              fontSize: '0.65rem',
              padding: '0.08rem 0.35rem',
              background: 'rgba(100, 116, 139, 0.12)',
              color: '#475569',
              fontWeight: 600,
            }}
          >
            Peer
          </span>
        );
      default:
        return null;
    }
  };

  const pinnedList = messages.filter((m) => m.pinned && !m.deleted);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Pinned Messages Banner */}
      {pinnedList.length > 0 && (
        <div
          style={{
            padding: '0.5rem 1rem',
            background: 'rgba(245, 158, 11, 0.08)',
            borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
            <Pin size={15} style={{ color: '#d97706', transform: 'rotate(45deg)', flexShrink: 0 }} />
            <span style={{ fontWeight: 700, color: '#b45309', flexShrink: 0 }}>Pinned:</span>
            <span
              style={{
                color: 'var(--text, #1e293b)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {pinnedList[0].content}
            </span>
          </div>
          {isCoachOrAdmin && (
            <button
              type="button"
              onClick={() => onTogglePinMessage(pinnedList[0])}
              style={{
                background: 'none',
                border: 'none',
                color: '#d97706',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
                textDecoration: 'underline',
              }}
            >
              Unpin
            </button>
          )}
        </div>
      )}

      {/* Message List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {messages.length === 0 ? (
          <div
            style={{
              padding: '3rem 1rem',
              textAlign: 'center',
              color: 'var(--muted, #94a3b8)',
              margin: 'auto 0',
            }}
          >
            <Sparkles size={36} style={{ color: 'var(--brand-gold, #f59e0b)', margin: '0 auto 0.65rem' }} />
            <h4 style={{ margin: '0 0 0.35rem', fontSize: '1rem', color: 'var(--text, #0f172a)' }}>
              Conversation Initialized
            </h4>
            <p style={{ margin: 0, fontSize: '0.83rem', maxWidth: '380px', marginInline: 'auto' }}>
              Welcome to the private coaching channel. Share exercises, ask questions, exchange guidelines and learning
              materials.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = currentUserId != null && msg.senderUserId === currentUserId;

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMine ? 'flex-end' : 'flex-start',
                  position: 'relative',
                }}
              >
                {/* Sender Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    marginBottom: '0.2rem',
                    paddingInline: '0.25rem',
                  }}
                >
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text, #334155)' }}>
                    {isMine ? 'You' : msg.senderName}
                  </span>
                  {renderRoleBadge(msg.senderRole)}
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted, #94a3b8)', marginLeft: '0.2rem' }}>
                    {formatMessageTime(msg.createdAt)}
                  </span>
                  {msg.pinned && (
                    <span title="Pinned by coach">
                      <Pin
                        size={12}
                        style={{ color: '#d97706', transform: 'rotate(45deg)', marginLeft: '0.15rem' }}
                      />
                    </span>
                  )}
                </div>

                {/* Message Card */}
                <div
                  style={{
                    maxWidth: '82%',
                    minWidth: '120px',
                    padding: '0.75rem 0.95rem',
                    borderRadius: isMine ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    background: isMine
                      ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.05) 100%)'
                      : 'var(--surface, #ffffff)',
                    border: isMine ? '1px solid rgba(245, 158, 11, 0.28)' : '1px solid var(--border, #e2e8f0)',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                    position: 'relative',
                  }}
                >
                  {/* Replied-to Reference Box */}
                  {msg.replyToSnippet && (
                    <div
                      style={{
                        padding: '0.35rem 0.65rem',
                        marginBottom: '0.5rem',
                        borderRadius: '6px',
                        background: 'rgba(100, 116, 139, 0.08)',
                        borderLeft: '3px solid #0284c7',
                        fontSize: '0.75rem',
                      }}
                    >
                      <span style={{ fontWeight: 700, color: '#0284c7', display: 'block' }}>
                        {msg.replyToSenderName || 'Participant'}
                      </span>
                      <span
                        style={{
                          color: 'var(--muted, #475569)',
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {msg.replyToSnippet}
                      </span>
                    </div>
                  )}

                  {/* Body Text */}
                  {msg.deleted ? (
                    <span style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--muted, #94a3b8)' }}>
                      This message was deleted.
                    </span>
                  ) : (
                    <div
                      style={{
                        fontSize: '0.88rem',
                        lineHeight: 1.5,
                        color: 'var(--text, #0f172a)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {msg.content}
                    </div>
                  )}

                  {/* Attachments Section */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {msg.attachments.map((att: AttachmentDto) => (
                        <div
                          key={att.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '8px',
                            background: 'var(--surface-subtle, #f8fafc)',
                            border: '1px solid var(--border, #cbd5e1)',
                            gap: '0.65rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', overflow: 'hidden' }}>
                            {getFileIcon(att.fileName)}
                            <div style={{ overflow: 'hidden' }}>
                              <span
                                style={{
                                  display: 'block',
                                  fontSize: '0.82rem',
                                  fontWeight: 600,
                                  color: 'var(--text, #1e293b)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {att.fileName}
                              </span>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  fontSize: '0.7rem',
                                  color: 'var(--muted, #64748b)',
                                }}
                              >
                                <span>{formatFileSize(att.fileSizeBytes)}</span>
                                <span>•</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', color: '#10b981' }}>
                                  <ShieldCheck size={11} /> Verified
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => void handleDownloadAttachment(att)}
                            disabled={downloadingId === att.id}
                            className="apid-btn apid-btn-outline"
                            title={`Download ${att.fileName}`}
                            style={{
                              padding: '0.3rem 0.55rem',
                              fontSize: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              flexShrink: 0,
                              cursor: downloadingId === att.id ? 'wait' : 'pointer',
                              color: '#0284c7',
                              borderColor: '#bae6fd',
                              background: '#ffffff',
                            }}
                          >
                            {downloadingId === att.id ? (
                              <Loader2 size={13} className="apid-spin" />
                            ) : (
                              <Download size={13} />
                            )}
                            <span>{downloadingId === att.id ? 'Saving...' : 'Download'}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions footer */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '0.65rem',
                      marginTop: '0.35rem',
                      paddingTop: '0.2rem',
                    }}
                  >
                    {!msg.deleted && (
                      <button
                        type="button"
                        onClick={() => onReplyMessage(msg)}
                        title="Reply to this message"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--muted, #64748b)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          fontSize: '0.72rem',
                          padding: 0,
                        }}
                      >
                        <Reply size={12} />
                        <span>Reply</span>
                      </button>
                    )}

                    {isCoachOrAdmin && !msg.deleted && (
                      <button
                        type="button"
                        onClick={() => onTogglePinMessage(msg)}
                        title={msg.pinned ? 'Unpin message' : 'Pin message for all participants'}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: msg.pinned ? '#d97706' : 'var(--muted, #94a3b8)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          fontSize: '0.72rem',
                          padding: 0,
                        }}
                      >
                        <Pin size={12} style={{ transform: msg.pinned ? 'rotate(45deg)' : 'none' }} />
                        <span>{msg.pinned ? 'Pinned' : 'Pin'}</span>
                      </button>
                    )}

                    {isMine && (
                      <span title="Delivered">
                        <CheckCheck size={13} style={{ color: '#0284c7', marginLeft: '0.15rem' }} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
