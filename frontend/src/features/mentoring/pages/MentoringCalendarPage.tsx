import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../../../app/AuthContext';
import { extractApiErrorMessage } from '../../../shared/api/apiClient';
import { ErrorState, LoadingSkeleton, PageHeader, useToast } from '../../../shared/components/ui';
import {
  mentoringPairingApi,
  type MentoringDeliveryMode,
  type MentoringRelationshipPair,
  type MentoringSession,
} from '../api/mentoringPairingApi';
import { BANK_OPERATING_TIME_OPTIONS } from '../../coaching/utils/ethiopianTimeUtils';
import './MentoringCalendarPage.css';

type CalendarMonth = { year: number; month: number };

function getEatDateParts(value: string | Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value instanceof Date ? value : new Date(value));

  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value),
  };
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function eatDateKey(value: string) {
  const parts = getEatDateParts(value);
  return dateKey(parts.year, parts.month, parts.day);
}

function getCalendarCells({ year, month }: CalendarMonth) {
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cellCount = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, index - firstDay + 1));
    const cellYear = date.getUTCFullYear();
    const cellMonth = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    return {
      year: cellYear,
      month: cellMonth,
      day,
      key: dateKey(cellYear, cellMonth, day),
      inCurrentMonth: cellYear === year && cellMonth === month,
    };
  });
}

function buildEatIsoString(date: string, time: string, durationMinutes: number) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 3, minute + durationMinutes)).toISOString();
}

function formatMonth(month: CalendarMonth) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(month.year, month.month - 1, 1)));
}

function formatCalendarDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function formatSessionTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Africa/Addis_Ababa',
  }).format(new Date(value));
}

function sessionStatusClass(status: MentoringSession['status']) {
  if (status === 'COMPLETED') return 'completed';
  if (status === 'CANCELLED' || status === 'DECLINED' || status === 'MISSED') return 'cancelled';
  if (status === 'PENDING' || status === 'RESCHEDULE_PROPOSED') return 'pending';
  return 'scheduled';
}

