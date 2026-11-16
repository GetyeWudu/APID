import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Save } from 'lucide-react';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import { ErrorState, LoadingSkeleton, StatusPill, useToast } from '../../../shared/components/ui';
import { mentoringTrainerApi } from '../api/mentoringTrainerApi';

function errorMessage(error: unknown) {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    return error.response?.data?.message ?? error.message;
  }
  return error instanceof Error ? error.message : 'Unable to load your mentor profile.';
}

export function MentorProfileForm() {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const profileQuery = useQuery({
    queryKey: ['mentoring', 'trainer-profile'],
    queryFn: mentoringTrainerApi.getProfile,
  });
  const [bio, setBio] = useState('');
  const [availabilityNotes, setAvailabilityNotes] = useState('');
  const [maxConcurrentTrainees, setMaxConcurrentTrainees] = useState(3);

  useEffect(() => {
    if (!profileQuery.data) return;
    setBio(profileQuery.data.bio ?? '');
    setAvailabilityNotes(profileQuery.data.availabilityNotes ?? '');
    setMaxConcurrentTrainees(profileQuery.data.maxConcurrentTrainees);
  }, [profileQuery.data]);

  const updateMutation = useMutation({
    mutationFn: mentoringTrainerApi.updateProfile,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'trainer-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'trainers'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'directory'] }),
      ]);
      pushToast({ title: 'Mentor profile updated', message: 'Your public mentoring profile is up to date.', tone: 'ok' });
    },
    onError: (error: unknown) => pushToast({
      title: 'Unable to update profile',
      message: errorMessage(error),
      tone: 'err',
    }),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateMutation.mutate({ bio: bio.trim(), availabilityNotes: availabilityNotes.trim(), maxConcurrentTrainees });
  };

  if (profileQuery.isLoading) return <LoadingSkeleton rows={3} height={28} />;
  if (profileQuery.isError || !profileQuery.data) {
    return <ErrorState message={errorMessage(profileQuery.error)} onRetry={() => void profileQuery.refetch()} />;
  }

  const committedTrainees = profileQuery.data.activeTrainees + profileQuery.data.pendingTrainees;
  const capacityLimit = Math.max(1, maxConcurrentTrainees);
  const capacityPercent = Math.min(100, Math.round((committedTrainees / capacityLimit) * 100));
  const remainingCapacity = Math.max(0, capacityLimit - committedTrainees);

  return (
    <form className="apid-card boa-stack" onSubmit={submit}>
      <div className="boa-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            aria-hidden="true"
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 42,
              height: 42,
              borderRadius: 12,
              background: 'var(--primary-soft, #eef2ff)',
              color: 'var(--primary, #4338ca)',
            }}
          >
            <Award size={21} />
          </span>
          <div>
            <h2 className="boa-card-title">Public profile details</h2>
            <p className="boa-card-subtitle">These details help employees decide whether your mentoring style and schedule fit their needs.</p>
          </div>
        </div>
        <StatusPill label="Active mentor" tone="ok" />
      </div>
      <div
        className="apid-card"
        style={{ padding: '1rem', background: 'var(--surface-subtle, #f8fafc)', borderColor: 'var(--border)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <strong>Mentoring capacity</strong>
            <div className="boa-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
              {profileQuery.data.activeTrainees} active · {profileQuery.data.pendingTrainees} pending · {remainingCapacity} available
            </div>
          </div>
          <strong>{committedTrainees} / {capacityLimit}</strong>
        </div>
        <progress
          aria-label="Current mentoring capacity"
          max={capacityLimit}
          value={Math.min(committedTrainees, capacityLimit)}
          style={{ width: '100%', height: 8, marginTop: '0.7rem', accentColor: 'var(--primary, #4338ca)' }}
        />
        <span className="boa-muted" style={{ fontSize: '0.76rem' }}>
          {capacityPercent}% of your available trainee capacity is committed.
        </span>
      </div>

      <div className="boa-grid-2" style={{ marginBottom: 0 }}>
        <label className="apid-field">
          Expertise and mentoring approach
          <textarea
            className="apid-input"
            rows={5}
            maxLength={2000}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Describe your experience, strengths, and how you support mentees."
            disabled={updateMutation.isPending}
          />
          <span className="boa-muted" style={{ fontSize: '0.76rem' }}>{bio.length} / 2000 characters</span>
        </label>
        <label className="apid-field">
          Weekly availability
          <textarea
            className="apid-input"
            rows={5}
            maxLength={1000}
            value={availabilityNotes}
            onChange={(event) => setAvailabilityNotes(event.target.value)}
            placeholder="For example: Tuesday and Thursday afternoons."
            disabled={updateMutation.isPending}
          />
          <span className="boa-muted" style={{ fontSize: '0.76rem' }}>{availabilityNotes.length} / 1000 characters</span>
        </label>
      </div>

      <div className="boa-grid-2" style={{ alignItems: 'end', marginBottom: 0 }}>
        <label className="apid-field">
          Maximum concurrent trainees
          <input
            className="apid-input"
            type="number"
            min={1}
            max={100}
            required
            value={maxConcurrentTrainees}
            onChange={(event) => setMaxConcurrentTrainees(Number(event.target.value))}
            disabled={updateMutation.isPending}
          />
          <span className="boa-muted" style={{ fontSize: '0.76rem' }}>
            Must be at least your current active and pending load.
          </span>
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="apid-btn apid-btn-primary" disabled={updateMutation.isPending}>
            <Save size={15} />
            {updateMutation.isPending ? 'Saving profile…' : 'Save profile'}
          </button>
        </div>
      </div>
    </form>
  );
}
