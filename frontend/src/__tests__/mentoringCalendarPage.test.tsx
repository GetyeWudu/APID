import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as AuthContextModule from '../app/AuthContext';
import type { UserProfile } from '../features/auth/types/auth.types';
import {
  mentoringPairingApi,
  type MentoringRelationshipPair,
  type MentoringSession,
} from '../features/mentoring/api/mentoringPairingApi';
import { MentoringCalendarPage } from '../features/mentoring/pages/MentoringCalendarPage';
import { ToastProvider } from '../shared/components/ui';

function buildAuthMock(user: UserProfile) {
  return {
    user,
    loading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    changePassword: vi.fn(),
    refreshProfile: vi.fn().mockResolvedValue(undefined),
    hasPermission: (code: string) => user.permissions.includes(code),
    hasAnyPermission: (codes: string[]) => codes.some((code) => user.permissions.includes(code)),
  };
}

const mentorUser: UserProfile = {
  id: 7,
  username: 'mentor',
  mustChangePassword: false,
  roles: ['Mentor'],
  permissions: ['EMPLOYEE_PORTAL_ACCESS'],
};

const relationship: MentoringRelationshipPair = {
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
  skillId: 5,
  skillName: 'Leadership',
  message: null,
  startedAt: '2026-04-20T08:00:00Z',
  joinedAt: '2026-04-20T08:00:00Z',
  endedAt: null,
  memberEndedAt: null,
};

function getTomorrowEatDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function renderCalendar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/mentoring?view=calendar']}>
          <MentoringCalendarPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe('MentoringCalendarPage', () => {
  beforeEach(() => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(buildAuthMock(mentorUser));
    vi.spyOn(mentoringPairingApi, 'listMyRelationships').mockResolvedValue([relationship]);
    vi.spyOn(mentoringPairingApi, 'listMySessions').mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lets mentors schedule a session by selecting a calendar day', async () => {
    const createSession = vi.spyOn(mentoringPairingApi, 'createSession').mockResolvedValue({
      id: 88,
      relationshipId: 77,
      title: 'Career check-in',
      agenda: null,
      scheduledStart: '2026-11-28T06:00:00Z',
      scheduledEnd: '2026-11-28T06:45:00Z',
      deliveryMode: 'ONLINE',
      meetingUrl: null,
      status: 'PENDING',
      createdByUserId: 7,
      createdByName: 'Mentor One',
      createdAt: '2026-11-27T06:00:00Z',
    });

    renderCalendar();

    const date = getTomorrowEatDate();
    const dateLabel = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'full',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
    fireEvent.click(await screen.findByRole('button', { name: dateLabel }));

    fireEvent.change(screen.getByLabelText('Mentoring pairing'), { target: { value: '77' } });
    fireEvent.change(screen.getByLabelText('Session title'), { target: { value: 'Career check-in' } });
    fireEvent.click(screen.getByRole('button', { name: 'Schedule session' }));

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledWith(77, expect.objectContaining({
        title: 'Career check-in',
        deliveryMode: 'ONLINE',
      }));
    });
  });

  it('lets mentees view a day but does not show session creation controls', async () => {
    const sessionDate = getTomorrowEatDate();
    const start = new Date(`${sessionDate}T06:00:00Z`);
    const session: MentoringSession = {
      id: 89,
      relationshipId: 77,
      title: 'Planned mentoring session',
      agenda: null,
      scheduledStart: start.toISOString(),
      scheduledEnd: new Date(start.getTime() + 45 * 60 * 1000).toISOString(),
      deliveryMode: 'ONLINE',
      meetingUrl: null,
      status: 'SCHEDULED',
      createdByUserId: 7,
      createdByName: 'Mentor One',
      createdAt: new Date().toISOString(),
    };
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(buildAuthMock({
      ...mentorUser,
      id: 8,
      username: 'mentee',
      roles: ['Employee'],
    }));
    vi.spyOn(mentoringPairingApi, 'listMyRelationships').mockResolvedValue([{
      ...relationship,
      currentUserRole: 'TRAINEE',
    }]);
    vi.spyOn(mentoringPairingApi, 'listMySessions').mockResolvedValue([session]);

    renderCalendar();

    const dateLabel = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'full',
      timeZone: 'UTC',
    }).format(new Date(`${sessionDate}T12:00:00Z`));
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(dateLabel) }));

    expect(await screen.findAllByText('Planned mentoring session')).toHaveLength(2);
    expect(screen.getByText(/Only mentors can schedule sessions/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Session title')).not.toBeInTheDocument();
  });
});
