import { useEffect, useState } from 'react';
import { Video } from 'lucide-react';
import type { MentoringSession } from '../api/mentoringPairingApi';

interface MentoringSessionJoinButtonProps {
  session: MentoringSession;
  onJoin: () => void;
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'the scheduled time'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function MentoringSessionJoinButton({ session, onJoin }: MentoringSessionJoinButtonProps) {
  const start = new Date(session.scheduledStart).getTime();
  const end = new Date(session.scheduledEnd).getTime();
  const [now, setNow] = useState(() => Date.now());
  const isVideoSession = session.deliveryMode === 'ONLINE' || session.deliveryMode === 'HYBRID';

  useEffect(() => {
    if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
    const nextBoundary = now < start ? start : now < end ? end : null;
    if (nextBoundary === null) return undefined;

    const timeout = setTimeout(
      () => setNow(Date.now()),
      Math.min(Math.max(0, nextBoundary - Date.now()), 2_147_483_647)
    );
    return () => clearTimeout(timeout);
  }, [start, end, now]);

  if (!isVideoSession || session.status === 'CANCELLED' || session.status === 'DECLINED') {
    return null;
  }

  const isConfirmed = session.status === 'CONFIRMED';
  const canJoin = isConfirmed && Number.isFinite(start) && Number.isFinite(end) && now >= start && now < end;
  let label = 'Join after the session is confirmed';
  if (isConfirmed && now < start) label = `Available ${formatTime(session.scheduledStart)}`;
  else if (isConfirmed && now >= end) label = 'Session time has ended';
  else if (isConfirmed && canJoin) label = 'Join video session';
  else if (session.status === 'RESCHEDULE_PROPOSED') label = 'Unavailable while reschedule is pending';
  else if (session.status === 'COMPLETED' || session.status === 'MISSED') label = 'Session is finished';

  return (
    <button
      type="button"
      onClick={onJoin}
      disabled={!canJoin}
      className={`apid-btn apid-btn-sm ${canJoin ? 'apid-btn-primary' : 'apid-btn-outline'}`}
      aria-disabled={!canJoin}
    >
      <Video size={14} /> {label}
    </button>
  );
}
