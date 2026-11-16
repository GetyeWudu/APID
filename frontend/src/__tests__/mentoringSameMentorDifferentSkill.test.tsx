import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { mentorDirectoryApi, type MentorDirectoryItem } from '../features/mentoring/api/mentorDirectoryApi';
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
  availabilityNotes: null,
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

  it('lets a trainee request a recommendation for a skill with no existing pairing', async () => {
    vi.spyOn(mentorDirectoryApi, 'listMentors').mockResolvedValue([mentor]);
    const requestMentor = vi.spyOn(mentoringPairingApi, 'requestMentor').mockResolvedValue(existingPairing);

    renderWithProviders(
      <MentoringRecommendations
        skills={[{ id: 8, name: 'Financial Modeling' }]}
        currentUserId={7}
        requests={[existingPairing]}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Request mentorship' }));

    await waitFor(() => expect(requestMentor).toHaveBeenCalled());
    expect(requestMentor.mock.calls[0][0]).toEqual({
      mentorUserId: 20,
      skillId: 8,
    });
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
});
