import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import {
  COACHING_PORTAL_PERMISSIONS,
  EMPLOYEE_WORKSPACE_PERMISSIONS,
  PMS_MODULE_PERMISSIONS,
} from '../../shared/auth/workspaceResolver';
import { ProtectedRoute } from '../../shared/components/ProtectedRoute';

const CoachingHomePage = lazy(() =>
  import('./pages/CoachingHomePage').then((m) => ({ default: m.CoachingHomePage }))
);

const PmsAdminDashboardPage = lazy(() =>
  import('./pages/PmsAdminDashboardPage').then((m) => ({ default: m.PmsAdminDashboardPage }))
);

function CoachingIndexGate() {
  const { hasAnyPermission } = useAuth();
  if (!hasAnyPermission(EMPLOYEE_WORKSPACE_PERMISSIONS)) {
    return <Navigate to="/coaching/pms" replace />;
  }
  return <CoachingHomePage />;
}

export const coachingRoutes: RouteObject[] = [
  {
    path: '/coaching',
    element: (
      <ProtectedRoute requiredAnyPermissions={COACHING_PORTAL_PERMISSIONS}>
        <CoachingIndexGate />
      </ProtectedRoute>
    ),
  },
  {
    path: '/coaching/pms',
    element: (
      <ProtectedRoute requiredAnyPermissions={PMS_MODULE_PERMISSIONS}>
        <PmsAdminDashboardPage />
      </ProtectedRoute>
    ),
  },
];
