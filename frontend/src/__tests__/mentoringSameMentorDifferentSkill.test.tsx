import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { MentorDirectoryItem } from '../features/mentoring/api/mentorDirectoryApi';
import { mentorDirectoryApi } from '../features/mentoring/api/mentorDirectoryApi';
import { mentoringPairingApi, type MentoringPairing } from '../features/mentoring/api/mentoringPairingApi';
import { MentorDirectory } from '../features/mentoring/components/MentorDirectory';
import { MentoringRecommendations } from '../features/mentoring/components/MentoringRecommendations';
import { ToastProvider } from '../shared/components/ui';

const mentor: MentorDirectoryItem = {
  userId: 20,
  username: 'mentor',
  employeeNumber: 'EMP-20',
  fullName: 'Mentor One',
  departmentName: 'Finance',
  bio: null,
  activeTrainees: 1,
  remainingCapacity: 3,
  averageRating: 4.5,
  skills: [
    { id: 4, name: 'Advanced Excel', category: 'Finance' },
    { id: 8, name: 'Financial Modeling', category: 'Finance' },
  ],
};

const existingPairing: MentoringPairing = {
  id: 1,
  requestId: 1,
  requestType: 'INDIVIDUAL',
  status: 'ACCEPTED',
  incoming: false,
  initiatedByMentor: false,
  mentorUserId: 20,
  mentorName: 'Mentor One',
  traineeUserId: 7,
  traineeName: 'Trainee One',
  recipientUserId: 20,
  skillId: 4,
  skillName: 'Advanced Excel',
  message: null,
  createdAt: '2026-01-01T00:00:00Z',
  respondedAt: '2026-01-02T00:00:00Z',
};

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

