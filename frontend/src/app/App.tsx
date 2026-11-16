import { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShieldOff } from 'lucide-react';
import { BrowserRouter, Navigate, useRoutes } from 'react-router-dom';
import { adminRoutes } from '../features/admin/routes';
import { ChangePasswordPage } from '../features/auth/pages/ChangePasswordPage';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { coachingRoutes } from '../features/coaching/routes';
import { PortalHomePage } from '../features/home/PortalHomePage';
import { mentoringRoutes } from '../features/mentoring/routes';
import { workspaceRoutes } from '../features/workspace/routes';
import { resolveAuthorizedModules } from '../shared/auth/workspaceResolver';
import { AppLayout } from '../shared/components/AppLayout';
import { ErrorBoundary } from '../shared/components/ErrorBoundary';
import { ProtectedRoute } from '../shared/components/ProtectedRoute';
import { EmptyState, LoadingSkeleton, ToastProvider } from '../shared/components/ui';
import { AuthProvider, useAuth } from './AuthContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function AdaptiveHomeRouter() {
  const { user, logout } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  const modules = resolveAuthorizedModules(user.permissions);
  if (modules.length === 0) {
    return (
      <div className="apid-card" data-testid="no-authorized-modules">
        <EmptyState
          title="No Authorized Modules"
          description={`Account "${user.username}" is signed in, but currently has zero dashboard permissions assigned. Contact your Bank of Abyssinia System Administrator to grant workspace permissions.`}
          icon={<ShieldOff size={34} />}
          action={
            <button
              type="button"
              className="apid-btn apid-btn-outline apid-btn-sm"
              onClick={() => void logout()}
            >
              Sign Out
            </button>
          }
        />
      </div>
    );
  }

  return <Navigate to="/home" replace />;
}

export function AppRoutes() {
  const element = useRoutes([
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
      path: '/home',
      element: (
        <ProtectedRoute>
          <PortalHomePage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/',
      element: (
        <ProtectedRoute>
          <AdaptiveHomeRouter />
        </ProtectedRoute>
      ),
    },
    ...workspaceRoutes,
    ...coachingRoutes,
    ...mentoringRoutes,
    ...adminRoutes,
    {
      path: '*',
      element: (
        <ProtectedRoute>
          <AdaptiveHomeRouter />
        </ProtectedRoute>
      ),
    },
  ]);

  return (
    <Suspense
      fallback={
        <div className="apid-card">
          <LoadingSkeleton rows={6} height={26} />
        </div>
      }
    >
      {element}
    </Suspense>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <ErrorBoundary>
              <AppLayout>
                <AppRoutes />
              </AppLayout>
            </ErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
