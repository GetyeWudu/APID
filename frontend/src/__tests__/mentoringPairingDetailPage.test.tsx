import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as AuthContextModule from '../app/AuthContext';
import type { UserProfile } from '../features/auth/types/auth.types';
import { mentoringPairingApi } from '../features/mentoring/api/mentoringPairingApi';
import { MentoringPairingDetailPage } from '../features/mentoring/pages/MentoringPairingDetailPage';
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

function renderDetailPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/mentoring/pairing/77']}>
          <Routes>
            <Route path="/mentoring/pairing/:relationshipId" element={<MentoringPairingDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe('MentoringPairingDetailPage', () => {
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
    vi.spyOn(mentoringPairingApi, 'getRelationshipDetail').mockResolvedValue({
      relationshipId: 77,
      requestId: 201,
      requestType: 'GROUP',
      status: 'ACTIVE',
      mentorUserId: 7,
      mentorName: 'Mentor One',
      skillName: 'Leadership',
      requestMessage: "Let's work on leadership.",
      startedAt: '2026-04-20T08:00:00Z',
      endedAt: null,
      currentUserRole: 'MENTOR',
      trainees: [
        {
          userId: 8,
          name: 'Trainee One',
          status: 'ACTIVE',
          joinedAt: '2026-04-20T08:00:00Z',
          endedAt: null,
        },
      ],
    });
    vi.spyOn(mentoringPairingApi, 'listSessions').mockResolvedValue([
      {
        id: 4,
        relationshipId: 77,
        title: 'Previous session',
        agenda: 'Review progress',
        scheduledStart: '2026-04-25T09:00:00Z',
        scheduledEnd: '2026-04-25T10:00:00Z',
        deliveryMode: 'ONLINE',
        meetingUrl: null,
        status: 'COMPLETED',
        createdByUserId: 7,
        createdByName: 'Mentor One',
        createdAt: '2026-04-20T08:00:00Z',
      },
    ]);
    vi.spyOn(mentoringPairingApi, 'listMessages').mockResolvedValue({
      messages: [
        {
          id: 31,
          relationshipId: 77,
          senderUserId: 8,
          senderName: 'Trainee One',
          body: 'Hello mentor',
          createdAt: '2026-04-25T10:00:00Z',
          mine: false,
        },
      ],
      page: 0,
      pageSize: 50,
      hasMore: false,
    });
  });

  it('shows previous sessions and lets the mentor schedule a shared class session', async () => {
    const createSession = vi.spyOn(mentoringPairingApi, 'createSession').mockResolvedValue({
      id: 5,
      relationshipId: 77,
      title: 'Career goals',
      agenda: null,
      scheduledStart: '2030-06-01T09:00:00Z',
      scheduledEnd: '2030-06-01T10:00:00Z',
      deliveryMode: 'ONLINE',
      meetingUrl: null,
      status: 'SCHEDULED',
      createdByUserId: 7,
      createdByName: 'Mentor One',
      createdAt: '2026-04-20T08:00:00Z',
    });

    renderDetailPage();
    await screen.findByRole('tab', { name: 'Sessions' });
    fireEvent.click(screen.getByRole('tab', { name: 'Sessions' }));

    expect(await screen.findByText('Previous session')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Session title'), { target: { value: 'Career goals' } });
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2030-06-01T09:00' } });
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2030-06-01T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Schedule session' }));

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledWith(
        77,
        expect.objectContaining({
          title: 'Career goals',
          scheduledStart: new Date('2030-06-01T09:00').toISOString(),
          scheduledEnd: new Date('2030-06-01T10:00').toISOString(),
          deliveryMode: 'ONLINE',
        })
      );
    });
  });

  it('loads previous chat and sends a new message to the pairing', async () => {
    const sendMessage = vi.spyOn(mentoringPairingApi, 'sendMessage').mockResolvedValue({
      id: 32,
      relationshipId: 77,
      senderUserId: 7,
      senderName: 'Mentor One',
      body: 'We can discuss it tomorrow.',
      createdAt: '2026-04-25T11:00:00Z',
      mine: true,
    });

    renderDetailPage();
    await screen.findByRole('tab', { name: 'Pair chat' });
    fireEvent.click(screen.getByRole('tab', { name: 'Pair chat' }));

    expect(await screen.findByText('Hello mentor')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Write a message' }), {
      target: { value: 'We can discuss it tomorrow.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(77, 'We can discuss it tomorrow.');
    });
  });
});
