import { useState } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import { EmptyState, ErrorState, LoadingSkeleton, StatusPill, useToast } from '../../../shared/components/ui';
import type { MentoringPairing } from '../api/mentoringPairingApi';
import { mentoringPairingApi } from '../api/mentoringPairingApi';
import { mentorDirectoryApi } from '../api/mentorDirectoryApi';

interface SkillOption {
  id: number;
  name: string;
}

export function MentoringRecommendations({
  skills,
  currentUserId,
  requests,
}: {
  skills: SkillOption[];
  currentUserId?: number;
  requests: MentoringPairing[];
}) {
  const [skillId, setSkillId] = useState(() => String(skills[0]?.id ?? ''));
  const [minimumExperienceYears, setMinimumExperienceYears] = useState('');
  const [approachFilter, setApproachFilter] = useState('');
  const [minimumSessionsPerWeek, setMinimumSessionsPerWeek] = useState('');
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const selectedSkillId = Number(skillId);
  const recommendationsQuery = useQuery({
    queryKey: ['mentoring', 'recommendations', selectedSkillId],
    queryFn: () => mentorDirectoryApi.listMentors({ skillId: selectedSkillId }),
    enabled: Number.isSafeInteger(selectedSkillId) && selectedSkillId > 0,
  });
  const requestMutation = useMutation({
    mutationFn: mentoringPairingApi.requestMentor,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'requests'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'recommendations'] }),
        queryClient.invalidateQueries({ queryKey: ['core', 'notifications'] }),
      ]);
      pushToast({
        title: 'Mentorship request sent',
        message: 'Your recommended mentor will be notified.',
        tone: 'ok',
      });
    },
    onError: (error: unknown) => {
      const message = axios.isAxiosError<ApiErrorPayload>(error)
        ? error.response?.data?.message ?? error.message
        : error instanceof Error ? error.message : 'Unable to send the mentorship request.';
      pushToast({ title: 'Request failed', message, tone: 'err' });
    },
  });

  const recommendations = (recommendationsQuery.data ?? []).filter((mentor) => {
    const approach = mentor.mentoringApproach ?? mentor.bio ?? '';
    return mentor.userId !== currentUserId &&
      mentor.remainingCapacity > 0 &&
      (minimumExperienceYears === '' ||
        (mentor.experienceYears != null && mentor.experienceYears >= Number(minimumExperienceYears))) &&
      (!approachFilter.trim() ||
        approach.toLowerCase().includes(approachFilter.trim().toLowerCase())) &&
      (minimumSessionsPerWeek === '' ||
        (mentor.sessionsPerWeek != null && mentor.sessionsPerWeek >= Number(minimumSessionsPerWeek)));
  });
  const hasFilters = Boolean(
    minimumExperienceYears || approachFilter.trim() || minimumSessionsPerWeek
  );

  return (
    <section className="apid-card boa-stack">
      <div>
        <h2 className="boa-card-title">Recommended Mentors</h2>
        <p className="boa-card-subtitle">
          Compare experience, mentoring approach, weekly sessions, and feedback for mentors with your selected skill.
        </p>
      </div>
      {skills.length === 0 ? (
        <EmptyState title="No skills available" description="There are no active skills to recommend mentors for." />
      ) : (
        <div className="boa-stack">
          <label>
            Skill you want to learn
            <select
              className="apid-input"
              value={skillId}
              onChange={(event) => setSkillId(event.target.value)}
            >
              {skills.map((skill) => (
                <option key={skill.id} value={skill.id}>{skill.name}</option>
              ))}
            </select>
          </label>
          <div className="boa-grid-2" style={{ marginBottom: 0 }}>
            <label className="apid-field">
              Minimum experience (years)
              <input
                className="apid-input"
                type="number"
                min={0}
                step={1}
                value={minimumExperienceYears}
                onChange={(event) => setMinimumExperienceYears(event.target.value)}
              />
            </label>
            <label className="apid-field">
              Mentoring approach
              <input
                className="apid-input"
                type="text"
                value={approachFilter}
                onChange={(event) => setApproachFilter(event.target.value)}
                placeholder="Search approach"
              />
            </label>
            <label className="apid-field">
              Minimum sessions per week
              <input
                className="apid-input"
                type="number"
                min={0}
                step={1}
                value={minimumSessionsPerWeek}
                onChange={(event) => setMinimumSessionsPerWeek(event.target.value)}
              />
            </label>
          </div>
        </div>
      )}
      {skills.length > 0 && recommendationsQuery.isLoading && <LoadingSkeleton rows={3} height={28} />}
      {skills.length > 0 && recommendationsQuery.isError && (
        <ErrorState
          message="Unable to load mentor recommendations."
          onRetry={() => void recommendationsQuery.refetch()}
        />
      )}
      {skills.length > 0 && !recommendationsQuery.isLoading && !recommendationsQuery.isError && (
        recommendations.length === 0 ? (
          <EmptyState
            title="No matching mentors"
            description={hasFilters
              ? 'Try adjusting your experience, mentoring approach, or weekly session filters.'
              : 'No available mentors currently offer this skill.'}
          />
        ) : (
          <div className="boa-stack">
            {recommendations.map((mentor) => {
              const existingRequest = requests.find(
                (request) =>
                  request.mentorUserId === mentor.userId &&
                  request.traineeUserId === currentUserId &&
                  request.skillId === selectedSkillId &&
                  (request.status === 'PENDING' || request.status === 'ACCEPTED')
              );
              return (
                <article key={mentor.userId} className="apid-card" style={{ border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div>
                      <strong>{mentor.fullName}</strong>
                      <div className="boa-muted" style={{ fontSize: '0.8rem' }}>
                        {mentor.departmentName}
                      </div>
                    </div>
                    <StatusPill
                      label={`${mentor.remainingCapacity} slot${mentor.remainingCapacity === 1 ? '' : 's'} available`}
                      tone="info"
                    />
                  </div>
                  <div className="boa-stack" style={{ gap: '0.3rem', margin: '0.4rem 0' }}>
                    <span className="boa-muted">
                      Experience: {mentor.experienceYears == null
                        ? 'Not provided'
                        : `${mentor.experienceYears} year${mentor.experienceYears === 1 ? '' : 's'}`}
                    </span>
                    <span className="boa-muted">
                      {mentor.sessionsPerWeek == null
                        ? mentor.availabilityNotes
                          ? `Previous availability note: ${mentor.availabilityNotes}`
                          : 'Sessions per week: Not provided'
                        : `Sessions per week: ${mentor.sessionsPerWeek}`}
                    </span>
                    <span className="boa-muted">
                      Mentoring approach: {mentor.mentoringApproach || mentor.bio || 'Not provided'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <StatusPill label={`${mentor.activeTrainees} active trainee${mentor.activeTrainees === 1 ? '' : 's'}`} tone="neutral" />
                    {mentor.averageRating > 0 && (
                      <StatusPill label={`${mentor.averageRating.toFixed(1)} / 5 rating`} tone="neutral" />
                    )}
                  </div>
                  <button
                    type="button"
                    className="apid-btn apid-btn-primary apid-btn-sm"
                    disabled={Boolean(existingRequest) || mentor.remainingCapacity <= 0 || requestMutation.isPending}
                    onClick={() => requestMutation.mutate({
                      mentorUserId: mentor.userId,
                      skillId: selectedSkillId,
                    })}
                  >
                    {existingRequest?.status === 'ACCEPTED'
                      ? 'Mentorship active'
                      : existingRequest
                        ? 'Request pending'
                        : mentor.remainingCapacity <= 0
                          ? 'At capacity'
                          : 'Request mentorship'}
                  </button>
                </article>
              );
            })}
          </div>
        )
      )}
    </section>
  );
}
