import { useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileSpreadsheet,
  GitPullRequest,
  Home,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import {
  getSavedPreferredWorkspace,
  resolveAuthorizedWorkspaces,
  savePreferredWorkspace,
  type WorkspaceKey,
} from '../auth/workspaceResolver';
import { PREVIEW_NOTIFICATIONS } from '../mocks/boaPreviewFixtures';
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

  const authorizedWorkspaces = useMemo(
    () => (user ? resolveAuthorizedWorkspaces(user.permissions) : []),
    [user]
  );

  const navGroups: NavGroup[] = useMemo(
    () => [
      {
        id: 'workspace',
        label: 'My Workspace',
        items: [
          {
            to: '/workspace',
            label: 'Overview',
            icon: <Home size={17} />,
            requiredAnyPermissions: ['EMPLOYEE_PORTAL_ACCESS', 'COACHING_REQUEST_SUBMIT'],
          },
          {
            to: '/workspace?tab=coaching',
            label: 'My Coaching',
            icon: <ClipboardCheck size={17} />,
            requiredAnyPermissions: ['EMPLOYEE_PORTAL_ACCESS', 'COACHING_REQUEST_SUBMIT'],
            matchSearch: '?tab=coaching',
          },
          {
            to: '/workspace?tab=mentoring',
            label: 'My Mentoring',
            icon: <Award size={17} />,
            requiredAnyPermissions: ['EMPLOYEE_PORTAL_ACCESS'],
            matchSearch: '?tab=mentoring',
          },
        ],
      },
      {
        id: 'pms',
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
        ],
      },
      {
        id: 'hr',
        label: 'HR Mentoring',
        items: [
          {
            to: '/mentoring/hr',
            label: 'Mentoring Overview',
            icon: <LayoutDashboard size={17} />,
            requiredAnyPermissions: ['MENTORING_REPORT_VIEW_ALL', 'TRAINER_APPLICATION_REVIEW', 'MENTORING_MATCH_MANAGE'],
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
        ],
      },
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
    []
  );

  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => hasAnyPermission(item.requiredAnyPermissions)),
        }))
        .filter((group) => group.items.length > 0),
    [navGroups, hasAnyPermission]
  );

  // Full-bleed split auth layout without app chrome when unauthenticated or password-change-pending
  if (!isAuthenticated || !user || user.mustChangePassword) {
    return <>{children}</>;
  }

  const pageMeta = (() => {
    if (location.pathname.startsWith('/admin')) {
      return { kicker: 'Bank of Abyssinia', title: 'System Administration' };
    }
    if (location.pathname.startsWith('/coaching')) {
      return { kicker: 'Bank of Abyssinia', title: 'PMS Coaching' };
    }
    if (location.pathname.startsWith('/mentoring')) {
      return { kicker: 'Bank of Abyssinia', title: 'HR Mentoring' };
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
    return location.search === '' || !location.search.includes('tab=');
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

  return (
    <div className="boa-shell">
      {mobileOpen && (
        <div
          className="boa-sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

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

        <nav className="boa-sidebar-nav" aria-label="Main navigation">
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

      <div className="boa-main-column">
        <header className="boa-topbar">
          <div className="boa-topbar-left">
            <button
              type="button"
              className="boa-mobile-menu-btn"
              aria-label="Open navigation menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={18} />
            </button>
            <div className="boa-breadcrumb">
              <span className="boa-breadcrumb-kicker">{pageMeta.kicker}</span>
              <span className="boa-breadcrumb-title">{pageMeta.title}</span>
            </div>
          </div>

          <div className="boa-topbar-right">
            <span
              className="boa-quarter-pill"
              title="Current fiscal quarter"
            >
              FY 2026/27 · Q1
            </span>

            <NotificationBellPopover initialItems={PREVIEW_NOTIFICATIONS} />

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
