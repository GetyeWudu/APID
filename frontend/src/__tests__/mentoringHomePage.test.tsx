import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as AuthContextModule from '../app/AuthContext';
import type { UserProfile } from '../features/auth/types/auth.types';
import { mentorDirectoryApi, type MentorDirectoryItem } from '../features/mentoring/api/mentorDirectoryApi';
import { mentoringMatchApi } from '../features/mentoring/api/mentoringMatchApi';
import {
  mentoringPairingApi,
  type MentoringPairing,
  type MentoringRelationshipPair,
} from '../features/mentoring/api/mentoringPairingApi';
import { MentoringHomePage } from '../features/mentoring/pages/MentoringHomePage';
import { workspaceLiveApi } from '../features/workspace/api/workspaceDashboardApi';
import { ToastProvider } from '../shared/components/ui';

const skill = {
  id: 4,
  name: 'Java',
  category: 'Technical',
  description: null,
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const otherSkill = { id: 8, name: 'Excel', category: 'Technical' };

function buildMentor(
  userId: number,
  remainingCapacity: number,
  mentorSkill: Pick<MentorDirectoryItem['skills'][number], 'id' | 'name' | 'category'> = skill
): MentorDirectoryItem {
  return {
    userId,
    username: `mentor${userId}`,
    employeeNumber: `EMP-${userId}`,
    fullName: `Mentor ${userId}`,
    departmentName: 'Engineering',
    bio: null,
    activeTrainees: 1,
    remainingCapacity,
    averageRating: 4.5,
    skills: [{ id: mentorSkill.id, name: mentorSkill.name, category: mentorSkill.category }],
  };
}

function buildAuthMock(user: UserProfile) {
  const permissions = user.permissions;
  return {
    user,
    loading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    changePassword: vi.fn(),
    refreshProfile: vi.fn().mockResolvedValue(undefined),
    hasPermission: (code: string) => permissions.includes(code),
    hasAnyPermission: (codes: string[]) => codes.some((code) => permissions.includes(code)),
  };
}

function renderFindMentorPage(initialEntry = '/mentoring?view=directory') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <MentoringHomePage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

function buildRelationship(
  overrides: Partial<MentoringRelationshipPair> = {}
): MentoringRelationshipPair {
  return {
    memberId: 1,
    relationshipId: 101,
    requestId: 201,
    requestType: 'INDIVIDUAL',
    relationshipStatus: 'ACTIVE',
    memberStatus: 'ACTIVE',
    currentUserRole: 'MENTOR',
    mentorUserId: 7,
    mentorName: 'Trainee Seven',
    traineeUserId: 30,
    traineeName: 'Trainee Thirty',
    skillId: skill.id,
    skillName: skill.name,
    message: null,
    startedAt: '2026-03-01T00:00:00Z',
    joinedAt: '2026-03-01T00:00:00Z',
    endedAt: null,
    memberEndedAt: null,
    ...overrides,
  };
}

describe('MentoringHomePage Find a Mentor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
      buildAuthMock({
        id: 7,
        username: 'trainee',
        mustChangePassword: false,
        roles: ['Employee'],
        permissions: ['EMPLOYEE_PORTAL_ACCESS'],
      })
    );
    vi.spyOn(workspaceLiveApi, 'loadMyIdentity').mockResolvedValue({
      linkedEmployee: {
        id: 1,
        userId: 7,
        username: 'trainee',
        employeeNumber: 'EMP-7',
        fullName: 'Trainee Seven',
        email: null,
        gender: null,
        departmentId: 2,
        departmentName: 'Engineering',
        parentDepartmentName: null,
        job: null,
        position: null,
        managerId: null,
        managerEmployeeNumber: null,
        managerFullName: null,
        employmentStatus: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      directReports: [],
      activeSkills: [skill],
    });
    vi.spyOn(mentoringPairingApi, 'listMyRelationships').mockResolvedValue([]);
    vi.spyOn(mentoringPairingApi, 'listMyRequests').mockResolvedValue([]);
    vi.spyOn(mentorDirectoryApi, 'getMyOrganizationPath').mockResolvedValue([]);
    vi.spyOn(mentoringPairingApi, 'requestMentor').mockResolvedValue({
      id: 99,
      requestId: 99,
      requestType: 'INDIVIDUAL',
      status: 'PENDING',
      incoming: false,
      initiatedByMentor: false,
      mentorUserId: 30,
      mentorName: 'Mentor 30',
      traineeUserId: 7,
      traineeName: 'Trainee Seven',
      recipientUserId: 30,
      skillId: otherSkill.id,
      skillName: otherSkill.name,
      message: null,
      createdAt: '2026-01-01T00:00:00Z',
      respondedAt: null,
    });
    vi.spyOn(mentoringMatchApi, 'listMine').mockResolvedValue([]);
  });

  it('shows the AI prompt and lets the trainee request a mentor through the directory', async () => {
    const matchingMentors = [
      ...Array.from({ length: 6 }, (_, index) => buildMentor(index + 10, 2)),
      buildMentor(20, 0),
      buildMentor(7, 2),
    ];
    vi.spyOn(mentorDirectoryApi, 'listMentors').mockImplementation((filters = {}) =>
      Promise.resolve(filters.skillId ? matchingMentors : [...matchingMentors, buildMentor(30, 2, otherSkill)])
    );

    renderFindMentorPage();

    expect(await screen.findByText('Mentor 30')).toBeInTheDocument();
    const recommendations = screen.getByRole('heading', { name: 'Find a mentor with AI' }).closest('section');
    if (!recommendations) throw new Error('AI mentor prompt was not rendered.');
    expect(within(recommendations).getByLabelText('What would you like to learn?')).toBeInTheDocument();
    expect(within(recommendations).queryByText('Mentor 30')).not.toBeInTheDocument();
    expect(screen.getByText('Mentor Directory')).toBeInTheDocument();
    expect(screen.getByText('Mentor 30')).toBeInTheDocument();

    const mentorCard = screen.getByText('Mentor 30').closest('article');
    if (!mentorCard) throw new Error('Mentor card was not rendered.');
    fireEvent.click(within(mentorCard).getByRole('button', { name: 'Request mentorship' }));
    const requestDialog = await screen.findByRole('dialog', { name: 'Request mentorship from Mentor 30' });
    fireEvent.click(within(requestDialog).getByRole('button', { name: 'Send request' }));

    await waitFor(() => {
      expect(mentoringPairingApi.requestMentor).toHaveBeenCalledWith({
        mentorUserId: 30,
        skillId: otherSkill.id,
        message: undefined,
      }, expect.anything());
    });
  });

  it('lets the trainee ask HR to find a mentor', async () => {
    vi.spyOn(mentorDirectoryApi, 'listMentors').mockResolvedValue([]);
    vi.spyOn(mentoringMatchApi, 'submit').mockResolvedValue({
      id: 41,
      traineeUserId: 7,
      traineeName: 'Trainee Seven',
      traineeEmployeeNumber: 'EMP-7',
      departmentName: 'Engineering',
      skillId: skill.id,
      skillName: skill.name,
      message: 'Please help me find a mentor.',
      status: 'OPEN',
      matchedTrainerUserId: null,
      matchedTrainerName: null,
      mentoringRelationshipId: null,
      createdAt: '2026-01-01T00:00:00Z',
    });

    renderFindMentorPage();

    expect(await screen.findByText('Ask HR to find a mentor')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Skill you want to learn'), {
      target: { value: String(skill.id) },
    });
    fireEvent.change(screen.getByLabelText('What would you like help with? (optional)'), {
      target: { value: 'Please help me find a mentor.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Request HR matching' }));

    await waitFor(() => {
      expect(mentoringMatchApi.submit).toHaveBeenCalledWith({
        skillId: skill.id,
        message: 'Please help me find a mentor.',
      }, expect.anything());
    });
  });

  it('shows an empty AI recommendation state without fabricating mentor matches', async () => {
    vi.spyOn(mentorDirectoryApi, 'listMentors').mockResolvedValue([]);

    renderFindMentorPage();

    expect(await screen.findByRole('heading', { name: 'Find a mentor with AI' })).toBeInTheDocument();
    expect(screen.getByText('Your recommendations will appear here')).toBeInTheDocument();
    expect(screen.getByText(
      'Start by describing what you want to learn. We’ll compare your goal with available mentor profiles.'
    )).toBeInTheDocument();
    expect(screen.getByText('Mentor Directory')).toBeInTheDocument();
    expect(screen.getByText('No Mentors Found')).toBeInTheDocument();
  });

  it('defaults the directory to the user branch and lets them browse all locations', async () => {
    const userBranch = [
      { id: 'department:1', name: 'North District' },
      { id: 'department:2', name: 'Central Branch' },
    ];
    vi.spyOn(mentorDirectoryApi, 'getMyOrganizationPath').mockResolvedValue(userBranch);
    vi.spyOn(mentorDirectoryApi, 'listMentors').mockResolvedValue([
      { ...buildMentor(20, 2), organizationPath: userBranch },
      {
        ...buildMentor(30, 2),
        organizationPath: [
          { id: 'department:3', name: 'South District' },
          { id: 'department:4', name: 'Market Branch' },
        ],
      },
    ]);

    renderFindMentorPage();

    expect(await screen.findByText('Mentor 20')).toBeInTheDocument();
    expect(screen.queryByText('Mentor 30')).not.toBeInTheDocument();
    const districtFilter = screen.getByLabelText('Filter by district');
    const branchFilter = screen.getByLabelText('Filter by branch');
    expect(districtFilter).toHaveValue('department:1');
    expect(branchFilter).toHaveValue('department:2');
    fireEvent.change(districtFilter, { target: { value: '' } });
    expect(screen.getByText('Mentor 30')).toBeInTheDocument();
  });

  it('shows a mentor list and all pairings when a trainee is selected', async () => {
    vi.spyOn(mentoringPairingApi, 'listMyRelationships').mockResolvedValue([
      buildRelationship({ relationshipId: 101, memberId: 1, skillName: 'Java' }),
      buildRelationship({ relationshipId: 102, memberId: 2, skillName: 'Excel' }),
      buildRelationship({
        relationshipId: 103,
        memberId: 3,
        traineeUserId: 31,
        traineeName: 'Trainee Thirty-One',
      }),
    ]);

    renderFindMentorPage('/mentoring?view=trainer');

    const traineeButton = await screen.findByRole('button', { name: /Trainee Thirty 2 pairings/i });
    fireEvent.click(traineeButton);

    expect(screen.getByRole('heading', { name: 'Java' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Excel' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /View pairing/i })).toHaveLength(2);
    expect(screen.queryByRole('tablist', { name: 'Mentoring request status' })).not.toBeInTheDocument();
  });

  it('shows mentor pairings in the My Mentors view', async () => {
    vi.spyOn(mentoringPairingApi, 'listMyRelationships').mockResolvedValue([
      buildRelationship({
        currentUserRole: 'TRAINEE',
        mentorUserId: 30,
        mentorName: 'Mentor Thirty',
        traineeUserId: 7,
        traineeName: 'Trainee Seven',
      }),
    ]);

    renderFindMentorPage('/mentoring?view=trainee');

    fireEvent.click(await screen.findByRole('button', { name: /Mentor Thirty 1 pairing/i }));

    expect(screen.getByRole('heading', { name: 'Mentor Thirty' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Java' })).toBeInTheDocument();
  });

  it('combines requests received as a mentor and sent as a trainee', async () => {
    const receivedRequest: MentoringPairing = {
      id: 501,
      requestId: 501,
      requestType: 'INDIVIDUAL',
      status: 'PENDING',
      incoming: true,
      initiatedByMentor: false,
      mentorUserId: 7,
      mentorName: 'Trainee Seven',
      traineeUserId: 41,
      traineeName: 'Trainee Forty-One',
      recipientUserId: 7,
      skillId: skill.id,
      skillName: 'Java',
      message: 'Help me learn Java.',
      createdAt: '2026-03-01T00:00:00Z',
      respondedAt: null,
    };
    const sentRequest: MentoringPairing = {
      ...receivedRequest,
      id: 502,
      requestId: 502,
      incoming: false,
      mentorUserId: 30,
      mentorName: 'Mentor Thirty',
      traineeUserId: 7,
      traineeName: 'Trainee Seven',
      recipientUserId: 30,
      skillId: otherSkill.id,
      skillName: 'Excel',
      message: 'Help me learn Excel.',
    };
    vi.spyOn(mentoringPairingApi, 'listMyRequests').mockResolvedValue([receivedRequest, sentRequest]);

    renderFindMentorPage('/mentoring?view=requests');

    expect(await screen.findByText(/Trainee Seven → Trainee Forty-One/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Sent/ }));
    expect(screen.getByText(/Mentor Thirty → Trainee Seven/)).toBeInTheDocument();
    expect(screen.getByText('Help me learn Excel.')).toBeInTheDocument();
  });

  it('submits the learning goal and allows a recommendation request', async () => {
    const mentor = {
      ...buildMentor(30, 2, otherSkill),
      experienceYears: 5,
      sessionsPerWeek: 3,
    };
    vi.spyOn(mentorDirectoryApi, 'listMentors').mockResolvedValue([]);
    vi.spyOn(mentorDirectoryApi, 'recommendMentors').mockResolvedValue({
      overallReason: 'Their available skills match your financial modeling goal.',
      recommendations: [{
        rank: 1,
        reason: 'Their Excel experience matches your goal.',
        skillId: otherSkill.id,
        skillName: otherSkill.name,
        careerExperience: [],
        mentorshipExperience: [],
        mentor,
      }],
    });

    renderFindMentorPage();

    fireEvent.change(await screen.findByLabelText('What would you like to learn?'), {
      target: { value: 'I want to improve my financial modeling skills.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Find mentors' }));

    expect(await screen.findByText('Mentor 30')).toBeInTheDocument();
    expect(screen.getByText('Their Excel experience matches your goal.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Request mentorship' }));

    await waitFor(() => {
      expect(mentorDirectoryApi.recommendMentors).toHaveBeenCalledWith(
        'I want to improve my financial modeling skills.',
        expect.anything()
      );
      expect(mentoringPairingApi.requestMentor).toHaveBeenCalledWith({
        mentorUserId: 30,
        skillId: otherSkill.id,
        message: 'I want to improve my financial modeling skills.',
      }, expect.anything());
    });
  });
});
