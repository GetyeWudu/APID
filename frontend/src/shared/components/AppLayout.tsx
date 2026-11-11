import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../app/AuthContext';

const ADMIN_PERMS = [
  'USER_MANAGE',
  'HIERARCHY_MANAGE',
  'ROLE_PERMISSION_MANAGE',
  'SYSTEM_CONFIG_MANAGE',
  'AUDIT_LOG_VIEW',
  'SKILL_MANAGE',
];

const COACHING_PERMS = [
  'EMPLOYEE_PORTAL_ACCESS',
  'PMS_REPORT_UPLOAD',
  'COACHING_ASSIGNMENT_VIEW_ALL',
  'COACHING_REQUEST_APPROVE',
  'COACHING_REPORT_VIEW_ALL',
];

const MENTORING_PERMS = [
  'EMPLOYEE_PORTAL_ACCESS',
  'TRAINER_APPLICATION_REVIEW',
  'TRAINER_DIRECT_APPOINT',
  'TRAINER_STATUS_MANAGE',
  'MENTORING_MATCH_MANAGE',
  'MENTORING_REPORT_VIEW_ALL',
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, logout, hasAnyPermission } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="apid-shell">
      <header className="apid-header">
        <div className="apid-brand">
          <span>APID</span>
          <span className="apid-badge">Bank of Abyssinia</span>
        </div>

        {isAuthenticated && user && !user.mustChangePassword && (
          <nav className="apid-nav">
            <NavLink to="/" end>
              Workspace
            </NavLink>
            {hasAnyPermission(COACHING_PERMS) && <NavLink to="/coaching">Coaching</NavLink>}
            {hasAnyPermission(MENTORING_PERMS) && <NavLink to="/mentoring">Mentoring</NavLink>}
            {hasAnyPermission(ADMIN_PERMS) && <NavLink to="/admin">System Admin</NavLink>}
          </nav>
        )}

        <div className="apid-user-controls">
          {isAuthenticated && user ? (
            <>
              <span className="apid-user-pill">
                {user.username} ({user.roles.join(', ') || 'No Role'})
              </span>
              <button type="button" className="apid-btn apid-btn-outline" onClick={handleLogout}>
                Sign Out
              </button>
            </>
          ) : null}
        </div>
      </header>

      <main className="apid-main">{children}</main>
    </div>
  );
}

