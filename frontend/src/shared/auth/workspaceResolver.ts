export type WorkspaceKey = 'admin' | 'pms' | 'hr' | 'workspace';

export type PortalModuleKey = 'coaching' | 'mentoring' | 'admin';

export interface WorkspaceDefinition {
  key: WorkspaceKey;
  label: string;
  description: string;
  route: string;
  requiredAnyPermissions: string[];
}

export interface PortalModuleDefinition {
  key: PortalModuleKey;
  title: string;
  shortLabel: string;
  tagline: string;
  route: string;
  requiredAnyPermissions: string[];
}

export const CORE_SYSADMIN_PERMISSIONS = [
  'USER_MANAGE',
  'HIERARCHY_MANAGE',
  'ROLE_PERMISSION_MANAGE',
  'SYSTEM_CONFIG_MANAGE',
  'AUDIT_LOG_VIEW',
];

export const ADMIN_MODULE_PERMISSIONS = [
  ...CORE_SYSADMIN_PERMISSIONS,
  'SKILL_MANAGE',
];

export const PMS_MODULE_PERMISSIONS = [
  'PMS_REPORT_UPLOAD',
  'COACHING_ASSIGNMENT_VIEW_ALL',
  'COACHING_COACH_REPLACE',
  'COACHING_REQUEST_APPROVE',
  'COACHING_INITIATIVE_CREATE',
  'COACHING_REPORT_VIEW_ALL',
];

export const HR_MODULE_PERMISSIONS = [
  'TRAINER_APPLICATION_REVIEW',
  'TRAINER_DIRECT_APPOINT',
  'TRAINER_STATUS_MANAGE',
  'MENTORING_MATCH_MANAGE',
  'MENTORING_REPORT_VIEW_ALL',
];

export const EMPLOYEE_WORKSPACE_PERMISSIONS = [
  'EMPLOYEE_PORTAL_ACCESS',
  'COACHING_REQUEST_SUBMIT',
];

export const WORKSPACE_DEFINITIONS: WorkspaceDefinition[] = [
  {
    key: 'admin',
    label: 'System Administration',
    description: 'Users, Employees & Org Structure, Roles & Permissions, Skills & Activity Log',
    route: '/admin',
    requiredAnyPermissions: ADMIN_MODULE_PERMISSIONS,
  },
  {
    key: 'pms',
    label: 'PMS Coaching',
    description: 'Appraisal Results, Mandatory Coaching (Rounded < 3) & Skill Requests',
    route: '/coaching/pms',
    requiredAnyPermissions: PMS_MODULE_PERMISSIONS,
  },
  {
    key: 'hr',
    label: 'HR Mentoring',
    description: 'Trainer Applications, Trainer Directory, Skill Availability & Matching',
    route: '/mentoring/hr',
    requiredAnyPermissions: HR_MODULE_PERMISSIONS,
  },
  {
    key: 'workspace',
    label: 'My Workspace',
    description: 'My Coaching, My Mentoring, Direct Reports & Upcoming Sessions',
    route: '/workspace',
    requiredAnyPermissions: EMPLOYEE_WORKSPACE_PERMISSIONS,
  },
];

export const COACHING_PORTAL_PERMISSIONS = [
  ...EMPLOYEE_WORKSPACE_PERMISSIONS,
  ...PMS_MODULE_PERMISSIONS,
];

export const MENTORING_PORTAL_PERMISSIONS = [
  ...EMPLOYEE_WORKSPACE_PERMISSIONS,
  ...HR_MODULE_PERMISSIONS,
];

function hasAny(permissions: string[], required: string[]): boolean {
  return required.some((code) => permissions.includes(code));
}

