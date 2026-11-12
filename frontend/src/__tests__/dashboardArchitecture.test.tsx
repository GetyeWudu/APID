import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdaptiveHomeRouter } from '../app/App';
import * as AuthContextModule from '../app/AuthContext';
import { rolesApi } from '../features/admin/roles/api/rolesApi';
import { usersApi } from '../features/admin/users/api/usersApi';
import { UsersPanel } from '../features/admin/users/components/UsersPanel';
import { organizationApi } from '../features/admin/organization/api/organizationApi';
import { LinkUserModal } from '../features/admin/organization/components/LinkUserModal';
import type { UserProfile } from '../features/auth/types/auth.types';
import { coachingPreviewAdapter } from '../features/coaching/api/coachingDashboardApi';
import {
  classifyRating,
  isMandatoryCoachingRounded,
  RATING_BAND_METADATA,
} from '../features/coaching/utils/ratingClassification';
import { mentoringPreviewAdapter } from '../features/mentoring/api/mentoringDashboardApi';
import { TrainerRosterTab } from '../features/mentoring/components/TrainerRosterTab';
import { workspaceLiveApi } from '../features/workspace/api/workspaceDashboardApi';
import { WorkspaceDashboardPage } from '../features/workspace/pages/WorkspaceDashboardPage';
import { apiClient } from '../shared/api/apiClient';
import {
  resolveLandingWorkspace,
  savePreferredWorkspace,
} from '../shared/auth/workspaceResolver';
import { AppLayout } from '../shared/components/AppLayout';
import { ToastProvider } from '../shared/components/ui';
import { PREVIEW_CERTIFIED_TRAINERS } from '../shared/mocks/boaPreviewFixtures';

function buildAuthMock(user: UserProfile | null) {
  const perms = user?.permissions ?? [];
  return {
    user,
    loading: false,
    isAuthenticated: Boolean(user),
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    changePassword: vi.fn(),
    refreshProfile: vi.fn().mockResolvedValue(undefined),
    hasPermission: (code: string) => perms.includes(code),
    hasAnyPermission: (codes: string[]) => codes.some((c) => perms.includes(c)),
  };
}

function renderWithProviders(ui: React.ReactNode, initialPath = '/') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('classifyRating boundary rules', () => {
  it('classifies performance eligibility strictly by RoundedOverallFinalRating (< 3)', () => {
    expect(classifyRating(1.45)).toBe('GRADE_1_CRITICAL');
    expect(classifyRating(2.2325)).toBe('GRADE_2_MANDATORY');
    expect(classifyRating(2.48)).toBe('GRADE_2_MANDATORY');
    expect(classifyRating(2.625)).toBe('GRADE_3_MEETS_STANDARD');
    expect(classifyRating(2.95)).toBe('GRADE_3_MEETS_STANDARD');
    expect(classifyRating(3.125)).toBe('GRADE_3_MEETS_STANDARD');
    expect(classifyRating(4.2)).toBe('GRADE_4_EXCEEDS');
    expect(classifyRating(4.8)).toBe('GRADE_5_EXCEPTIONAL');

    expect(isMandatoryCoachingRounded(1)).toBe(true);
    expect(isMandatoryCoachingRounded(2)).toBe(true);
    expect(isMandatoryCoachingRounded(3)).toBe(false);
    expect(isMandatoryCoachingRounded(2.48)).toBe(true);
    expect(isMandatoryCoachingRounded(2.625)).toBe(false);
    expect(RATING_BAND_METADATA.GRADE_3_MEETS_STANDARD.policyNote).toContain('RoundedOverallFinalRating = 3');
  });
});

