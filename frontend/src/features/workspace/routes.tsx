import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { EMPLOYEE_WORKSPACE_PERMISSIONS } from '../../shared/auth/workspaceResolver';
import { ProtectedRoute } from '../../shared/components/ProtectedRoute';

const WorkspaceDashboardPage = lazy(() =>
  import('./pages/WorkspaceDashboardPage').then((m) => ({ default: m.WorkspaceDashboardPage }))
);

export const workspaceRoutes: RouteObject[] = [
  {
    path: '/workspace',
    element: (
      <ProtectedRoute requiredAnyPermissions={EMPLOYEE_WORKSPACE_PERMISSIONS}>
        <WorkspaceDashboardPage />
      </ProtectedRoute>
    ),
  },
];
