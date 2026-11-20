import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Video, X } from 'lucide-react';
import { extractApiErrorMessage } from '../../../shared/api/apiClient';
import { useToast } from '../../../shared/components/ui';
import {
  mentoringPairingApi,
  type MentoringSession,
} from '../api/mentoringPairingApi';
import { MentoringDailyVideoModal } from './MentoringDailyVideoModal';
import { MentoringSessionJoinButton } from './MentoringSessionJoinButton';
import './MentoringVideoSessionReminder.css';

const MAX_TIMEOUT = 2_147_483_647;

function isVideoSession(session: MentoringSession) {
  return session.deliveryMode === 'ONLINE' || session.deliveryMode === 'HYBRID';
}

function formatStartTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Scheduled time unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function MentoringVideoSessionReminder({ userId }: { userId: number }) {
  const [now, setNow] = useState(() => Date.now());
  const [dismissedSessionIds, setDismissedSessionIds] = useState<Set<number>>(() => new Set());
  const [reminderSessions, setReminderSessions] = useState<Map<number, MentoringSession>>(
    () => new Map()
  );
  const [selectedSession, setSelectedSession] = useState<MentoringSession | null>(null);
  const [errorReported, setErrorReported] = useState(false);
  const { pushToast } = useToast();
  const sessionsQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'my-sessions', userId],
    queryFn: mentoringPairingApi.listMySessions,
    enabled: userId > 0,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (sessionsQuery.isError && !errorReported) {
      pushToast({
        title: 'Unable to check mentoring video sessions',
        message: extractApiErrorMessage(sessionsQuery.error, 'Please try again later.'),
        tone: 'err',
      });
      setErrorReported(true);
    } else if (!sessionsQuery.isError && errorReported) {
      setErrorReported(false);
    }
  }, [errorReported, pushToast, sessionsQuery.error, sessionsQuery.isError]);

  useEffect(() => {
    const sessions = sessionsQuery.data;
    const upcomingStarts = (sessions ?? [])
      .filter((session) =>
        session.status === 'CONFIRMED'
        && isVideoSession(session)
        && Number.isFinite(new Date(session.scheduledStart).getTime())
        && new Date(session.scheduledStart).getTime() > now
      )
      .map((session) => new Date(session.scheduledStart).getTime());
    const upcomingEnds = [...reminderSessions.values()]
      .map((session) => new Date(session.scheduledEnd).getTime())
      .filter((end) => Number.isFinite(end) && end > now);
    const nextBoundary = [...upcomingStarts, ...upcomingEnds]
      .reduce((earliest, boundary) => Math.min(earliest, boundary), Number.POSITIVE_INFINITY);

    if (!Number.isFinite(nextBoundary)) return;
    const timeout = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(Math.max(0, nextBoundary - Date.now() + 50), MAX_TIMEOUT)
    );
    return () => window.clearTimeout(timeout);
  }, [now, reminderSessions, sessionsQuery.data]);

  useEffect(() => {
    const sessions = sessionsQuery.data;
    if (!sessions) return;

    setReminderSessions((current) => {
      let changed = false;
      const next = new Map(current);

      sessions.forEach((session) => {
        if (current.has(session.id)) {
          if (current.get(session.id) !== session) {
            next.set(session.id, session);
            changed = true;
          }
          return;
        }

        const start = new Date(session.scheduledStart).getTime();
        if (
          !dismissedSessionIds.has(session.id)
          && session.status === 'CONFIRMED'
          && isVideoSession(session)
          && Number.isFinite(start)
          && start <= now
        ) {
          next.set(session.id, session);
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [dismissedSessionIds, now, sessionsQuery.data]);

  const reminders = [...reminderSessions.values()]
    .filter((session) => !dismissedSessionIds.has(session.id))
    .sort((left, right) =>
      new Date(left.scheduledStart).getTime() - new Date(right.scheduledStart).getTime()
    );

  const dismiss = (sessionId: number) => {
    setDismissedSessionIds((current) => new Set(current).add(sessionId));
    setReminderSessions((current) => {
      const next = new Map(current);
      next.delete(sessionId);
      return next;
    });
  };

  return (
    <>
      {reminders.length > 0 && (
        <aside className="mentoring-video-reminder-stack" aria-label="Video session reminders" aria-live="polite">
          {reminders.map((session) => {
            const hasEnded = now >= new Date(session.scheduledEnd).getTime();
            return (
              <section key={session.id} className="mentoring-video-reminder">
                <div className="mentoring-video-reminder-icon" aria-hidden="true">
                  <Video size={18} />
                </div>
                <div className="mentoring-video-reminder-content">
                  <p className="mentoring-video-reminder-kicker">
                    {session.status === 'CANCELLED' || session.status === 'DECLINED'
                      ? 'Session is no longer available'
                      : hasEnded
                        ? 'Session time has ended'
                        : 'Your video session is ready'}
                  </p>
                  <h2 title={session.title}>{session.title}</h2>
                  <p className="mentoring-video-reminder-time">
                    <Clock size={14} /> {formatStartTime(session.scheduledStart)}
                  </p>
                  {session.status === 'CONFIRMED' && (
                    <MentoringSessionJoinButton
                      session={session}
                      onJoin={() => setSelectedSession(session)}
                    />
                  )}
                </div>
                <button
                  type="button"
                  className="mentoring-video-reminder-dismiss"
                  onClick={() => dismiss(session.id)}
                  aria-label={`Dismiss reminder for ${session.title}`}
                  title="Dismiss reminder"
                >
                  <X size={16} />
                </button>
              </section>
            );
          })}
        </aside>
      )}
      {selectedSession && (
        <MentoringDailyVideoModal
          session={selectedSession}
          isOpen
          onClose={() => setSelectedSession(null)}
          relationshipId={selectedSession.relationshipId}
        />
      )}
    </>
  );
}