describe('Adaptive workspace resolver & RBAC multi-hat preferences', () => {
  it('honors saved default workspace when authorized and falls back safely if revoked', () => {
    const multiHatPerms = [
      'PMS_REPORT_UPLOAD',
      'COACHING_ASSIGNMENT_VIEW_ALL',
      'TRAINER_APPLICATION_REVIEW',
      'MENTORING_MATCH_MANAGE',
      'EMPLOYEE_PORTAL_ACCESS',
    ];
    savePreferredWorkspace(42, 'hr');
    expect(resolveLandingWorkspace(multiHatPerms, 42)?.route).toBe('/mentoring/hr');

    // Revoke HR & give only PMS -> saved 'hr' is ignored cleanly
    savePreferredWorkspace(42, 'admin');
    expect(resolveLandingWorkspace(multiHatPerms, 42)?.route).toBe('/coaching/pms');
  });

  it('routes HR Admin holding SKILL_MANAGE to HR Mentoring rather than System Administration', () => {
    const hrAdminPerms = [
      'TRAINER_APPLICATION_REVIEW',
      'TRAINER_DIRECT_APPOINT',
      'TRAINER_STATUS_MANAGE',
      'MENTORING_MATCH_MANAGE',
      'MENTORING_REPORT_VIEW_ALL',
      'SKILL_MANAGE',
      'EMPLOYEE_PORTAL_ACCESS',
    ];
    expect(resolveLandingWorkspace(hrAdminPerms, 9)?.route).toBe('/mentoring/hr');
  });

  it('returns null for zero permissions and renders No Authorized Modules state', () => {
    expect(resolveLandingWorkspace([], 10)).toBeNull();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
      buildAuthMock({
        id: 10,
        username: 'noperm.user',
        mustChangePassword: false,
        roles: [],
        permissions: [],
      })
    );
    renderWithProviders(<AdaptiveHomeRouter />);
    expect(screen.getByTestId('no-authorized-modules')).toBeInTheDocument();
    expect(screen.getByText('No Authorized Modules')).toBeInTheDocument();
  });
});

describe('AppLayout permission-based sidebar isolation', () => {
  it('hides unauthorized navigation groups completely for employee-only users', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
      buildAuthMock({
        id: 7,
        username: 'abebe.bekele',
        mustChangePassword: false,
        roles: ['Employee'],
        permissions: ['EMPLOYEE_PORTAL_ACCESS', 'COACHING_REQUEST_SUBMIT'],
      })
    );

    renderWithProviders(
      <AppLayout>
        <div>Workspace Content</div>
      </AppLayout>,
      '/workspace'
    );

    expect(screen.getAllByText('My Workspace').length).toBeGreaterThan(0);
    expect(screen.queryByText('System Administration')).not.toBeInTheDocument();
    expect(screen.queryByText('PMS Administration')).not.toBeInTheDocument();
    expect(screen.queryByText('HR Mentoring')).not.toBeInTheDocument();
  });
});

describe('Preview adapters network isolation', () => {
  it('performs zero HTTP requests for coaching preview mutations & snapshot', async () => {
    const getSpy = vi.spyOn(apiClient, 'get');
    const postSpy = vi.spyOn(apiClient, 'post');

    const snapshot = await coachingPreviewAdapter.getOverview({
      performanceQuarter: 'FY26/27 Q1',
      coachingQuarter: 'FY26/27 Q2',
      directorate: 'ALL',
    });
    expect(snapshot.assignments.length).toBeGreaterThan(0);

    const replaceRes = await coachingPreviewAdapter.simulateReplaceCoach('PA-101', 'Coach X', 'Leave');
    expect(replaceRes.simulated).toBe(true);

    await coachingPreviewAdapter.simulateDecisionRequest('SDR-201', 'RETURNED', 'Add goal dates');
    await coachingPreviewAdapter.simulateExcelPreview('sample.xlsx');

    expect(getSpy).not.toHaveBeenCalled();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('performs zero mutating HTTP calls in HR mentoring preview adapter', async () => {
    const postSpy = vi.spyOn(apiClient, 'post');
    const patchSpy = vi.spyOn(apiClient, 'patch');
    await mentoringPreviewAdapter.simulateApplicationDecision('APP-301', 'APPROVED', 'Valid cert');
    await mentoringPreviewAdapter.simulateDirectAppoint('Trainer Demo', ['Java & Spring Boot Development'], 3);
    await mentoringPreviewAdapter.simulateTrainerStatusChange(
      'TRN-401',
      'SUSPENDED',
      'BLOCK_NEW_SESSIONS_ONLY',
      'Rotation'
    );
    await mentoringPreviewAdapter.simulateMatch('MR-501', 'TRN-401');

    expect(postSpy).not.toHaveBeenCalled();
    expect(patchSpy).not.toHaveBeenCalled();
  });
});

describe('Orthogonal HR Trainer lifecycle status rendering', () => {
  it('renders separate Employment, Trainer Auth, and Capacity pills simultaneously', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
      buildAuthMock({
        id: 2,
        username: 'hr.admin',
        mustChangePassword: false,
        roles: ['HR Admin'],
        permissions: ['TRAINER_DIRECT_APPOINT', 'TRAINER_STATUS_MANAGE'],
      })
    );

    renderWithProviders(
      <TrainerRosterTab
        trainers={PREVIEW_CERTIFIED_TRAINERS}
        liveSkillNames={['Credit Risk & Loan Assessment']}
        onTrainerAppointed={vi.fn()}
        onTrainerStatusChanged={vi.fn()}
      />
    );

    expect(screen.getByText('Emp: ON_LEAVE')).toBeInTheDocument();
    expect(screen.getByText('Auth: SUSPENDED')).toBeInTheDocument();
    expect(screen.getByText('Emp: TERMINATED')).toBeInTheDocument();
    expect(screen.getByText('3/3 AT CAPACITY')).toBeInTheDocument();
  });
});

