import type { RouteObject } from 'react-router-dom';

function MentoringPlaceholderPage() {
  return (
    <div className="apid-card">
      <h2>Mentoring Module (HR &amp; Knowledge Sharing)</h2>
      <p>
        Owned by Developer 2: Trainer applications, HR review &amp; direct appointments,
        Suspend/Revoke controls, Trainer discovery &amp; matching, and Mentoring
        collaboration rooms.
      </p>
    </div>
  );
}

export const mentoringRoutes: RouteObject[] = [
  {
    path: '/mentoring',
    element: <MentoringPlaceholderPage />,
  },
];

