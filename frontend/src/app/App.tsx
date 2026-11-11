import { useEffect, useState } from 'react';
import { BrowserRouter, NavLink, useRoutes } from 'react-router-dom';
import { apiClient, type ApiResponse } from '../shared/api/apiClient';
import { adminRoutes } from '../features/admin/routes';
import { coachingRoutes } from '../features/coaching/routes';
import { mentoringRoutes } from '../features/mentoring/routes';

interface HealthPayload {
  service: string;
  status: string;
  modules: string[];
}

function HomePage() {
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
        setStatusText('Backend unreachable (start Spring Boot / Docker backend on port 8080)');
      });
  }, []);

  return (
    <div>
      <div className="apid-card">
        <h2>APID Foundation Ready (Phase 1)</h2>
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
          <h2>Core Platform (Joint)</h2>
          <p>Auth, Dynamic RBAC, Org Hierarchy, Skills, Daily.co Video, Files &amp; Notifications.</p>
        </div>
        <div className="apid-card">
          <h2>Coaching (Developer 1)</h2>
          <p>PMS Excel import, mandatory &amp; skill-dev coaching, session reports &amp; oversight.</p>
        </div>
        <div className="apid-card">
          <h2>Mentoring (Developer 2)</h2>
          <p>Trainer applications, HR approvals, direct appointments, discovery &amp; matching.</p>
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  return useRoutes([
    { path: '/', element: <HomePage /> },
    ...coachingRoutes,
    ...mentoringRoutes,
    ...adminRoutes,
  ]);
}

export function App() {
  return (
    <BrowserRouter>
      <div className="apid-shell">
        <header className="apid-header">
          <div className="apid-brand">
            <span>APID</span>
            <span className="apid-badge">Bank of Abyssinia</span>
          </div>
          <nav className="apid-nav">
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/coaching">Coaching</NavLink>
            <NavLink to="/mentoring">Mentoring</NavLink>
            <NavLink to="/admin">Admin</NavLink>
          </nav>
        </header>
        <main className="apid-main">
          <AppRoutes />
        </main>
      </div>
    </BrowserRouter>
  );
}

