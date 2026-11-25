import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as AuthContextModule from '../app/AuthContext';
import type { UserProfile } from '../features/auth/types/auth.types';
import type { MessageDto } from '../features/coaching/api/coachingCommunicationApi';
import { mentoringPairingApi, type MentoringSession } from '../features/mentoring/api/mentoringPairingApi';
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
    vi.spyOn(mentoringPairingApi, 'getRelationshipConversation').mockResolvedValue({
      id: 501,
      conversationType: 'GROUP',
      contextType: 'MENTORING_COHORT_GROUP',
      mentoringRelationshipId: 77,
      title: 'Mentoring class',
      status: 'ACTIVE',
      unreadCount: 0,
      participants: [],
      pinnedMessages: [],
    });
    vi.spyOn(mentoringPairingApi, 'getConversationMessages').mockResolvedValue([
      {
        id: 31,
        conversationId: 501,
        senderEmployeeId: 8,
        senderUserId: 8,
        senderName: 'Trainee One',
        senderRole: 'TRAINEE',
        messageType: 'TEXT',
        content: 'Hello mentor',
        pinned: false,
        deleted: false,
        createdAt: '2026-04-25T10:00:00Z',
        attachments: [],
      },
    ]);
  });

  it('shows only the latest five messages from the pairing group chat', async () => {
    const messages: MessageDto[] = Array.from({ length: 6 }, (_, index) => ({
      id: 100 + index,
      conversationId: 501,
      senderEmployeeId: 8,
      senderUserId: index % 2 === 0 ? 8 : 7,
      senderName: index % 2 === 0 ? 'Trainee One' : 'Mentor One',
      senderRole: index % 2 === 0 ? 'TRAINEE' : 'TRAINER',
      messageType: 'TEXT',
      content: `Group message ${index + 1}`,
      pinned: false,
      deleted: false,
      createdAt: `2026-04-25T10:0${index}:00Z`,
      attachments: [],
    }));
    const messagesSpy = vi.spyOn(mentoringPairingApi, 'getConversationMessages')
      .mockResolvedValue(messages);
    const conversationSpy = vi.spyOn(mentoringPairingApi, 'getRelationshipConversation');

    renderDetailPage();

    expect(await screen.findByText('Group message 6')).toBeInTheDocument();
    expect(screen.queryByText('Group message 1')).not.toBeInTheDocument();
    for (let messageNumber = 2; messageNumber <= 6; messageNumber += 1) {
      expect(screen.getByText(`Group message ${messageNumber}`)).toBeInTheDocument();
    }
    expect(conversationSpy).toHaveBeenCalledWith(77);
    expect(messagesSpy).toHaveBeenCalledWith(501, undefined, undefined, 5);
  });

  it('shows previous sessions and links to the session planner', async () => {
    renderDetailPage();
    await screen.findByRole('tab', { name: 'Sessions' });
    fireEvent.click(screen.getByRole('tab', { name: 'Sessions' }));

    expect(await screen.findByText('Previous session')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to overview' })).toHaveAttribute(
      'href',
      '/mentoring/pairing/77'
    );
    expect(screen.getByRole('link', { name: 'Create session' })).toHaveAttribute(
      'href',
      '/mentoring?view=trainer-sessions&relationshipId=77'
    );
  });

  it('shows requested, confirmed, and declined sessions to the trainee and allows accepting an invitation', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
      buildAuthMock({
        id: 8,
        username: 'trainee',
        mustChangePassword: false,
        roles: ['Employee'],
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
      requestMessage: null,
      startedAt: '2026-04-20T08:00:00Z',
      endedAt: null,
      currentUserRole: 'TRAINEE',
      trainees: [],
    });
    const listedSessions: MentoringSession[] = [
      {
        id: 5,
        relationshipId: 77,
        title: 'Session awaiting response',
        agenda: null,
        scheduledStart: '2026-11-25T09:00:00Z',
        scheduledEnd: '2026-11-25T10:00:00Z',
        deliveryMode: 'ONLINE',
        meetingUrl: null,
        status: 'SCHEDULED',
        createdByUserId: 7,
        createdByName: 'Mentor One',
        createdAt: '2026-11-20T08:00:00Z',
      },
      {
        id: 6,
        relationshipId: 77,
        title: 'Accepted session',
        agenda: null,
        scheduledStart: '2026-11-26T09:00:00Z',
        scheduledEnd: '2026-11-26T10:00:00Z',
        deliveryMode: 'ONLINE',
        meetingUrl: null,
        status: 'CONFIRMED',
        createdByUserId: 7,
        createdByName: 'Mentor One',
        createdAt: '2026-11-20T08:00:00Z',
      },
      {
        id: 7,
        relationshipId: 77,
        title: 'Declined session',
        agenda: null,
        scheduledStart: '2026-11-27T09:00:00Z',
        scheduledEnd: '2026-11-27T10:00:00Z',
        deliveryMode: 'ONLINE',
        meetingUrl: null,
        status: 'DECLINED',
        declineReason: 'Schedule conflict',
        createdByUserId: 7,
        createdByName: 'Mentor One',
        createdAt: '2026-11-20T08:00:00Z',
      },
    ];
    vi.spyOn(mentoringPairingApi, 'listSessions').mockImplementation(async () => listedSessions);
    const acceptedSession: MentoringSession = {
      id: 5,
      relationshipId: 77,
      title: 'Session awaiting response',
      agenda: null,
      scheduledStart: '2026-11-25T09:00:00Z',
      scheduledEnd: '2026-11-25T10:00:00Z',
      deliveryMode: 'ONLINE',
      meetingUrl: null,
      status: 'CONFIRMED',
      createdByUserId: 7,
      createdByName: 'Mentor One',
      createdAt: '2026-11-20T08:00:00Z',
    };
    const respondSpy = vi.spyOn(mentoringPairingApi, 'respondSession').mockImplementation(async () => {
      listedSessions[0] = acceptedSession;
      return acceptedSession;
    });

    renderDetailPage();
    fireEvent.click(await screen.findByRole('tab', { name: 'Sessions' }));

    expect(await screen.findByText('Session awaiting response')).toBeInTheDocument();
    expect(screen.getByText('Accepted session')).toBeInTheDocument();
    expect(screen.getByText('Declined session')).toBeInTheDocument();
    expect(screen.getByText(/Declined: Schedule conflict/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Accept session/i }));
    expect(await screen.findByText('Session accepted')).toBeInTheDocument();
    expect(respondSpy).toHaveBeenCalledWith(77, 5, { accept: true });
    const acceptedSessionCard = screen.getByText('Session awaiting response').closest('article');
    expect(acceptedSessionCard).not.toBeNull();
    if (acceptedSessionCard) {
      expect(await within(acceptedSessionCard).findByText('CONFIRMED')).toBeInTheDocument();
    }
  });

  it('lets mentors accept or reject a reschedule proposal and shows confirmed sessions', async () => {
    vi.spyOn(mentoringPairingApi, 'listSessions').mockResolvedValue([
      {
        id: 8,
        relationshipId: 77,
        title: 'Accepted mentoring session',
        agenda: null,
        scheduledStart: '2026-11-26T09:00:00Z',
        scheduledEnd: '2026-11-26T10:00:00Z',
        deliveryMode: 'ONLINE',
        meetingUrl: null,
        status: 'CONFIRMED',
        createdByUserId: 7,
        createdByName: 'Mentor One',
        createdAt: '2026-11-20T08:00:00Z',
      },
      {
        id: 9,
        relationshipId: 77,
        title: 'Reschedule requested',
        agenda: null,
        scheduledStart: '2026-11-27T09:00:00Z',
        scheduledEnd: '2026-11-27T10:00:00Z',
        deliveryMode: 'ONLINE',
        meetingUrl: null,
        status: 'RESCHEDULE_PROPOSED',
        proposedStart: '2026-11-28T09:00:00Z',
        proposedEnd: '2026-11-28T10:00:00Z',
        rescheduleReason: 'Conflicting appointment',
        createdByUserId: 7,
        createdByName: 'Mentor One',
        createdAt: '2026-11-20T08:00:00Z',
      },
    ]);
    const respondSpy = vi.spyOn(mentoringPairingApi, 'respondReschedule').mockResolvedValue({
      id: 9,
      relationshipId: 77,
      title: 'Reschedule requested',
      agenda: null,
      scheduledStart: '2026-11-28T09:00:00Z',
      scheduledEnd: '2026-11-28T10:00:00Z',
      deliveryMode: 'ONLINE',
      meetingUrl: null,
      status: 'CONFIRMED',
      createdByUserId: 7,
      createdByName: 'Mentor One',
      createdAt: '2026-11-20T08:00:00Z',
    });

    renderDetailPage();
    fireEvent.click(await screen.findByRole('tab', { name: 'Sessions' }));

    expect(await screen.findByText('Accepted mentoring session')).toBeInTheDocument();
    expect(screen.getByText('Conflicting appointment')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Accept new time/i }));

    expect(await screen.findByText('Reschedule accepted')).toBeInTheDocument();
    expect(respondSpy).toHaveBeenCalledWith(77, 9, true);
    expect(screen.getByRole('button', { name: /Keep original time/i })).toBeInTheDocument();
  });

  it('hides the video join button until the scheduled local day', async () => {
    const tomorrowStart = new Date();
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const tomorrowEnd = new Date(tomorrowStart.getTime() + 45 * 60 * 1000);
    vi.spyOn(mentoringPairingApi, 'listSessions').mockResolvedValue([
      {
        id: 10,
        relationshipId: 77,
        title: 'Tomorrow session',
        agenda: null,
        scheduledStart: tomorrowStart.toISOString(),
        scheduledEnd: tomorrowEnd.toISOString(),
        deliveryMode: 'ONLINE',
        meetingUrl: null,
        status: 'CONFIRMED',
        createdByUserId: 7,
        createdByName: 'Mentor One',
        createdAt: new Date().toISOString(),
      },
    ]);

    renderDetailPage();
    fireEvent.click(await screen.findByRole('tab', { name: 'Sessions' }));

    expect(await screen.findByText('Tomorrow session')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Join LiveKit Video/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Session details' }));
    expect(screen.getByText('Video only')).toBeInTheDocument();
    expect(screen.getByText('1 day remaining')).toBeInTheDocument();
  });

  it('shows progress for the selected pairing and links back to its overview', async () => {
    vi.spyOn(mentoringPairingApi, 'listProgressNotes').mockResolvedValue([]);
    renderDetailPage();
    fireEvent.click(await screen.findByRole('tab', { name: 'Progress' }));

    expect(await screen.findByText('Progress and milestones')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Back to overview' }));
    expect(await screen.findByText('Pairing details')).toBeInTheDocument();
  });

  it('lets the mentor submit an end-of-session report and displays the saved report', async () => {
    const session: MentoringSession = {
      id: 12,
      relationshipId: 77,
      title: 'Completed session',
      agenda: null,
      scheduledStart: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      scheduledEnd: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      deliveryMode: 'ONLINE',
      meetingUrl: null,
      status: 'CONFIRMED',
      notes: null,
      createdByUserId: 7,
      createdByName: 'Mentor One',
      createdAt: new Date().toISOString(),
    };
    const savedSession = { ...session, status: 'COMPLETED' as const, notes: 'Reviewed goals and next steps.' };
    const listSessionsSpy = vi.spyOn(mentoringPairingApi, 'listSessions')
      .mockResolvedValue([session]);
    listSessionsSpy.mockResolvedValueOnce([session]).mockResolvedValue([savedSession]);
    const submitReportSpy = vi.spyOn(mentoringPairingApi, 'submitSessionReport')
      .mockResolvedValue(savedSession);

    renderDetailPage();
    fireEvent.click(await screen.findByRole('tab', { name: 'Sessions' }));

    const reportInput = await screen.findByLabelText('Session report');
    fireEvent.change(reportInput, { target: { value: 'Reviewed goals and next steps.' } });
    const submitButton = screen.getByRole('button', { name: 'Submit report and complete session' });
    expect(submitButton).not.toBeDisabled();
    fireEvent.click(submitButton);

    await waitFor(() =>
      expect(submitReportSpy).toHaveBeenCalledWith(77, 12, 'Reviewed goals and next steps.')
    );
    expect(await screen.findByRole('region', { name: 'Session report' })).toHaveTextContent(
      'Reviewed goals and next steps.'
    );
  });

  it('blocks pairing completion while a confirmed session remains', async () => {
    vi.spyOn(mentoringPairingApi, 'listSessions').mockResolvedValue([
      {
        id: 13,
        relationshipId: 77,
        title: 'Upcoming session',
        agenda: null,
        scheduledStart: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        scheduledEnd: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        deliveryMode: 'ONLINE',
        meetingUrl: null,
        status: 'CONFIRMED',
        createdByUserId: 7,
        createdByName: 'Mentor One',
        createdAt: new Date().toISOString(),
      },
    ]);

    renderDetailPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Close relationship' }));

    expect(await screen.findByText(
      'Submit the report for every confirmed session before completing the pairing.'
    )).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Complete objectives' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Cancel relationship' })).not.toBeDisabled();
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