export function MentoringCalendarPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const today = getEatDateParts(new Date());
  const todayKey = dateKey(today.year, today.month, today.day);
  const [calendarMonth, setCalendarMonth] = useState<CalendarMonth>({
    year: today.year,
    month: today.month,
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState('');
  const [createTime, setCreateTime] = useState('09:00');
  const [createDuration, setCreateDuration] = useState(45);
  const [createTitle, setCreateTitle] = useState('');
  const [createAgenda, setCreateAgenda] = useState('');
  const [createDeliveryMode, setCreateDeliveryMode] = useState<MentoringDeliveryMode>('ONLINE');
  const [createMeetingUrl, setCreateMeetingUrl] = useState('');
  const [createLocation, setCreateLocation] = useState('');

  const relationshipsQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'relationships', user?.id],
    queryFn: mentoringPairingApi.listMyRelationships,
    enabled: Boolean(user?.id),
  });
  const sessionsQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'my-sessions', user?.id],
    queryFn: mentoringPairingApi.listMySessions,
    enabled: Boolean(user?.id),
  });

  const activeMentorRelationships = useMemo(() => {
    const uniqueRelationships = new Map<number, MentoringRelationshipPair>();
    (relationshipsQuery.data ?? []).forEach((relationship) => {
      if (
        relationship.currentUserRole === 'MENTOR'
        && relationship.relationshipStatus === 'ACTIVE'
        && relationship.memberStatus === 'ACTIVE'
      ) {
        uniqueRelationships.set(relationship.relationshipId, relationship);
      }
    });
    return [...uniqueRelationships.values()];
  }, [relationshipsQuery.data]);

  const canCreateSession = activeMentorRelationships.length > 0
    || (user?.roles.some((role) => role.trim().toLowerCase() === 'mentor') ?? false);

  const sessionsByDate = useMemo(() => {
    const byDate = new Map<string, MentoringSession[]>();
    (sessionsQuery.data ?? []).forEach((session) => {
      const key = eatDateKey(session.scheduledStart);
      const sessions = byDate.get(key) ?? [];
      sessions.push(session);
      byDate.set(key, sessions);
    });
    byDate.forEach((sessions) => {
      sessions.sort((first, second) =>
        first.scheduledStart.localeCompare(second.scheduledStart)
      );
    });
    return byDate;
  }, [sessionsQuery.data]);

  const createSessionMutation = useMutation({
    mutationFn: (input: {
      relationshipId: number;
      title: string;
      agenda?: string;
      scheduledStart: string;
      scheduledEnd: string;
      deliveryMode: MentoringDeliveryMode;
      meetingUrl?: string;
      location?: string;
    }) => {
      const { relationshipId, ...sessionInput } = input;
      return mentoringPairingApi.createSession(relationshipId, sessionInput);
    },
    onSuccess: async () => {
      setSelectedDate(null);
      setCreateTitle('');
      setCreateAgenda('');
      setCreateMeetingUrl('');
      setCreateLocation('');
      await queryClient.invalidateQueries({
        queryKey: ['mentoring', 'pairing', 'my-sessions', user?.id],
      });
      pushToast({
        title: 'Session invitation sent',
        message: 'Your mentee(s) must accept the proposed session schedule.',
        tone: 'ok',
      });
    },
    onError: (error: unknown) => {
      pushToast({
        title: 'Unable to schedule session',
        message: extractApiErrorMessage(error, 'A scheduling conflict or policy restriction prevented booking.'),
        tone: 'err',
      });
    },
  });

  const openDay = (key: string, year: number, month: number) => {
    setCalendarMonth({ year, month });
    setSelectedDate(key);
    setSelectedRelationshipId(
      activeMentorRelationships.length === 1
        ? String(activeMentorRelationships[0].relationshipId)
        : ''
    );
    setCreateTime('09:00');
    setCreateDuration(45);
    setCreateTitle('');
    setCreateAgenda('');
    setCreateDeliveryMode('ONLINE');
    setCreateMeetingUrl('');
    setCreateLocation('');
    createSessionMutation.reset();
  };

  const shiftMonth = (amount: number) => {
    const nextMonth = new Date(Date.UTC(calendarMonth.year, calendarMonth.month - 1 + amount, 1));
    setCalendarMonth({
      year: nextMonth.getUTCFullYear(),
      month: nextMonth.getUTCMonth() + 1,
    });
  };

  const handleCreateSession = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedDate || !selectedRelationshipId || !createTitle.trim()) {
      pushToast({
        title: 'Required information missing',
        message: 'Select an active mentoring pairing and enter a session title.',
        tone: 'err',
      });
      return;
    }

    if (new Date(`${selectedDate}T00:00:00Z`).getUTCDay() === 0) {
      pushToast({
        title: 'Sunday scheduling unavailable',
        message: 'Bank policy does not allow mentoring sessions on Sundays.',
        tone: 'err',
      });
      return;
    }

    const scheduledStart = buildEatIsoString(selectedDate, createTime, 0);
    const scheduledEnd = buildEatIsoString(selectedDate, createTime, createDuration);
    if (new Date(scheduledStart).getTime() <= Date.now()) {
      pushToast({
        title: 'Choose a future time',
        message: 'Mentoring sessions must be scheduled for a future time slot.',
        tone: 'err',
      });
      return;
    }

    createSessionMutation.mutate({
      relationshipId: Number(selectedRelationshipId),
      title: createTitle.trim(),
      agenda: createAgenda.trim() || undefined,
      scheduledStart,
      scheduledEnd,
      deliveryMode: createDeliveryMode,
      meetingUrl: createDeliveryMode === 'IN_PERSON' ? undefined : createMeetingUrl.trim() || undefined,
      location: createDeliveryMode === 'IN_PERSON' ? createLocation.trim() || undefined : undefined,
    });
  };

  if (relationshipsQuery.isLoading || sessionsQuery.isLoading) {
    return <LoadingSkeleton rows={6} height={28} />;
  }
  if (relationshipsQuery.isError || sessionsQuery.isError) {
    return (
      <ErrorState
        message="Unable to load your mentoring calendar."
        onRetry={() => {
          void relationshipsQuery.refetch();
          void sessionsQuery.refetch();
        }}
      />
    );
  }

  const calendarCells = getCalendarCells(calendarMonth);
  const selectedDaySessions = selectedDate ? sessionsByDate.get(selectedDate) ?? [] : [];

  return (
    <div className="boa-stack mentoring-dashboard mentoring-calendar">
      <PageHeader
        title="Mentoring Calendar"
        subtitle="View your planned mentoring sessions."
        source="live"
      />
      <section className="apid-card mentoring-calendar__card">
        <div className="mentoring-calendar__toolbar">
          <div className="mentoring-calendar__month-controls">
            <button type="button" className="mentoring-calendar__icon-button" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={18} />
            </button>
            <h2 aria-live="polite">{formatMonth(calendarMonth)}</h2>
            <button type="button" className="mentoring-calendar__icon-button" aria-label="Next month" onClick={() => shiftMonth(1)}>
              <ChevronRight size={18} />
            </button>
            <button
              type="button"
              className="apid-btn apid-btn-primary apid-btn-sm"
              onClick={() => setCalendarMonth({ year: today.year, month: today.month })}
            >
              Today
            </button>
          </div>
          <div className="mentoring-calendar__summary">
            <span>
              {sessionsQuery.data?.length ?? 0} session{sessionsQuery.data?.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              className="mentoring-calendar__icon-button"
              aria-label="Refresh calendar"
              onClick={() => void sessionsQuery.refetch()}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <div className="mentoring-calendar__legend" aria-label="Session status legend">
          <span>Status:</span>
          <span><i className="mentoring-calendar__dot mentoring-calendar__dot--scheduled" /> Scheduled</span>
          <span><i className="mentoring-calendar__dot mentoring-calendar__dot--completed" /> Completed</span>
          <span><i className="mentoring-calendar__dot mentoring-calendar__dot--cancelled" /> Cancelled</span>
        </div>

        <div className="mentoring-calendar__grid" aria-label="Monthly mentoring calendar">
          <div className="mentoring-calendar__weekdays">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="mentoring-calendar__days">
            {calendarCells.map((cell) => {
              const daySessions = sessionsByDate.get(cell.key) ?? [];
              const isToday = cell.key === todayKey;
              return (
                <button
                  type="button"
                  key={cell.key}
                  className={[
                    'mentoring-calendar__day',
                    cell.inCurrentMonth ? '' : 'mentoring-calendar__day--outside',
                    isToday ? 'mentoring-calendar__day--today' : '',
                  ].filter(Boolean).join(' ')}
                  aria-label={`${formatCalendarDate(cell.key)}${daySessions.length ? `, ${daySessions.length} session${daySessions.length === 1 ? '' : 's'}` : ''}`}
                  onClick={() => openDay(cell.key, cell.year, cell.month)}
                >
                  <span className="mentoring-calendar__day-number">{cell.day}</span>
                  <span className="mentoring-calendar__day-sessions">
                    {daySessions.slice(0, 3).map((session) => (
                      <span
                        key={session.id}
                        className={`mentoring-calendar__event mentoring-calendar__event--${sessionStatusClass(session.status)}`}
                        title={`${formatSessionTime(session.scheduledStart)} · ${session.title}`}
                      >
                        <time>{formatSessionTime(session.scheduledStart)}</time>
                        <span>{session.title}</span>
                      </span>
                    ))}
                    {daySessions.length > 3 && (
                      <span className="mentoring-calendar__more">+{daySessions.length - 3} more</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {selectedDate && (
        <div
          className="mentoring-calendar__overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedDate(null);
          }}
        >
          <section
            className="mentoring-calendar__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mentoring-calendar-dialog-title"
          >
            <header className="mentoring-calendar__modal-header">
              <div>
                <span className="mentoring-calendar__eyebrow">Calendar day</span>
                <h2 id="mentoring-calendar-dialog-title">{formatCalendarDate(selectedDate)}</h2>
              </div>
              <button
                type="button"
                className="mentoring-calendar__icon-button"
                aria-label="Close day details"
                onClick={() => setSelectedDate(null)}
              >
                <X size={18} />
              </button>
            </header>

            <div className="mentoring-calendar__day-details">
              <h3>Planned sessions</h3>
              {selectedDaySessions.length === 0 ? (
                <p className="boa-muted">No sessions are planned for this day.</p>
              ) : (
                <div className="mentoring-calendar__session-list">
                  {selectedDaySessions.map((session) => (
                    <article key={session.id} className="mentoring-calendar__session">
                      <div>
                        <strong>{session.title}</strong>
                        <span>
                          <Clock size={14} /> {formatSessionTime(session.scheduledStart)}
                          {' – '}{formatSessionTime(session.scheduledEnd)}
                        </span>
                        {session.location && (
                          <span><MapPin size={14} /> {session.location}</span>
                        )}
                      </div>
                      <span className={`mentoring-calendar__status mentoring-calendar__status--${sessionStatusClass(session.status)}`}>
                        {session.status.replace(/_/g, ' ')}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </div>

            {canCreateSession ? (
              activeMentorRelationships.length === 0 ? (
                <p className="mentoring-calendar__notice">
                  You need an active mentoring pairing before you can schedule a session.
                </p>
              ) : (
                <form className="mentoring-calendar__form" onSubmit={handleCreateSession}>
                  <div className="mentoring-calendar__form-heading">
                    <CalendarDays size={18} aria-hidden="true" />
                    <div>
                      <h3>Schedule a session</h3>
                      <p>Participants will receive an invitation to accept the proposed schedule.</p>
                    </div>
                  </div>

                  <label>
                    Mentoring pairing
                    <select
                      className="apid-input"
                      value={selectedRelationshipId}
                      onChange={(event) => setSelectedRelationshipId(event.target.value)}
                      required
                    >
                      <option value="">Select an active pairing</option>
                      {activeMentorRelationships.map((relationship) => (
                        <option key={relationship.relationshipId} value={relationship.relationshipId}>
                          {relationship.requestType === 'GROUP' ? 'Group cohort' : relationship.traineeName}
                          {relationship.skillName ? ` · ${relationship.skillName}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Session title
                    <input
                      className="apid-input"
                      value={createTitle}
                      onChange={(event) => setCreateTitle(event.target.value)}
                      placeholder="e.g. Career development check-in"
                      maxLength={180}
                      required
                    />
                  </label>

                  <div className="mentoring-calendar__form-row">
                    <label>
                      Start time (EAT)
                      <select className="apid-input" value={createTime} onChange={(event) => setCreateTime(event.target.value)}>
                        {BANK_OPERATING_TIME_OPTIONS.map((option) => (
                          <option key={option.timeValue24} value={option.timeValue24}>{option.labelDual}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Duration
                      <select
                        className="apid-input"
                        value={createDuration}
                        onChange={(event) => setCreateDuration(Number(event.target.value))}
                      >
                        <option value={30}>30 minutes</option>
                        <option value={45}>45 minutes</option>
                        <option value={60}>60 minutes</option>
                        <option value={90}>90 minutes</option>
                      </select>
                    </label>
                  </div>

                  <label>
                    Delivery mode
                    <select
                      className="apid-input"
                      value={createDeliveryMode}
                      onChange={(event) => setCreateDeliveryMode(event.target.value as MentoringDeliveryMode)}
                    >
                      <option value="ONLINE">Online video call</option>
                      <option value="IN_PERSON">In person</option>
                      <option value="HYBRID">Hybrid</option>
                    </select>
                  </label>

                  {createDeliveryMode === 'IN_PERSON' ? (
                    <label>
                      Branch / room location
                      <input
                        className="apid-input"
                        value={createLocation}
                        onChange={(event) => setCreateLocation(event.target.value)}
                        placeholder="Branch or meeting room"
                      />
                    </label>
                  ) : (
                    <label>
                      Meeting link (optional)
                      <input
                        type="url"
                        className="apid-input"
                        value={createMeetingUrl}
                        onChange={(event) => setCreateMeetingUrl(event.target.value)}
                        placeholder="Leave empty to create a secure video room"
                      />
                    </label>
                  )}

                  <label>
                    Agenda (optional)
                    <textarea
                      className="apid-input"
                      rows={3}
                      value={createAgenda}
                      onChange={(event) => setCreateAgenda(event.target.value)}
                      maxLength={2000}
                      placeholder="Topics or learning goals for the session"
                    />
                  </label>

                  {createSessionMutation.isError && (
                    <p className="mentoring-calendar__error" role="alert">
                      {extractApiErrorMessage(
                        createSessionMutation.error,
                        'A scheduling conflict or policy restriction prevented booking.'
                      )}
                    </p>
                  )}

                  <footer className="mentoring-calendar__modal-actions">
                    <button
                      type="button"
                      className="apid-btn apid-btn-outline apid-btn-sm"
                      onClick={() => setSelectedDate(null)}
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      className="apid-btn apid-btn-primary apid-btn-sm"
                      disabled={createSessionMutation.isPending}
                    >
                      <CalendarDays size={15} />
                      {createSessionMutation.isPending ? 'Scheduling…' : 'Schedule session'}
                    </button>
                  </footer>
                </form>
              )
            ) : (
              <p className="mentoring-calendar__notice">
                You can view your planned sessions here. Only mentors can schedule sessions.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
