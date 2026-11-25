import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mentorDirectoryApi, type MentorRecommendation } from '../features/mentoring/api/mentorDirectoryApi';
import { mentoringMatchApi } from '../features/mentoring/api/mentoringMatchApi';
import type { TrainerEmployeeCandidate, TrainerRosterItem } from '../features/mentoring/api/mentoringTrainerApi';
import { HrDirectMatchingTab } from '../features/mentoring/components/HrDirectMatchingTab';
import { HrMatchingTab } from '../features/mentoring/components/HrMatchingTab';
import { ToastProvider } from '../shared/components/ui';

describe('HrMatchingTab reassignment', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lets HR reassign to an active trainer with a reasoned skill-mismatch override', async () => {
    vi.spyOn(mentoringMatchApi, 'listReassignmentQueue').mockResolvedValue([
      {
        relationshipId: 12,
        formerTrainerUserId: 20,
        formerTrainerName: 'Bekele Tesfaye',
        skillId: 9,
        skillName: 'Java & Spring Boot Development',
        requestType: 'INDIVIDUAL',
        startedAt: '2026-11-16T08:00:00Z',
        trainees: [{ userId: 40, name: 'Eden Negash' }],
      },
    ]);
    const reassign = vi.spyOn(mentoringMatchApi, 'reassign').mockResolvedValue({
      previousRelationshipId: 12,
      newRelationshipId: 13,
      trainerUserId: 30,
      trainerName: 'Replacement Trainer',
      reassignedTrainees: 1,
    });

    const trainer: TrainerRosterItem = {
      id: 4,
      employeeId: 5,
      userId: 30,
      employeeNumber: '00010006',
      fullName: 'Replacement Trainer',
      departmentName: 'Engineering',
      employmentStatus: 'ACTIVE',
      sourceType: 'APPLICATION',
      status: 'ACTIVE',
      activeTrainees: 1,
      pendingTrainees: 0,
      maxConcurrentTrainees: 1,
      bio: null,
      skills: [],
      effectiveFrom: '2026-11-01T08:00:00Z',
      updatedAt: '2026-11-01T08:00:00Z',
    };
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <HrMatchingTab requests={[]} trainers={[trainer]} />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

    const trainerSelect = await screen.findByLabelText('Replacement trainer for relationship 12');
    expect(screen.getByRole('option', { name: /Skill mismatch \(HR override\)/ })).toBeInTheDocument();
    fireEvent.change(trainerSelect, { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Reassignment reason for relationship 12'), {
      target: { value: 'Former trainer is unavailable.' },
    });

    const reassignButton = screen.getByRole('button', { name: 'Reassign' });
    expect(reassignButton).toBeDisabled();
    expect(screen.queryByRole('checkbox', { name: /skill mismatch/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Skill override reason for relationship 12'), {
      target: { value: 'Temporary coverage approved by HR.' },
    });
    expect(reassignButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText('HR override capacity'));
    fireEvent.change(screen.getByLabelText('Capacity override reason for relationship 12'), {
      target: { value: 'Temporary coverage approved by HR.' },
    });
    expect(reassignButton).toBeEnabled();
    fireEvent.click(reassignButton);

    await waitFor(() => {
      expect(reassign).toHaveBeenCalledWith(12, {
        relationshipId: 12,
        trainerUserId: 30,
        reason: 'Former trainer is unavailable.',
        overrideCapacity: true,
        overrideReason: 'Temporary coverage approved by HR.',
        skillOverrideReason: 'Temporary coverage approved by HR.',
      });

      it('only shows exact-skill suggestions and renders stars from the mentor rating', async () => {
        vi.spyOn(mentoringMatchApi, 'listReassignmentQueue').mockResolvedValue([]);
        const requestId = 21;
        const skillId = 7;
        const exactMentor: MentorRecommendation = {
          rank: 1,
          reason: 'Exact Cybersecurity skill match.',
          skillId,
          skillName: 'Cybersecurity',
          profileSummary: null,
          careerExperience: [],
          mentorshipExperience: [],
          mentor: {
            userId: 30,
            username: 'exact.mentor',
            employeeNumber: 'EMP-30',
            fullName: 'Exact Mentor',
            departmentName: 'Security',
            bio: null,
            activeTrainees: 0,
            remainingCapacity: 2,
            averageRating: 4.3,
            skills: [{ id: skillId, name: 'Cybersecurity', category: 'Security' }],
          },
        };
        const relatedMentor: MentorRecommendation = {
          ...exactMentor,
          rank: 2,
          skillId: 8,
          skillName: 'Network Engineering',
          reason: 'A related skill.',
          mentor: {
            ...exactMentor.mentor,
            userId: 31,
            username: 'related.mentor',
            employeeNumber: 'EMP-31',
            fullName: 'Related Mentor',
            skills: [{ id: 8, name: 'Network Engineering', category: 'Security' }],
          },
        };
        const recommend = vi.spyOn(mentorDirectoryApi, 'recommendExactSkillMentorsForHr').mockResolvedValue({
          overallReason: null,
          recommendations: [exactMentor, relatedMentor],
        });
        const trainer: TrainerRosterItem = {
          id: 4,
          employeeId: 5,
          userId: 30,
          employeeNumber: 'EMP-30',
          fullName: 'Exact Mentor',
          departmentName: 'Security',
          employmentStatus: 'ACTIVE',
          sourceType: 'APPLICATION',
          status: 'ACTIVE',
          activeTrainees: 0,
          pendingTrainees: 0,
          maxConcurrentTrainees: 2,
          bio: null,
          skills: [{ id: skillId, name: 'Cybersecurity', category: 'Security', status: 'ACTIVE' }],
          effectiveFrom: '2026-11-01T08:00:00Z',
          updatedAt: '2026-11-01T08:00:00Z',
        };
        const queryClient = new QueryClient({
          defaultOptions: { queries: { retry: false } },
        });

        render(
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <MemoryRouter>
                <HrMatchingTab
                  requests={[{
                    id: requestId,
                    traineeUserId: 40,
                    traineeName: 'Trainee',
                    traineeEmployeeNumber: 'EMP-40',
                    departmentName: 'Security',
                    skillId,
                    skillName: 'Cybersecurity',
                    message: null,
                    status: 'OPEN',
                    matchedTrainerUserId: null,
                    matchedTrainerName: null,
                    mentoringRelationshipId: null,
                    createdAt: '2026-11-01T08:00:00Z',
                  }]}
                  trainers={[trainer]}
                />
              </MemoryRouter>
            </ToastProvider>
          </QueryClientProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: /AI Suggest/ }));

        expect(await screen.findByText('Exact Mentor')).toBeInTheDocument();
        expect(screen.queryByText('Related Mentor')).not.toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Average mentor rating 4.3 out of 5' })).toBeInTheDocument();
        expect(recommend).toHaveBeenCalledWith('Cybersecurity', skillId);
      });
    });
  });
});