describe('same mentor requests for different skills', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('collects a learning goal before recommendations are requested', () => {
    renderWithProviders(<MentoringRecommendations />);

    fireEvent.change(screen.getByLabelText('What would you like to learn?'), {
      target: { value: 'I want to learn financial modeling.' },
    });

    expect(screen.getByLabelText('What would you like to learn?')).toHaveValue(
      'I want to learn financial modeling.'
    );
    expect(screen.getByText(
      'Start by describing what you want to learn. We’ll compare your goal with available mentor profiles.'
    )).toBeInTheDocument();
  });

  it('shows a friendly no-match message when no mentors are recommended', async () => {
    vi.spyOn(mentorDirectoryApi, 'recommendMentors').mockResolvedValue({
      overallReason: null,
      recommendations: [],
    });
    renderWithProviders(<MentoringRecommendations />);

    fireEvent.change(screen.getByLabelText('What would you like to learn?'), {
      target: { value: 'I want to learn marine biology.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /find mentors/i }));

    expect(await screen.findByText('No mentor available for this skill')).toBeInTheDocument();
  });

  it('shows no mentor available for an empty recommendation service result', async () => {
    const error = Object.assign(new Error('empty response'), {
      isAxiosError: true,
      response: {
        status: 502,
        data: {
          error: {
            code: 'MENTOR_RECOMMENDATION_EMPTY_RESPONSE',
            message: 'The recommendation service returned an empty response.',
          },
        },
      },
    });
    vi.spyOn(mentorDirectoryApi, 'recommendMentors').mockRejectedValue(error);
    renderWithProviders(<MentoringRecommendations />);

    fireEvent.change(screen.getByLabelText('What would you like to learn?'), {
      target: { value: 'I want to learn marine biology.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /find mentors/i }));

    expect(await screen.findByText('No mentor available for this skill')).toBeInTheDocument();
  });

  it('shows a friendly unavailable message when the AI service is unreachable', async () => {
    const error = Object.assign(new Error('request failed'), {
      isAxiosError: true,
      response: {
        status: 502,
        data: {
          error: {
            code: 'MENTOR_RECOMMENDATION_SERVICE_UNAVAILABLE',
            message: 'The mentor recommendation service is unavailable.',
          },
        },
      },
    });
    vi.spyOn(mentorDirectoryApi, 'recommendMentors').mockRejectedValue(error);
    renderWithProviders(<MentoringRecommendations />);

    fireEvent.change(screen.getByLabelText('What would you like to learn?'), {
      target: { value: 'I want to learn financial modeling.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /find mentors/i }));

    expect(await screen.findByText(
      'AI recommendations are not available right now. Please try again later.'
    )).toBeInTheDocument();
    expect(screen.queryByText('The mentor recommendation service is unavailable.')).not.toBeInTheDocument();
  });

  it('renders multiple mentor recommendations with readable rank labels', async () => {
    vi.spyOn(mentorDirectoryApi, 'recommendMentors').mockResolvedValue({
      overallReason: 'These mentors have skills related to your financial modeling goal.',
      recommendations: [
        {
          rank: 1,
          reason: 'Strong match for financial modeling.',
          skillId: 4,
          skillName: 'Advanced Excel',
          careerExperience: [],
          mentorshipExperience: [],
          mentor,
        },
        {
          rank: 2,
          reason: 'Related experience in financial modeling.',
          skillId: 8,
          skillName: 'Financial Modeling',
          careerExperience: [],
          mentorshipExperience: [],
          mentor: { ...mentor, userId: 21, fullName: 'Mentor Two' },
        },
      ],
    });
    renderWithProviders(<MentoringRecommendations currentUserId={7} />);

    fireEvent.change(screen.getByLabelText('What would you like to learn?'), {
      target: { value: 'I want to learn financial modeling.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /find mentors/i }));

    expect(await screen.findByText('Mentor One')).toBeInTheDocument();
    expect(screen.getByText('Mentor Two')).toBeInTheDocument();
    expect(screen.getByText('Recommendation #1')).toBeInTheDocument();
    expect(screen.getByText('Recommendation #2')).toBeInTheDocument();
    expect(screen.getByText('These mentors have skills related to your financial modeling goal.')).toBeInTheDocument();
  });

  it('shows the full mentor profile and asks which skill to request', async () => {
    const requestMentor = vi.spyOn(mentoringPairingApi, 'requestMentor').mockResolvedValue(existingPairing);
    vi.spyOn(mentorDirectoryApi, 'recommendMentors').mockResolvedValue({
      overallReason: 'These mentors have experience aligned with your goal.',
      recommendations: [{
        rank: 1,
        reason: 'Mentor One has experience with Advanced Excel.',
        skillId: 4,
        skillName: 'Advanced Excel',
        careerExperience: [{ role: 'Financial Analyst', organization: 'Example Co', years: '2018-2024' }],
        mentorshipExperience: [{ role: 'Volunteer Mentor', organization: 'Example Org', years: '2021-2024' }],
        mentor: {
          ...mentor,
          bio: 'I help colleagues build practical finance skills.',
          mentoringApproach: 'Hands-on guided exercises.',
          education: [{
            educationLevel: "Bachelor's Degree",
            fieldOfStudy: 'Finance',
            institution: 'Example University',
          }],
          professionalCertificates: [{ title: 'Financial Modeling', skills: ['Excel'] }],
        },
      }],
    });

    renderWithProviders(<MentoringRecommendations currentUserId={7} />);
    fireEvent.change(screen.getByLabelText('What would you like to learn?'), {
      target: { value: 'I want to learn financial modeling.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /find mentors/i }));

    fireEvent.click(await screen.findByRole('button', { name: /view profile/i }));
    const profileDialog = screen.getByRole('dialog', { name: 'Mentor One' });
    expect(within(profileDialog).queryByText(/CV summary/i)).not.toBeInTheDocument();
    expect(within(profileDialog).getByText('Financial Analyst')).toBeInTheDocument();
    expect(within(profileDialog).getByText('Volunteer Mentor')).toBeInTheDocument();
    expect(within(profileDialog).getByText(/Finance · Example University/)).toBeInTheDocument();
    fireEvent.click(within(profileDialog).getByRole('button', { name: 'Close mentor profile' }));

    fireEvent.click(screen.getByRole('button', { name: /request mentorship/i }));
    expect(screen.getByRole('dialog', { name: 'Choose a skill' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Financial Modeling/ }));
    fireEvent.click(screen.getByRole('button', { name: /send request/i }));

    await waitFor(() => expect(requestMentor.mock.calls[0]?.[0]).toEqual({
      mentorUserId: 20,
      skillId: 8,
      message: 'I want to learn financial modeling.',
    }));
  });

  it('automatically requests the only available mentor skill', async () => {
    const requestMentor = vi.spyOn(mentoringPairingApi, 'requestMentor').mockResolvedValue(existingPairing);
    vi.spyOn(mentorDirectoryApi, 'recommendMentors').mockResolvedValue({
      overallReason: 'Advanced Excel matches the learning goal.',
      recommendations: [{
        rank: 1,
        reason: 'Mentor One offers Advanced Excel.',
        skillId: 4,
        skillName: 'Advanced Excel',
        careerExperience: [],
        mentorshipExperience: [],
        mentor: { ...mentor, skills: mentor.skills.slice(0, 1) },
      }],
    });

    renderWithProviders(<MentoringRecommendations currentUserId={7} />);
    fireEvent.change(screen.getByLabelText('What would you like to learn?'), {
      target: { value: 'I want to learn Excel.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /find mentors/i }));
    fireEvent.click(await screen.findByRole('button', { name: /request mentorship/i }));

    await waitFor(() => {
      expect(requestMentor.mock.calls[0]?.[0]).toEqual({
        mentorUserId: 20,
        skillId: 4,
        message: 'I want to learn Excel.',
      });
    });
    expect(screen.queryByRole('dialog', { name: 'Choose a skill' })).not.toBeInTheDocument();
  });

  it('lets a trainee select another skill in the mentor directory when one skill is active', async () => {
    const requestMentor = vi.spyOn(mentoringPairingApi, 'requestMentor').mockResolvedValue(existingPairing);

    renderWithProviders(
      <MentorDirectory mentors={[mentor]} currentUserId={7} requests={[existingPairing]} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Request another skill' }));

    const skillSelect = screen.getByLabelText('Skill');
    expect(skillSelect).toHaveValue('8');
    expect(screen.getByRole('option', { name: /Advanced Excel.*Mentorship active/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

    await waitFor(() => expect(requestMentor).toHaveBeenCalled());
    expect(requestMentor.mock.calls[0][0]).toEqual({
      mentorUserId: 20,
      skillId: 8,
      message: undefined,
    });
  });

  describe('mentor directory pagination', () => {
    it('shows mentors in a paginated table', () => {
      const mentors = Array.from({ length: 12 }, (_, index) => ({
        ...mentor,
        userId: 20 + index,
        username: `mentor${index + 1}`,
        employeeNumber: `EMP-${index + 1}`,
        fullName: `Mentor ${index + 1}`,
      }));

      renderWithProviders(<MentorDirectory mentors={mentors} currentUserId={7} />);

      expect(screen.getByText('Mentor 1')).toBeInTheDocument();
      expect(screen.getByText('Mentor 10')).toBeInTheDocument();
      expect(screen.queryByText('Mentor 11')).not.toBeInTheDocument();
      expect(screen.getByText('Page 1 of 2 (12 mentors)')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      expect(screen.getByText('Mentor 11')).toBeInTheDocument();
      expect(screen.getByText('Mentor 12')).toBeInTheDocument();
      expect(screen.queryByText('Mentor 1')).not.toBeInTheDocument();
      expect(screen.getByText('Page 2 of 2 (12 mentors)')).toBeInTheDocument();
    });

    it('loads and displays the selected mentor profile details', async () => {
      const getMentorProfile = vi.spyOn(mentorDirectoryApi, 'getMentorProfile').mockResolvedValue({
        mentor,
        careerExperience: [],
        mentorshipExperience: [],
      });
      renderWithProviders(
        <MentorDirectory
          mentors={[mentor]}
          currentUserId={7}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'View profile for Mentor One' }));

      const profileDialog = await screen.findByRole('dialog', { name: 'Mentor One' });
      expect(getMentorProfile).toHaveBeenCalledWith(mentor.userId);
      expect(within(profileDialog).getByText('Mentoring capacity')).toBeInTheDocument();
      expect(within(profileDialog).queryByText(/CV summary/i)).not.toBeInTheDocument();
      expect(within(profileDialog).queryByText(/time zone/i)).not.toBeInTheDocument();
      expect(within(profileDialog).queryByText(/availability details/i)).not.toBeInTheDocument();
      fireEvent.click(within(profileDialog).getByRole('button', { name: 'Close mentor profile' }));
      expect(screen.queryByRole('dialog', { name: 'Mentor One' })).not.toBeInTheDocument();
    });

    it('shows a profile details error while keeping the mentor profile available', async () => {
      vi.spyOn(mentorDirectoryApi, 'getMentorProfile').mockRejectedValue(new Error('Details unavailable'));
      renderWithProviders(<MentorDirectory mentors={[mentor]} currentUserId={7} />);

      fireEvent.click(screen.getByRole('button', { name: 'View profile for Mentor One' }));

      const profileDialog = await screen.findByRole('dialog', { name: 'Mentor One' });
      expect(await within(profileDialog).findByRole('alert')).toHaveTextContent('Details unavailable');
      expect(within(profileDialog).getByText('Mentoring capacity')).toBeInTheDocument();
    });
  });
});
