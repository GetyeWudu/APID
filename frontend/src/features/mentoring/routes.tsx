import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import {
  EMPLOYEE_WORKSPACE_PERMISSIONS,
  HR_MODULE_PERMISSIONS,
  MENTORING_PORTAL_PERMISSIONS,
} from '../../shared/auth/workspaceResolver';
import { ProtectedRoute } from '../../shared/components/ProtectedRoute';

const MentoringHomePage = lazy(() =>
  import('./pages/MentoringHomePage').then((m) => ({ default: m.MentoringHomePage }))
);

const HrMentoringDashboardPage = lazy(() =>
  import('./pages/HrMentoringDashboardPage').then((m) => ({ default: m.HrMentoringDashboardPage }))
);

const MyPairingPage = lazy(() =>
  import('./pages/MyPairingPage').then((m) => ({ default: m.MyPairingPage }))
);

const MentoringPairingDetailPage = lazy(() =>
  import('./pages/MentoringPairingDetailPage').then((m) => ({ default: m.MentoringPairingDetailPage }))
);

function MentoringIndexGate() {
  const { hasAnyPermission } = useAuth();
  if (!hasAnyPermission(EMPLOYEE_WORKSPACE_PERMISSIONS)) {
    return <Navigate to="/mentoring/hr" replace />;
  }
  return <MentoringHomePage />;
}

export const mentoringRoutes: RouteObject[] = [
  {
    path: '/mentoring',
    element: (
      <ProtectedRoute requiredAnyPermissions={MENTORING_PORTAL_PERMISSIONS}>
        <MentoringIndexGate />
      </ProtectedRoute>
    ),
  },
  {
    path: '/mentoring/hr',
    element: (
      <ProtectedRoute requiredAnyPermissions={HR_MODULE_PERMISSIONS}>
        <HrMentoringDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/mentoring/pairing',
    element: (
      <ProtectedRoute requiredAnyPermissions={EMPLOYEE_WORKSPACE_PERMISSIONS}>
        <MyPairingPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/mentoring/pairing/:relationshipId',
    element: (
      <ProtectedRoute requiredAnyPermissions={EMPLOYEE_WORKSPACE_PERMISSIONS}>
        <MentoringPairingDetailPage />
      </ProtectedRoute>
    ),
  },
];
