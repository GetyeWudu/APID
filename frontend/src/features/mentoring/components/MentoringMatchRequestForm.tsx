import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SkillItem } from '../../admin/skills/types/skills.types';
import { EmptyState, StatusPill, useToast } from '../../../shared/components/ui';
import { mentoringMatchApi } from '../api/mentoringMatchApi';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';

export function MentoringMatchRequestForm({ skills }: { skills: SkillItem[] }) {
  const [skillId, setSkillId] = useState('');
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const requestsQuery = useQuery({
    queryKey: ['mentoring', 'match-requests', 'mine'],
    queryFn: mentoringMatchApi.listMine,
  });
  const submitMutation = useMutation({
    mutationFn: mentoringMatchApi.submit,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mentoring', 'match-requests', 'mine'] });
      setMessage('');
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

  const openRequest = (requestsQuery.data ?? []).some((request) => request.status === 'OPEN');

  return (
    <section className="apid-card boa-stack">
      <div>
        <h2 className="boa-card-title">Ask HR to find a mentor</h2>
        <p className="boa-card-subtitle">
          Submit a skill-learning request for HR-assisted matching when you do not have a specific mentor in mind.
        </p>
      </div>
      <form className="boa-grid-2" onSubmit={submit}>
        <label>
          Skill you want to learn
          <select
            className="apid-input"
            value={skillId}
            onChange={(event) => setSkillId(event.target.value)}
            required
            disabled={submitMutation.isPending || openRequest}
          >
            <option value="">Select a skill</option>
            {skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
          </select>
        </label>
        <label>
          What would you like help with? (optional)
          <textarea
            className="apid-input"
            rows={2}
            maxLength={1000}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={submitMutation.isPending || openRequest}
          />
        </label>
        <div>
          <button type="submit" className="apid-btn apid-btn-primary apid-btn-sm" disabled={!skillId || openRequest || submitMutation.isPending}>
            {submitMutation.isPending ? 'Submitting...' : 'Request HR matching'}
          </button>
          {openRequest && <span className="boa-muted" style={{ marginLeft: '0.6rem' }}>You already have an open request.</span>}
        </div>
      </form>

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
    </section>
  );
}
