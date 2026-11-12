import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ADMIN_MODULE_PERMISSIONS } from '../../shared/auth/workspaceResolver';
import { ProtectedRoute } from '../../shared/components/ProtectedRoute';

const AdminDashboardPage = lazy(() =>
  import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
);

export const adminRoutes: RouteObject[] = [
  {
    path: '/admin',
    element: (
      <ProtectedRoute requiredAnyPermissions={ADMIN_MODULE_PERMISSIONS}>
        <AdminDashboardPage />
      </ProtectedRoute>
    ),
  },
];