describe('UsersPanel masked one-time credential security', () => {
  it('keeps temporary password masked by default without clipboard copy button and clears on close', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
      buildAuthMock({
        id: 1,
        username: 'admin',
        mustChangePassword: false,
        roles: ['Super Admin'],
        permissions: ['USER_MANAGE'],
      })
    );
    vi.spyOn(usersApi, 'search').mockResolvedValue({
      content: [],
      number: 0,
      size: 15,
      totalElements: 0,
      totalPages: 0,
    });
    vi.spyOn(rolesApi, 'listRoles').mockResolvedValue([
      {
        id: 1,
        name: 'Employee',
        description: 'Employee base',
        active: true,
        systemProtected: false,
        permissions: [],
        activeUserCount: 0,
      },
    ]);
    vi.spyOn(usersApi, 'create').mockResolvedValue({
      user: {
        id: 50,
        username: 'new.banker',
        authProvider: 'LOCAL',
        status: 'ACTIVE',
        mustChangePassword: true,
        temporarilyLocked: false,
        lockedUntil: null,
        failedLoginAttempts: 0,
        roles: [],
        lastLoginAt: null,
        createdAt: '2026-11-12T08:00:00Z',
      },
      temporaryPassword: 'Temp#Banker991!',
    });

    renderWithProviders(<UsersPanel />);

    await waitFor(() => expect(screen.getByText('+ Create User')).toBeInTheDocument());
    fireEvent.click(screen.getByText('+ Create User'));

    const usernameInput = screen.getByLabelText('Username');
    fireEvent.change(usernameInput, { target: { value: 'new.banker' } });
    fireEvent.click(screen.getByLabelText('Employee'));
    fireEvent.click(screen.getByRole('button', { name: 'Create User' }));

    await waitFor(() => expect(screen.getByTestId('masked-credential-value')).toBeInTheDocument());
    expect(screen.getByTestId('masked-credential-value')).toHaveTextContent('••••••••••••••••');
    expect(screen.queryByText('Temp#Banker991!')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reveal password' }));
    expect(screen.getByTestId('masked-credential-value')).toHaveTextContent('Temp#Banker991!');

    fireEvent.click(screen.getByRole('button', { name: 'I Have Delivered This Securely' }));
    expect(screen.queryByTestId('masked-credential-value')).not.toBeInTheDocument();
  });
});

describe('WorkspaceDashboardPage identity-driven empty state', () => {
  it('shows honest Profile Not Linked Yet state when user has no linked employee record', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
      buildAuthMock({
        id: 33,
        username: 'unlinked.staff',
        mustChangePassword: false,
        roles: ['Employee'],
        permissions: ['EMPLOYEE_PORTAL_ACCESS'],
      })
    );
    vi.spyOn(workspaceLiveApi, 'loadMyIdentity').mockResolvedValue({
      linkedEmployee: null,
      directReports: [],
      activeSkills: [],
    });

    renderWithProviders(<WorkspaceDashboardPage />, '/workspace');

    await waitFor(() => expect(screen.getByTestId('unlinked-profile-state')).toBeInTheDocument());
    expect(screen.getByText('Profile Not Linked Yet')).toBeInTheDocument();
    expect(screen.queryByText(/Switch Preview Persona/i)).not.toBeInTheDocument();
  });

  it('renders live identity banner when linked to an employee profile', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
      buildAuthMock({
        id: 34,
        username: 'linked.staff',
        mustChangePassword: false,
        roles: ['Employee'],
        permissions: ['EMPLOYEE_PORTAL_ACCESS', 'COACHING_REQUEST_SUBMIT'],
      })
    );
    vi.spyOn(workspaceLiveApi, 'loadMyIdentity').mockResolvedValue({
      linkedEmployee: {
        id: 9,
        userId: 34,
        username: 'linked.staff',
        employeeNumber: 'BOA-4091',
        fullName: 'Abebe Bekele',
        email: 'abebe@boa.example',
        gender: 'M',
        departmentId: 2,
        departmentName: 'Retail & Branch Banking',
        parentDepartmentName: 'Domestic Banking',
        job: 'Senior Officer',
        position: 'Branch Relationship Manager',
        managerId: null,
        managerEmployeeNumber: null,
        managerFullName: 'Tirhas Tadesse',
        employmentStatus: 'ACTIVE',
        createdAt: '2026-11-12T08:00:00Z',
        updatedAt: '2026-11-12T08:00:00Z',
      },
      directReports: [],
      activeSkills: [],
    });

    renderWithProviders(<WorkspaceDashboardPage />, '/workspace');

    await waitFor(() => expect(screen.getByText('Abebe Bekele')).toBeInTheDocument());
    expect(screen.getByText(/BOA-4091/)).toBeInTheDocument();
    expect(screen.queryByTestId('unlinked-profile-state')).not.toBeInTheDocument();
  });
});

