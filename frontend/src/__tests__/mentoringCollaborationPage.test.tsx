import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
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
    const mockConvs = [
      {
        id: 99,
        title: 'Trainee One & Mentor One',
        contextType: 'MENTORING_RELATIONSHIP_DIRECT' as const,
        mentoringRelationshipId: 42,
        mentoringClassCohortId: null,
        unreadCount: 0,
        archived: false,
        pinned: false,
        participantCount: 2,
        lastMessage: {
          id: 71,
          conversationId: 99,
          senderId: 8,
          senderName: 'Trainee One',
          senderRole: 'TRAINEE' as const,
          content: 'Ready to start?',
          body: 'Ready to start?',
          createdAt: '2026-04-20T09:00:00Z',
          pinned: false,
          attachments: [],
        },
        participants: [
          {
            id: 1,
            employeeId: 80,
            userId: 8,
            fullName: 'Trainee One',
            employeeNumber: 'BOA-008',
            role: 'TRAINEE' as const,
            status: 'ACTIVE' as const,
            joinedAt: '2026-04-20T08:00:00Z',
          },
        ],
      },
    ];

    vi.spyOn(mentoringPairingApi, 'markConversationRead').mockResolvedValue();
    vi.spyOn(mentoringPairingApi, 'getMyMentoringConversations').mockResolvedValue(mockConvs);
    vi.spyOn(mentoringPairingApi, 'listMentoringConversations').mockResolvedValue(mockConvs);

    const getMessagesSpy = vi.spyOn(mentoringPairingApi, 'getConversationMessages').mockResolvedValue([
      {
        id: 71,
        conversationId: 99,
        senderEmployeeId: 80,
        senderUserId: 8,
        senderName: 'Trainee One',
        senderRole: 'TRAINEE' as any,
        messageType: 'TEXT',
        content: 'Ready to start?',
        deleted: false,
        pinned: false,
        createdAt: '2026-04-20T09:00:00Z',
        attachments: [],
      },
    ]);

    renderPage('/mentoring/chat?relationshipId=42', <MentoringChatPage />);

    expect(await screen.findByText('Mentoring Chat')).toBeInTheDocument();
    expect(await screen.findByText('Ready to start?')).toBeInTheDocument();
    await waitFor(() => {
      expect(getMessagesSpy).toHaveBeenCalledWith(99, undefined, undefined, 60);
    });
  });

  it('loads shared resources for the selected relationship without adding backend behavior', async () => {
    const listResources = vi.spyOn(mentoringPairingApi, 'listResources').mockResolvedValue([]);

    renderPage('/mentoring/resources?relationshipId=42', <MentoringResourcesPage />);

    expect(await screen.findByRole('link', { name: 'Back to Pairing Overview' })).toHaveAttribute(
      'href',
      '/mentoring/pairing/42'
    );
    expect(await screen.findByText('Share a resource')).toBeInTheDocument();
    expect(await screen.findByText('No resources yet')).toBeInTheDocument();
    expect(listResources).toHaveBeenCalledWith(42);
  });
});