export function resolveAuthorizedModules(permissions: string[]): PortalModuleDefinition[] {
  const modules: PortalModuleDefinition[] = [];

  if (hasAny(permissions, COACHING_PORTAL_PERMISSIONS)) {
    const hasEmployee = hasAny(permissions, EMPLOYEE_WORKSPACE_PERMISSIONS);
    modules.push({
      key: 'coaching',
      title: 'Performance Coaching',
      shortLabel: 'Coaching',
      tagline:
        'My coaching plan & sessions, coaching assigned team members, and PMS appraisal oversight.',
      route: hasEmployee ? '/coaching' : '/coaching/pms',
      requiredAnyPermissions: COACHING_PORTAL_PERMISSIONS,
    });
  }

  if (hasAny(permissions, MENTORING_PORTAL_PERMISSIONS)) {
    const hasEmployee = hasAny(permissions, EMPLOYEE_WORKSPACE_PERMISSIONS);
    modules.push({
      key: 'mentoring',
      title: 'Mentoring & Trainers',
      shortLabel: 'Mentoring',
      tagline:
        'Find certified trainers, track mentoring sessions, apply as a trainer, and HR matching.',
      route: hasEmployee ? '/mentoring' : '/mentoring/hr',
      requiredAnyPermissions: MENTORING_PORTAL_PERMISSIONS,
    });
  }

  if (hasAny(permissions, ADMIN_MODULE_PERMISSIONS)) {
    modules.push({
      key: 'admin',
      title: 'System Administration',
      shortLabel: 'System Admin',
      tagline:
        'User accounts, organization directory & imports, roles & permissions, skills, activity log, and quarter settings.',
      route: '/admin',
      requiredAnyPermissions: ADMIN_MODULE_PERMISSIONS,
    });
  }

  return modules;
}

export function getActiveModuleFromPath(pathname: string): PortalModuleKey | null {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/coaching')) return 'coaching';
  if (pathname.startsWith('/mentoring')) return 'mentoring';
  return null;
}

export function resolveAuthorizedWorkspaces(permissions: string[]): WorkspaceDefinition[] {
  return WORKSPACE_DEFINITIONS.filter((ws) => hasAny(permissions, ws.requiredAnyPermissions));
}

const PREF_STORAGE_PREFIX = 'apid.preferredWorkspace.';

export function getSavedPreferredWorkspace(userId: number | undefined): WorkspaceKey | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${PREF_STORAGE_PREFIX}${userId}`);
    if (raw === 'admin' || raw === 'pms' || raw === 'hr' || raw === 'workspace') {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export function savePreferredWorkspace(userId: number | undefined, key: WorkspaceKey | null): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    const storageKey = `${PREF_STORAGE_PREFIX}${userId}`;
    if (!key) {
      window.localStorage.removeItem(storageKey);
    } else {
      window.localStorage.setItem(storageKey, key);
    }
  } catch {
    // Ignore storage errors in restricted environments
  }
}

/**
 * Resolves the initial landing route after sign-in using:
 * 1) User's saved default workspace IF still authorized by current permissions.
 * 2) Otherwise deterministic priority order where core System Admin leads,
 *    followed by PMS Admin, HR Mentoring Admin, Skills-only Admin, and Employee Workspace.
 */
export function resolveLandingWorkspace(
  permissions: string[],
  userId?: number
): WorkspaceDefinition | null {
  const authorized = resolveAuthorizedWorkspaces(permissions);
  if (authorized.length === 0) {
    return null;
  }

  const saved = getSavedPreferredWorkspace(userId);
  if (saved) {
    const match = authorized.find((w) => w.key === saved);
    if (match) {
      return match;
    }
  }

  if (hasAny(permissions, CORE_SYSADMIN_PERMISSIONS)) {
    return authorized.find((w) => w.key === 'admin') ?? authorized[0];
  }
  if (hasAny(permissions, PMS_MODULE_PERMISSIONS)) {
    return authorized.find((w) => w.key === 'pms') ?? authorized[0];
  }
  if (hasAny(permissions, HR_MODULE_PERMISSIONS)) {
    return authorized.find((w) => w.key === 'hr') ?? authorized[0];
  }
  if (permissions.includes('SKILL_MANAGE')) {
    return authorized.find((w) => w.key === 'admin') ?? authorized[0];
  }
  return authorized.find((w) => w.key === 'workspace') ?? authorized[0];
}

