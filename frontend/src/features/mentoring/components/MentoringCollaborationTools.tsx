import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Link2, Plus } from 'lucide-react';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatusPill,
  useToast,
} from '../../../shared/components/ui';
import { mentoringPairingApi } from '../api/mentoringPairingApi';

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    return error.response?.data?.message ?? error.message;
  }
  return error instanceof Error ? error.message : fallback;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function MentoringResourcesPanel({
  relationshipId,
  canAdd,
}: {
  relationshipId: number;
  canAdd: boolean;
}) {
  const [targetType, setTargetType] = useState<'FILE' | 'LINK'>('LINK');
  const [file, setFile] = useState<File | null>(null);
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const resourcesQuery = useQuery({
    queryKey: ['mentoring', 'resources', relationshipId],
    queryFn: () => mentoringPairingApi.listResources(relationshipId),
  });
  const addMutation = useMutation({
    mutationFn: (input: { title: string; externalUrl?: string; file?: File }) =>
      mentoringPairingApi.addResource(relationshipId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mentoring', 'resources', relationshipId] });
      setFile(null);
      pushToast({ title: 'Resource shared', message: 'The resource is now available to this relationship.', tone: 'ok' });
    },
    onError: (error: unknown) => pushToast({
      title: 'Unable to share resource',
      message: getErrorMessage(error, 'Please try again.'),
      tone: 'err',
    }),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get('title') ?? '').trim();
    const externalUrl = String(formData.get('externalUrl') ?? '').trim();
    if (!title || (targetType === 'FILE' && !file) || (targetType === 'LINK' && !externalUrl)) return;
    addMutation.mutate(targetType === 'FILE' ? { title, file: file ?? undefined } : { title, externalUrl });
    event.currentTarget.reset();
  };

  const download = async (resourceId: number, fileName: string) => {
    try {
      const blob = await mentoringPairingApi.downloadResource(relationshipId, resourceId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      pushToast({
        title: 'Unable to download resource',
        message: getErrorMessage(error, 'Please try again.'),
        tone: 'err',
      });
    }
  };

  if (resourcesQuery.isLoading) return <LoadingSkeleton rows={3} height={26} />;
  if (resourcesQuery.isError) {
    return <ErrorState message={getErrorMessage(resourcesQuery.error, 'Unable to load resources.')} onRetry={() => void resourcesQuery.refetch()} />;
  }

  return (
    <div className="boa-stack">
      {canAdd && (
        <form className="apid-card boa-stack" onSubmit={handleSubmit}>
          <div>
            <h3 className="boa-card-title">Share a resource</h3>
            <p className="boa-card-subtitle">Share a learning link or upload a file with this mentoring relationship.</p>
          </div>
          <div className="boa-grid-2">
            <label>
              Resource title
              <input className="apid-input" name="title" maxLength={180} required disabled={addMutation.isPending} />
            </label>
            <label>
              Type
              <select
                className="apid-input"
                value={targetType}
                onChange={(event) => {
                  setTargetType(event.target.value as 'FILE' | 'LINK');
                  setFile(null);
                }}
                disabled={addMutation.isPending}
              >
                <option value="LINK">External link</option>
                <option value="FILE">File upload</option>
              </select>
            </label>
          </div>
          {targetType === 'LINK' ? (
            <label>
              HTTPS or HTTP link
              <input className="apid-input" type="url" name="externalUrl" maxLength={1000} required disabled={addMutation.isPending} />
            </label>
          ) : (
            <label>
              File (PDF, Office document, or image; up to 25 MB)
              <input
                className="apid-input"
                type="file"
                accept=".pdf,.pptx,.docx,.xlsx,.png,.jpg,.jpeg"
                required
                disabled={addMutation.isPending}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
          )}
          <div>
            <button type="submit" className="apid-btn apid-btn-primary apid-btn-sm" disabled={addMutation.isPending}>
              <Plus size={14} /> {addMutation.isPending ? 'Sharing...' : 'Share resource'}
            </button>
          </div>
        </form>
      )}
      {(resourcesQuery.data ?? []).length === 0 ? (
        <EmptyState title="No resources yet" description="Learning links and files shared with this relationship will appear here." />
      ) : (
        <div className="boa-stack">
          {(resourcesQuery.data ?? []).map((resource) => (
            <article key={resource.id} className="apid-card" style={{ border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div>
                  <strong>{resource.title}</strong>
                  <div className="boa-muted" style={{ fontSize: '0.8rem' }}>
                    Shared by {resource.uploadedByName} · {formatDateTime(resource.createdAt)}
                  </div>
                </div>
                <StatusPill label={resource.resourceType} tone="neutral" />
              </div>
              {resource.resourceType === 'FILE' ? (
                <button
                  type="button"
                  className="apid-btn apid-btn-outline apid-btn-sm"
                  onClick={() => void download(resource.id, resource.fileName ?? resource.title)}
                >
                  <Download size={14} /> {resource.fileName ?? 'Download file'}
                </button>
              ) : (
                <a href={resource.externalUrl ?? undefined} target="_blank" rel="noreferrer" className="apid-btn apid-btn-outline apid-btn-sm">
                  <Link2 size={14} /> Open resource
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function MentoringProgressPanel({
  relationshipId,
  canAdd,
}: {
  relationshipId: number;
  canAdd: boolean;
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [note, setNote] = useState('');
  const notesQuery = useQuery({
    queryKey: ['mentoring', 'progress-notes', relationshipId],
    queryFn: () => mentoringPairingApi.listProgressNotes(relationshipId),
  });
  const addMutation = useMutation({
    mutationFn: () => mentoringPairingApi.addProgressNote(relationshipId, note.trim()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mentoring', 'progress-notes', relationshipId] });
      setNote('');
      pushToast({ title: 'Progress recorded', message: 'Your mentoring milestone has been saved.', tone: 'ok' });
    },
    onError: (error: unknown) => pushToast({
      title: 'Unable to record progress',
      message: getErrorMessage(error, 'Please try again.'),
      tone: 'err',
    }),
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (note.trim()) addMutation.mutate();
  };

  if (notesQuery.isLoading) return <LoadingSkeleton rows={3} height={26} />;
  if (notesQuery.isError) {
    return <ErrorState message={getErrorMessage(notesQuery.error, 'Unable to load progress notes.')} onRetry={() => void notesQuery.refetch()} />;
  }

  return (
    <div className="boa-stack">
      {canAdd && (
        <form className="apid-card boa-stack" onSubmit={submit}>
          <label>
            Progress note or milestone
            <textarea
              className="apid-input"
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Record a goal reached, an insight, or a next step."
              required
              disabled={addMutation.isPending}
            />
          </label>
          <div>
            <button type="submit" className="apid-btn apid-btn-primary apid-btn-sm" disabled={!note.trim() || addMutation.isPending}>
              {addMutation.isPending ? 'Saving...' : 'Add progress note'}
            </button>
          </div>
        </form>
      )}
      {(notesQuery.data ?? []).length === 0 ? (
        <EmptyState title="No progress notes yet" description="Mentoring milestones and next steps will appear here." />
      ) : (
        <div className="boa-stack">
          {(notesQuery.data ?? []).map((progressNote) => (
            <article key={progressNote.id} className="apid-card" style={{ border: '1px solid var(--border)' }}>
              <div className="boa-muted" style={{ fontSize: '0.8rem' }}>
                {progressNote.authorName} · {formatDateTime(progressNote.createdAt)}
              </div>
              <p style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{progressNote.note}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function MentoringFeedbackForm({
  relationshipId,
  enabled,
}: {
  relationshipId: number;
  enabled: boolean;
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [rating, setRating] = useState('5');
  const [feedback, setFeedback] = useState('');
  const feedbackQuery = useQuery({
    queryKey: ['mentoring', 'feedback', relationshipId],
    queryFn: () => mentoringPairingApi.getMyFeedback(relationshipId),
    enabled,
  });
  const submitMutation = useMutation({
    mutationFn: () => mentoringPairingApi.submitFeedback(relationshipId, {
      rating: Number(rating),
      feedback: feedback.trim() || undefined,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mentoring', 'feedback', relationshipId] });
      await queryClient.invalidateQueries({ queryKey: ['mentoring', 'hr-overview'] });
      pushToast({ title: 'Feedback submitted', message: 'Thank you for sharing your mentoring experience.', tone: 'ok' });
    },
    onError: (error: unknown) => pushToast({
      title: 'Unable to submit feedback',
      message: getErrorMessage(error, 'Please try again.'),
      tone: 'err',
    }),
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitMutation.mutate();
  };

  if (!enabled) return null;
  if (feedbackQuery.isLoading) return <LoadingSkeleton rows={2} height={24} />;
  if (feedbackQuery.isError) {
    return <ErrorState message={getErrorMessage(feedbackQuery.error, 'Unable to load your feedback status.')} onRetry={() => void feedbackQuery.refetch()} />;
  }
  if (feedbackQuery.data) {
    return (
      <section className="apid-card">
        <h3 className="boa-card-title">Your mentoring feedback</h3>
        <p><strong>{feedbackQuery.data.rating} / 5</strong>{feedbackQuery.data.feedback ? ` · ${feedbackQuery.data.feedback}` : ''}</p>
      </section>
    );
  }
  return (
    <form className="apid-card boa-stack" onSubmit={submit}>
      <div>
        <h3 className="boa-card-title">Rate your mentoring experience</h3>
        <p className="boa-card-subtitle">Optional feedback helps HR measure mentoring quality.</p>
      </div>
      <label>
        Rating
        <select className="apid-input" value={rating} onChange={(event) => setRating(event.target.value)} disabled={submitMutation.isPending}>
          {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}
        </select>
      </label>
      <label>
        Feedback (optional)
        <textarea className="apid-input" rows={3} maxLength={2000} value={feedback} onChange={(event) => setFeedback(event.target.value)} disabled={submitMutation.isPending} />
      </label>
      <div>
        <button type="submit" className="apid-btn apid-btn-primary apid-btn-sm" disabled={submitMutation.isPending}>
          {submitMutation.isPending ? 'Submitting...' : 'Submit feedback'}
        </button>
      </div>
    </form>
  );
}

export function MentoringRelationshipClosure({
  relationshipId,
  relationshipStatus,
  canCompleteRelationship,
  completionBlockedReason,
  onClosed,
}: {
  relationshipId: number;
  relationshipStatus: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'REASSIGNED';
  canCompleteRelationship: boolean;
  completionBlockedReason: string | null;
  onClosed: () => void;
}) {
  const { pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'COMPLETED' | 'CANCELLED'>('COMPLETED');
  const [reason, setReason] = useState('');
  const closeMutation = useMutation({
    mutationFn: () => mentoringPairingApi.closeRelationship(relationshipId, { status, reason: reason.trim() }),
    onSuccess: () => {
      onClosed();
      setOpen(false);
      setReason('');
      pushToast({ title: 'Relationship closed', message: `The mentoring relationship is ${status.toLowerCase()}.`, tone: 'ok' });
    },
    onError: (error: unknown) => pushToast({
      title: 'Unable to close relationship',
      message: getErrorMessage(error, 'Please try again.'),
      tone: 'err',
    }),
  });
  if (relationshipStatus !== 'ACTIVE' && relationshipStatus !== 'PAUSED') return null;

  return (
    <>
      <button type="button" className="apid-btn apid-btn-outline apid-btn-sm" onClick={() => setOpen(true)}>
        Close relationship
      </button>
      {open && (
        <div className="apid-modal-backdrop" role="dialog" aria-modal="true" aria-label="Close mentoring relationship">
          <form className="apid-card apid-modal boa-stack" onSubmit={(event) => {
            event.preventDefault();
            if (reason.trim().length >= 5 && (status === 'CANCELLED' || canCompleteRelationship)) {
              closeMutation.mutate();
            }
          }}>
            <h3 style={{ margin: 0 }}>Close mentoring relationship</h3>
            <label>
              Outcome
              <select className="apid-input" value={status} onChange={(event) => setStatus(event.target.value as 'COMPLETED' | 'CANCELLED')}>
                <option value="COMPLETED" disabled={!canCompleteRelationship}>Complete objectives</option>
                <option value="CANCELLED">Cancel relationship</option>
              </select>
            </label>
            {status === 'COMPLETED' && !canCompleteRelationship && (
              <p className="boa-muted" role="status">
                {completionBlockedReason ?? 'Complete all confirmed sessions before completing the relationship.'}
              </p>
            )}
            <label>
              Reason or completion summary
              <textarea className="apid-input" rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} required />
            </label>
            <div className="apid-modal-actions">
              <button type="button" className="apid-btn apid-btn-outline" disabled={closeMutation.isPending} onClick={() => setOpen(false)}>
                Keep open
              </button>
              <button
                type="submit"
                className="apid-btn apid-btn-primary"
                disabled={
                  closeMutation.isPending ||
                  reason.trim().length < 5 ||
                  (status === 'COMPLETED' && !canCompleteRelationship)
                }
              >
                {closeMutation.isPending ? 'Saving...' : `Confirm ${status.toLowerCase()}`}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
