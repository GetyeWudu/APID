import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as AuthContextModule from '../app/AuthContext';
import { mentoringPairingApi } from '../features/mentoring/api/mentoringPairingApi';
import {
  MentoringChatPage,
  MentoringResourcesPage,
} from '../features/mentoring/pages/MentoringCollaborationPage';
import type { UserProfile } from '../features/auth/types/auth.types';
import { ToastProvider } from '../shared/components/ui';

function buildAuthMock(user: UserProfile) {
  const permissions = user.permissions;
  return {
    user,
    loading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    changePassword: vi.fn(),
    refreshProfile: vi.fn().mockResolvedValue(undefined),
    hasPermission: (code: string) => permissions.includes(code),
    hasAnyPermission: (codes: string[]) => codes.some((code) => permissions.includes(code)),
  };
}

function renderPage(path: string, page: JSX.Element) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/mentoring/chat" element={page} />
            <Route path="/mentoring/resources" element={page} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe('Mentoring collaboration pages', () => {
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
        memberId: 31,
        relationshipId: 42,
        requestId: 51,
        requestType: 'INDIVIDUAL',
        relationshipStatus: 'ACTIVE',
        memberStatus: 'ACTIVE',
        currentUserRole: 'MENTOR',
        mentorUserId: 7,
        mentorName: 'Mentor One',
        traineeUserId: 8,
        traineeName: 'Trainee One',
        skillId: 4,
        skillName: 'Leadership',
        message: null,
        startedAt: '2026-04-20T08:00:00Z',
        joinedAt: '2026-04-20T08:00:00Z',
        endedAt: null,
        memberEndedAt: null,
      },
    ]);
  });

  it('loads the selected relationship conversation using existing mentoring chat APIs', async () => {
    vi.spyOn(mentoringPairingApi, 'getRelationshipDetail').mockResolvedValue({
      relationshipId: 42,
      requestId: 51,
      requestType: 'INDIVIDUAL',
      status: 'ACTIVE',
      mentorUserId: 7,
      mentorName: 'Mentor One',
      skillName: 'Leadership',
      requestMessage: null,
      startedAt: '2026-04-20T08:00:00Z',
      endedAt: null,
      currentUserRole: 'MENTOR',
      trainees: [{
        userId: 8,
        name: 'Trainee One',
        status: 'ACTIVE',
        joinedAt: '2026-04-20T08:00:00Z',
        endedAt: null,
      }],
    });
    const listMessages = vi.spyOn(mentoringPairingApi, 'listMessages').mockResolvedValue({
      messages: [{
        id: 71,
        relationshipId: 42,
        senderUserId: 8,
        senderName: 'Trainee One',
        body: 'Ready to start?',
        createdAt: '2026-04-20T09:00:00Z',
        mine: false,
      }],
      page: 0,
      pageSize: 50,
      hasMore: false,
    });

    renderPage('/mentoring/chat?relationshipId=42', <MentoringChatPage />);

    expect(await screen.findByText('Chat with your pairing')).toBeInTheDocument();
    expect(await screen.findByText('Ready to start?')).toBeInTheDocument();
    expect(listMessages).toHaveBeenCalledWith(42, 0, 50);
  });

  it('loads shared resources for the selected relationship without adding backend behavior', async () => {
    const listResources = vi.spyOn(mentoringPairingApi, 'listResources').mockResolvedValue([]);

    renderPage('/mentoring/resources?relationshipId=42', <MentoringResourcesPage />);

    expect(await screen.findByText('Share a resource')).toBeInTheDocument();
    expect(await screen.findByText('No resources yet')).toBeInTheDocument();
    expect(listResources).toHaveBeenCalledWith(42);
  });
});
