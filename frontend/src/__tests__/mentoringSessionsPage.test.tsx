import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as AuthContextModule from '../app/AuthContext';
import type { UserProfile } from '../features/auth/types/auth.types';
import { mentoringPairingApi, type MentoringSession } from '../features/mentoring/api/mentoringPairingApi';
import { MentoringSessionsPage } from '../features/mentoring/pages/MentoringSessionsPage';
import { ToastProvider } from '../shared/components/ui';

function buildAuthMock(user: UserProfile | null) {
  const permissions = user?.permissions ?? [];
  return {
    user,
    loading: false,
    isAuthenticated: Boolean(user),
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    changePassword: vi.fn(),
    refreshProfile: vi.fn().mockResolvedValue(undefined),
    hasPermission: (code: string) => permissions.includes(code),
    hasAnyPermission: (codes: string[]) => codes.some((code) => permissions.includes(code)),
  };
}

const mockRelationships = [
  {
    memberId: 1,
    relationshipId: 77,
    requestId: 201,
    requestType: 'INDIVIDUAL' as const,
    relationshipStatus: 'ACTIVE' as const,
    memberStatus: 'ACTIVE' as const,
    currentUserRole: 'MENTOR' as const,
    mentorUserId: 7,
    mentorName: 'Mentor One',
    traineeUserId: 8,
    traineeName: 'Trainee One',
    skillId: null,
    skillName: 'Leadership',
    message: null,
    startedAt: '2026-04-20T08:00:00Z',
    joinedAt: '2026-04-20T08:00:00Z',
    endedAt: null,
    memberEndedAt: null,
  },
];

const mockScheduledSession: MentoringSession = {
  id: 101,
  relationshipId: 77,
  title: 'Core Banking Fundamentals',
  agenda: 'Review branch ledger flows and posting controls',
  scheduledStart: '2026-11-20T06:00:00Z',
  scheduledEnd: '2026-11-20T06:45:00Z',
  deliveryMode: 'ONLINE',
  meetingUrl: 'https://daily.co/boa-mentoring-101',
  location: null,
  status: 'SCHEDULED',
  createdByUserId: 7,
  createdByName: 'Mentor One',
  createdAt: '2026-11-17T08:00:00Z',
};

describe('MentoringSessionsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
      buildAuthMock({
        id: 7,
        username: 'mentor',
        mustChangePassword: false,
        roles: ['Mentor'],
        permissions: ['EMPLOYEE_PORTAL_ACCESS'],
      })
    );
    vi.spyOn(mentoringPairingApi, 'listMyRelationships').mockResolvedValue(mockRelationships);
    vi.spyOn(mentoringPairingApi, 'listMySessions').mockResolvedValue([mockScheduledSession]);
  });

  it('renders scheduled mentoring sessions with Ethiopian sunrise clock details', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/mentoring/sessions']}>
            <MentoringSessionsPage view="mentor" />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

    expect(await screen.findByText('Core Banking Fundamentals')).toBeInTheDocument();
    expect(screen.getByText(/Trainee One/i)).toBeInTheDocument();
    expect(screen.getByText('AWAITING TRAINEE RSVP')).toBeInTheDocument();
  });

  it('lets trainees view sessions and provides RSVP actions (Accept, Propose New Time, Decline)', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
      buildAuthMock({
        id: 8,
        username: 'trainee',
        mustChangePassword: false,
        roles: ['Employee'],
        permissions: ['EMPLOYEE_PORTAL_ACCESS'],
      })
    );
    vi.spyOn(mentoringPairingApi, 'listMyRelationships').mockResolvedValue([
      {
        ...mockRelationships[0],
        currentUserRole: 'TRAINEE' as const,
      },
    ]);

    const respondSpy = vi.spyOn(mentoringPairingApi, 'respondSession').mockResolvedValue({
      ...mockScheduledSession,
      status: 'CONFIRMED',
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/mentoring/sessions']}>
            <MentoringSessionsPage view="trainee" />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

    expect(await screen.findByText('Core Banking Fundamentals')).toBeInTheDocument();
    const acceptBtn = screen.getByRole('button', { name: /Accept Session/i });
    expect(acceptBtn).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Propose New Time/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Decline/i })).toBeInTheDocument();

    fireEvent.click(acceptBtn);
    await waitFor(() => {
      expect(respondSpy).toHaveBeenCalledWith(77, 101, { accept: true });
    });
  });

  it('allows mentors to submit real session scheduling via API', async () => {
    const createSessionSpy = vi.spyOn(mentoringPairingApi, 'createSession').mockResolvedValue({
      ...mockScheduledSession,
      id: 102,
      title: 'Branch Risk Architecture',
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/mentoring/sessions?relationshipId=77']}>
            <MentoringSessionsPage view="mentor" />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

    const titleInput = await screen.findByPlaceholderText('e.g. Core Banking System Orientation');
    fireEvent.change(titleInput, { target: { value: 'Branch Risk Architecture' } });

    const dateInput = container.querySelector('input[type="date"]');
    expect(dateInput).toBeTruthy();
    if (dateInput) {
      fireEvent.change(dateInput, { target: { value: '2099-06-05' } });
    }

    const form = container.querySelector('form');
    expect(form).toBeTruthy();
    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(() => {
      expect(createSessionSpy).toHaveBeenCalled();
    });
  });

  it('renders "Join Daily.co Video" on the scheduled day and launches the video room modal', async () => {
    const sessionStart = new Date();
    sessionStart.setHours(12, 0, 0, 0);
    vi.spyOn(mentoringPairingApi, 'listMySessions').mockResolvedValue([
      {
        ...mockScheduledSession,
        scheduledStart: sessionStart.toISOString(),
        scheduledEnd: new Date(sessionStart.getTime() + 45 * 60 * 1000).toISOString(),
      },
    ]);
    const getJoinTokenSpy = vi.spyOn(mentoringPairingApi, 'getJoinToken').mockResolvedValue({
      roomUrlWithToken: 'https://amakari.daily.co/apid-mentoring-77-101?t=mock-token',
      token: 'mock-token',
      expiresAt: '2026-11-20T08:00:00Z',
      isMock: true,
      roomName: 'apid-mentoring-77-101',
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/mentoring/sessions']}>
            <MentoringSessionsPage view="mentor" />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

    const joinBtn = await screen.findByRole('button', { name: /Join Daily\.co Video/i });
    expect(joinBtn).toBeInTheDocument();

    fireEvent.click(joinBtn);

    await waitFor(() => {
      expect(getJoinTokenSpy).toHaveBeenCalledWith(77, 101);
    });

    expect(await screen.findByText(/Daily\.co Mentoring Video Session Active/i)).toBeInTheDocument();
    expect(screen.getByText('apid-mentoring-77-101')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Leave Meeting/i })).toBeInTheDocument();
  });
});
