import { useEffect, useState } from 'react';
import { Video } from 'lucide-react';
import type { MentoringSession } from '../api/mentoringPairingApi';

interface MentoringSessionJoinButtonProps {
  session: MentoringSession;
  onJoin: () => void;
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

  const isScheduled = session.status === 'SCHEDULED' || session.status === 'CONFIRMED';
  const canJoin = isScheduled && Number.isFinite(start) && Number.isFinite(end) && now >= start && now < end;
  if (
    !isVideoSession ||
    session.status === 'CANCELLED' ||
    session.status === 'DECLINED'
  ) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onJoin}
      disabled={!canJoin}
      className={`apid-btn apid-btn-sm ${canJoin ? 'apid-btn-primary' : 'apid-btn-outline'}`}
      aria-disabled={!canJoin}
    >
      <Video size={14} /> Join LiveKit Video
    </button>
  );
}
