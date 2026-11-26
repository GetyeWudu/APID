import { useEffect, useRef, useState } from 'react';
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

function getReminderKey(session: MentoringSession) {
  return `${session.id}:${new Date(session.scheduledStart).getTime()}`;
}

function getDismissalStorageKey(userId: number, session: MentoringSession) {
  return `mentoring-video-session-reminder-dismissed:${userId}:${getReminderKey(session)}`;
}

function formatStartTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Scheduled time unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function MentoringVideoSessionReminder({ userId }: { userId: number }) {
  const [now, setNow] = useState(() => Date.now());
  const [dismissedReminderKeys, setDismissedReminderKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [reminderSessions, setReminderSessions] = useState<Map<number, MentoringSession>>(
    () => new Map()
  );
  const [selectedSession, setSelectedSession] = useState<MentoringSession | null>(null);
  const [errorReported, setErrorReported] = useState(false);
  const storageErrorReported = useRef(false);
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
        (session.status === 'SCHEDULED' || session.status === 'CONFIRMED')
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

    const reminderCandidates = new Map<number, MentoringSession>();
    let storageReadFailed = false;
    sessions.forEach((session) => {
      const start = new Date(session.scheduledStart).getTime();
      if (
        (session.status !== 'SCHEDULED' && session.status !== 'CONFIRMED')
        || !isVideoSession(session)
        || !Number.isFinite(start)
        || start > now
      ) {
        return;
      }

      const reminderKey = getReminderKey(session);
      let dismissed = dismissedReminderKeys.has(reminderKey);
      if (!dismissed) {
        try {
          dismissed = window.localStorage.getItem(
            getDismissalStorageKey(userId, session)
          ) === 'true';
        } catch {
          storageReadFailed = true;
        }
      }

      if (!dismissed) reminderCandidates.set(session.id, session);
    });

    setReminderSessions((current) => {
      let changed = false;
      const next = new Map(current);
      sessions.forEach((session) => {
        if (current.has(session.id)) {
          if (current.get(session.id) !== session) {
            next.set(session.id, session);
            changed = true;
          }
        } else if (reminderCandidates.has(session.id)) {
          next.set(session.id, session);
          changed = true;
        }
      });
      return changed ? next : current;
    });

    if (storageReadFailed && !storageErrorReported.current) {
      storageErrorReported.current = true;
      pushToast({
        title: 'Unable to load video reminder preferences',
        message: 'A dismissed reminder may appear again after reloading.',
        tone: 'err',
      });
    }
  }, [dismissedReminderKeys, now, pushToast, sessionsQuery.data, userId]);

  const reminders = [...reminderSessions.values()]
    .filter((session) => !dismissedReminderKeys.has(getReminderKey(session)))
    .sort((left, right) =>
      new Date(left.scheduledStart).getTime() - new Date(right.scheduledStart).getTime()
    );

  const dismiss = (session: MentoringSession) => {
    const reminderKey = getReminderKey(session);
    setDismissedReminderKeys((current) => new Set(current).add(reminderKey));
    try {
      window.localStorage.setItem(getDismissalStorageKey(userId, session), 'true');
    } catch {
      if (!storageErrorReported.current) {
        storageErrorReported.current = true;
        pushToast({
          title: 'Unable to save reminder dismissal',
          message: 'This reminder may appear again after reloading.',
          tone: 'err',
        });
      }
    }

    setReminderSessions((current) => {
      const next = new Map(current);
      next.delete(session.id);
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
                  {(session.status === 'SCHEDULED' || session.status === 'CONFIRMED') && (
                    <MentoringSessionJoinButton
                      session={session}
                      onJoin={() => setSelectedSession(session)}
                    />
                  )}
                </div>
                <button
                  type="button"
                  className="mentoring-video-reminder-dismiss"
                  onClick={() => dismiss(session)}
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
