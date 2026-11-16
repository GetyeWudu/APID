import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
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
            <Route
              path="/mentoring/chat"
              element={<div>Mentoring Chat Workspace</div>}
            />
            <Route
              path="/mentoring/resources"
              element={<div>Mentoring Resources Workspace</div>}
            />
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

  it('shows previous sessions and links to the session planner', async () => {
    renderDetailPage();
    await screen.findByRole('tab', { name: 'Sessions' });
    fireEvent.click(screen.getByRole('tab', { name: 'Sessions' }));

    expect(await screen.findByText('Previous session')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create session' })).toHaveAttribute(
      'href',
      '/mentoring?view=trainer-sessions&relationshipId=77'
    );
  });

  it('links chat and resources to their shared workspaces with the pairing selected', async () => {
    renderDetailPage();
    const messageLink = await screen.findByRole('link', { name: 'Message' });
    expect(messageLink).toHaveAttribute('href', '/mentoring/chat?relationshipId=77');
    expect(screen.getByRole('tab', { name: 'Resources' })).toHaveAttribute(
      'href',
      '/mentoring/resources?relationshipId=77'
    );
    fireEvent.click(messageLink);
    expect(await screen.findByText('Mentoring Chat Workspace')).toBeInTheDocument();
  });
});
