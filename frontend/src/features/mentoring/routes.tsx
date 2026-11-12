import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { HR_MODULE_PERMISSIONS } from '../../shared/auth/workspaceResolver';
import { ProtectedRoute } from '../../shared/components/ProtectedRoute';

const HrMentoringDashboardPage = lazy(() =>
  import('./pages/HrMentoringDashboardPage').then((m) => ({ default: m.HrMentoringDashboardPage }))
);

export const mentoringRoutes: RouteObject[] = [
  {
    path: '/mentoring',
    element: <Navigate to="/mentoring/hr" replace />,
  },
  {
    path: '/mentoring/hr',
    element: (
      <ProtectedRoute requiredAnyPermissions={HR_MODULE_PERMISSIONS}>
        <HrMentoringDashboardPage />
      </ProtectedRoute>
    ),
  },
];
