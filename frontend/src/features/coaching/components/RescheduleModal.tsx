import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, AlertCircle, ShieldCheck, Lock } from 'lucide-react';
import { CoachingSessionItem, coachingSessionApi } from '../api/coachingSessionApi';
import { BANK_OPERATING_TIME_OPTIONS, toEthiopianTime } from '../utils/ethiopianTimeUtils';

interface RescheduleModalProps {
  session: CoachingSessionItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  publicConfig?: {
    coachingRescheduleScope?: string;
    coachingMinRescheduleNoticeHours?: number;
    coachingMaxReschedulesPerSession?: number;
    coachingAllowSaturdayScheduling?: boolean;
    coachingRequireDeclineReason?: boolean;
  };
  activeQuarter?: {
    startDate?: string;
    endDate?: string;
  };
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  session,
  isOpen,
  onClose,
  onSuccess,
  publicConfig,
  activeQuarter,
}) => {
  if (!isOpen || !session) return null;

  const rescheduleScope = publicConfig?.coachingRescheduleScope || 'SAME_WEEK';
  const minNoticeHours = publicConfig?.coachingMinRescheduleNoticeHours ?? 4;
  const maxReschedules = publicConfig?.coachingMaxReschedulesPerSession ?? 2;
  const allowSaturday = publicConfig?.coachingAllowSaturdayScheduling ?? true;

  const rescheduleCount = session.rescheduleCount ?? 0;
  const isRescheduleLimitReached = rescheduleCount >= maxReschedules;

  const currentStart = useMemo(() => new Date(session.scheduledStartTime), [session.scheduledStartTime]);

  const [sessionDate, setSessionDate] = useState('');
  const [selectedTime24, setSelectedTime24] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      setError(null);
      setReason('');

      const eatDate = new Date(session.scheduledStartTime);
      const eatHours = (eatDate.getUTCHours() + 3) % 24;
      const eatMinutes = eatDate.getUTCMinutes();
      const pad = (n: number) => n.toString().padStart(2, '0');

      setSessionDate(`${eatDate.getUTCFullYear()}-${pad(eatDate.getUTCMonth() + 1)}-${pad(eatDate.getUTCDate())}`);

      const timeVal = `${pad(eatHours)}:${pad(eatMinutes)}`;
      const match = BANK_OPERATING_TIME_OPTIONS.find((o) => o.timeValue24 === timeVal);
      setSelectedTime24(match ? match.timeValue24 : timeVal);
    }
  }, [session]);

  const { weekMondayStr, weekSaturdayStr } = useMemo(() => {
    const d = new Date(currentStart);
    const dayOfWeek = d.getUTCDay();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionDate || !selectedTime24) {
      setError('Please select both a date and an Ethiopian meeting time.');
      return;
    }
    if (!reason.trim()) {
      setError('Bank policy requires a valid reason for proposing a reschedule.');
      return;
    }

    if (isRescheduleLimitReached) {
      setError(`This session has reached the limit of ${maxReschedules} reschedule requests.`);
      return;
    }

    // Check Sunday lockout
    const dayOfWeek = new Date(sessionDate + 'T12:00:00Z').getUTCDay();
    if (dayOfWeek === 0) {
      setError('Sundays are strictly prohibited for coaching sessions by Bank Policy.');
      return;
    }
    if (!allowSaturday && dayOfWeek === 6) {
      setError('Saturday sessions are currently disabled by Bank Coaching Policy.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

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

      await coachingSessionApi.proposeReschedule(session.id, {
        proposedStartTime: scheduledDateUtc.toISOString(),
        reason: reason.trim(),
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to propose reschedule.';
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
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="apid-card"
        style={{
          width: '100%',
          maxWidth: '520px',
          margin: 0,
          background: 'var(--surface, #ffffff)',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
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
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '1.15rem',
                fontWeight: 700,
                margin: 0,
                color: 'var(--text-primary, #0f172a)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <Calendar size={18} style={{ color: 'var(--brand-gold, #ca8a04)' }} />
              Propose New Session Time
            </h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--muted, #64748b)' }}>
              Currently scheduled: {new Date(session.scheduledStartTime).toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="apid-btn apid-btn-outline"
            style={{ padding: '0.35rem', border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Admin Policy Notice */}
        <div
          style={{
            margin: '1rem 1.5rem 0',
            padding: '0.65rem 0.85rem',
            background: 'rgba(202, 138, 4, 0.06)',
            border: '1px solid rgba(202, 138, 4, 0.25)',
            borderRadius: '6px',
            fontSize: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <span style={{ fontWeight: 700, color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <ShieldCheck size={14} /> Bank Reschedule Policy
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '0.1rem 0.4rem',
                borderRadius: '8px',
                background: isRescheduleLimitReached ? '#fee2e2' : '#fef3c7',
                color: isRescheduleLimitReached ? '#b91c1c' : '#92400e',
              }}
            >
              Requests: {rescheduleCount} / {maxReschedules} Used
            </span>
          </div>
          <div style={{ color: 'var(--muted, #64748b)' }}>
            Scope: {rescheduleScope === 'SAME_WEEK' ? 'Same Calendar Week (Mon–Sat)' : rescheduleScope} | Advance Notice: {minNoticeHours}h min
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <div
              className="apid-alert apid-alert-err"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.85rem' }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {isRescheduleLimitReached && (
            <div
              style={{
                padding: '0.65rem 0.85rem',
                background: '#fef2f2',
                border: '1px solid #f87171',
                borderRadius: '6px',
                color: '#991b1b',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Lock size={16} />
              <span>Reschedule limit of {maxReschedules} reached. Please coordinate directly with your coach.</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Proposed Date (Mon–Sat) <span style={{ color: '#ef4444' }}>*</span>
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
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Proposed Time (የኢትዮጵያ ሰዓት) <span style={{ color: '#ef4444' }}>*</span>
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
                <div style={{ marginTop: '0.2rem', fontSize: '0.7rem', color: 'var(--brand-gold, #ca8a04)', fontWeight: 600 }}>
                  {selectedEthTime.formattedDual}
                </div>
              )}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Reason for Reschedule <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Conflict with urgent branch audit; requesting to move to afternoon slot..."
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border, #cbd5e1)',
                fontSize: '0.88rem',
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
            >
              Cancel
            </button>
            <button
              type="submit"
              className="apid-btn apid-btn-primary"
              disabled={loading || isRescheduleLimitReached}
              style={{
                backgroundColor: 'var(--brand-gold, #ca8a04)',
                borderColor: 'var(--brand-gold, #ca8a04)',
                color: '#fff',
              }}
            >
              {loading ? 'Submitting...' : 'Submit Reschedule Proposal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
