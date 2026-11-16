import { useState } from 'react';
import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import { EmptyState, useToast } from '../../../shared/components/ui';
import type { TrainerEmployeeCandidate, TrainerRosterItem } from '../api/mentoringTrainerApi';
import { mentoringMatchApi } from '../api/mentoringMatchApi';

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

  const eligibleMentors = trainers.filter((trainer) =>
    trainer.userId !== null &&
    trainer.status === 'ACTIVE' &&
    trainer.acceptingNewPairings !== false &&
    trainer.employmentStatus === 'ACTIVE' &&
    trainer.skills.some((skill) => skill.status === 'ACTIVE') &&
    trainer.activeTrainees + trainer.pendingTrainees < trainer.maxConcurrentTrainees
  );
  const selectedMentor = eligibleMentors.find((mentor) => String(mentor.userId) === mentorUserId);
  const availableSkills = selectedMentor?.skills.filter((skill) =>
    skill.status === undefined ? selectedMentor.status === 'ACTIVE' : skill.status === 'ACTIVE'
  ) ?? [];
  const eligibleTrainees = employees.filter((employee) =>
    String(employee.userId) !== mentorUserId
  );

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
        <div className="boa-stack">
          <label className="boa-stack" style={{ gap: '0.35rem' }}>
            Mentor
            <select
              className="apid-input"
              aria-label="Mentor"
              value={mentorUserId}
              onChange={(event) => {
                setMentorUserId(event.target.value);
                if (event.target.value === traineeUserId) setTraineeUserId('');
                setSkillId('');
              }}
            >
              <option value="">Select an active mentor</option>
              {eligibleMentors.map((mentor) => (
                <option key={mentor.userId} value={mentor.userId ?? ''}>
                  {mentor.fullName} · {mentor.activeTrainees + mentor.pendingTrainees}/{mentor.maxConcurrentTrainees}
                </option>
              ))}
            </select>
          </label>
          <label className="boa-stack" style={{ gap: '0.35rem' }}>
            Skill
            <select
              className="apid-input"
              aria-label="Skill"
              value={skillId}
              onChange={(event) => setSkillId(event.target.value)}
              disabled={!selectedMentor}
              required
            >
              <option value="">Select a skill for this pairing</option>
              {availableSkills.map((skill) => (
                <option key={skill.id} value={skill.id}>{skill.name}</option>
              ))}
            </select>
          </label>
          <label className="boa-stack" style={{ gap: '0.35rem' }}>
            Trainee
            <select
              className="apid-input"
              aria-label="Trainee"
              value={traineeUserId}
              onChange={(event) => setTraineeUserId(event.target.value)}
            >
              <option value="">Select an active employee</option>
              {eligibleTrainees.map((employee) => (
                <option key={employee.userId} value={employee.userId}>
                  {employee.fullName} · {employee.employeeNumber}
                  {employee.departmentName ? ` · ${employee.departmentName}` : ''}
                </option>
              ))}
            </select>
          </label>
          <div>
            <button
              type="button"
              className="apid-btn apid-btn-primary"
              disabled={!selectedMentor || !skillId || !traineeUserId || matchMutation.isPending}
              onClick={() => matchMutation.mutate({
                mentorUserId: Number(mentorUserId),
                traineeUserId: Number(traineeUserId),
                skillId: Number(skillId),
              })}
            >
              <Link2 size={14} /> Match mentor and trainee
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