describe('LinkUserModal Create New User & Link', () => {
  it('creates a new user account, links it to the employee, and masks the one-time password', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
      buildAuthMock({
        id: 1,
        username: 'admin',
        mustChangePassword: false,
        roles: ['Super Admin'],
        permissions: ['USER_MANAGE', 'HIERARCHY_MANAGE'],
      })
    );
    vi.spyOn(organizationApi, 'listAvailableUsers').mockResolvedValue([]);
    vi.spyOn(organizationApi, 'linkEmployeeUser').mockResolvedValue({
      id: 4,
      userId: 88,
      username: 'mekdes.alemu.004',
      employeeNumber: '00010004',
      fullName: 'Mekdes Alemu',
      email: 'mekdes.alemu.004@bankofabyssinia.com',
      gender: 'Female',
      departmentId: 3,
      departmentName: 'Bole Branch Operations',
      parentDepartmentName: 'Retail & Branch Banking',
      job: 'Branch Management',
      position: 'Branch Manager',
      managerId: 2,
      managerEmployeeNumber: '00010003',
      managerFullName: 'Bekele Tesfaye',
      employmentStatus: 'ACTIVE',
      createdAt: '2026-11-12T08:00:00Z',
      updatedAt: '2026-11-12T08:00:00Z',
    });
    vi.spyOn(rolesApi, 'listRoles').mockResolvedValue([
      {
        id: 4,
        name: 'Employee',
        description: 'Employee base',
        active: true,
        systemProtected: false,
        permissions: [],
        activeUserCount: 0,
      },
    ]);
    vi.spyOn(usersApi, 'create').mockResolvedValue({
      user: {
        id: 88,
        username: 'mekdes.alemu.004',
        authProvider: 'LOCAL',
        status: 'ACTIVE',
        mustChangePassword: true,
        temporarilyLocked: false,
        lockedUntil: null,
        failedLoginAttempts: 0,
        roles: [],
        lastLoginAt: null,
        createdAt: '2026-11-12T08:00:00Z',
      },
      temporaryPassword: 'Temp#Mekdes004!',
    });

    const onUpdated = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    renderWithProviders(
      <LinkUserModal
        employee={{
          id: 4,
          userId: null,
          username: null,
          employeeNumber: '00010004',
          fullName: 'Mekdes Alemu',
          email: 'mekdes.alemu.004@bankofabyssinia.com',
          gender: 'Female',
          departmentId: 3,
          departmentName: 'Bole Branch Operations',
          parentDepartmentName: 'Retail & Branch Banking',
          job: 'Branch Management',
          position: 'Branch Manager',
          managerId: 2,
          managerEmployeeNumber: '00010003',
          managerFullName: 'Bekele Tesfaye',
          employmentStatus: 'ACTIVE',
          createdAt: '2026-11-12T08:00:00Z',
          updatedAt: '2026-11-12T08:00:00Z',
        }}
        onUpdated={onUpdated}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create New User & Link' }));
    await waitFor(() => expect(screen.getByLabelText('Employee')).toBeChecked());
    fireEvent.click(screen.getByRole('button', { name: 'Create Account & Link' }));

    await waitFor(() => expect(screen.getByTestId('link-modal-masked-credential')).toBeInTheDocument());
    expect(screen.getByTestId('link-modal-masked-credential')).toHaveTextContent('••••••••••••••••');
    expect(screen.queryByText('Temp#Mekdes004!')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reveal password' }));
    expect(screen.getByTestId('link-modal-masked-credential')).toHaveTextContent('Temp#Mekdes004!');

    fireEvent.click(screen.getByRole('button', { name: 'Done & Close' }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
