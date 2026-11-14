import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowLeft,
  Award,
  BarChart3,
  BookOpen,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileSpreadsheet,
  GitPullRequest,
  HeartHandshake,
  Home,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  RefreshCw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import {
  EMPLOYEE_WORKSPACE_PERMISSIONS,
  getActiveModuleFromPath,
  getSavedPreferredWorkspace,
  resolveAuthorizedModules,
  resolveAuthorizedWorkspaces,
  savePreferredWorkspace,
  type PortalModuleKey,
  type WorkspaceKey,
} from '../auth/workspaceResolver';
import { coreConfigApi } from '../../features/admin/config/api/coreConfigApi';
import { workspaceLiveApi } from '../../features/workspace/api/workspaceDashboardApi';
import { AvatarBadge, NotificationBellPopover, useToast } from './ui';

interface NavEntry {
  to: string;
  label: string;
  icon: ReactNode;
  requiredAnyPermissions: string[];
  matchSearch?: string;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavEntry[];
}

const EMPLOYEE_NAV_GROUP: NavGroup = {
  id: 'employee',
  label: 'Employee',
  items: [
    {
      to: '/workspace',
      label: 'Dashboard',
      icon: <LayoutDashboard size={17} />,
      requiredAnyPermissions: EMPLOYEE_WORKSPACE_PERMISSIONS,
    },
    {
      to: '/workspace?tab=chat',
      label: 'Chat',
      icon: <MessageSquare size={17} />,
      requiredAnyPermissions: EMPLOYEE_WORKSPACE_PERMISSIONS,
      matchSearch: '?tab=chat',
    },
    {
      to: '/mentoring/pairing',
      label: 'My Pairing',
      icon: <HeartHandshake size={17} />,
      requiredAnyPermissions: EMPLOYEE_WORKSPACE_PERMISSIONS,
    },
  ],
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, logout, refreshProfile, hasAnyPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { pushToast } = useToast();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [savedDefault, setSavedDefault] = useState<WorkspaceKey | null>(() =>
    getSavedPreferredWorkspace(user?.id)
  );

  const activeConfigQuery = useQuery({
    queryKey: ['core', 'active-config'],
    queryFn: coreConfigApi.getActiveConfig,
    enabled: Boolean(isAuthenticated && user && !user.mustChangePassword),
    staleTime: 60_000,
  });
  const activeQuarterLabel = activeConfigQuery.data?.activeQuarter?.label ?? 'FY 2026/27 · Q2';

  const authorizedWorkspaces = useMemo(
    () => (user ? resolveAuthorizedWorkspaces(user.permissions) : []),
    [user]
  );

  const authorizedModules = useMemo(
    () => (user ? resolveAuthorizedModules(user.permissions) : []),
    [user]
  );

  const isWorkspacePath = location.pathname.startsWith('/workspace');
  const activeModule =
    getActiveModuleFromPath(location.pathname) ?? (isWorkspacePath ? 'mentoring' : null);

  const hasEmployeeAccess = Boolean(
    isAuthenticated && user && !user.mustChangePassword && hasAnyPermission(EMPLOYEE_WORKSPACE_PERMISSIONS)
  );

  const identityQuery = useQuery({
    queryKey: ['workspace', 'identity', user?.id],
    queryFn: workspaceLiveApi.loadMyIdentity,
    enabled: hasEmployeeAccess,
    staleTime: 60_000,
  });

  const canCoachDirectReports =
    (identityQuery.data?.directReports.length ?? 0) > 0 ||
    Boolean(user?.permissions.includes('COACHING_REQUEST_SUBMIT'));
  const isMentor = user?.roles.some((role) => role.trim().toLowerCase() === 'mentor') ?? false;

  const moduleNavGroups = useMemo<Record<PortalModuleKey, NavGroup[]>>(
    () => ({
      coaching: [
        {
          id: 'coaching-personal',
          label: 'My Coaching',
          items: [
            {
              to: '/coaching',
              label: 'My Coach & Plan',
              icon: <ClipboardCheck size={17} />,
              requiredAnyPermissions: EMPLOYEE_WORKSPACE_PERMISSIONS,
            },
            {
              to: '/coaching?view=sessions',
              label: 'Sessions & Channel',
              icon: <MessageSquare size={17} />,
              requiredAnyPermissions: EMPLOYEE_WORKSPACE_PERMISSIONS,
              matchSearch: '?view=sessions',
            },
            ...(canCoachDirectReports
              ? [
                  {
                    to: '/coaching?view=coachees',
                    label: 'People I Coach',
                    icon: <UserCheck size={17} />,
                    requiredAnyPermissions: EMPLOYEE_WORKSPACE_PERMISSIONS,
                    matchSearch: '?view=coachees',
                  },
                ]
              : []),
          ],
        },
        {
          id: 'coaching-pms',
          label: 'PMS Administration',
          items: [
            {
              to: '/coaching/pms',
              label: 'Coaching Overview',
              icon: <BarChart3 size={17} />,
              requiredAnyPermissions: [
                'COACHING_ASSIGNMENT_VIEW_ALL',
                'COACHING_COACH_REPLACE',
                'COACHING_INITIATIVE_CREATE',
                'COACHING_REPORT_VIEW_ALL',
              ],
            },
            {
              to: '/coaching/pms?tab=uploads',
              label: 'Appraisal Upload',
              icon: <FileSpreadsheet size={17} />,
              requiredAnyPermissions: ['PMS_REPORT_UPLOAD'],
              matchSearch: '?tab=uploads',
            },
            {
              to: '/coaching/pms?tab=approvals',
              label: 'Skill Requests',
              icon: <GitPullRequest size={17} />,
              requiredAnyPermissions: ['COACHING_REQUEST_APPROVE'],
              matchSearch: '?tab=approvals',
            },
            {
              to: '/coaching/pms?tab=reports',
              label: 'Coaching Reports',
              icon: <LayoutDashboard size={17} />,
              requiredAnyPermissions: ['COACHING_REPORT_VIEW_ALL'],
              matchSearch: '?tab=reports',
            },
          ],
        },
      ],
      mentoring: [
        {
          id: 'mentoring-trainee',
          label: 'As a Trainee',
          items: [
            {
              to: '/mentoring?view=trainee',
              label: 'My Mentor',
              icon: <Award size={17} />,
              requiredAnyPermissions: EMPLOYEE_WORKSPACE_PERMISSIONS,
              matchSearch: '?view=trainee',
            },
            {
              to: '/mentoring?view=trainee-sessions',
              label: 'My Sessions',
              icon: <MessageSquare size={17} />,
              requiredAnyPermissions: EMPLOYEE_WORKSPACE_PERMISSIONS,
              matchSearch: '?view=trainee-sessions',
            },
            {
              to: '/mentoring?view=directory',
              label: 'Find a Mentor',
              icon: <BookOpen size={17} />,
              requiredAnyPermissions: EMPLOYEE_WORKSPACE_PERMISSIONS,
              matchSearch: '?view=directory',
            },
            {
              to: '/mentoring?view=apply',
              label: 'Apply to Become a Mentor',
              icon: <UserPlus size={17} />,
              requiredAnyPermissions: EMPLOYEE_WORKSPACE_PERMISSIONS,
              matchSearch: '?view=apply',
            },
          ],
        },
        ...(isMentor
          ? [
              {
                id: 'mentoring-mentor',
                label: 'As a Mentor',
                items: [
                  {
                    to: '/mentoring?view=trainer',
                    label: 'My Trainees',
                    icon: <Users size={17} />,
                    requiredAnyPermissions: EMPLOYEE_WORKSPACE_PERMISSIONS,
                    matchSearch: '?view=trainer',
                  },
                  {
                    to: '/mentoring?view=trainer-sessions',
                    label: 'Mentor Sessions',
                    icon: <MessageSquare size={17} />,
                    requiredAnyPermissions: EMPLOYEE_WORKSPACE_PERMISSIONS,
                    matchSearch: '?view=trainer-sessions',
                  },
                ],
              },
            ]
          : []),
        {
          id: 'mentoring-hr',
          label: 'HR Administration',
          items: [
            {
              to: '/mentoring/hr',
              label: 'Mentoring Overview',
              icon: <LayoutDashboard size={17} />,
              requiredAnyPermissions: [
                'MENTORING_REPORT_VIEW_ALL',
                'TRAINER_APPLICATION_REVIEW',
                'MENTORING_MATCH_MANAGE',
              ],
            },
            {
              to: '/mentoring/hr?tab=applications',
              label: 'Trainer Applications',
              icon: <ClipboardCheck size={17} />,
              requiredAnyPermissions: ['TRAINER_APPLICATION_REVIEW'],
              matchSearch: '?tab=applications',
            },
            {
              to: '/mentoring/hr?tab=trainers',
              label: 'Approved Trainers',
              icon: <Award size={17} />,
              requiredAnyPermissions: ['TRAINER_DIRECT_APPOINT', 'TRAINER_STATUS_MANAGE'],
              matchSearch: '?tab=trainers',
            },
            {
              to: '/mentoring/hr?tab=matching',
              label: 'Match Requests',
              icon: <GitPullRequest size={17} />,
              requiredAnyPermissions: ['MENTORING_MATCH_MANAGE'],
              matchSearch: '?tab=matching',
            },
            {
              to: '/mentoring/hr?tab=analytics',
              label: 'Mentoring Reports',
              icon: <BarChart3 size={17} />,
              requiredAnyPermissions: ['MENTORING_REPORT_VIEW_ALL'],
              matchSearch: '?tab=analytics',
            },
          ],
        },
      ],
      admin: [
        {
          id: 'admin',
          label: 'System Administration',
          items: [
            {
              to: '/admin',
              label: 'Overview',
              icon: <LayoutDashboard size={17} />,
              requiredAnyPermissions: [
                'USER_MANAGE',
                'HIERARCHY_MANAGE',
                'ROLE_PERMISSION_MANAGE',
                'AUDIT_LOG_VIEW',
                'SKILL_MANAGE',
                'SYSTEM_CONFIG_MANAGE',
              ],
            },
            {
              to: '/admin?tab=users',
              label: 'Users & Access',
              icon: <Users size={17} />,
              requiredAnyPermissions: ['USER_MANAGE'],
              matchSearch: '?tab=users',
            },
            {
              to: '/admin?tab=organization',
              label: 'Employees & Org',
              icon: <Building2 size={17} />,
              requiredAnyPermissions: ['HIERARCHY_MANAGE'],
              matchSearch: '?tab=organization',
            },
            {
              to: '/admin?tab=roles',
              label: 'Roles & Permissions',
              icon: <ShieldCheck size={17} />,
              requiredAnyPermissions: ['ROLE_PERMISSION_MANAGE'],
              matchSearch: '?tab=roles',
            },
            {
              to: '/admin?tab=skills',
              label: 'Skills',
              icon: <Settings2 size={17} />,
              requiredAnyPermissions: ['SKILL_MANAGE'],
              matchSearch: '?tab=skills',
            },
            {
              to: '/admin?tab=audit',
              label: 'Activity Log',
              icon: <Activity size={17} />,
              requiredAnyPermissions: ['AUDIT_LOG_VIEW'],
              matchSearch: '?tab=audit',
            },
            {
              to: '/admin?tab=config',
              label: 'Quarter Settings',
              icon: <SlidersHorizontal size={17} />,
              requiredAnyPermissions: ['SYSTEM_CONFIG_MANAGE'],
              matchSearch: '?tab=config',
            },
          ],
        },
      ],
    }),
    [canCoachDirectReports, isMentor]
  );

  const visibleGroups = useMemo(() => {
    const showEmployeeNavigation = activeModule === 'mentoring' || isWorkspacePath;
    const employeeGroup =
      showEmployeeNavigation && hasAnyPermission(EMPLOYEE_WORKSPACE_PERMISSIONS)
        ? {
            ...EMPLOYEE_NAV_GROUP,
            items: EMPLOYEE_NAV_GROUP.items.filter((item) =>
              hasAnyPermission(item.requiredAnyPermissions)
            ),
          }
        : null;
    const moduleGroups = activeModule ? moduleNavGroups[activeModule] : [];
    const visibleModuleGroups = moduleGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => hasAnyPermission(item.requiredAnyPermissions)),
      }))
      .filter((group) => group.items.length > 0);
    return [...(employeeGroup ? [employeeGroup] : []), ...visibleModuleGroups];
  }, [activeModule, isWorkspacePath, moduleNavGroups, hasAnyPermission]);

  // Full-bleed split auth layout without app chrome when unauthenticated or password-change-pending
  if (!isAuthenticated || !user || user.mustChangePassword) {
    return <>{children}</>;
  }

  const pageMeta = (() => {
    if (location.pathname === '/home') {
      return { kicker: 'Bank of Abyssinia', title: 'APID Portal Home' };
    }
    if (location.pathname.startsWith('/admin')) {
      return { kicker: 'System Administration', title: 'Platform Governance & Settings' };
    }
    if (location.pathname.startsWith('/coaching/pms')) {
      return { kicker: 'Performance Coaching', title: 'PMS Coaching Administration' };
    }
    if (location.pathname.startsWith('/coaching')) {
      return { kicker: 'Performance Coaching', title: 'Coaching Dashboard' };
    }
    if (location.pathname.startsWith('/mentoring/hr')) {
      return { kicker: 'Mentoring & Trainers', title: 'HR Mentoring Administration' };
    }
    if (location.pathname.startsWith('/mentoring')) {
      return { kicker: 'Mentoring', title: 'Mentoring Dashboard' };
    }
    if (location.pathname.startsWith('/workspace')) {
      return { kicker: 'Bank of Abyssinia', title: 'My Workspace' };
    }
    return { kicker: 'Bank of Abyssinia', title: 'APID Portal' };
  })();

  const isNavItemActive = (item: NavEntry) => {
    const basePath = item.to.split('?')[0];
    if (location.pathname !== basePath) return false;
    if (item.matchSearch) {
      return location.search === item.matchSearch;
    }
    return !location.search.includes('tab=') && !location.search.includes('view=');
  };

  const handleLogout = async () => {
    setAccountOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const handleSetDefaultWorkspace = (key: WorkspaceKey) => {
    savePreferredWorkspace(user.id, key);
    setSavedDefault(key);
    pushToast({
      tone: 'ok',
      title: 'Default workspace updated',
      message: 'Your default workspace is saved for future logins.',
    });
  };

  const handleRefreshPerms = async () => {
    await refreshProfile();
    pushToast({
      tone: 'info',
      title: 'Session permissions synced',
      message: 'Refreshed effective permissions from the backend.',
    });
  };

  const showSidebar = activeModule !== null || isWorkspacePath;

  return (
    <div className="boa-shell">
      {showSidebar && mobileOpen && (
        <div
          className="boa-sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {showSidebar && (
        <aside className={`boa-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
          <div className="boa-sidebar-brand">
            <div className="boa-brand-mark">
              <span className="boa-brand-emblem">BoA</span>
              {!collapsed && (
                <div className="boa-brand-text">
                  <span className="boa-brand-title">APID Portal</span>
                  <span className="boa-brand-sub">Bank of Abyssinia</span>
                </div>
              )}
            </div>
            <button
              type="button"
              className="boa-icon-btn"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            {mobileOpen && (
              <button
                type="button"
                className="boa-icon-btn"
                aria-label="Close mobile menu"
                onClick={() => setMobileOpen(false)}
              >
                <X size={16} />
              </button>
            )}
          </div>

          <nav className="boa-sidebar-nav" aria-label="Module navigation">
            <NavLink
              to="/home"
              className="boa-sidebar-home-link"
              onClick={() => setMobileOpen(false)}
              title="Back to All Modules"
            >
              <ArrowLeft size={15} />
              {!collapsed && <span>All Modules</span>}
            </NavLink>

            {visibleGroups.map((group) => (
              <div key={group.id}>
                {!collapsed && <div className="boa-nav-group-label">{group.label}</div>}
                <div className="boa-nav-items">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={() => `boa-nav-link ${isNavItemActive(item) ? 'active' : ''}`}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? item.label : undefined}
                    >
                      {item.icon}
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {!collapsed && (
            <div className="boa-sidebar-footer">
              <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{user.username}</div>
              <div style={{ fontSize: '0.72rem', marginTop: '0.15rem' }}>
                {user.roles.join(', ') || 'No Role'} · {user.permissions.length} perms
              </div>
            </div>
          )}
        </aside>
      )}

      <div className="boa-main-column">
        <header className="boa-topbar">
          <div className="boa-topbar-left">
            {showSidebar ? (
              <button
                type="button"
                className="boa-mobile-menu-btn"
                aria-label="Open navigation menu"
                onClick={() => setMobileOpen(true)}
              >
                <Menu size={18} />
              </button>
            ) : (
              <div className="boa-brand-mark boa-brand-mark--light" style={{ marginRight: '0.5rem' }}>
                <span className="boa-brand-emblem">BoA</span>
              </div>
            )}
            <div className="boa-breadcrumb">
              <span className="boa-breadcrumb-kicker">{pageMeta.kicker}</span>
              <span className="boa-breadcrumb-title">{pageMeta.title}</span>
            </div>

            {location.pathname !== '/home' && authorizedModules.length > 0 && (
              <nav className="boa-module-switcher" aria-label="Module switcher">
                <NavLink to="/home" className="boa-module-pill">
                  <Home size={13} />
                  <span>Home</span>
                </NavLink>
                {authorizedModules.map((mod) => (
                  <NavLink
                    key={mod.key}
                    to={mod.route}
                    className={() =>
                      `boa-module-pill ${activeModule === mod.key ? 'active' : ''}`
                    }
                  >
                    {mod.shortLabel}
                  </NavLink>
                ))}
              </nav>
            )}
          </div>

          <div className="boa-topbar-right">
            <span
              className="boa-quarter-pill"
              title="Active fiscal quarter"
            >
              {activeQuarterLabel}
            </span>

            <NotificationBellPopover />

            <div className="boa-popover-anchor">
              <button
                type="button"
                className="boa-user-chip"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((o) => !o)}
              >
                <AvatarBadge name={user.username} size={28} />
                <span>{user.username}</span>
              </button>

              {accountOpen && (
                <div className="boa-popover-panel" role="dialog" aria-label="Account menu" style={{ padding: '0.85rem 1rem' }}>
                  <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.7rem', marginBottom: '0.7rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{user.username}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      Roles: {user.roles.join(', ') || 'None'}
                    </div>
                  </div>

                  {authorizedWorkspaces.length > 1 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.4rem' }}>
                        Default Workspace
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {authorizedWorkspaces.map((ws) => {
                          const selected = savedDefault === ws.key;
                          return (
                            <button
                              key={ws.key}
                              type="button"
                              className={`apid-btn apid-btn-sm ${selected ? 'apid-btn-primary' : 'apid-btn-outline'}`}
                              style={{ justifyContent: 'space-between' }}
                              onClick={() => handleSetDefaultWorkspace(ws.key)}
                            >
                              <span>{ws.label}</span>
                              {selected && <span>Default</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="apid-btn apid-btn-outline apid-btn-sm"
                      style={{ justifyContent: 'flex-start' }}
                      onClick={() => {
                        setAccountOpen(false);
                        void handleRefreshPerms();
                      }}
                    >
                      <RefreshCw size={14} />
                      Sync Session Permissions
                    </button>
                    <button
                      type="button"
                      className="apid-btn apid-btn-outline apid-btn-sm"
                      style={{ justifyContent: 'flex-start' }}
                      onClick={() => {
                        setAccountOpen(false);
                        navigate('/change-password');
                      }}
                    >
                      <KeyRound size={14} />
                      Change Password
                    </button>
                    <button
                      type="button"
                      className="apid-btn apid-btn-danger apid-btn-sm"
                      style={{ justifyContent: 'flex-start' }}
                      onClick={handleLogout}
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="boa-content">{children}</main>
      </div>
    </div>
  );
}
