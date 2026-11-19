import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as AuthContextModule from '../app/AuthContext';
import type { UserProfile } from '../features/auth/types/auth.types';
import { mentorDirectoryApi, type MentorDirectoryItem } from '../features/mentoring/api/mentorDirectoryApi';
import { mentoringMatchApi } from '../features/mentoring/api/mentoringMatchApi';
import { mentoringPairingApi } from '../features/mentoring/api/mentoringPairingApi';
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
    availabilityNotes: null,
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

function renderFindMentorPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/mentoring?view=directory']}>
          <MentoringHomePage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
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
    vi.spyOn(mentoringPairingApi, 'listMyRequests').mockResolvedValue([]);
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

  it('shows the AI recommendation placeholder without fabricating mentor matches', async () => {
    vi.spyOn(mentorDirectoryApi, 'listMentors').mockResolvedValue([]);

    renderFindMentorPage();

    expect(await screen.findByRole('heading', { name: 'Find a mentor with AI' })).toBeInTheDocument();
    expect(screen.getByText('Your recommendations will appear here')).toBeInTheDocument();
    expect(screen.getByText(
      'Start by describing what you want to learn. This is a UI preview; AI matching is not connected yet.'
    )).toBeInTheDocument();
    expect(screen.getByText('Mentor Directory')).toBeInTheDocument();
    expect(screen.getByText('No Mentors Found')).toBeInTheDocument();
  });
});
