import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import { EmptyState, PageHeader, PermissionGate } from '../../../shared/components/ui';
import { ADMIN_MODULE_PERMISSIONS } from '../../../shared/auth/workspaceResolver';
import { AuditLogsPanel } from '../audit/components/AuditLogsPanel';
import { SystemConfigPreviewPanel } from '../config/SystemConfigPreviewPanel';
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
  | 'config';

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
    source: 'preview',
    subtitle: 'Configure fiscal quarter dates and missed-session alert thresholds.',
  },
];

export function AdminDashboardPage() {
  const { hasAnyPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const visibleTabs = useMemo(
    () => ADMIN_TABS.filter((t) => hasAnyPermission(t.anyPermissions)),
    [hasAnyPermission]
  );

  const requestedTab = searchParams.get('tab') as AdminTabKey | null;
  const activeTabMeta =
    visibleTabs.find((t) => t.key === requestedTab) ?? visibleTabs[0] ?? null;

  const selectTab = (key: AdminTabKey) => {
    if (key === 'overview') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: key });
    }
  };

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

      <div className="apid-card" style={{ padding: '0.75rem 1rem' }}>
        <div className="apid-tabs" role="tablist" aria-label="System Admin sections">
          {visibleTabs.map((tab) => {
            const active = tab.key === activeTabMeta.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                className={`apid-tab ${active ? 'active' : ''}`}
                onClick={() => selectTab(tab.key)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

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
          <SystemConfigPreviewPanel />
        </PermissionGate>
      )}
    </div>
  );
}
