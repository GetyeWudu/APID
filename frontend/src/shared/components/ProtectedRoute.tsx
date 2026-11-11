import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../app/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredAnyPermissions?: string[];
  allowPasswordChangePending?: boolean;
}

export function ProtectedRoute({
  children,
  requiredAnyPermissions,
  allowPasswordChangePending = false,
}: ProtectedRouteProps) {
  const { user, loading, isAuthenticated, hasAnyPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="apid-card" style={{ textAlign: 'center', marginTop: '3rem' }}>
        <p>Verifying session...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (user.mustChangePassword && !allowPasswordChangePending) {
    return <Navigate to="/change-password" replace />;
  }

  if (
    requiredAnyPermissions &&
    requiredAnyPermissions.length > 0 &&
    !hasAnyPermission(requiredAnyPermissions)
  ) {
    return (
      <div className="apid-card">
        <h2>Access Restricted</h2>
        <p>You do not have permission to access this module.</p>
      </div>
    );
  }

  return <>{children}</>;
}

