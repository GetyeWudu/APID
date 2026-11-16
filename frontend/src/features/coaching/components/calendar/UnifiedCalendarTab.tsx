import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Video,
  Filter,
  Loader2,
} from 'lucide-react';
import {
  scheduleCalendarApi,
  ScheduleEventDto,
  ScheduleParticipationRole,
} from '../../../scheduling/api/scheduleCalendarApi';
import { toEthiopianTime } from '../../utils/ethiopianTimeUtils';

export const UnifiedCalendarTab: React.FC = () => {
  // Navigation: state is Monday of current view week
  const [currentWeekMonday, setCurrentWeekMonday] = useState<Date>(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const [roleFilter, setRoleFilter] = useState<'ALL' | ScheduleParticipationRole>('ALL');
  const [moduleFilter, setModuleFilter] = useState<'ALL' | 'COACHING' | 'MENTORING'>('ALL');

  // Calculate week range (Monday to Sunday)
  const currentWeekSunday = useMemo(() => {
    const sun = new Date(currentWeekMonday);
    sun.setDate(sun.getDate() + 6);
    sun.setHours(23, 59, 59, 999);
    return sun;
  }, [currentWeekMonday]);

  // Query events in range
  const { data: events = [], isLoading } = useQuery<ScheduleEventDto[]>({
    queryKey: [
      'schedule',
      'my-calendar',
      currentWeekMonday.toISOString(),
      currentWeekSunday.toISOString(),
    ],
    queryFn: () =>
      scheduleCalendarApi.getMyCalendar({
        from: currentWeekMonday.toISOString(),
        to: currentWeekSunday.toISOString(),
      }),
  });

  const handlePrevWeek = () => {
    const prev = new Date(currentWeekMonday);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekMonday(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentWeekMonday);
    next.setDate(next.getDate() + 7);
    setCurrentWeekMonday(next);
  };

  const handleCurrentWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekMonday(monday);
  };

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((ev: ScheduleEventDto) => {
      if (roleFilter !== 'ALL' && ev.myRole !== roleFilter) return false;
      if (moduleFilter !== 'ALL' && ev.sourceModule !== moduleFilter) return false;
      return true;
    });
  }, [events, roleFilter, moduleFilter]);

  // Generate 7 days of current week
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekMonday);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentWeekMonday]);

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const formatEATTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Africa/Addis_Ababa',
      }).format(d);
    } catch {
      return '';
    }
  };

  const getRoleBadge = (role?: ScheduleParticipationRole) => {
    switch (role) {
      case 'COACH':
        return (
          <span
            className="boa-pill"
            style={{
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#d97706',
              fontSize: '0.68rem',
              fontWeight: 700,
            }}
          >
            Coach
          </span>
        );
      case 'TALENT':
        return (
          <span
            className="boa-pill"
            style={{
              background: 'rgba(2, 132, 199, 0.12)',
              color: '#0284c7',
              fontSize: '0.68rem',
              fontWeight: 700,
            }}
          >
            Talent
          </span>
        );
      case 'MENTOR':
        return (
          <span
            className="boa-pill"
            style={{
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#059669',
              fontSize: '0.68rem',
              fontWeight: 700,
            }}
          >
            Mentor
          </span>
        );
      case 'MENTEE':
        return (
          <span
            className="boa-pill"
            style={{
              background: 'rgba(139, 92, 246, 0.12)',
              color: '#7c3aed',
              fontSize: '0.68rem',
              fontWeight: 700,
            }}
          >
            Mentee
          </span>
        );
      default:
        return null;
    }
  };

  const getModuleBadge = (module: string) => {
    return (
      <span
        style={{
          fontSize: '0.65rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: module === 'COACHING' ? '#b45309' : '#047857',
        }}
      >
        {module}
      </span>
    );
  };

  return (
    <div className="boa-stack" style={{ gap: '1.25rem' }}>
      {/* Header & Controls Bar */}
      <div
        className="apid-card"
        style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <CalendarIcon size={20} style={{ color: 'var(--gold-primary, #f59e0b)' }} />
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>
              Unified Weekly Schedule
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted, #64748b)' }}>
            Consolidated timeline across Coaching &amp; Mentoring modules • <strong>Africa/Addis_Ababa (UTC+3)</strong>
          </p>
        </div>

        {/* Week Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className="apid-btn apid-btn-outline apid-btn-sm"
            onClick={handlePrevWeek}
            title="Previous Week"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="apid-btn apid-btn-outline apid-btn-sm"
            onClick={handleCurrentWeek}
          >
            This Week
          </button>
          <button
            type="button"
            className="apid-btn apid-btn-outline apid-btn-sm"
            onClick={handleNextWeek}
            title="Next Week"
          >
            <ChevronRight size={16} />
          </button>

          <span
            style={{
              marginLeft: '0.5rem',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: 'var(--text, #1e293b)',
            }}
          >
            {currentWeekMonday.toLocaleDateString([], { month: 'short', day: 'numeric' })} –{' '}
            {currentWeekSunday.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Filter size={14} /> Filter Role:
        </span>
        {(['ALL', 'COACH', 'TALENT', 'MENTOR', 'MENTEE'] as const).map((r) => {
          const isActive = roleFilter === r;
          const label =
            r === 'ALL'
              ? 'All Roles'
              : r === 'COACH'
              ? '🟡 As Coach'
              : r === 'TALENT'
              ? '🔵 As Talent'
              : r === 'MENTOR'
              ? '🟢 As Mentor'
              : '🟣 As Mentee';
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: isActive ? 700 : 500,
                border: isActive ? '1px solid var(--gold-primary, #f59e0b)' : '1px solid var(--border, #cbd5e1)',
                background: isActive ? 'rgba(245, 158, 11, 0.12)' : 'var(--surface, #ffffff)',
                color: isActive ? 'var(--gold-dark, #b45309)' : 'var(--text, #475569)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          );
        })}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem' }}>
          {(['ALL', 'COACHING', 'MENTORING'] as const).map((m) => {
            const isActive = moduleFilter === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setModuleFilter(m)}
                style={{
                  padding: '0.25rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: isActive ? 700 : 500,
                  border: isActive ? '1px solid #0284c7' : '1px solid var(--border, #cbd5e1)',
                  background: isActive ? 'rgba(2, 132, 199, 0.12)' : 'transparent',
                  color: isActive ? '#0284c7' : 'var(--muted, #64748b)',
                  cursor: 'pointer',
                }}
              >
                {m === 'ALL' ? 'All Modules' : m}
              </button>
            );
          })}
        </div>
      </div>

      {/* Calendar 7-Day Grid */}
      {isLoading ? (
        <div className="apid-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <Loader2 className="apid-spin" size={28} style={{ margin: '0 auto 0.5rem', color: 'var(--gold-primary)' }} />
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>Loading schedule reservations...</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '0.75rem',
            alignItems: 'start',
          }}
        >
          {weekDays.map((dayDate) => {
            const dayKey = dayDate.toISOString().split('T')[0];
            const isCurrent = isToday(dayDate);

            // Find events matching this day in Ethiopian local time
            const dayEvents = filteredEvents.filter((ev: ScheduleEventDto) => {
              const evDateEAT = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Africa/Addis_Ababa',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              }).format(new Date(ev.startAt));
              return evDateEAT === dayKey;
            });

            return (
              <div
                key={dayKey}
                className="apid-card"
                style={{
                  padding: '0.75rem',
                  minHeight: '260px',
                  background: isCurrent ? 'rgba(245, 158, 11, 0.04)' : 'var(--surface, #ffffff)',
                  border: isCurrent ? '2px solid var(--gold-primary, #f59e0b)' : '1px solid var(--border, #e2e8f0)',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {/* Day Header */}
                <div
                  style={{
                    borderBottom: '1px solid var(--border, #e2e8f0)',
                    paddingBottom: '0.4rem',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted, #64748b)', textTransform: 'uppercase' }}>
                    {dayDate.toLocaleDateString([], { weekday: 'short' })}
                  </div>
                  <div
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      color: isCurrent ? 'var(--gold-primary, #d97706)' : 'var(--text, #0f172a)',
                    }}
                  >
                    {dayDate.getDate()}
                  </div>
                </div>

                {/* Event Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  {dayEvents.length === 0 ? (
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--muted, #cbd5e1)',
                        fontSize: '0.75rem',
                      }}
                    >
                      No sessions
                    </div>
                  ) : (
                    dayEvents.map((ev: ScheduleEventDto) => (
                      <div
                        key={ev.id}
                        style={{
                          padding: '0.65rem',
                          borderRadius: '8px',
                          background: 'var(--surface-subtle, #f8fafc)',
                          border: '1px solid var(--border, #e2e8f0)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          {getModuleBadge(ev.sourceModule)}
                          {getRoleBadge(ev.myRole)}
                        </div>

                        <div
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: 'var(--text, #0f172a)',
                            lineHeight: 1.25,
                            marginBottom: '0.35rem',
                          }}
                        >
                          {ev.title}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.74rem',
                            color: 'var(--muted, #475569)',
                            marginBottom: '0.35rem',
                          }}
                        >
                          <Clock size={13} style={{ color: 'var(--gold-primary)' }} />
                          <span>
                            {toEthiopianTime(ev.startAt).periodAmharic} {toEthiopianTime(ev.startAt).ethiopianHour.toString().padStart(2, '0')}:{toEthiopianTime(ev.startAt).minute.toString().padStart(2, '0')} ({formatEATTime(ev.startAt)} EAT)
                          </span>
                        </div>

                        {/* Meeting mode / action */}
                        {ev.meetingMode === 'VIRTUAL_VIDEO' && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontSize: '0.72rem',
                              color: '#0284c7',
                              fontWeight: 600,
                            }}
                          >
                            <Video size={13} />
                            <span>Video Room</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
