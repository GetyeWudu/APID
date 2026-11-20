import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import type { MentoringSession } from '../api/mentoringPairingApi';
import './MentoringSessionList.css';

interface MentoringSessionDetailsProps {
  session: MentoringSession;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function MentoringSessionDetails({
  session,
  isOpen,
  onClose,
  children,
}: MentoringSessionDetailsProps) {
  if (!isOpen) return null;

  return (
    <div
      className="apid-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="mentoring-session-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`mentoring-session-details-title-${session.id}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="mentoring-session-details-header">
          <div className="mentoring-session-details-heading">
            <span className="mentoring-session-details-eyebrow">Session details</span>
            <h2 id={`mentoring-session-details-title-${session.id}`}>{session.title}</h2>
          </div>
          <button
            type="button"
            className="mentoring-session-details-close"
            onClick={onClose}
            aria-label="Close session details"
          >
            <X size={16} />
          </button>
        </header>
        <div className="mentoring-session-details-body">{children}</div>
      </section>
    </div>
  );
}
