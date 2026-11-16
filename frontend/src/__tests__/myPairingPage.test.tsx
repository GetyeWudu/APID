import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as AuthContextModule from '../app/AuthContext';
import { mentoringPairingApi, type MentoringRelationshipPair } from '../features/mentoring/api/mentoringPairingApi';
import { MyPairingPage } from '../features/mentoring/pages/MyPairingPage';
import type { UserProfile } from '../features/auth/types/auth.types';

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

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MyPairingPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const pairings: MentoringRelationshipPair[] = [
  {
    memberId: 11,
    relationshipId: 101,
    requestId: 201,
    requestType: 'INDIVIDUAL',
    relationshipStatus: 'ACTIVE',
    memberStatus: 'ACTIVE',
    currentUserRole: 'MENTOR',
    mentorUserId: 7,
    mentorName: 'Current User',
    traineeUserId: 8,
    traineeName: 'Trainee One',
    skillId: 5,
    skillName: 'Communication',
    message: null,
    startedAt: '2026-04-20T08:00:00Z',
    joinedAt: '2026-04-20T08:00:00Z',
    endedAt: null,
    memberEndedAt: null,
  },
  {
    memberId: 12,
    relationshipId: 102,
    requestId: 202,
    requestType: 'GROUP',
    relationshipStatus: 'COMPLETED',
    memberStatus: 'COMPLETED',
    currentUserRole: 'TRAINEE',
    mentorUserId: 9,
    mentorName: 'Mentor One',
    traineeUserId: 7,
    traineeName: 'Current User',
    skillId: null,
    skillName: null,
    message: null,
    startedAt: '2025-11-10T08:00:00Z',
    joinedAt: '2025-11-10T08:00:00Z',
    endedAt: '2026-01-10T08:00:00Z',
    memberEndedAt: '2026-01-10T08:00:00Z',
  },
];

describe('MyPairingPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
      buildAuthMock({
        id: 7,
        username: 'current.user',
        mustChangePassword: false,
        roles: ['Employee'],
        permissions: ['EMPLOYEE_PORTAL_ACCESS'],
      })
    );
  });

  it('loads pairings from the API for both mentor and trainee roles', async () => {
    vi.spyOn(mentoringPairingApi, 'listMyRelationships').mockResolvedValue(pairings);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Trainee One' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mentor One' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /As mentor/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /As trainee/ })).toBeInTheDocument();
    expect(mentoringPairingApi.listMyRelationships).toHaveBeenCalledOnce();
  });

  it('filters the list by the user-selected pairing role', async () => {
    vi.spyOn(mentoringPairingApi, 'listMyRelationships').mockResolvedValue(pairings);

    renderPage();

    await screen.findByRole('heading', { name: 'Trainee One' });
    fireEvent.click(screen.getByRole('button', { name: /As mentor/ }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Trainee One' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Mentor One' })).not.toBeInTheDocument();
    });
  });
});
