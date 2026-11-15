import React, { useState, useRef } from 'react';
import {
  Send,
  Paperclip,
  X,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File as GenericFile,
  Loader2,
} from 'lucide-react';
import { MessageDto, AttachmentDto, coachingCommunicationApi } from '../../api/coachingCommunicationApi';

interface MessageComposerProps {
  conversationId: number;
  replyToMessage: MessageDto | null;
  onCancelReply: () => void;
  onMessageSent: () => void;
  disabled?: boolean;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  conversationId,
  replyToMessage,
  onCancelReply,
  onMessageSent,
  disabled = false,
}) => {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<AttachmentDto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    // Check max file size (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('File exceeds 10MB limit.');
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);
    try {
      const att = await coachingCommunicationApi.uploadAttachment(conversationId, file);
      setAttachments((prev) => [...prev, att]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'File upload failed. Ensure format is permitted.';
      setErrorMsg(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (attachmentId: number) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  };

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed && attachments.length === 0) return;
    if (isSending || isUploading || disabled) return;

    setIsSending(true);
    setErrorMsg(null);
    try {
      const clientMessageId = `web-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      await coachingCommunicationApi.sendMessage(conversationId, {
        content: trimmed,
        messageType: attachments.length > 0 ? 'FILE' : 'TEXT',
        clientMessageId,
        replyToMessageId: replyToMessage?.id,
        attachmentIds: attachments.map((a) => a.id),
      });

      setContent('');
      setAttachments([]);
      onCancelReply();
      onMessageSent();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      setErrorMsg(msg);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const getFileBadgeIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText size={14} style={{ color: '#ef4444' }} />;
    if (ext === 'xlsx' || ext === 'csv') return <FileSpreadsheet size={14} style={{ color: '#10b981' }} />;
    if (ext === 'docx' || ext === 'doc') return <FileText size={14} style={{ color: '#0284c7' }} />;
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp')
      return <ImageIcon size={14} style={{ color: '#8b5cf6' }} />;
    return <GenericFile size={14} style={{ color: '#64748b' }} />;
  };

  return (
    <div
      style={{
        borderTop: '1px solid var(--border, #e2e8f0)',
        background: 'var(--surface, #ffffff)',
        padding: '0.75rem 1rem',
      }}
    >
      {/* Error alert */}
      {errorMsg && (
        <div
          style={{
            padding: '0.45rem 0.75rem',
            marginBottom: '0.5rem',
            borderRadius: '6px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#dc2626',
            fontSize: '0.78rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Reply target banner */}
      {replyToMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.4rem 0.75rem',
            marginBottom: '0.5rem',
            background: 'rgba(2, 132, 199, 0.08)',
            borderLeft: '3px solid #0284c7',
            borderRadius: '4px',
            fontSize: '0.78rem',
          }}
        >
          <div style={{ overflow: 'hidden' }}>
            <span style={{ fontWeight: 700, color: '#0284c7', marginRight: '0.4rem' }}>
              Replying to {replyToMessage.senderName}:
            </span>
            <span
              style={{
                color: 'var(--muted, #475569)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {replyToMessage.content}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted, #64748b)',
              cursor: 'pointer',
              padding: '0.1rem',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Attachments tray */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
          {attachments.map((att) => (
            <div
              key={att.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.25rem 0.55rem',
                borderRadius: '6px',
                background: 'var(--surface-subtle, #f8fafc)',
                border: '1px solid var(--border, #cbd5e1)',
                fontSize: '0.75rem',
                color: 'var(--text, #1e293b)',
              }}
            >
              {getFileBadgeIcon(att.fileName)}
              <span
                style={{
                  maxWidth: '180px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {att.fileName}
              </span>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted, #94a3b8)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,.docx,.xlsx,.pptx,.csv,.png,.jpg,.jpeg,.webp"
          style={{ display: 'none' }}
        />

        {/* Paperclip Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isSending || disabled}
          title="Share document or learning resource (PDF, Excel, Word, PPTX, Image)"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--muted, #64748b)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            padding: '0.45rem',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginBottom: '0.15rem',
          }}
        >
          {isUploading ? <Loader2 className="apid-spin" size={18} /> : <Paperclip size={18} />}
        </button>

        {/* Multi-line Textarea */}
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={content}
            disabled={disabled || isSending}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
            style={{
              width: '100%',
              minHeight: '38px',
              maxHeight: '120px',
              padding: '0.45rem 0.75rem',
              fontSize: '0.86rem',
              lineHeight: 1.4,
              borderRadius: '10px',
              border: '1px solid var(--border, #cbd5e1)',
              background: 'var(--surface-subtle, #f8fafc)',
              color: 'var(--text, #0f172a)',
              resize: 'none',
              outline: 'none',
            }}
          />
        </div>

        {/* Send Button */}
        <button
          type="button"
          className="apid-btn apid-btn-primary"
          onClick={handleSend}
          disabled={(!content.trim() && attachments.length === 0) || isSending || isUploading || disabled}
          style={{
            padding: '0.45rem 0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            borderRadius: '10px',
            flexShrink: 0,
            marginBottom: '0.15rem',
          }}
        >
          {isSending ? (
            <Loader2 className="apid-spin" size={16} />
          ) : (
            <>
              <span>Send</span>
              <Send size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
