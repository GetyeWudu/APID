import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as AuthContextModule from '../app/AuthContext';
import { mentorApplicationApi } from '../features/mentoring/api/mentorApplicationApi';
import { mentoringTrainerApi } from '../features/mentoring/api/mentoringTrainerApi';
import { ApplyForMentorForm } from '../features/mentoring/components/ApplyForMentorForm';
import { MentorProfileForm } from '../features/mentoring/components/MentorProfileForm';
import { ToastProvider } from '../shared/components/ui';

const activeSkills = [
  {
    id: 8,
    name: 'Financial Modeling',
    category: 'Finance',
    description: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 9,
    name: 'Budget Planning',
    category: 'Finance',
    description: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

describe('mentor application workflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 7,
        username: 'mentor',
        mustChangePassword: false,
        roles: ['Mentor'],
        permissions: ['EMPLOYEE_PORTAL_ACCESS'],
      },
      loading: false,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
      changePassword: vi.fn(),
      refreshProfile: vi.fn().mockResolvedValue(undefined),
      hasPermission: () => false,
      hasAnyPermission: () => false,
    });
  });

  it('shows the existing initial application instead of allowing a second one', async () => {
    vi.spyOn(mentorApplicationApi, 'listMine').mockResolvedValue([
      {
        id: 11,
        applicantUsername: 'employee',
        applicationType: 'INITIAL',
        status: 'PENDING',
        skillName: 'Advanced Excel',
        skillNames: ['Advanced Excel'],
        catalogSkillIds: [4],
        customSkill: null,
        proofFileId: 31,
        proofFileName: 'proof.pdf',
        evidenceFiles: [{ fileId: 31, fileName: 'proof.pdf' }],
        note: null,
        expertiseSummary: null,
        availabilityNotes: null,
        maxConcurrentTrainees: null,
        submittedAt: '2026-01-01T00:00:00Z',
        reviewedByUsername: null,
        reviewedAt: null,
        reviewReason: null,
      },
    ]);

    renderWithProviders(<ApplyForMentorForm activeSkills={activeSkills} currentUserId={7} />);

    expect(await screen.findByText('Your application is awaiting HR review.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send application' })).not.toBeInTheDocument();
  });

  it('submits additional skills for HR review from the mentor profile', async () => {
    vi.spyOn(mentoringTrainerApi, 'getProfile').mockResolvedValue({
      id: 5,
      employeeId: 10,
      userId: 7,
      employeeNumber: 'EMP-7',
      fullName: 'Mentor One',
      departmentName: 'Finance',
      employmentStatus: 'ACTIVE',
      sourceType: 'APPLICATION',
      status: 'ACTIVE',
      activeTrainees: 0,
      pendingTrainees: 0,
      maxConcurrentTrainees: 5,
      bio: null,
      availabilityNotes: null,
      skills: [{ id: 4, name: 'Advanced Excel', category: 'Finance', status: 'ACTIVE' }],
      effectiveFrom: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    vi.spyOn(mentorApplicationApi, 'listMine').mockResolvedValue([]);
    const requestSkillAddition = vi.spyOn(mentorApplicationApi, 'requestSkillAddition').mockResolvedValue({
      id: 12,
      applicationType: 'SKILL_ADDITION',
      status: 'PENDING',
      catalogSkillId: 8,
      catalogSkillIds: [8, 9],
      customSkill: null,
      submittedAt: '2026-01-02T00:00:00Z',
    });

    renderWithProviders(
      <MentorProfileForm activeSkills={activeSkills} currentUserId={7} />
    );

    const skillsSelect = await screen.findByLabelText('Catalog skills') as HTMLSelectElement;
    Array.from(skillsSelect.options).forEach((option) => {
      option.selected = option.value === '8' || option.value === '9';
    });
    fireEvent.change(skillsSelect);
    const evidence = new File(['certificate'], 'cert.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Supporting evidence'), {
      target: { files: [evidence] },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Request skill approval' }).closest('form')!);

    await waitFor(() => expect(requestSkillAddition).toHaveBeenCalled());
    expect(requestSkillAddition.mock.calls[0][0]).toEqual({
      catalogSkillIds: [8, 9],
      customSkill: undefined,
      supportingEvidence: [evidence],
      note: undefined,
    });
  });
});
