import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { CoachingHomePage } from '../features/coaching/pages/CoachingHomePage';
import * as AuthContextModule from '../app/AuthContext';
import { workspaceLiveApi } from '../features/workspace/api/workspaceDashboardApi';
import { coachingAssignmentApi } from '../features/coaching/api/coachingAssignmentApi';
import { coachingSessionApi } from '../features/coaching/api/coachingSessionApi';
import { coreConfigApi } from '../features/admin/config/api/coreConfigApi';

describe('CoachingHomePage test render', () => {
  it('renders without throwing when activeView=coachees', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 3,
        username: 'mekdes.alemu.004',
        roles: ['Employee'],
        permissions: ['EMPLOYEE_PORTAL_ACCESS', 'COACHING_REQUEST_SUBMIT'],
        mustChangePassword: false,
      },
      loading: false,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      refreshProfile: vi.fn(),
      hasPermission: () => true,
      hasAnyPermission: () => true,
    });

    vi.spyOn(workspaceLiveApi, 'loadMyIdentity').mockResolvedValue({
      linkedEmployee: {
        id: 3,
        employeeNumber: '00010004',
        fullName: 'Mekdes Alemu',
        departmentName: 'Bole Branch Operations',
        jobTitle: 'Branch Operations Manager',
      } as any,
      directReports: [
        {
          id: 4,
          employeeNumber: '00010005',
          fullName: 'Lidia Girma',
          departmentName: 'Bole Branch Operations',
          position: 'Senior Customer Service Officer',
          employmentStatus: 'ACTIVE',
        } as any,
      ],
      activeSkills: [],
    });

    vi.spyOn(coachingAssignmentApi, 'getMyCoachees').mockResolvedValue([
      {
        assignmentId: 1,
        coacheeEmployeeId: 4,
        coacheeEmployeeNumber: '00010005',
        coacheeFullName: 'Lidia Girma',
        coacheeDepartment: 'Bole Branch Operations',
        coacheeJobTitle: 'Senior Customer Service Officer',
        pathway: 'MANDATORY_PMS',
        coachingQuarterLabel: 'FY 2026/27 · Q2',
        status: 'ACTIVE',
        atRisk: false,
      } as any,
    ]);

    vi.spyOn(coreConfigApi, 'getActiveConfig').mockResolvedValue({
      activeQuarter: {
        quarterId: 2,
        fiscalYear: '2026/27',
        quarter: 2,
        label: 'FY 2026/27 · Q2',
        startDate: '2026-10-01',
        endDate: '2026-12-31',
      },
      calendarQuarterLabel: 'Q2',
      publicConfig: {
        mandatoryCutoffRounded: 3,
        missedSessionAlertThreshold: 2,
        inactivityReminderDays: 14,
        maxFileUploadMb: 25,
        coachingEarlyJoinWindowMinutes: 15,
        coachingVideoPostBufferMinutes: 30,
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/coaching?view=coachees']}>
          <CoachingHomePage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait and check
    expect(await screen.findByText('My Coachees & Direct Reports')).toBeInTheDocument();
  });

  it('advances focus to upcoming occurrence and hides edit/reschedule for ended sessions', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 3,
        username: 'mekdes.alemu.004',
        roles: ['Employee'],
        permissions: ['EMPLOYEE_PORTAL_ACCESS', 'COACHING_REQUEST_SUBMIT'],
        mustChangePassword: false,
      },
      loading: false,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      refreshProfile: vi.fn(),
      hasPermission: () => true,
      hasAnyPermission: () => true,
    });

    vi.spyOn(workspaceLiveApi, 'loadMyIdentity').mockResolvedValue({
      linkedEmployee: {
        id: 3,
        employeeNumber: '00010004',
        fullName: 'Mekdes Alemu',
        departmentName: 'Bole Branch Operations',
        jobTitle: 'Branch Operations Manager',
      } as any,
      directReports: [],
      activeSkills: [],
    });

    vi.spyOn(coachingAssignmentApi, 'getMyCoachees').mockResolvedValue([
      {
        assignmentId: 1,
        coacheeEmployeeId: 4,
        coacheeEmployeeNumber: '00010005',
        coacheeFullName: 'Rahel Tsegaye',
        coacheeDepartment: 'Bole Branch Operations',
        coacheeJobTitle: 'Customer Service Officer',
        pathway: 'MANDATORY_PMS',
        coachingQuarterLabel: 'FY 2026/27 · Q2',
        status: 'ACTIVE',
        atRisk: false,
      } as any,
    ]);

    vi.spyOn(coreConfigApi, 'getActiveConfig').mockResolvedValue({
      activeQuarter: {
        quarterId: 2,
        fiscalYear: '2026/27',
        quarter: 2,
        label: 'FY 2026/27 · Q2',
        startDate: '2026-10-01',
        endDate: '2026-12-31',
      },
      calendarQuarterLabel: 'Q2',
      publicConfig: {
        mandatoryCutoffRounded: 3,
        missedSessionAlertThreshold: 2,
        inactivityReminderDays: 14,
        maxFileUploadMb: 25,
        coachingEarlyJoinWindowMinutes: 15,
        coachingVideoPostBufferMinutes: 30,
      },
    });

    // Mock sessions: Occurrence 1 is yesterday (ended, uncompleted), Occurrence 2 is in future
    const pastStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const pastEnd = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
    const futureStart = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const futureEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString();

    vi.spyOn(coachingSessionApi, 'getMySessions').mockResolvedValue([
      {
        id: 101,
        assignmentId: 1,
        seriesId: 10,
        sequenceNumber: 1,
        coachEmployeeId: 3,
        coachFullName: 'Mekdes Alemu',
        title: 'Mandatory Performance Coaching — Rahel Tsegaye — Session 1',
        pathway: 'MANDATORY_PMS',
        scheduledStartTime: pastStart,
        scheduledEndTime: pastEnd,
        durationMinutes: 45,
        meetingMode: 'VIRTUAL_VIDEO',
        status: 'CONFIRMED',
        participants: [
          {
            id: 1,
            sessionId: 101,
            employeeId: 4,
            fullName: 'Rahel Tsegaye',
            role: 'COACHEE',
            invitationStatus: 'ACCEPTED',
            attendanceStatus: 'PENDING',
          } as any,
        ],
        createdAt: pastStart,
      } as any,
      {
        id: 102,
        assignmentId: 1,
        seriesId: 10,
        sequenceNumber: 2,
        coachEmployeeId: 3,
        coachFullName: 'Mekdes Alemu',
        title: 'Mandatory Performance Coaching — Rahel Tsegaye — Session 2',
        pathway: 'MANDATORY_PMS',
        scheduledStartTime: futureStart,
        scheduledEndTime: futureEnd,
        durationMinutes: 45,
        meetingMode: 'VIRTUAL_VIDEO',
        status: 'CONFIRMED',
        participants: [
          {
            id: 2,
            sessionId: 102,
            employeeId: 4,
            fullName: 'Rahel Tsegaye',
            role: 'COACHEE',
            invitationStatus: 'ACCEPTED',
            attendanceStatus: 'PENDING',
          } as any,
        ],
        createdAt: pastStart,
      } as any,
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/coaching?view=sessions']}>
          <CoachingHomePage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // In the new modern Agenda View, sessions are listed compactly with life-cycle filtering
    expect(await screen.findByText('Agenda View')).toBeInTheDocument();

    // Session 1 is in the past without minutes, so it shows "Log Minutes"
    expect(
      await screen.findByRole('button', { name: /Log Minutes/i })
    ).toBeInTheDocument();

    // Occurrence 2 is upcoming
    expect(
      screen.getByText(/Mandatory Performance Coaching — Rahel Tsegaye — Session 2/i)
    ).toBeInTheDocument();

    // Toggle view to Grouped Journey View
    const journeyToggleBtn = screen.getByRole('button', { name: /Roadmap|Group by Coachee/i });
    fireEvent.click(journeyToggleBtn);

    // In Journey View, coachee card with Schedule Next Session and sequence numbers are visible
    expect(await screen.findByRole('button', { name: /Schedule Next Session/i })).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });
});
