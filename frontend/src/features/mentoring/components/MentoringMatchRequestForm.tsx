import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import type { SkillItem } from '../../admin/skills/types/skills.types';
import { EmptyState, StatusPill, useToast } from '../../../shared/components/ui';
import { mentoringMatchApi } from '../api/mentoringMatchApi';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';

export function MentoringMatchRequestForm({ skills }: { skills: SkillItem[] }) {
  const [skillId, setSkillId] = useState('');
  const [message, setMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const requestsQuery = useQuery({
    queryKey: ['mentoring', 'match-requests', 'mine'],
    queryFn: mentoringMatchApi.listMine,
  });
  const openRequest = (requestsQuery.data ?? []).some((request) => request.status === 'OPEN');
  const submitMutation = useMutation({
    mutationFn: mentoringMatchApi.submit,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mentoring', 'match-requests', 'mine'] });
      setMessage('');
      setIsOpen(false);
      pushToast({
        title: 'Matching request submitted',
        message: 'HR can now review your requested skill and match you with an active trainer.',
        tone: 'ok',
      });
    },
    onError: (error: unknown) => {
      const errorMessage = axios.isAxiosError<ApiErrorPayload>(error)
        ? error.response?.data?.message ?? error.message
        : error instanceof Error ? error.message : 'Unable to submit your matching request.';
      pushToast({ title: 'Request failed', message: errorMessage, tone: 'err' });
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!skillId) return;
    submitMutation.mutate({ skillId: Number(skillId), message: message.trim() || undefined });
  };

  return (
    <section className="apid-card boa-stack">
      <div>
        <h2 className="boa-card-title">Need help finding a mentor?</h2>
        <p className="boa-card-subtitle">
          Ask HR to match you with an active mentor based on the skill you want to learn.
        </p>
      </div>
      <div>
        <button
          type="button"
          className="apid-btn apid-btn-primary"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(true)}
        >
          Ask HR to find a mentor
        </button>
        {openRequest && (
          <span className="boa-muted" style={{ marginLeft: '0.75rem' }}>
            You already have an open request.
          </span>
        )}
      </div>

      {requestsQuery.isError && (
        <p className="apid-alert apid-alert-danger">Your previous matching requests could not be loaded.</p>
      )}
      {(requestsQuery.data ?? []).length > 0 && (
        <div className="boa-stack">
          <h3 style={{ margin: 0 }}>Your HR matching requests</h3>
          {(requestsQuery.data ?? []).map((request) => (
            <article key={request.id} className="apid-card" style={{ border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                <strong>{request.skillName}</strong>
                <StatusPill label={request.status} tone={request.status === 'MATCHED' ? 'ok' : 'info'} />
              </div>
              {request.message && <p className="boa-muted">{request.message}</p>}
              {request.matchedTrainerName && <p>Matched trainer: {request.matchedTrainerName}</p>}
              {request.status === 'OPEN' && <p className="boa-muted">HR will contact you after selecting an eligible trainer.</p>}
            </article>
          ))}
        </div>
      )}
      {!requestsQuery.isLoading && (requestsQuery.data ?? []).length === 0 && (
        <EmptyState title="No HR matching requests yet" description="Your requests and assigned mentors will appear here." />
      )}

      {isOpen && (
        <div className="apid-modal-backdrop">
          <div
            className="apid-card apid-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hr-match-request-title"
          >
            <div className="mentor-directory-modal-heading">
              <div>
                <h2 id="hr-match-request-title" className="boa-card-title">Ask HR to find a mentor</h2>
                <p className="boa-card-subtitle">
                  Tell HR which skill you want to learn and they will help find a match.
                </p>
              </div>
              <button
                type="button"
                className="apid-btn apid-btn-outline apid-btn-sm"
                aria-label="Close HR matching request"
                onClick={() => setIsOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form className="apid-form" onSubmit={submit}>
              <div className="apid-field">
                <label htmlFor="hr-match-skill">Skill you want to learn</label>
                <select
                  id="hr-match-skill"
                  className="apid-input"
                  value={skillId}
                  onChange={(event) => setSkillId(event.target.value)}
                  required
                  disabled={submitMutation.isPending || openRequest}
                >
                  <option value="">Select a skill</option>
                  {skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
                </select>
              </div>
              <div className="apid-field">
                <label htmlFor="hr-match-message">What would you like help with? (optional)</label>
                <textarea
                  id="hr-match-message"
                  className="apid-input"
                  rows={3}
                  maxLength={1000}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  disabled={submitMutation.isPending || openRequest}
                />
              </div>
              {openRequest && (
                <p className="boa-muted">You already have an open request. HR will contact you after selecting an eligible trainer.</p>
              )}
              <div className="apid-modal-actions">
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  disabled={submitMutation.isPending}
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="apid-btn apid-btn-primary"
                  disabled={!skillId || openRequest || submitMutation.isPending}
                >
                  {submitMutation.isPending ? 'Submitting...' : 'Request HR matching'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
