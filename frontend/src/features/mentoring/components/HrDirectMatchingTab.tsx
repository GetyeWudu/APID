import { useState, useMemo } from 'react';
import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import { EmptyState, useToast } from '../../../shared/components/ui';
import type { TrainerEmployeeCandidate, TrainerRosterItem } from '../api/mentoringTrainerApi';
import { mentoringMatchApi } from '../api/mentoringMatchApi';
import {
  filterByOrganizationLocation,
  OrganizationLocationFilter,
} from './OrganizationLocationFilter';

export function HrDirectMatchingTab({
  employees,
  trainers,
}: {
  employees: TrainerEmployeeCandidate[];
  trainers: TrainerRosterItem[];
}) {
  const [mentorUserId, setMentorUserId] = useState('');
  const [traineeUserId, setTraineeUserId] = useState('');
  const [skillId, setSkillId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const matchMutation = useMutation({
    mutationFn: (input: { mentorUserId: number; traineeUserId: number; skillId: number }) =>
      mentoringMatchApi.directMatch(input),
    onSuccess: async (match) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'trainers'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'hr-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'relationships'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'requests'] }),
      ]);
      setMentorUserId('');
      setTraineeUserId('');
      setSkillId('');
      pushToast({
        title: 'Mentor and trainee matched',
        message: `${match.mentorName} and ${match.traineeName} are now paired. Both participants were notified.`,
        tone: 'ok',
      });
    },
    onError: (error: unknown) => {
      const message = axios.isAxiosError<ApiErrorPayload>(error)
        ? error.response?.data?.message ?? error.message
        : error instanceof Error ? error.message : 'Unable to create the mentoring match.';
      pushToast({ title: 'Matching failed', message, tone: 'err' });
    },
  });

  // 1. All active authorized mentors with available capacity
  const eligibleMentors = useMemo(() => trainers.filter((trainer) =>
    trainer.userId !== null &&
    trainer.status === 'ACTIVE' &&
    trainer.acceptingNewPairings !== false &&
    trainer.employmentStatus === 'ACTIVE' &&
    trainer.skills.some((skill) => skill.status === 'ACTIVE' || skill.status === undefined) &&
    trainer.activeTrainees + trainer.pendingTrainees < trainer.maxConcurrentTrainees
  ), [trainers]);

  // 2. All active skills taught by any eligible mentor
  const allMentorSkills = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    eligibleMentors.forEach((m) => {
      m.skills.forEach((s) => {
        if (s.status === 'ACTIVE' || s.status === undefined) {
          map.set(s.id, { id: s.id, name: s.name });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [eligibleMentors]);

  // 3. Mentors filtered by location and chosen skill (if a skill is selected first)
  const locationPaths = useMemo(
    () => eligibleMentors.map((mentor) => mentor.organizationPath ?? []),
    [eligibleMentors]
  );

  const availableMentors = useMemo(() => {
    const byLocation = filterByOrganizationLocation(eligibleMentors, selectedLocationId);
    if (!skillId) return byLocation;
    return byLocation.filter((m) =>
      m.skills.some((s) => String(s.id) === skillId && (s.status === 'ACTIVE' || s.status === undefined))
    );
  }, [eligibleMentors, selectedLocationId, skillId]);

  // 4. Skills filtered by chosen mentor (if a mentor is selected first)
  const selectedMentor = eligibleMentors.find((m) => String(m.userId) === mentorUserId);
  const availableSkills = useMemo(() => {
    if (selectedMentor) {
      return selectedMentor.skills.filter((s) => s.status === 'ACTIVE' || s.status === undefined);
    }
    return allMentorSkills;
  }, [selectedMentor, allMentorSkills]);

  // 5. Eligible trainees (excluding the mentor themselves)
  const eligibleTrainees = useMemo(() => employees.filter((employee) =>
    String(employee.userId) !== mentorUserId
  ), [employees, mentorUserId]);

  return (
    <section className="apid-card">
      <div className="boa-card-header">
        <div>
          <h3 className="boa-card-title">Match a mentor and trainee</h3>
          <p className="boa-card-subtitle">
            HR matching starts an active mentoring relationship immediately. Neither participant needs to approve.
            Both participants receive a notification.
          </p>
        </div>
      </div>
      {eligibleMentors.length === 0 || employees.length === 0 ? (
        <EmptyState
          title={eligibleMentors.length === 0 ? 'No mentors with available capacity' : 'No active employees available'}
          description="An active, authorized mentor and active employee account are required to create a match."
        />
      ) : (
        <div className="boa-stack" style={{ gap: '1.25rem' }}>
          <OrganizationLocationFilter
            paths={locationPaths}
            value={selectedLocationId}
            onChange={(nextLocationId) => {
              setSelectedLocationId(nextLocationId);
              if (
                mentorUserId &&
                !filterByOrganizationLocation(eligibleMentors, nextLocationId).some(
                  (m) => String(m.userId) === mentorUserId
                )
              ) {
                setMentorUserId('');
              }
            }}
          />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem',
          }}>
            {/* 1. Mentor Selection */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontWeight: 600 }}>
              <span>Mentor</span>
              <select
                className="apid-input"
                aria-label="Mentor"
                value={mentorUserId}
                onChange={(event) => {
                  const nextMentorId = event.target.value;
                  setMentorUserId(nextMentorId);
                  if (nextMentorId === traineeUserId) setTraineeUserId('');
                  if (nextMentorId && skillId) {
                    const m = eligibleMentors.find((t) => String(t.userId) === nextMentorId);
                    const teachesSkill = m?.skills.some((s) => String(s.id) === skillId);
                    if (!teachesSkill) setSkillId('');
                  }
                }}
              >
                <option value="">Select an active mentor</option>
                {availableMentors.map((mentor) => (
                  <option key={mentor.userId} value={mentor.userId ?? ''}>
                    {mentor.fullName} · {mentor.activeTrainees + mentor.pendingTrainees}/{mentor.maxConcurrentTrainees} capacity
                  </option>
                ))}
              </select>
              <span className="boa-muted" style={{ fontSize: '0.8rem', fontWeight: 400 }}>
                {skillId
                  ? 'Mentors certified in the selected skill.'
                  : 'Select an authorized mentor with available capacity.'}
              </span>
            </label>

            {/* 2. Skill Selection */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontWeight: 600 }}>
              <span>Skill</span>
              <select
                className="apid-input"
                aria-label="Skill"
                value={skillId}
                onChange={(event) => {
                  const nextSkillId = event.target.value;
                  setSkillId(nextSkillId);
                  if (nextSkillId && mentorUserId) {
                    const m = eligibleMentors.find((t) => String(t.userId) === mentorUserId);
                    const teachesSkill = m?.skills.some((s) => String(s.id) === nextSkillId);
                    if (!teachesSkill) setMentorUserId('');
                  }
                }}
                required
              >
                <option value="">Select a skill for this pairing</option>
                {availableSkills.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.name}
                  </option>
                ))}
              </select>
              <span className="boa-muted" style={{ fontSize: '0.8rem', fontWeight: 400 }}>
                {selectedMentor
                  ? `Authorized skills for ${selectedMentor.fullName}.`
                  : 'Select a skill to filter available mentors.'}
              </span>
            </label>

            {/* 3. Trainee Selection */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontWeight: 600 }}>
              <span>Trainee</span>
              <select
                className="apid-input"
                aria-label="Trainee"
                value={traineeUserId}
                onChange={(event) => setTraineeUserId(event.target.value)}
              >
                <option value="">Select an active employee</option>
                {eligibleTrainees.map((employee) => (
                  <option key={employee.userId} value={employee.userId}>
                    {employee.fullName} ({employee.employeeNumber})
                    {employee.departmentName ? ` · ${employee.departmentName}` : ''}
                  </option>
                ))}
              </select>
              <span className="boa-muted" style={{ fontSize: '0.8rem', fontWeight: 400 }}>
                Employee to receive training in this skill.
              </span>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="apid-btn apid-btn-primary"
              disabled={!mentorUserId || !skillId || !traineeUserId || matchMutation.isPending}
              onClick={() => matchMutation.mutate({
                mentorUserId: Number(mentorUserId),
                traineeUserId: Number(traineeUserId),
                skillId: Number(skillId),
              })}
            >
              <Link2 size={14} /> Match mentor and trainee
            </button>
            {(!mentorUserId || !skillId || !traineeUserId) && (
              <span className="boa-muted" style={{ fontSize: '0.82rem' }}>
                {!mentorUserId
                  ? 'Select an active mentor (or choose a skill to filter mentors).'
                  : !skillId
                  ? 'Select an authorized skill.'
                  : 'Select a trainee to complete the match.'}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
