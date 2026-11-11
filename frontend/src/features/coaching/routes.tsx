import type { RouteObject } from 'react-router-dom';

function CoachingPlaceholderPage() {
  return (
    <div className="apid-card">
      <h2>Coaching Module (PMS &amp; Performance Development)</h2>
      <p>
        Owned by Developer 1: PMS Excel uploads, automatic mandatory assignments
        (&lt; 3.0), Coach/Talent views, Skill-Development requests, Daily.co sessions,
        and per-session PMS reports.
      </p>
    </div>
  );
}

export const coachingRoutes: RouteObject[] = [
  {
    path: '/coaching',
    element: <CoachingPlaceholderPage />,
  },
];

