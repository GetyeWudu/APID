import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  PermissionGate,
} from '../../../shared/components/ui';
import { ADMIN_MODULE_PERMISSIONS } from '../../../shared/auth/workspaceResolver';
import { mentorApplicationApi } from '../../mentoring/api/mentorApplicationApi';
import { TrainerApplicationsTab } from '../../mentoring/components/TrainerApplicationsTab';
import { AuditLogsPanel } from '../audit/components/AuditLogsPanel';
import { SystemConfigPanel } from '../config/SystemConfigPanel';
import { OrganizationPanel } from '../organization/components/OrganizationPanel';
import { AdminOverviewPanel } from '../overview/AdminOverviewPanel';
import { RolesPanel } from '../roles/components/RolesPanel';
import { SkillsPanel } from '../skills/components/SkillsPanel';
import { UsersPanel } from '../users/components/UsersPanel';

export type AdminTabKey =
  | 'overview'
  | 'users'
  | 'organization'
  | 'skills'
  | 'roles'
  | 'audit'
  | 'config'
  | 'hr-mentor-applications';

interface AdminTabMeta {
  key: AdminTabKey;
  label: string;
  anyPermissions: string[];
  source: 'live' | 'preview';
  phaseLabel?: string;
  subtitle: string;
}

const ADMIN_TABS: AdminTabMeta[] = [
  {
    key: 'overview',
    label: 'Overview',
    anyPermissions: ADMIN_MODULE_PERMISSIONS,
    source: 'live',
    subtitle: 'Platform summary, access coverage, and recent activity.',
  },
  {
    key: 'users',
    label: 'Users & Access',
    anyPermissions: ['USER_MANAGE'],
    source: 'live',
    subtitle: 'Create accounts, assign roles, reset temporary passwords, and unlock accounts.',
  },
  {
    key: 'organization',
    label: 'Employees & Org',
    anyPermissions: ['HIERARCHY_MANAGE'],
    source: 'live',
    subtitle: 'Manage departments, reporting managers, employee profiles, and spreadsheet imports.',
  },
  {
    key: 'roles',
    label: 'Roles & Permissions',
    anyPermissions: ['ROLE_PERMISSION_MANAGE'],
    source: 'live',
    subtitle: 'Configure roles and permissions for each portal function.',
  },
  {
    key: 'skills',
    label: 'Skills',
    anyPermissions: ['SKILL_MANAGE'],
    source: 'live',
    subtitle: 'Manage skills shared across Coaching and Mentoring.',
  },
  {
    key: 'audit',
    label: 'Activity Log',
    anyPermissions: ['AUDIT_LOG_VIEW'],
    source: 'live',
    subtitle: 'Review authentication, user access, org import, and security activity.',
  },
  {
    key: 'config',
    label: 'Quarter Settings',
    anyPermissions: ['SYSTEM_CONFIG_MANAGE'],
    source: 'live',
    subtitle: 'Configure fiscal quarter dates, active cycle, and system rules.',
  },
  {
    key: 'hr-mentor-applications',
    label: 'HR Mentor Requests',
    anyPermissions: ['TRAINER_APPLICATION_SUPER_REVIEW'],
    source: 'live',
    subtitle: 'Review mentor applications and profile updates submitted by HR administrators.',
  },
];

export function AdminDashboardPage() {
  const { hasAnyPermission } = useAuth();
  const [searchParams] = useSearchParams();

  const visibleTabs = useMemo(
    () => ADMIN_TABS.filter((t) => hasAnyPermission(t.anyPermissions)),
    [hasAnyPermission]
  );

  const requestedTab = searchParams.get('tab') as AdminTabKey | null;
  const activeTabMeta =
    visibleTabs.find((t) => t.key === requestedTab) ?? visibleTabs[0] ?? null;
  const hrMentorApplicationsQuery = useQuery({
    queryKey: ['mentoring', 'applications', 'super-admin-review'],
    queryFn: mentorApplicationApi.listForSuperAdmin,
    enabled: activeTabMeta?.key === 'hr-mentor-applications',
  });

  if (!activeTabMeta) {
    return (
      <div className="apid-card">
        <EmptyState
          title="No System Governance Permissions"
          description="Your account does not hold permissions for System Administration modules."
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <PageHeader
        title={activeTabMeta.label}
        subtitle={activeTabMeta.subtitle}
        source={activeTabMeta.source}
        phaseLabel={activeTabMeta.phaseLabel}
      />

      {activeTabMeta.key === 'overview' && (
        <PermissionGate anyPermissions={ADMIN_MODULE_PERMISSIONS}>
          <AdminOverviewPanel />
        </PermissionGate>
      )}
      {activeTabMeta.key === 'users' && (
        <PermissionGate permission="USER_MANAGE">
          <UsersPanel />
        </PermissionGate>
      )}
      {activeTabMeta.key === 'organization' && (
        <PermissionGate permission="HIERARCHY_MANAGE">
          <OrganizationPanel />
        </PermissionGate>
      )}
      {activeTabMeta.key === 'roles' && (
        <PermissionGate permission="ROLE_PERMISSION_MANAGE">
          <RolesPanel />
        </PermissionGate>
      )}
      {activeTabMeta.key === 'skills' && (
        <PermissionGate permission="SKILL_MANAGE">
          <SkillsPanel />
        </PermissionGate>
      )}
      {activeTabMeta.key === 'audit' && (
        <PermissionGate permission="AUDIT_LOG_VIEW">
          <AuditLogsPanel />
        </PermissionGate>
      )}
      {activeTabMeta.key === 'config' && (
        <PermissionGate permission="SYSTEM_CONFIG_MANAGE">
          <SystemConfigPanel />
        </PermissionGate>
      )}
      {activeTabMeta.key === 'hr-mentor-applications' && (
        <PermissionGate permission="TRAINER_APPLICATION_SUPER_REVIEW">
          {hrMentorApplicationsQuery.isLoading ? (
            <LoadingSkeleton rows={6} height={28} />
          ) : hrMentorApplicationsQuery.isError ? (
            <ErrorState
              message="Failed to load HR mentor requests."
              onRetry={() => void hrMentorApplicationsQuery.refetch()}
            />
          ) : (
            <TrainerApplicationsTab
              applications={hrMentorApplicationsQuery.data ?? []}
              mode="hr-admin-requests"
            />
          )}
        </PermissionGate>
      )}
    </div>
  );
}
