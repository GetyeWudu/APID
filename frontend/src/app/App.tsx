import { useEffect, useState } from 'react';
import { BrowserRouter, useRoutes, type RouteObject } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { apiClient, type ApiResponse } from '../shared/api/apiClient';
import { AppLayout } from '../shared/components/AppLayout';
import { ProtectedRoute } from '../shared/components/ProtectedRoute';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { ChangePasswordPage } from '../features/auth/pages/ChangePasswordPage';
import { adminRoutes } from '../features/admin/routes';
import { coachingRoutes } from '../features/coaching/routes';
import { mentoringRoutes } from '../features/mentoring/routes';

interface HealthPayload {
  service: string;
  status: string;
  modules: string[];
}

function HomePage() {
  const { user, hasPermission } = useAuth();
  const [statusText, setStatusText] = useState<string>('Checking backend...');
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    apiClient
      .get<ApiResponse<HealthPayload>>('/core/health')
      .then((res) => {
        setHealthy(true);
        setStatusText(`${res.data.data.service}: ${res.data.data.status}`);
      })
      .catch(() => {
        setHealthy(false);
        setStatusText('Backend unreachable');
      });
  }, []);

  return (
    <div>
      <div className="apid-card">
        <h2>Welcome, {user?.username}</h2>
        <p>
          Active Roles: <strong>{user?.roles.join(', ') || 'None'}</strong>
        </p>
        <p>
          Backend API Status:{' '}
          <strong
            style={{
              color: healthy === null ? 'inherit' : healthy ? 'var(--ok)' : 'var(--err)',
            }}
          >
            {statusText}
          </strong>
        </p>
      </div>

      <div className="apid-grid">
        <div className="apid-card">
          <h2>Active Permissions ({user?.permissions.length ?? 0})</h2>
          <p style={{ fontSize: '0.85rem', wordBreak: 'break-word' }}>
            {user?.permissions.join(', ') || 'None'}
          </p>
        </div>
        {hasPermission('USER_MANAGE') && (
          <div className="apid-card">
            <h2>Admin Access Active</h2>
            <p>You hold administrative governance permissions for Phase 2+ modules.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function wrapRoutes(
  routes: RouteObject[],
  requiredAnyPermissions?: string[]
): RouteObject[] {
  return routes.map((r) => ({
    ...r,
    element: (
      <ProtectedRoute requiredAnyPermissions={requiredAnyPermissions}>
        {r.element}
      </ProtectedRoute>
    ),
  }));
}

function AppRoutes() {
  return useRoutes([
    { path: '/login', element: <LoginPage /> },
    {
      path: '/change-password',
      element: (
        <ProtectedRoute allowPasswordChangePending>
          <ChangePasswordPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/',
      element: (
        <ProtectedRoute>
          <HomePage />
        </ProtectedRoute>
      ),
    },
    ...wrapRoutes(coachingRoutes),
    ...wrapRoutes(mentoringRoutes),
    ...wrapRoutes(adminRoutes, [
      'USER_MANAGE',
      'HIERARCHY_MANAGE',
      'ROLE_PERMISSION_MANAGE',
      'SYSTEM_CONFIG_MANAGE',
      'AUDIT_LOG_VIEW',
      'SKILL_MANAGE',
    ]),
  ]);
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout>
          <AppRoutes />
        </AppLayout>
      </AuthProvider>
    </BrowserRouter>
  );
}
