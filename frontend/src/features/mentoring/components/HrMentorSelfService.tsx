import { useState } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import { EmptyState, ErrorState, LoadingSkeleton, StatusPill, useToast } from '../../../shared/components/ui';
import { mentoringTrainerApi } from '../api/mentoringTrainerApi';

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    return error.response?.data?.message ?? error.message;
  }
  return error instanceof Error ? error.message : 'Unable to update your mentor availability.';
}

export function HrMentorSelfService() {
  const { refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([]);
  const profileQuery = useQuery({
    queryKey: ['mentoring', 'hr', 'my-mentor-profile'],
    queryFn: mentoringTrainerApi.getHrMentorProfile,
  });

  const updateMutation = useMutation({
    mutationFn: mentoringTrainerApi.updateHrMentorProfile,
    onSuccess: async (profile, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'hr', 'my-mentor-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'trainers'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'directory'] }),
      ]);
      if (profile.profile?.userId) {
        queryClient.setQueryData(
          ['mentoring', 'trainer', 'profile', profile.profile.userId],
          profile.profile
        );
      }
      await refreshProfile();
      setSelectedSkillIds([]);
      const skillsUpdated = Boolean(variables.skillIds?.length);
      pushToast({
        title: skillsUpdated
          ? 'Mentor skills updated'
          : profile.acceptingNewPairings ? 'Mentor badge is on' : 'Mentor badge is off',
        message: skillsUpdated
          ? 'The selected skills are active on your profile immediately; no HR approval is needed.'
          : profile.acceptingNewPairings
            ? 'You can receive new matches. Existing pairings are unchanged.'
            : 'You will not receive new matches. Existing pairings are unchanged.',
        tone: 'ok',
      });
    },
    onError: (error: unknown) => pushToast({
      title: 'Unable to update mentor status',
      message: getErrorMessage(error),
      tone: 'err',
    }),
  });

  if (profileQuery.isLoading) return <LoadingSkeleton rows={4} height={28} />;
  if (profileQuery.isError || !profileQuery.data) {
    return (
      <ErrorState
        message={getErrorMessage(profileQuery.error)}
        onRetry={() => void profileQuery.refetch()}
      />
    );
  }

  const profile = profileQuery.data;
  const hasProfile = !profile.profileSetupRequired && profile.profile !== null;
  const hasNoActiveSkills = profile.activeSkills.length === 0;

  const toggleSkill = (skillId: number, limit = 2) => {
    if (selectedSkillIds.includes(skillId)) {
      setSelectedSkillIds(selectedSkillIds.filter((id) => id !== skillId));
      return;
    }
    if (selectedSkillIds.length >= limit) {
      pushToast({
        title: `${limit} skills maximum`,
        message: `Select up to ${limit} skills when creating this profile.`,
        tone: 'info',
      });
      return;
    }
    setSelectedSkillIds([...selectedSkillIds, skillId]);
  };

  const createProfile = () => {
    updateMutation.mutate({
      acceptingNewPairings: true,
      skillIds: selectedSkillIds,
      maxConcurrentTrainees: 3,
    });
  };

  return (
    <section className="apid-card boa-stack">
      <div className="boa-card-header">
        <div>
          <h2 className="boa-card-title">My mentor badge</h2>
          <p className="boa-card-subtitle">
            Manage whether employees and HR can match you with new trainees. No approval is required.
          </p>
        </div>
        <Award size={22} aria-hidden="true" />
      </div>

      <div className="boa-stack" style={{ gap: '0.5rem' }}>
        <StatusPill
          label={profile.acceptingNewPairings ? 'ON · accepting new matches' : 'OFF · not accepting new matches'}
          tone={profile.acceptingNewPairings ? 'ok' : 'neutral'}
        />
        {profile.profile?.status && profile.profile.status !== 'ACTIVE' && (
          <p className="boa-muted" style={{ margin: 0 }}>
            Your mentor authorization is {profile.profile.status.toLowerCase()}. Contact HR to restore it before accepting matches.
          </p>
        )}
      </div>

      {hasProfile ? (
        <div className="boa-stack">
          <div className="boa-stack">
            <div>
              <strong>Your mentor profile is set up</strong>
              <p className="boa-muted" style={{ margin: '0.3rem 0 0' }}>
                Manage your profile details and skills from the dedicated Mentor Profile page.
              </p>
            </div>
            <Link to="/mentoring?view=trainer-profile" className="apid-btn apid-btn-primary apid-btn-sm">
              Open mentor profile
            </Link>
          </div>
          <button
            type="button"
            className={profile.acceptingNewPairings ? 'apid-btn apid-btn-outline apid-btn-sm' : 'apid-btn apid-btn-primary apid-btn-sm'}
            disabled={updateMutation.isPending || (profile.profile?.status !== 'ACTIVE' && !profile.acceptingNewPairings)}
            onClick={() => updateMutation.mutate({ acceptingNewPairings: !profile.acceptingNewPairings })}
          >
            {updateMutation.isPending
              ? 'Saving...'
              : profile.acceptingNewPairings
                ? 'Turn mentor badge off'
                : 'Turn mentor badge on'}
          </button>
        </div>
      ) : (
        <div className="boa-stack">
          <p className="boa-muted" style={{ margin: 0 }}>
            {profile.acceptingNewPairings
              ? 'Your mentor badge is on by default. Choose up to two skills to finish setting up your profile; it will be available without HR review.'
              : 'Choose up to two skills to create your profile and turn your mentor badge on.'}
          </p>
          {hasNoActiveSkills ? (
            <EmptyState
              title="No active skills available"
              description="Add active skills to your employee profile before setting up mentor availability."
            />
          ) : (
            <div className="boa-stack" role="group" aria-label="Select up to two mentor skills">
              {profile.activeSkills.map((skill) => (
                <label key={skill.id} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                  <input
                    type="checkbox"
                    checked={selectedSkillIds.includes(skill.id)}
                    onChange={() => toggleSkill(skill.id)}
                    disabled={updateMutation.isPending}
                  />
                  <span>{skill.name}</span>
                  {skill.category && <span className="boa-muted">· {skill.category}</span>}
                </label>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="apid-btn apid-btn-primary apid-btn-sm"
              disabled={hasNoActiveSkills || selectedSkillIds.length === 0 || updateMutation.isPending}
              onClick={createProfile}
            >
              {updateMutation.isPending ? 'Saving...' : 'Create mentor profile'}
            </button>
            {profile.acceptingNewPairings && (
              <button
                type="button"
                className="apid-btn apid-btn-outline apid-btn-sm"
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ acceptingNewPairings: false })}
              >
                Turn mentor badge off
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
