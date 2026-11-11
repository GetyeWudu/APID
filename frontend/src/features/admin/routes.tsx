import type { RouteObject } from 'react-router-dom';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

export const adminRoutes: RouteObject[] = [
  {
    path: '/admin',
    element: <AdminDashboardPage />,
  },
];
