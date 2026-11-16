import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { CoachingHomePage } from '../features/coaching/pages/CoachingHomePage';
import * as AuthContextModule from '../app/AuthContext';
import { workspaceLiveApi } from '../features/workspace/api/workspaceDashboardApi';
import { coachingAssignmentApi } from '../features/coaching/api/coachingAssignmentApi';
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
    expect(await screen.findByText('People I Coach & Team')).toBeInTheDocument();
  });
});
