import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mentoringPairingApi } from '../features/mentoring/api/mentoringPairingApi';
import { mentoringTrainerApi } from '../features/mentoring/api/mentoringTrainerApi';
import { MentorInvitationForm } from '../features/mentoring/components/MentorInvitationForm';
import { ToastProvider } from '../shared/components/ui';

describe('MentorInvitationForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(mentoringPairingApi, 'listEmployeeCandidates').mockResolvedValue([
      {
        userId: 21,
        employeeNumber: 'EMP-21',
        fullName: 'Trainee One',
        departmentName: 'Finance',
      },
    ]);
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
      skills: [
        { id: 4, name: 'Advanced Excel', category: 'Finance', status: 'ACTIVE' },
        { id: 8, name: 'Financial Modeling', category: 'Finance', status: 'ACTIVE' },
      ],
      effectiveFrom: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    vi.spyOn(mentoringPairingApi, 'inviteTrainees').mockResolvedValue([]);
  });

  it('requires and sends the selected skill when inviting a trainee', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const inviteTrainees = vi.mocked(mentoringPairingApi.inviteTrainees);

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MentorInvitationForm currentUserId={7} />
        </ToastProvider>
      </QueryClientProvider>
    );

    const skillSelect = await screen.findByLabelText('Mentoring skill');
    const sendButton = screen.getByRole('button', { name: 'Send mentoring invitation' });

    fireEvent.change(screen.getByLabelText('Employees (select one)'), {
      target: { value: '21' },
    });
    expect(sendButton).toBeDisabled();

    fireEvent.change(skillSelect, { target: { value: '8' } });
    expect(sendButton).toBeEnabled();
    fireEvent.click(sendButton);

    await waitFor(() => expect(inviteTrainees).toHaveBeenCalled());
    expect(inviteTrainees.mock.calls[0][0]).toEqual({
      requestType: 'INDIVIDUAL',
      traineeUserIds: [21],
      skillId: 8,
      message: undefined,
    });
  });
});
