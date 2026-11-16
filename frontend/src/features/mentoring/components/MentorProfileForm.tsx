import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Save } from 'lucide-react';
import { useAuth } from '../../../app/AuthContext';
import { HR_MODULE_PERMISSIONS } from '../../../shared/auth/workspaceResolver';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import type { SkillItem } from '../../admin/skills/types/skills.types';
import { mentorApplicationApi } from '../api/mentorApplicationApi';
import { mentoringTrainerApi } from '../api/mentoringTrainerApi';
import { EmptyState, ErrorState, LoadingSkeleton, StatusPill, useToast } from '../../../shared/components/ui';

function errorMessage(error: unknown) {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    return error.response?.data?.message ?? error.message;
  }
  return error instanceof Error ? error.message : 'Unable to load your mentor profile.';
}

export function MentorProfileForm({
  activeSkills,
  currentUserId,
}: {
  activeSkills: SkillItem[];
  currentUserId: number;
}) {
  const { hasAnyPermission } = useAuth();
  const isHrAdmin = hasAnyPermission(HR_MODULE_PERMISSIONS);
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const profileQuery = useQuery({
    queryKey: ['mentoring', 'trainer-profile'],
    queryFn: mentoringTrainerApi.getProfile,
  });
  const applicationsQuery = useQuery({
    queryKey: ['mentoring', 'applications', 'mine', currentUserId],
    queryFn: mentorApplicationApi.listMine,
    enabled: !isHrAdmin,
  });
  const hrProfileQuery = useQuery({
    queryKey: ['mentoring', 'hr', 'my-mentor-profile'],
    queryFn: mentoringTrainerApi.getHrMentorProfile,
    enabled: isHrAdmin,
  });
  const [experienceYears, setExperienceYears] = useState('');
  const [mentoringApproach, setMentoringApproach] = useState('');
  const [sessionsPerWeek, setSessionsPerWeek] = useState('');
  const [maxConcurrentTrainees, setMaxConcurrentTrainees] = useState(3);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');
  const [skillEvidence, setSkillEvidence] = useState<File[]>([]);
  const [skillRequestNote, setSkillRequestNote] = useState('');

  useEffect(() => {
    if (!profileQuery.data) return;
    setExperienceYears(profileQuery.data.experienceYears?.toString() ?? '');
    setMentoringApproach(profileQuery.data.mentoringApproach ?? profileQuery.data.bio ?? '');
    setSessionsPerWeek(profileQuery.data.sessionsPerWeek?.toString() ?? '');
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
  const skillRequestMutation = useMutation({
    mutationFn: mentorApplicationApi.requestSkillAddition,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['mentoring', 'applications', 'mine', currentUserId],
      });
      await applicationsQuery.refetch();
      setSkillIds([]);
      setCustomSkill('');
      setSkillEvidence([]);
      setSkillRequestNote('');
      pushToast({
        title: 'Skill request submitted',
        message: 'HR must approve the requested skills before they are added to your mentor profile.',
        tone: 'ok',
      });
    },
    onError: (error: unknown) => pushToast({
      title: 'Unable to request skills',
      message: errorMessage(error),
      tone: 'err',
    }),
  });
  const hrSkillMutation = useMutation({
    mutationFn: async (selectedSkillIds: number[]) => {
      const hrProfile = hrProfileQuery.data ?? await mentoringTrainerApi.getHrMentorProfile();
      return mentoringTrainerApi.updateHrMentorProfile({
        acceptingNewPairings: hrProfile.acceptingNewPairings,
        skillIds: selectedSkillIds,
      });
    },
    onSuccess: async (hrProfile) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'trainer-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'hr', 'my-mentor-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'trainers'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'directory'] }),
      ]);
      if (hrProfile.profile?.userId) {
        queryClient.setQueryData(
          ['mentoring', 'trainer', 'profile', hrProfile.profile.userId],
          hrProfile.profile
        );
      }
      setSkillIds([]);
      pushToast({
        title: 'Mentor skills updated',
        message: 'Your selected skills are active immediately; no approval is required.',
        tone: 'ok',
      });
    },
    onError: (error: unknown) => pushToast({
      title: 'Unable to update mentor skills',
      message: errorMessage(error),
      tone: 'err',
    }),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateMutation.mutate({
      bio: mentoringApproach.trim(),
      experienceYears: experienceYears === '' ? null : Number(experienceYears),
      mentoringApproach: mentoringApproach.trim(),
      sessionsPerWeek: sessionsPerWeek === '' ? null : Number(sessionsPerWeek),
      maxConcurrentTrainees,
    });
  };

  if (profileQuery.isLoading
    || (!isHrAdmin && applicationsQuery.isLoading)
    || (isHrAdmin && hrProfileQuery.isLoading)) {
    return <LoadingSkeleton rows={3} height={28} />;
  }
  if (profileQuery.isError || !profileQuery.data) {
    return <ErrorState message={errorMessage(profileQuery.error)} onRetry={() => void profileQuery.refetch()} />;
  }
  if (isHrAdmin && (hrProfileQuery.isError || !hrProfileQuery.data)) {
    return (
      <ErrorState
        message={errorMessage(hrProfileQuery.error)}
        onRetry={() => void hrProfileQuery.refetch()}
      />
    );
  }
  if (!isHrAdmin && (applicationsQuery.isError || !applicationsQuery.data)) {
    return (
      <ErrorState
        message="Unable to load your skill request history."
        onRetry={() => void applicationsQuery.refetch()}
      />
    );
  }

  const committedTrainees = profileQuery.data.activeTrainees + profileQuery.data.pendingTrainees;
  const capacityLimit = Math.max(1, maxConcurrentTrainees);
  const capacityPercent = Math.min(100, Math.round((committedTrainees / capacityLimit) * 100));
  const remainingCapacity = Math.max(0, capacityLimit - committedTrainees);
  const skillAdditionRequests = (applicationsQuery.data ?? []).filter(
    (application) => application.applicationType === 'SKILL_ADDITION'
  );
  const pendingSkillIds = new Set(
    skillAdditionRequests
      .filter((application) => application.status === 'PENDING')
      .flatMap((application) => application.catalogSkillIds)
  );
  const currentSkillIds = new Set(profileQuery.data.skills.map((skill) => skill.id));
  const availableSkills = activeSkills.filter(
    (skill) => !currentSkillIds.has(skill.id) && !pendingSkillIds.has(skill.id)
  );
  const pendingCustomSkills = new Set(
    skillAdditionRequests
      .filter((application) => application.status === 'PENDING')
      .map((application) => application.customSkill?.trim().toLowerCase())
      .filter((skill): skill is string => Boolean(skill))
  );

  const submitSkillRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (skillIds.length === 0 && !customSkill.trim()) {
      pushToast({
        title: 'Select a skill',
        message: 'Choose one or more skills or enter a custom skill to request.',
        tone: 'info',
      });
      return;
    }
    if (customSkill.trim() && pendingCustomSkills.has(customSkill.trim().toLowerCase())) {
      pushToast({
        title: 'Skill request already pending',
        message: 'This custom skill is already awaiting HR review.',
        tone: 'info',
      });
      return;
    }
    if (skillEvidence.length === 0) {
      pushToast({
        title: 'Supporting evidence required',
        message: 'Upload evidence for the requested mentor skills.',
        tone: 'err',
      });
      return;
    }
    skillRequestMutation.mutate({
      catalogSkillIds: skillIds.map(Number),
      customSkill: customSkill.trim() || undefined,
      supportingEvidence: skillEvidence,
      note: skillRequestNote.trim() || undefined,
    });
  };
  const submitHrSkillUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (skillIds.length === 0) {
      pushToast({
        title: 'Select a skill',
        message: 'Choose one or more active catalog skills to add to your profile.',
        tone: 'info',
      });
      return;
    }
    hrSkillMutation.mutate(skillIds.map(Number));
  };

  return (
    <div className="apid-card boa-stack">
      <form className="boa-stack" onSubmit={submit}>
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
            Years of experience
            <input
              className="apid-input"
              type="number"
              min={0}
              step={1}
              value={experienceYears}
              onChange={(event) => setExperienceYears(event.target.value)}
              disabled={updateMutation.isPending}
            />
          </label>
          <label className="apid-field">
            Mentoring approach
            <textarea
              className="apid-input"
              rows={4}
              maxLength={2000}
              value={mentoringApproach}
              onChange={(event) => setMentoringApproach(event.target.value)}
              placeholder="Describe how you guide, teach, and support your mentees."
              disabled={updateMutation.isPending}
            />
            <span className="boa-muted" style={{ fontSize: '0.76rem' }}>
              {mentoringApproach.length} / 2000 characters
            </span>
          </label>
          <label className="apid-field">
            Sessions per week
            <input
              className="apid-input"
              type="number"
              min={0}
              step={1}
              value={sessionsPerWeek}
              onChange={(event) => setSessionsPerWeek(event.target.value)}
              disabled={updateMutation.isPending}
            />
            {profileQuery.data.availabilityNotes && profileQuery.data.sessionsPerWeek == null && (
              <span className="boa-muted" style={{ fontSize: '0.76rem' }}>
                Previous availability note: {profileQuery.data.availabilityNotes}
              </span>
            )}
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

      <section className="apid-card boa-stack" style={{ marginBottom: 0 }}>
        <div>
          <h3 className="boa-card-title">
            {isHrAdmin ? 'Add mentoring skills' : 'Request additional mentoring skills'}
          </h3>
          <p className="boa-card-subtitle">
            {isHrAdmin
              ? 'Add active catalog skills directly to your profile. No approval is required.'
              : 'Select new skills and submit supporting evidence. HR approval is required before you can mentor them.'}
          </p>
        </div>
        <div className="boa-stack">
          <strong>Approved skills</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {profileQuery.data.skills.length > 0
              ? profileQuery.data.skills.map((skill) => (
                  <StatusPill key={skill.id} label={skill.name} tone="ok" />
                ))
              : <span className="boa-muted">No active mentor skills.</span>}
          </div>
        </div>
        {!isHrAdmin && skillAdditionRequests.length > 0 && (
          <div className="boa-stack" aria-label="Skill request history">
            <strong>Skill request history</strong>
            {skillAdditionRequests.map((application) => (
              <div
                key={application.id}
                style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}
              >
                <span>{application.skillName || 'Skill request'}</span>
                <StatusPill
                  label={application.status}
                  tone={application.status === 'APPROVED' ? 'ok' : application.status === 'DECLINED' ? 'err' : 'warn'}
                />
                {application.reviewReason && <span className="boa-muted">{application.reviewReason}</span>}
              </div>
            ))}
          </div>
        )}
        {availableSkills.length === 0 && !customSkill.trim() ? (
          <EmptyState
            title="No additional catalog skills available"
            description={isHrAdmin
              ? 'All active catalog skills are already listed.'
              : 'Your current and pending skills are already listed. You can still request a custom skill below.'}
          />
        ) : null}
        {isHrAdmin ? (
          <form className="apid-form" onSubmit={submitHrSkillUpdate}>
            <div className="apid-field">
              <label htmlFor="mentor-skill-addition">Catalog skills</label>
              <select
                id="mentor-skill-addition"
                className="apid-input"
                multiple
                size={Math.min(6, Math.max(3, availableSkills.length))}
                value={skillIds}
                onChange={(event) => setSkillIds(
                  Array.from(event.target.selectedOptions, (option) => option.value)
                )}
                disabled={hrSkillMutation.isPending || availableSkills.length === 0}
              >
                {availableSkills.map((skill) => (
                  <option key={skill.id} value={skill.id}>{skill.name}</option>
                ))}
              </select>
              <span className="boa-muted" style={{ fontSize: '0.76rem' }}>
                Hold Ctrl or Command to select multiple skills.
              </span>
            </div>
            <button
              type="submit"
              className="apid-btn apid-btn-primary"
              disabled={hrSkillMutation.isPending || skillIds.length === 0}
            >
              {hrSkillMutation.isPending ? 'Adding skills…' : 'Add skills now'}
            </button>
          </form>
        ) : (
        <form className="apid-form" onSubmit={submitSkillRequest}>
          <div className="apid-field">
            <label htmlFor="mentor-skill-addition">Catalog skills</label>
            <select
              id="mentor-skill-addition"
              className="apid-input"
              multiple
              size={Math.min(6, Math.max(3, availableSkills.length))}
              value={skillIds}
              onChange={(event) => setSkillIds(
                Array.from(event.target.selectedOptions, (option) => option.value)
              )}
              disabled={skillRequestMutation.isPending || availableSkills.length === 0}
            >
              {availableSkills.map((skill) => (
                <option key={skill.id} value={skill.id}>{skill.name}</option>
              ))}
            </select>
            <span className="boa-muted" style={{ fontSize: '0.76rem' }}>
              Hold Ctrl or Command to select multiple skills.
            </span>
          </div>
          <div className="apid-field">
            <label htmlFor="mentor-skill-addition-custom">Custom skill (optional)</label>
            <input
              id="mentor-skill-addition-custom"
              className="apid-input"
              value={customSkill}
              onChange={(event) => setCustomSkill(event.target.value)}
              maxLength={150}
              disabled={skillRequestMutation.isPending}
            />
          </div>
          <div className="apid-field">
            <label htmlFor="mentor-skill-addition-evidence">Supporting evidence</label>
            <input
              id="mentor-skill-addition-evidence"
              type="file"
              className="apid-input"
              accept=".pdf,.docx,.png,.jpg,.jpeg"
              multiple
              required
              onChange={(event) => setSkillEvidence(Array.from(event.target.files ?? []))}
              disabled={skillRequestMutation.isPending}
            />
          </div>
          <div className="apid-field">
            <label htmlFor="mentor-skill-addition-note">Note (optional)</label>
            <textarea
              id="mentor-skill-addition-note"
              className="apid-input"
              rows={3}
              value={skillRequestNote}
              onChange={(event) => setSkillRequestNote(event.target.value)}
              disabled={skillRequestMutation.isPending}
            />
          </div>
          <button
            type="submit"
            className="apid-btn apid-btn-primary"
            disabled={skillRequestMutation.isPending || (availableSkills.length === 0 && !customSkill.trim())}
          >
            {skillRequestMutation.isPending ? 'Sending request…' : 'Request skill approval'}
          </button>
        </form>
        )}
      </section>
    </div>
  );
}
