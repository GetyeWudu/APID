import { useState } from 'react';
import type { MentoringSession } from '../api/mentoringPairingApi';
import { getMentoringSessionDaysRemaining } from '../utils/mentoringSessionUtils';

const deliveryModeLabels: Record<MentoringSession['deliveryMode'], string> = {
  ONLINE: 'Video only',
  IN_PERSON: 'In person',
  HYBRID: 'Hybrid: in person and video',
};

function getDaysRemainingLabel(daysRemaining: number | null) {
  if (daysRemaining === null) return 'Unavailable';
  if (daysRemaining < 0) {
    const daysAgo = Math.abs(daysRemaining);
    return `${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`;
  }
  if (daysRemaining === 0) return 'Today';
  return `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`;
}

export function MentoringSessionDetails({ session }: { session: MentoringSession }) {
  const [isOpen, setIsOpen] = useState(false);
  const detailsId = `mentoring-session-${session.id}-details`;
  const daysRemaining = getMentoringSessionDaysRemaining(session.scheduledStart);

  return (
    <div>
      <button
        type="button"
        className="apid-btn apid-btn-outline apid-btn-sm"
        aria-expanded={isOpen}
        aria-controls={detailsId}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? 'Hide session details' : 'Session details'}
      </button>
      {isOpen && (
        <div
          id={detailsId}
          className="apid-card"
          style={{ marginTop: '0.6rem', border: '1px solid var(--border)' }}
        >
          <p style={{ margin: 0 }}>
            <strong>Session type:</strong> {deliveryModeLabels[session.deliveryMode]}
          </p>
          <p className="boa-muted" style={{ margin: '0.35rem 0 0' }}>
            <strong>Days until session:</strong> {getDaysRemainingLabel(daysRemaining)}
          </p>
          {session.location && (
            <p className="boa-muted" style={{ margin: '0.35rem 0 0' }}>
              <strong>Location:</strong> {session.location}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
