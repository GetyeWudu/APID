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
    vi.spyOn(mentorApplicationApi, 'getAgreementTerms').mockResolvedValue({
      version: 'mentor-terms-v1',
      conditions: ['Mentor agreement condition'],
    });
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

  it('saves a draft without submitting the application', async () => {
    vi.spyOn(mentorApplicationApi, 'listMine').mockResolvedValue([]);
    const submit = vi.spyOn(mentorApplicationApi, 'submit');
    window.localStorage.removeItem('mentor-application-draft-7');

    renderWithProviders(<ApplyForMentorForm activeSkills={activeSkills} currentUserId={7} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Save as Draft' }));

    expect(window.localStorage.getItem('mentor-application-draft-7')).toBeTruthy();
    expect(submit).not.toHaveBeenCalled();
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

  it('shows and hides the submitted application details', async () => {
    vi.spyOn(mentorApplicationApi, 'listMine').mockResolvedValue([
      {
        id: 13,
        applicantUsername: 'employee',
        applicationType: 'INITIAL',
        status: 'PENDING',
        skillName: 'Backend Development',
        skillNames: ['Backend Development'],
        catalogSkillIds: [4],
        customSkill: null,
        proofFileId: null,
        proofFileName: null,
        evidenceFiles: [],
        note: [
          'MENTOR APPLICATION DETAILS',
          'Full name: Dereje Kebede',
          'Educational background: [{"educationLevel":"Master\'s Degree","fieldOfStudy":"Computer science","institution":"Haramaya University"}]',
          'Mentoring interests / expertise: ["Backend Development","Database Design & Management"]',
          'Professional certificates: [{"title":"Program Certificate","document":"certificate.pdf","skills":["Backend Development"]}]',
          'General professional experience: [{"title":"Software Engineer","organization":"Example Ltd","years":"2025–2026","description":"Software development"}]',
          'Availability: {"days":[{"day":"Monday","start":"08:32","end":"09:33"}],"timeZone":"Africa/Addis_Ababa"}',
          'Maximum concurrent mentees: 5',
          'CV: resume.pdf (85 KB)',
        ].join('\n'),
        expertiseSummary: 'Backend Development',
        availabilityNotes: null,
        maxConcurrentTrainees: 5,
        submittedAt: '2026-01-01T00:00:00Z',
        reviewedByUsername: null,
        reviewedAt: null,
        reviewReason: null,
      },
    ]);

    renderWithProviders(<ApplyForMentorForm activeSkills={activeSkills} currentUserId={7} />);

    fireEvent.click(await screen.findByRole('button', { name: 'View application details' }));
    expect(await screen.findByLabelText('Submitted application details')).toBeInTheDocument();
    expect(screen.getByText('Dereje Kebede')).toBeInTheDocument();
    expect(screen.getByText('Haramaya University')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide application details' }));
    expect(screen.queryByLabelText('Submitted application details')).not.toBeInTheDocument();
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

  it('summarizes an uploaded application document in the details modal', async () => {
    const summarizeDocument = vi.spyOn(mentorApplicationApi, 'summarizeDocument').mockResolvedValue({
      applicationId: 23,
      fileId: 61,
      fileName: 'resume.pdf',
      summary: 'The document describes the applicant’s software engineering experience.',
      sourceTruncated: false,
    });

    renderWithProviders(<TrainerApplicationsTab applications={[{
      id: 23,
      applicantUsername: 'mentor.one',
      applicationType: 'INITIAL',
      status: 'PENDING',
      skillName: 'Backend Development',
      skillNames: ['Backend Development'],
      catalogSkillIds: [4],
      customSkill: null,
      proofFileId: 63,
      proofFileName: 'letter.doc',
      evidenceFiles: [
        { fileId: 61, fileName: 'resume.pdf', context: 'Curriculum vitae' },
        { fileId: 62, fileName: 'portrait.png', context: 'Profile picture' },
      ],
      note: null,
      expertiseSummary: null,
      availabilityNotes: null,
      maxConcurrentTrainees: null,
      submittedAt: '2026-01-01T00:00:00Z',
      reviewedByUsername: null,
      reviewedAt: null,
      reviewReason: null,
    }]} />);

    fireEvent.click(screen.getByRole('button', { name: /^view$/i }));
    const summaryButtons = await screen.findAllByRole('button', { name: 'AI summary' });
    expect(summaryButtons[0]).toBeEnabled();
    expect(summaryButtons[1]).toBeDisabled();
    expect(summaryButtons[2]).toBeEnabled();
    expect(screen.getByText('letter.doc')).toBeInTheDocument();
    fireEvent.click(summaryButtons[0]);

    expect(await screen.findByText(
      'The document describes the applicant’s software engineering experience.'
    )).toBeInTheDocument();
    expect(summarizeDocument).toHaveBeenCalledWith(23, 61);
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

  it('includes additional skills and evidence in the complete profile update', async () => {
    const availability = {
      days: [{ day: 'Monday', start: '08:00', end: '09:00' }],
      timeZone: 'Africa/Addis_Ababa',
      formats: ['One-on-One Mentorship'],
    };
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
      availabilityNotes: JSON.stringify(availability),
      skills: [{ id: 4, name: 'Advanced Excel', category: 'Finance', status: 'ACTIVE' }],
      profileApplicationDetails: [
        'MENTOR APPLICATION DETAILS',
        'Full name: Mentor One',
        'Educational background: [{"educationLevel":"Master\'s Degree","fieldOfStudy":"Computer science","institution":"Old University","certificateLink":"","certificateDocument":"degree.pdf"}]',
        'Mentoring interests / expertise: ["Advanced Excel"]',
        'Professional certificates: [{"title":"Certificate","link":"","document":"cert.pdf","skills":["Advanced Excel"]}]',
        'Previous mentorship experience: No',
        'General professional experience: [{"title":"Software Engineer","organization":"Example","years":"2024–Present","description":"Builds software"}]',
        `Availability: ${JSON.stringify(availability)}`,
        'Mentorship formats: One-on-One Mentorship',
        'Maximum concurrent mentees: 5',
        'CV: resume.pdf',
        'Letter of motivation: letter.pdf',
      ].join('\n'),
      effectiveFrom: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    vi.spyOn(mentoringTrainerApi, 'getMyBadgeRemovalRequest').mockResolvedValue(null);
    vi.spyOn(mentorApplicationApi, 'listMine').mockResolvedValue([]);
    const requestProfileUpdate = vi.spyOn(mentorApplicationApi, 'requestProfileUpdate').mockResolvedValue({
      id: 12,
      applicationType: 'PROFILE_UPDATE',
      status: 'PENDING',
      catalogSkillId: null,
      catalogSkillIds: [8],
      customSkill: null,
      submittedAt: '2026-01-02T00:00:00Z',
    });

    renderWithProviders(
      <MentorProfileForm activeSkills={activeSkills} currentUserId={7} />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Edit profile' }));
    fireEvent.change(await screen.findByLabelText('Institution'), {
      target: { value: 'New University' },
    });
    const skillsSelect = await screen.findByLabelText('Catalog skills') as HTMLSelectElement;
    Array.from(skillsSelect.options).forEach((option) => {
      option.selected = option.value === 'Financial Modeling';
    });
    fireEvent.change(skillsSelect);
    const evidence = new File(['certificate'], 'cert.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Supporting documents'), {
      target: { files: [evidence] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit complete profile for HR review' }));

    await waitFor(() => expect(requestProfileUpdate).toHaveBeenCalled());
    expect(requestProfileUpdate).toHaveBeenCalledWith(expect.objectContaining({
      catalogSkillIds: [8],
      customSkill: 'Advanced Excel',
      supportingEvidence: [evidence],
      supportingEvidenceContexts: ['Professional certificate'],
      profileDetails: expect.stringContaining(
        'Mentoring interests / expertise: ["Advanced Excel","Financial Modeling"]'
      ),
    }));
    expect(requestProfileUpdate.mock.calls[0][0].profileDetails).toContain('"institution":"New University"');
  });

  it('submits full profile changes and skills together for HR review', async () => {
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

    fireEvent.click(await screen.findByRole('button', { name: 'Edit profile' }));
    fireEvent.change(await screen.findByLabelText('Mentoring approach'), {
      target: { value: 'A new approach' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit complete profile for HR review' }));

    await waitFor(() => expect(requestProfileUpdate).toHaveBeenCalled());
    expect(requestProfileUpdate).toHaveBeenCalledWith(expect.objectContaining({
      availabilityNotes: JSON.stringify({ days: [], timeZone: 'UTC', formats: [] }),
      experienceYears: null,
      mentoringApproach: 'A new approach',
      sessionsPerWeek: null,
      catalogSkillIds: [],
      customSkill: 'Advanced Excel',
      changeNote: undefined,
      supportingEvidence: [],
      profileDetails: expect.stringContaining('Mentoring interests / expertise: ["Advanced Excel"]'),
    }));
  });
});
