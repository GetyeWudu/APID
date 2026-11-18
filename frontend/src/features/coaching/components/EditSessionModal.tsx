import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Clock,
  AlertCircle,
  MapPin,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import {
  CoachingSessionItem,
  SessionMeetingMode,
  coachingSessionApi,
  UpdateSessionPayload,
} from '../api/coachingSessionApi';
import {
  BANK_OPERATING_TIME_OPTIONS,
  toEthiopianTime,
} from '../utils/ethiopianTimeUtils';

interface EditSessionModalProps {
  session: CoachingSessionItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  publicConfig?: {
    coachingRescheduleScope?: string;
    coachingMinRescheduleNoticeHours?: number;
    coachingMaxReschedulesPerSession?: number;
    coachingAllowSaturdayScheduling?: boolean;
  };
  activeQuarter?: {
    startDate?: string;
    endDate?: string;
    label?: string;
  };
}

export const EditSessionModal: React.FC<EditSessionModalProps> = ({
  session,
  isOpen,
  onClose,
  onSuccess,
  publicConfig,
  activeQuarter,
}) => {
  if (!isOpen || !session) return null;

  // Policies from Admin config
  const rescheduleScope = publicConfig?.coachingRescheduleScope || 'SAME_WEEK';
  const minNoticeHours = publicConfig?.coachingMinRescheduleNoticeHours ?? 4;
  const maxReschedules = publicConfig?.coachingMaxReschedulesPerSession ?? 2;
  const allowSaturday = publicConfig?.coachingAllowSaturdayScheduling ?? true;

  const rescheduleCount = session.rescheduleCount ?? 0;
  const isRescheduleLimitReached = rescheduleCount >= maxReschedules;

  // Current session timing parts
  const currentStart = useMemo(() => new Date(session.scheduledStartTime), [session.scheduledStartTime]);

  // Form State
  const [title, setTitle] = useState(session.title || '');
  const [meetingMode, setMeetingMode] = useState<SessionMeetingMode>(session.meetingMode || 'VIRTUAL_VIDEO');
  const [meetingLocation, setMeetingLocation] = useState(session.meetingLocation || '');
  const [sessionDate, setSessionDate] = useState('');
  const [selectedTime24, setSelectedTime24] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(session.durationMinutes || 45);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize date & time from session
  useEffect(() => {
    if (session) {
      setTitle(session.title || '');
      setMeetingMode(session.meetingMode || 'VIRTUAL_VIDEO');
      setMeetingLocation(session.meetingLocation || '');
      setDurationMinutes(session.durationMinutes || 45);
      setReason('');
      setError(null);

      // Convert UTC to East Africa Time (UTC+3) for input
      const eatDate = new Date(session.scheduledStartTime);
      const eatHours = (eatDate.getUTCHours() + 3) % 24;
      const eatMinutes = eatDate.getUTCMinutes();
      const pad = (n: number) => n.toString().padStart(2, '0');

      // Date string YYYY-MM-DD
      const year = eatDate.getUTCFullYear();
      const month = pad(eatDate.getUTCMonth() + 1);
      const day = pad(eatDate.getUTCDate());
      setSessionDate(`${year}-${month}-${day}`);

      const timeVal = `${pad(eatHours)}:${pad(eatMinutes)}`;
      // Find matching standard option or default to closest
      const match = BANK_OPERATING_TIME_OPTIONS.find((o) => o.timeValue24 === timeVal);
      setSelectedTime24(match ? match.timeValue24 : timeVal);
    }
  }, [session]);

  // Calculate week boundary (Monday to Saturday) for current session
  const { weekMondayStr, weekSaturdayStr } = useMemo(() => {
    const d = new Date(currentStart);
    // EAT day of week (0=Sun, 1=Mon... 6=Sat)
    const dayOfWeek = d.getUTCDay();
    // Offset to Monday
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mon = new Date(d);
    mon.setUTCDate(d.getUTCDate() + diffToMon);

    const sat = new Date(mon);
    sat.setUTCDate(mon.getUTCDate() + 5);

    const pad = (n: number) => n.toString().padStart(2, '0');
    return {
      weekMondayStr: `${mon.getUTCFullYear()}-${pad(mon.getUTCMonth() + 1)}-${pad(mon.getUTCDate())}`,
      weekSaturdayStr: `${sat.getUTCFullYear()}-${pad(sat.getUTCMonth() + 1)}-${pad(sat.getUTCDate())}`,
    };
  }, [currentStart]);

  // Allowed date boundaries based on scope
  const minDate = useMemo(() => {
    if (rescheduleScope === 'SAME_DAY_ONLY') return sessionDate;
    if (rescheduleScope === 'SAME_WEEK') return weekMondayStr;
    return activeQuarter?.startDate || new Date().toISOString().split('T')[0];
  }, [rescheduleScope, sessionDate, weekMondayStr, activeQuarter]);

  const maxDate = useMemo(() => {
    if (rescheduleScope === 'SAME_DAY_ONLY') return sessionDate;
    if (rescheduleScope === 'SAME_WEEK') return weekSaturdayStr;
    return activeQuarter?.endDate || '2026-12-31';
  }, [rescheduleScope, sessionDate, weekSaturdayStr, activeQuarter]);

  // Check if date or time has been changed
  const isTimeRescheduled = useMemo(() => {
    if (!session || !sessionDate || !selectedTime24) return false;
    const pad = (n: number) => n.toString().padStart(2, '0');
    const origEatHours = (currentStart.getUTCHours() + 3) % 24;
    const origTimeStr = `${pad(origEatHours)}:${pad(currentStart.getUTCMinutes())}`;
    const origDateStr = `${currentStart.getUTCFullYear()}-${pad(currentStart.getUTCMonth() + 1)}-${pad(currentStart.getUTCDate())}`;

    return sessionDate !== origDateStr || selectedTime24 !== origTimeStr || durationMinutes !== session.durationMinutes;
  }, [session, sessionDate, selectedTime24, durationMinutes, currentStart]);

  // Check Notice Window (4 hours)
  const isNoticeViolated = useMemo(() => {
    if (!isTimeRescheduled) return false;
    const now = new Date();
    const noticeCutoff = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);
    return noticeCutoff > currentStart;
  }, [isTimeRescheduled, minNoticeHours, currentStart]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    if (!title.trim()) {
      setError('Session focus topic/title cannot be blank.');
      return;
    }

    if (isTimeRescheduled && isRescheduleLimitReached) {
      setError(`Maximum reschedule limit (${maxReschedules}) reached for this session. Schedule changes locked.`);
      return;
    }

    if (isTimeRescheduled && isNoticeViolated) {
      setError(`Cannot reschedule: Bank policy requires at least ${minNoticeHours} hours advance notice before scheduled start time.`);
      return;
    }

    // Check Sunday lockout
    if (sessionDate) {
      const selectedDayOfWeek = new Date(sessionDate + 'T12:00:00Z').getUTCDay();
      if (selectedDayOfWeek === 0) {
        setError('Sundays are strictly prohibited for coaching sessions by Bank Policy.');
        return;
      }
      if (!allowSaturday && selectedDayOfWeek === 6) {
        setError('Saturday sessions are currently disabled by Bank Coaching Policy.');
        return;
      }
    }

    if (isTimeRescheduled && !reason.trim()) {
      setError('Please provide an operational reason for rescheduling the date or time.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload: UpdateSessionPayload = {
        title: title.trim(),
        meetingMode,
        meetingLocation: meetingMode === 'IN_PERSON' ? meetingLocation.trim() : undefined,
        durationMinutes,
      };

      if (isTimeRescheduled) {
        // Construct ISO start time in UTC
        const [hStr, mStr] = selectedTime24.split(':');
        const eatH = parseInt(hStr, 10);
        const eatM = parseInt(mStr, 10);
        let utcH = eatH - 3;
        const [yStr, monStr, dStr] = sessionDate.split('-');
        let utcYear = parseInt(yStr, 10);
        let utcMonth = parseInt(monStr, 10) - 1;
        let utcDay = parseInt(dStr, 10);

        if (utcH < 0) {
          utcH += 24;
          utcDay -= 1;
        }

        const scheduledDateUtc = new Date(Date.UTC(utcYear, utcMonth, utcDay, utcH, eatM, 0));
        payload.scheduledStartTime = scheduledDateUtc.toISOString();
        payload.reason = reason.trim();
      }

      await coachingSessionApi.updateSession(session.id, payload);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update session details.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const selectedEthTime = toEthiopianTime(selectedTime24);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1.25rem',
      }}
      onClick={onClose}
    >
      <div
        className="apid-card"
        style={{
          width: '100%',
          maxWidth: '580px',
          maxHeight: '92vh',
          overflowY: 'auto',
          margin: 0,
          background: 'var(--surface, #ffffff)',
          borderRadius: '14px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border, #e2e8f0)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, rgba(202, 138, 4, 0.04) 0%, transparent 100%)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  background: 'rgba(202, 138, 4, 0.12)',
                  color: 'var(--brand-gold, #ca8a04)',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '4px',
                }}
              >
                Occurrence #{session.sequenceNumber ?? 1}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted, #64748b)' }}>
                {session.pathway === 'MANDATORY_PMS' ? 'Mandatory PMS Coaching' : 'Skill Development'}
              </span>
            </div>
            <h2
              style={{
                fontSize: '1.2rem',
                fontWeight: 700,
                margin: 0,
                color: 'var(--text-primary, #0f172a)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <Calendar size={20} style={{ color: 'var(--brand-gold, #ca8a04)' }} />
              Edit & Reschedule Session
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--muted, #64748b)' }}>
              Coachee: <strong>{session.participants?.map((p) => p.fullName).join(', ') || 'Assigned Coachee'}</strong> | Coach: {session.coachFullName || 'Designated Coach'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="apid-btn apid-btn-outline"
            style={{ padding: '0.35rem', border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Admin Policy Guidance Banner */}
        <div
          style={{
            margin: '1rem 1.5rem 0',
            padding: '0.75rem 1rem',
            background: 'rgba(202, 138, 4, 0.06)',
            border: '1px solid rgba(202, 138, 4, 0.25)',
            borderRadius: '8px',
            fontSize: '0.78rem',
            color: 'var(--text-primary, #1e293b)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: '#92400e' }}>
              <ShieldCheck size={15} />
              <span>Admin Coaching Governance & Policies</span>
            </div>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '0.15rem 0.5rem',
                borderRadius: '12px',
                background: isRescheduleLimitReached ? '#fee2e2' : '#fef3c7',
                color: isRescheduleLimitReached ? '#b91c1c' : '#92400e',
              }}
            >
              Reschedules: {rescheduleCount} / {maxReschedules} Used
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.4rem', fontSize: '0.74rem' }}>
            <div>
              <span style={{ color: 'var(--muted, #64748b)' }}>Scope: </span>
              <strong>
                {rescheduleScope === 'SAME_WEEK' && 'Same Week Only (Mon–Sat)'}
                {rescheduleScope === 'SAME_DAY_ONLY' && 'Same Day Only'}
                {rescheduleScope === 'QUARTER_FLEXIBLE' && 'Quarter Flexible (to Dec 31)'}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--muted, #64748b)' }}>Notice Window: </span>
              <strong>Min {minNoticeHours} hrs before session</strong>
            </div>
            <div>
              <span style={{ color: 'var(--muted, #64748b)' }}>Bank Work Days: </span>
              <strong>Mon–Sat ({allowSaturday ? 'Sat Open' : 'Sat Disabled'}) | No Sundays</strong>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <div
              className="apid-alert apid-alert-err"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 0.85rem',
                background: '#fef2f2',
                border: '1px solid #f87171',
                borderRadius: '6px',
                color: '#991b1b',
                fontSize: '0.82rem',
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Session Focus / Title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Session Focus Topic / Agenda <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Initial Alignment & Baseline Review"
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border, #cbd5e1)',
                fontSize: '0.88rem',
              }}
            />
          </div>

          {/* Meeting Mode & Duration */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Delivery Mode
              </label>
              <select
                value={meetingMode}
                onChange={(e) => setMeetingMode(e.target.value as SessionMeetingMode)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border, #cbd5e1)',
                  fontSize: '0.86rem',
                }}
              >
                <option value="ONLINE">📹 LiveKit Video</option>
                <option value="IN_PERSON">🏢 Branch / In Person</option>
                <option value="HYBRID">🌐 Hybrid (Video & Branch)</option>
                <option value="VIRTUAL_VIDEO">📹 Live Video (Legacy)</option>
                <option value="PHONE_CALL">📞 Phone Call</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Duration
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border, #cbd5e1)',
                  fontSize: '0.86rem',
                }}
              >
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes (Recommended)</option>
                <option value={60}>60 Minutes</option>
                <option value={90}>90 Minutes (Intensive)</option>
              </select>
            </div>
          </div>

          {(meetingMode === 'IN_PERSON' || meetingMode === 'HYBRID') && (
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Branch Meeting Room / Office Location
              </label>
              <div style={{ position: 'relative' }}>
                <MapPin size={16} style={{ position: 'absolute', left: '0.75rem', top: '0.65rem', color: '#94a3b8' }} />
                <input
                  type="text"
                  value={meetingLocation}
                  onChange={(e) => setMeetingLocation(e.target.value)}
                  placeholder="e.g. Bole Branch, Executive Conference Room"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem 0.55rem 2.25rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border, #cbd5e1)',
                    fontSize: '0.88rem',
                  }}
                />
              </div>
            </div>
          )}

          {/* Date & Ethiopian Time Section */}
          <div
            style={{
              padding: '0.85rem 1rem',
              background: 'var(--surface-subtle, #f8fafc)',
              borderRadius: '8px',
              border: '1px solid var(--border, #e2e8f0)',
              position: 'relative',
            }}
          >
            {isRescheduleLimitReached && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(255, 255, 255, 0.75)',
                  backdropFilter: 'blur(1px)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  zIndex: 2,
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  color: '#b91c1c',
                }}
              >
                <Lock size={16} />
                <span>Reschedule Limit Reached ({maxReschedules}/{maxReschedules}). Date & Time locked.</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
              {/* Date Input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Scheduled Date (Mon–Sat)
                </label>
                <input
                  type="date"
                  required
                  min={minDate}
                  max={maxDate}
                  value={sessionDate}
                  disabled={isRescheduleLimitReached || rescheduleScope === 'SAME_DAY_ONLY'}
                  onChange={(e) => setSessionDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border, #cbd5e1)',
                    fontSize: '0.86rem',
                    backgroundColor: isRescheduleLimitReached || rescheduleScope === 'SAME_DAY_ONLY' ? '#f1f5f9' : '#fff',
                  }}
                />
                <div style={{ marginTop: '0.25rem', fontSize: '0.7rem', color: 'var(--muted, #64748b)' }}>
                  {rescheduleScope === 'SAME_WEEK' && `Bounded to current bank week (${weekMondayStr} to ${weekSaturdayStr})`}
                  {rescheduleScope === 'SAME_DAY_ONLY' && 'Locked to same calendar day by policy'}
                  {rescheduleScope === 'QUARTER_FLEXIBLE' && `Available through quarter end (${activeQuarter?.endDate || 'Dec 31'})`}
                </div>
              </div>

              {/* Start Time (Ethiopian Sunrise Clock) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Start Time (የኢትዮጵያ ሰዓት / EAT)
                </label>
                <select
                  required
                  value={selectedTime24}
                  disabled={isRescheduleLimitReached}
                  onChange={(e) => setSelectedTime24(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border, #cbd5e1)',
                    fontSize: '0.86rem',
                    backgroundColor: isRescheduleLimitReached ? '#f1f5f9' : '#fff',
                  }}
                >
                  <option value="">-- Select Time --</option>
                  {BANK_OPERATING_TIME_OPTIONS.map((opt) => (
                    <option key={opt.timeValue24} value={opt.timeValue24}>
                      {opt.labelDual}
                    </option>
                  ))}
                </select>
                {selectedTime24 && (
                  <div
                    style={{
                      marginTop: '0.25rem',
                      fontSize: '0.72rem',
                      color: 'var(--brand-gold, #ca8a04)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <Clock size={12} />
                    <span>{selectedEthTime.formattedDual}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Reason for Modification (Mandatory if time rescheduled) */}
          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Reason for Update / Reschedule {isTimeRescheduled && <span style={{ color: '#ef4444' }}>*</span>}
            </label>
            <textarea
              rows={2}
              required={isTimeRescheduled}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                isTimeRescheduled
                  ? 'Bank policy requires an audit reason for moving date/time (e.g. urgent branch audit or coachee requested afternoon slot)'
                  : 'Optional note regarding topic or delivery adjustments'
              }
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border, #cbd5e1)',
                fontSize: '0.86rem',
              }}
            />
          </div>

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              marginTop: '0.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border, #e2e8f0)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="apid-btn apid-btn-outline"
              disabled={loading}
              style={{ padding: '0.45rem 1rem', fontSize: '0.86rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="apid-btn apid-btn-primary"
              disabled={loading || (isTimeRescheduled && isRescheduleLimitReached)}
              style={{
                backgroundColor: 'var(--brand-gold, #ca8a04)',
                borderColor: 'var(--brand-gold, #ca8a04)',
                color: '#fff',
                padding: '0.45rem 1.25rem',
                fontSize: '0.86rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              {loading ? 'Saving Changes...' : isTimeRescheduled ? 'Reschedule & Save' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
