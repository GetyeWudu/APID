import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, FileText, UserCheck, Award } from 'lucide-react';
import {
  CoachingSessionItem,
  AttendanceStatus,
  CoachAssessment,
  coachingSessionApi,
} from '../api/coachingSessionApi';

interface CompleteSessionModalProps {
  session: CoachingSessionItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type AttendanceRecord = Record<
  number,
  {
    attendanceStatus: AttendanceStatus;
    coachAssessment: CoachAssessment;
    individualNotes: string;
  }
>;

export const CompleteSessionModal: React.FC<CompleteSessionModalProps> = ({
  session,
  isOpen,
  onClose,
  onSuccess,
}) => {
  // ALL hooks must be declared before any early return
  const coacheeParticipants = session?.participants?.filter((p) => p.role === 'COACHEE') ?? [];

  const [sessionNotesMinutes, setSessionNotesMinutes] = useState('');
  const [actionItems, setActionItems] = useState('');
  const [attendances, setAttendances] = useState<AttendanceRecord>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync form state whenever the session or open state changes
  useEffect(() => {
    if (!isOpen || !session) return;
    setSessionNotesMinutes(session.sessionNotesMinutes || '');
    setActionItems(session.actionItems || '');
    setError(null);
    const initial: AttendanceRecord = {};
    (session.participants ?? [])
      .filter((p) => p.role === 'COACHEE')
      .forEach((p) => {
        initial[p.employeeId] = {
          attendanceStatus: p.attendanceStatus === 'PENDING' ? 'ATTENDED' : p.attendanceStatus,
          coachAssessment: p.coachAssessment || 'PROGRESSING',
          individualNotes: p.individualNotes || '',
        };
      });
    setAttendances(initial);
  }, [session, isOpen]);

  // Guard after all hooks
  if (!isOpen || !session) return null;

  const handleAttendanceChange = (
    employeeId: number,
    field: 'attendanceStatus' | 'coachAssessment' | 'individualNotes',
    value: string
  ) => {
    setAttendances((prev) => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionNotesMinutes.trim()) {
      setError('Please provide session discussion minutes.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const participantAttendances = coacheeParticipants.map((p) => {
        const att = attendances[p.employeeId];
        return {
          employeeId: p.employeeId,
          attendanceStatus: att?.attendanceStatus || 'ATTENDED',
          coachAssessment: att?.coachAssessment || 'PROGRESSING',
          individualNotes: att?.individualNotes || undefined,
        };
      });

      await coachingSessionApi.completeSession(session.id, {
        sessionNotesMinutes,
        actionItems: actionItems.trim() || undefined,
        participantAttendances,
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to complete session minutes.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
          maxWidth: '720px',
          maxHeight: '90vh',
          overflowY: 'auto',
          margin: 0,
          background: 'var(--surface, #ffffff)',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
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
                fontSize: '1.25rem',
                fontWeight: 700,
                margin: 0,
                color: 'var(--text-primary, #0f172a)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <CheckCircle2 size={20} style={{ color: 'var(--brand-gold, #ca8a04)' }} />
              Log Session Minutes & Attendance
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--muted, #64748b)' }}>
              Session: <strong>{session.title}</strong> · {session.durationMinutes} mins · {session.pathway === 'SELF_DEVELOPMENT' ? 'Skill Development' : 'Mandatory PMS Coaching'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="apid-btn apid-btn-outline"
            style={{ padding: '0.4rem', border: 'none', background: 'transparent' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && (
            <div
              className="apid-alert apid-alert-err"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem' }}
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Session Discussion Notes */}
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.88rem',
                fontWeight: 600,
                marginBottom: '0.35rem',
              }}
            >
              <FileText size={16} />
              Discussion Minutes & Observations <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              required
              rows={4}
              value={sessionNotesMinutes}
              onChange={(e) => setSessionNotesMinutes(e.target.value)}
              placeholder="Record topics reviewed, coaching questions asked, breakthrough moments, and general performance insights..."
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '6px',
                border: '1px solid var(--border, #cbd5e1)',
                fontSize: '0.9rem',
                background: 'var(--surface-input, #fff)',
              }}
            />
          </div>

          {/* Action Items */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.88rem',
                fontWeight: 600,
                marginBottom: '0.35rem',
              }}
            >
              Agreed Next Action Items & Practice Exercises
            </label>
            <textarea
              rows={2}
              value={actionItems}
              onChange={(e) => setActionItems(e.target.value)}
              placeholder="e.g. 1. Practice 3 cross-currency transactions; 2. Complete daily reconciliation checklist..."
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '6px',
                border: '1px solid var(--border, #cbd5e1)',
                fontSize: '0.9rem',
                background: 'var(--surface-input, #fff)',
              }}
            />
          </div>

          {/* Individual Participant Attendance & Assessment */}
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.88rem',
                fontWeight: 600,
                marginBottom: '0.5rem',
              }}
            >
              <UserCheck size={16} />
              Participant Attendance & Individual Assessment ({coacheeParticipants.length} Coachees)
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {coacheeParticipants.map((p) => {
                const att = attendances[p.employeeId] || {
                  attendanceStatus: 'ATTENDED',
                  coachAssessment: 'PROGRESSING',
                  individualNotes: '',
                };

                return (
                  <div
                    key={p.id}
                    style={{
                      border: '1px solid var(--border, #e2e8f0)',
                      borderRadius: '8px',
                      padding: '0.85rem',
                      background: 'var(--surface-subtle, #f8fafc)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <div>
                        <strong>{p.fullName}</strong>{' '}
                        <span style={{ fontSize: '0.8rem', color: 'var(--muted, #64748b)' }}>
                          ({p.employeeNumber || 'ID ' + p.employeeId}) {p.position ? `· ${p.position}` : ''}
                        </span>
                      </div>

                      {/* Attendance Select */}
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Attendance:</span>
                        <select
                          value={att.attendanceStatus}
                          onChange={(e) =>
                            handleAttendanceChange(
                              p.employeeId,
                              'attendanceStatus',
                              e.target.value as AttendanceStatus
                            )
                          }
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border, #cbd5e1)',
                            fontSize: '0.82rem',
                          }}
                        >
                          <option value="ATTENDED">Attended</option>
                          <option value="MISSED">Missed</option>
                          <option value="EXCUSED">Excused</option>
                        </select>
                      </div>
                    </div>

                    {/* Progress Assessment & Individual note */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(180px, 1fr) 2fr',
                        gap: '0.75rem',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.2rem' }}>
                          <Award size={12} /> Coach Assessment
                        </label>
                        <select
                          value={att.coachAssessment}
                          onChange={(e) =>
                            handleAttendanceChange(
                              p.employeeId,
                              'coachAssessment',
                              e.target.value as CoachAssessment
                            )
                          }
                          style={{
                            width: '100%',
                            padding: '0.35rem 0.5rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border, #cbd5e1)',
                            fontSize: '0.82rem',
                          }}
                        >
                          <option value="PROGRESSING">Progressing</option>
                          <option value="ON_TRACK">On Track</option>
                          <option value="MASTERED">Mastered Skill</option>
                          <option value="NEEDS_IMPROVEMENT">Needs Improvement</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                          Private Coach Notes on Employee
                        </label>
                        <input
                          type="text"
                          value={att.individualNotes}
                          onChange={(e) =>
                            handleAttendanceChange(p.employeeId, 'individualNotes', e.target.value)
                          }
                          placeholder="e.g. Demonstrated strong grasp of swift messages..."
                          style={{
                            width: '100%',
                            padding: '0.35rem 0.6rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border, #cbd5e1)',
                            fontSize: '0.82rem',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
              disabled={loading}
              style={{
                backgroundColor: 'var(--brand-gold, #ca8a04)',
                borderColor: 'var(--brand-gold, #ca8a04)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              {loading ? 'Saving Minutes...' : 'Save & Complete Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

