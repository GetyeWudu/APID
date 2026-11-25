import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PmsAdminDashboardPage } from '../features/coaching/pages/PmsAdminDashboardPage';
import * as AuthContextModule from '../app/AuthContext';

vi.mock('../features/admin/config/api/coreConfigApi', () => ({
  coreConfigApi: {
    getActiveConfig: vi.fn().mockResolvedValue({
      activeQuarter: { quarterId: 2, fiscalYear: '2026/27', quarter: 2, label: 'FY 2026/27 · Q2' },
      calendarQuarterLabel: null,
      publicConfig: {
        mandatoryCutoffRounded: 3,
        missedSessionAlertThreshold: 2,
        inactivityReminderDays: 14,
        maxFileUploadMb: 25,
        coachingAdSyncInterval: '7_DAYS',
      },
    }),
    updateConfigs: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../features/coaching/api/coachingSessionApi', () => ({
  coachingGovernanceApi: {
    getPolicies: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../features/coaching/api/pmsReportApi', () => ({
  pmsReportApi: {
    getSummary: vi.fn().mockResolvedValue({
      fiscalQuarterName: 'FY 2026/27 · Q2',
      totalInRemediation: 49,
      criticalCount: 17,
      moderateCount: 32,
      showingImprovementCount: 0,
      masteredCount: 0,
      onTrackCount: 0,
      needsImprovementCount: 0,
      notStartedCount: 49,
      totalApprovedSessions: 490,
      totalCompletedSessions: 7,
      sessionDeliveryRate: 1.4,
      attentionRequiredCount: 42,
      directorateBreakdown: [],
    }),
    getHierarchicalAnalytics: vi.fn().mockResolvedValue({
      fiscalQuarterId: 2,
      fiscalQuarterName: 'FY 2026/27 · Q2',
      totalEmployeesMonitored: 151,
      totalCoachingAssignments: 49,
      criticalCount: 17,
      moderateCount: 32,
      totalTargetSessions: 490,
      totalCompletedSessions: 7,
      overallCompletionRate: 1.4,
      attentionRequiredCount: 42,
      districts: [
        {
          districtName: 'Central District',
          totalStaff: 24,
          coacheesCount: 11,
          criticalCount: 6,
          moderateCount: 5,
          targetSessions: 90,
          completedSessions: 4,
          completionRate: 4.4,
          overdueCount: 7,
          averageStartingScore: 1.45,
          primarySkillGap: 'Branch FX & Deposit Mobilization',
          branches: [
            {
              branchName: 'Addis Kazanchis',
              totalStaff: 8,
              coacheesCount: 4,
              criticalCount: 2,
              moderateCount: 2,
              targetSessions: 40,
              completedSessions: 2,
              completionRate: 5.0,
              overdueCount: 2,
              averageStartingScore: 1.45,
              primarySkillGap: 'Branch FX & Deposit Mobilization',
              activeCoachesCount: 1,
            },
          ],
        },
      ],
    }),
    getTalents: vi.fn().mockResolvedValue([]),
    getTopCoaches: vi.fn().mockResolvedValue([
      {
        coachEmployeeId: 160,
        coachName: 'Lidia Belay',
        coachStaffId: '00020085',
        department: 'Bahir Dar Branch Operations',
        district: 'Bahir Dar District',
        averageRating: 5.0,
        totalRatings: 1,
        completedSessions: 1,
        activeCoachees: 3,
        excellenceBadge: 'EXCELLENCE',
      },
    ]),
    getMidQuarterInactivity: vi.fn().mockResolvedValue([]),
    getFilterOptions: vi.fn().mockResolvedValue({
      districts: ['Central District'],
      branchesByDistrict: { 'Central District': ['Addis Kazanchis'] },
      performanceBands: ['CRITICAL', 'MODERATE'],
      coachingLifecycles: ['ACTIVE'],
      sessionProgressStatuses: ['COMPLETED'],
    }),
  },
}));

function renderWithAuth(initialEntries: string[] = ['/coaching/pms']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    user: { id: 1, username: 'admin', roles: ['Super Admin'], permissions: [], mustChangePassword: false } as any,
    loading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    refreshProfile: vi.fn(),
    hasPermission: () => true,
    hasAnyPermission: () => true,
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <PmsAdminDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('PmsAdminDashboardPage 3-Tab Architecture', () => {
  it('renders all dedicated tabs in navigation bar', async () => {
    renderWithAuth(['/coaching/pms']);

    expect(screen.getAllByText('Coaching Overview').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Coach Quality & CSAT')).toBeInTheDocument();
    expect(screen.getByText('Regional & Branch Matrix')).toBeInTheDocument();
  });

  it('renders Coach Quality tab when navigated to tab=quality', async () => {
    renderWithAuth(['/coaching/pms?tab=quality']);

    expect(
      screen.getByText(/Coach Quality, CSAT Ratings & Pacing Governance/i)
    ).toBeInTheDocument();
  });

  it('renders Regional & Branch Matrix tab when navigated to tab=matrix', async () => {
    renderWithAuth(['/coaching/pms?tab=matrix']);

    expect(
      screen.getByText(/Regional & Branch Comparative Performance Matrix/i)
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Search district, branch/i)
    ).toBeInTheDocument();
  });

  it('renders Coaching Rules & Policies tab with AD DS Sync Cadence card', async () => {
    renderWithAuth(['/coaching/pms?tab=policies']);

    await waitFor(() => {
      expect(
        screen.getByText(/AD DS Directory Sync Cadence/i)
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/7 Days \(Weekly - Governance Default\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/1 Day \(Daily Sync\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/12 Hours \(Twice Daily\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/1 Hour \(High Frequency\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Trigger AD DS Sync Now/i })
    ).toBeInTheDocument();
  });
});
