import { useState, type ReactNode } from 'react';
import { StatusPill } from '../../../shared/components/ui';
import type { MentoringSession } from '../api/mentoringPairingApi';
import { MentoringSessionDetails } from './MentoringSessionDetails';
import './MentoringSessionList.css';

type StatusTone = 'ok' | 'err' | 'warn' | 'info' | 'neutral';

interface MentoringSessionListRowProps {
  session: MentoringSession;
  approach: string;
  startTime: string;
  statusLabel: string;
  statusTone: StatusTone;
  pairLabel: string;
  children: ReactNode;
}

export function MentoringSessionListHeader() {
  return (
    <div className="mentoring-session-list-row mentoring-session-list-header" aria-hidden="true">
      <span>Title</span>
      <span>Approach</span>
      <span>Start time</span>
      <span>Status</span>
      <span>Pair</span>
      <span>Details</span>
    </div>
  );
}

export function MentoringSessionListRow({
  session,
  approach,
  startTime,
  statusLabel,
  statusTone,
  pairLabel,
  children,
}: MentoringSessionListRowProps) {
  const [isDetailsOpen, setDetailsOpen] = useState(false);

  return (
    <div
      className="mentoring-session-list-entry"
      role="listitem"
      aria-label={`${session.title}, ${approach}, starts ${startTime}, ${statusLabel}, ${pairLabel}`}
    >
      <div className="mentoring-session-list-row">
        <strong className="mentoring-session-list-title" title={session.title}>{session.title}</strong>
        <span data-label="Approach">{approach}</span>
        <span data-label="Start time">{startTime}</span>
        <span data-label="Status"><StatusPill label={statusLabel} tone={statusTone} /></span>
        <span className="mentoring-session-list-pair" data-label="Pair">{pairLabel}</span>
        <button
          type="button"
          className="apid-btn apid-btn-outline apid-btn-sm"
          onClick={() => setDetailsOpen(true)}
          aria-label={`View details for ${session.title}`}
        >
          View detail
        </button>
      </div>
      <MentoringSessionDetails
        session={session}
        isOpen={isDetailsOpen}
        onClose={() => setDetailsOpen(false)}
      >
        {children}
      </MentoringSessionDetails>
    </div>
  );
}
