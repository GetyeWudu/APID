import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { PMS_MODULE_PERMISSIONS } from '../../shared/auth/workspaceResolver';
import { ProtectedRoute } from '../../shared/components/ProtectedRoute';

const PmsAdminDashboardPage = lazy(() =>
  import('./pages/PmsAdminDashboardPage').then((m) => ({ default: m.PmsAdminDashboardPage }))
);

export const coachingRoutes: RouteObject[] = [
  {
    path: '/coaching',
    element: <Navigate to="/coaching/pms" replace />,
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