describe('HrDirectMatchingTab', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an HR match directly without requesting participant approval', async () => {
    const directMatch = vi.spyOn(mentoringMatchApi, 'directMatch').mockResolvedValue({
      relationshipId: 13,
      mentorUserId: 30,
      mentorName: 'Assigned Mentor',
      traineeUserId: 40,
      traineeName: 'Assigned Trainee',
      startedAt: '2026-11-16T08:00:00Z',
    });
    const employees: TrainerEmployeeCandidate[] = [
      {
        employeeId: 5,
        userId: 40,
        employeeNumber: '00010040',
        fullName: 'Assigned Trainee',
        departmentName: 'Engineering',
      },
    ];
    const trainer: TrainerRosterItem = {
      id: 4,
      employeeId: 6,
      userId: 30,
      employeeNumber: '00010006',
      fullName: 'Assigned Mentor',
      departmentName: 'Engineering',
      employmentStatus: 'ACTIVE',
      sourceType: 'APPLICATION',
      status: 'ACTIVE',
      activeTrainees: 0,
      pendingTrainees: 0,
      maxConcurrentTrainees: 3,
      bio: null,
      skills: [{ id: 11, name: 'Java', category: 'Technical', status: 'ACTIVE' }],
      effectiveFrom: '2026-11-01T08:00:00Z',
      updatedAt: '2026-11-01T08:00:00Z',
    };
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <HrDirectMatchingTab employees={employees} trainers={[trainer]} />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByLabelText('Mentor'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Skill'), { target: { value: '11' } });
    fireEvent.change(screen.getByLabelText('Trainee'), { target: { value: '40' } });
    expect(screen.getByText(/Neither participant needs to approve/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Match mentor and trainee' }));

    await waitFor(() => {
      expect(directMatch).toHaveBeenCalledWith({ mentorUserId: 30, traineeUserId: 40, skillId: 11 });
    });
  });
});
