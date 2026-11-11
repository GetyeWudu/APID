import type { RouteObject } from 'react-router-dom';

function AdminPlaceholderPage() {
  return (
    <div className="apid-card">
      <h2>System Administration</h2>
      <p>
        Shared Core Admin workspace for Users, Dynamic Roles &amp; Permissions,
        Organizational Hierarchy, Master Skills, and Fiscal Quarter configuration.
      </p>
    </div>
  );
}

export const adminRoutes: RouteObject[] = [
  {
    path: '/admin',
    element: <AdminPlaceholderPage />,
  },
];

