import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as AuthContextModule from '../app/AuthContext';
import type { UserProfile } from '../features/auth/types/auth.types';
import { mentoringPairingApi } from '../features/mentoring/api/mentoringPairingApi';
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
    vi.spyOn(mentoringPairingApi, 'listMyRelationships').mockResolvedValue([
      {
        memberId: 1,
        relationshipId: 77,
        requestId: 201,
        requestType: 'INDIVIDUAL',
        relationshipStatus: 'ACTIVE',
        memberStatus: 'ACTIVE',
        currentUserRole: 'MENTOR',
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
    ]);
    vi.spyOn(mentoringPairingApi, 'listMySessions').mockResolvedValue([]);
  });

  it('creates a local session plan without calling the session API', async () => {
    const createSession = vi.spyOn(mentoringPairingApi, 'createSession');
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/mentoring?relationshipId=77']}>
            <MentoringSessionsPage view="mentor" />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

    fireEvent.change(await screen.findByLabelText('Session title'), {
      target: { value: 'Career goals' },
    });
    fireEvent.change(screen.getByLabelText('What will you work on?'), {
      target: { value: 'Set career goals and identify next steps.' },
    });
    fireEvent.change(screen.getByLabelText('Starts'), {
      target: { value: '2099-06-01T09:00' },
    });
    fireEvent.change(screen.getByLabelText('Ends'), {
      target: { value: '2099-06-01T10:00' },
    });
    fireEvent.change(screen.getByLabelText('How will you meet?'), {
      target: { value: 'PHONE_CALL' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add session plan' }));

    expect(await screen.findByTestId('local-session-plan')).toHaveTextContent('Career goals');
    expect(screen.getByTestId('local-session-plan')).toHaveTextContent(
      'Set career goals and identify next steps.'
    );
    expect(screen.getByTestId('local-session-plan')).toHaveTextContent('Phone call');
    expect(createSession).not.toHaveBeenCalled();
  });
});
