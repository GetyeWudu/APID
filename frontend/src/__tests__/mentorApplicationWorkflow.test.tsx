import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import * as AuthContextModule from '../app/AuthContext';
import { mentorApplicationApi } from '../features/mentoring/api/mentorApplicationApi';
import { mentoringTrainerApi } from '../features/mentoring/api/mentoringTrainerApi';
import { ApplyForMentorForm } from '../features/mentoring/components/ApplyForMentorForm';
import { MentorProfileForm } from '../features/mentoring/components/MentorProfileForm';
import { TrainerApplicationsTab } from '../features/mentoring/components/TrainerApplicationsTab';
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
      <MemoryRouter>
        <ToastProvider>{children}</ToastProvider>
      </MemoryRouter>
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

    expect(await screen.findByText(/awaiting administrator review/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit Application' })).not.toBeInTheDocument();
  });

  it('allows a new application after the previous initial application was declined', async () => {
    vi.spyOn(mentorApplicationApi, 'listMine').mockResolvedValue([
      {
        id: 12,
        applicantUsername: 'mentor',
        applicationType: 'INITIAL',
        status: 'DECLINED',
        skillName: 'Backend Development',
        skillNames: ['Backend Development'],
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
        reviewedByUsername: 'hr',
        reviewedAt: '2026-01-02T00:00:00Z',
        reviewReason: 'Please provide more experience information.',
      },
    ]);

    renderWithProviders(<ApplyForMentorForm activeSkills={activeSkills} currentUserId={7} />);

    expect(await screen.findByText('Your previous application was declined.')).toBeInTheDocument();
    expect(screen.getByText(/Please provide more experience information/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('shows combined education records in the HR application details view', async () => {
    const application = {
      id: 21,
      applicantUsername: 'mentor.one',
      applicationType: 'INITIAL' as const,
      status: 'PENDING' as const,
      skillName: 'Frontend Development',
      skillNames: ['Frontend Development'],
      catalogSkillIds: [4],
      customSkill: null,
      proofFileId: 31,
      proofFileName: 'degree.pdf',
      evidenceFiles: [{
        fileId: 31,
        fileName: 'degree.pdf',
        context: "Education background 1: Bachelor's Degree · Example University",
      }],
      note: [
        'MENTOR APPLICATION DETAILS',
        'Full name: Mentor One',
        'Educational background: [{"educationLevel":"Bachelor\'s Degree","fieldOfStudy":"Software Engineering","institution":"Example University","certificateLink":"https://example.edu/degree","certificateDocument":"degree.pdf"}]',
        'Mentoring interests / expertise: ["API Development & Integration","Backend Development"]',
        'Availability: {"days":[{"day":"Monday","start":"","end":""},{"day":"Friday","start":"09:00","end":"12:00"}],"timeZone":"Africa/Addis_Ababa"}',
        'Mentorship formats: One-on-One Mentorship, Both',
        'Maximum concurrent mentees: 5',
      ].join('\n'),
      expertiseSummary: null,
      availabilityNotes: null,
      maxConcurrentTrainees: null,
      submittedAt: '2026-01-01T00:00:00Z',
      reviewedByUsername: null,
      reviewedAt: null,
      reviewReason: null,
    };

    renderWithProviders(<TrainerApplicationsTab applications={[application]} />);
    fireEvent.click(screen.getByRole('button', { name: /^view$/i }));

    expect(await screen.findByRole('heading', { name: 'Educational background' })).toBeInTheDocument();
    expect(screen.getByText("Bachelor's Degree")).toBeInTheDocument();
    expect(screen.getByText('Software Engineering')).toBeInTheDocument();
    expect(screen.getByText('Example University')).toBeInTheDocument();
    expect(screen.getByText('API Development & Integration')).toBeInTheDocument();
    expect(screen.getByText('Backend Development')).toBeInTheDocument();
    expect(screen.getByText("Education background 1: Bachelor's Degree · Example University")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open certificate/i })).toHaveAttribute(
      'href',
      'https://example.edu/degree'
    );
    expect(screen.getByText('Time not specified')).toBeInTheDocument();
    expect(screen.getByText('Time zone: Africa/Addis Ababa')).toBeInTheDocument();
    expect(screen.getByText('One-on-One Mentorship')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows requested mentor profile changes in HR review details', async () => {
    renderWithProviders(<TrainerApplicationsTab applications={[{
      id: 22,
      applicantUsername: 'mentor.one',
      applicationType: 'PROFILE_UPDATE' as const,
      status: 'PENDING' as const,
      skillName: '',
      skillNames: [],
      catalogSkillIds: [],
      customSkill: null,
      proofFileId: null,
      proofFileName: null,
      evidenceFiles: [],
      note: 'Mentor profile update request',
      expertiseSummary: null,
      availabilityNotes: 'Weekday evenings',
      experienceYears: 8,
      mentoringApproach: 'Practical coaching',
      sessionsPerWeek: 2,
      maxConcurrentTrainees: 4,
      submittedAt: '2026-01-01T00:00:00Z',
      reviewedByUsername: null,
      reviewedAt: null,
      reviewReason: null,
    }]} />);

    fireEvent.click(screen.getByRole('button', { name: /^view$/i }));

    expect(await screen.findByRole('heading', { name: 'Requested profile changes' })).toBeInTheDocument();
    expect(screen.getByText('Practical coaching')).toBeInTheDocument();
    expect(screen.getByText('Weekday evenings')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Educational background' })).not.toBeInTheDocument();
  });

  it('uses the account name read-only and allows continuing without a profile picture', async () => {
    vi.spyOn(mentorApplicationApi, 'listMine').mockResolvedValue([]);

    renderWithProviders(
      <ApplyForMentorForm activeSkills={activeSkills} currentUserId={7} defaultFullName="Mentor One" />
    );

    const fullName = await screen.findByLabelText('Full name');
    expect(fullName).toHaveValue('Mentor One');
    expect(fullName).toHaveAttribute('readonly');
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('No education records added yet.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Education Background' }));
    expect(screen.getByLabelText('Education level')).toBeInTheDocument();
    expect(screen.getByLabelText('Institution name')).toBeInTheDocument();
    expect(screen.getByLabelText('Certificate document')).toBeInTheDocument();
    expect(screen.getByLabelText('Or certificate link')).toBeInTheDocument();
  });

  it('shows mentoring skills, certificate skills, mentorship, and career sections without requiring answers', async () => {
    vi.spyOn(mentorApplicationApi, 'listMine').mockResolvedValue([]);
    renderWithProviders(
      <ApplyForMentorForm activeSkills={activeSkills} currentUserId={7} defaultFullName="Mentor One" />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Education Background' }));
    fireEvent.change(screen.getByLabelText('Education level'), {
      target: { value: "Bachelor's Degree" },
    });
    fireEvent.change(screen.getByLabelText('Field of study'), {
      target: { value: 'Finance' },
    });
    fireEvent.change(screen.getByLabelText('Institution name'), {
      target: { value: 'Example University' },
    });
    fireEvent.change(screen.getByLabelText('Or certificate link'), {
      target: { value: 'https://example.edu/certificate' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('What would you like to mentor?')).toBeInTheDocument();
    expect(screen.getByText('Software Engineering & IT')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Add a custom skill/), {
      target: { value: 'Financial modeling' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'Professional Certificates' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Professional Certificate' }));
    expect(screen.getByLabelText('Certificate title')).toBeInTheDocument();
    expect(screen.getByText(/Skills gained from certificate 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    fireEvent.click(await screen.findByRole('radio', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Mentorship Experience' }));
    expect(screen.getByLabelText(/Organization or program/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Proof of experience/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('General Professional Experience')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Career Experience' }));
    expect(screen.getByLabelText('Job title')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Mentorship Preferences and Availability')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('CV and Letter of Motivation')).toBeInTheDocument();
    expect(screen.getByLabelText(/CV \(optional\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Letter of motivation \(optional\)/)).toBeInTheDocument();
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
    vi.spyOn(mentoringTrainerApi, 'getMyBadgeRemovalRequest').mockResolvedValue(null);
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

  it('submits mentor profile edits as an HR review request', async () => {
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
      activeTrainees: 1,
      pendingTrainees: 0,
      maxConcurrentTrainees: 5,
      bio: 'Current approach',
      availabilityNotes: null,
      skills: [{ id: 4, name: 'Advanced Excel', category: 'Finance', status: 'ACTIVE' }],
      effectiveFrom: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    vi.spyOn(mentoringTrainerApi, 'getMyBadgeRemovalRequest').mockResolvedValue(null);
    vi.spyOn(mentorApplicationApi, 'listMine').mockResolvedValue([]);
    const requestProfileUpdate = vi.spyOn(mentorApplicationApi, 'requestProfileUpdate').mockResolvedValue({
      id: 13,
      applicationType: 'PROFILE_UPDATE',
      status: 'PENDING',
      catalogSkillId: null,
      catalogSkillIds: [],
      customSkill: null,
      submittedAt: '2026-01-02T00:00:00Z',
    });

    renderWithProviders(<MentorProfileForm activeSkills={activeSkills} currentUserId={7} />);

    fireEvent.change(await screen.findByLabelText('Mentoring approach'), {
      target: { value: 'A new approach' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Request profile update' }));

    await waitFor(() => expect(requestProfileUpdate).toHaveBeenCalled());
    expect(requestProfileUpdate).toHaveBeenCalledWith({
      bio: 'A new approach',
      availabilityNotes: '',
      experienceYears: null,
      mentoringApproach: 'A new approach',
      sessionsPerWeek: null,
      maxConcurrentTrainees: 5,
    });
  });
});
