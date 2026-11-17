import React from 'react';
import {
  X,
  FileText,
  CheckCircle2,
  Calendar,
  Clock,
  UserCheck,
  Award,
  Edit3,
} from 'lucide-react';
import { CoachingSessionItem } from '../api/coachingSessionApi';
import { toEthiopianTime } from '../utils/ethiopianTimeUtils';

interface ViewMinutesModalProps {
  session: CoachingSessionItem | null;
  isOpen: boolean;
  onClose: () => void;
  onEditMinutes?: (session: CoachingSessionItem) => void;
  isCoach?: boolean;
}

export const ViewMinutesModal: React.FC<ViewMinutesModalProps> = ({
  session,
  isOpen,
  onClose,
  onEditMinutes,
  isCoach = false,
}) => {
  if (!isOpen || !session) return null;

  const isPms = session.pathway === 'MANDATORY_PMS';
  const themeColor = isPms ? 'var(--brand-gold, #ca8a04)' : '#2563eb';
  const themeBg = isPms ? 'rgba(202, 138, 4, 0.1)' : 'rgba(37, 99, 235, 0.1)';

  const startDate = new Date(session.scheduledStartTime);
  const dateFormatted = startDate.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const ethTime = toEthiopianTime(session.scheduledStartTime);

  const coachees = session.participants?.filter((p) => p.role === 'COACHEE') ?? [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
          border: '1px solid var(--border, #e2e8f0)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            backgroundColor: 'var(--surface-subtle, #f8fafc)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: themeBg,
                  color: themeColor,
                  border: `1px solid ${themeColor}`,
                }}
              >
                {isPms ? 'MANDATORY PMS COACHING' : 'SKILL DEVELOPMENT'}
              </span>
              {session.sequenceNumber && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: '#dbeafe',
                    color: '#1d4ed8',
                  }}
                >
                  Occurrence #{session.sequenceNumber}
                </span>
              )}
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: '#dcfce7',
                  color: '#15803d',
                }}
              >
                COMPLETED
              </span>
            </div>

            <h2
              style={{
                margin: 0,
                fontSize: '1.2rem',
                fontWeight: 800,
                color: 'var(--text-primary, #0f172a)',
              }}
            >
              {session.title}
            </h2>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                marginTop: '0.35rem',
                fontSize: '0.82rem',
                color: 'var(--muted, #64748b)',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <Calendar size={13} /> {dateFormatted}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <Clock size={13} /> {ethTime.formattedDual} · {session.durationMinutes || 45} mins
              </span>
              {session.coachFullName && <span>Coach: <strong>{session.coachFullName}</strong></span>}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0.35rem',
              cursor: 'pointer',
              color: 'var(--muted, #64748b)',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {/* Discussion Minutes & Observations */}
          <div>
            <div
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: 'var(--muted, #64748b)',
                marginBottom: '0.4rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <FileText size={15} style={{ color: themeColor }} />
              OFFICIAL DISCUSSION MINUTES & OBSERVATIONS
            </div>
            <div
              style={{
                padding: '1rem 1.15rem',
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '1px solid var(--border, #cbd5e1)',
                fontSize: '0.9rem',
                lineHeight: 1.6,
                color: 'var(--text-primary, #1e293b)',
                whiteSpace: 'pre-line',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              }}
            >
              {session.sessionNotesMinutes || 'No discussion minutes were recorded for this session.'}
            </div>
          </div>

          {/* Agreed Action Items & Practice Exercises */}
          {session.actionItems && (
            <div>
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: 'var(--muted, #64748b)',
                  marginBottom: '0.4rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <CheckCircle2 size={15} style={{ color: '#16a34a' }} />
                AGREED NEXT ACTION ITEMS & PRACTICE EXERCISES
              </div>
              <div
                style={{
                  padding: '1rem 1.15rem',
                  backgroundColor: 'rgba(22, 163, 74, 0.04)',
                  borderRadius: '8px',
                  border: '1px solid rgba(22, 163, 74, 0.25)',
                  fontSize: '0.88rem',
                  lineHeight: 1.6,
                  color: '#166534',
                  whiteSpace: 'pre-line',
                }}
              >
                {session.actionItems}
              </div>
            </div>
          )}

          {/* Participant Attendance & Individual Assessment */}
          {coachees.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: 'var(--muted, #64748b)',
                  marginBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <UserCheck size={15} style={{ color: '#0284c7' }} />
                COACHEE ATTENDANCE & PERFORMANCE EVALUATION ({coachees.length})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {coachees.map((p) => {
                  const isAttended = p.attendanceStatus === 'ATTENDED';
                  const isMissed = p.attendanceStatus === 'MISSED';
                  const isExcused = p.attendanceStatus === 'EXCUSED';

                  const assessmentLabels: Record<string, { label: string; bg: string; color: string }> = {
                    NEEDS_IMPROVEMENT: { label: 'Needs Improvement', bg: '#fee2e2', color: '#b91c1c' },
                    PROGRESSING: { label: 'Progressing', bg: '#fef3c7', color: '#b45309' },
                    ON_TRACK: { label: 'On Track', bg: '#e0f2fe', color: '#0369a1' },
                    MASTERED: { label: 'Mastered', bg: '#dcfce7', color: '#15803d' },
                  };

                  const assessMeta = p.coachAssessment ? assessmentLabels[p.coachAssessment] : null;

                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: '0.85rem 1rem',
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--border, #e2e8f0)',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.45rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary, #0f172a)' }}>
                            {p.fullName}
                          </span>
                          {p.employeeNumber && (
                            <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: '#64748b' }}>
                              ({p.employeeNumber})
                            </span>
                          )}
                          {p.position && (
                            <span style={{ marginLeft: '0.4rem', fontSize: '0.78rem', color: '#64748b' }}>
                              · {p.position}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              backgroundColor: isAttended ? '#dcfce7' : isMissed ? '#fee2e2' : isExcused ? '#fef3c7' : '#f1f5f9',
                              color: isAttended ? '#15803d' : isMissed ? '#b91c1c' : isExcused ? '#b45309' : '#64748b',
                            }}
                          >
                            {p.attendanceStatus || 'PENDING'}
                          </span>

                          {assessMeta && (
                            <span
                              style={{
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.5rem',
                                borderRadius: '4px',
                                backgroundColor: assessMeta.bg,
                                color: assessMeta.color,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                              }}
                            >
                              <Award size={12} /> {assessMeta.label}
                            </span>
                          )}
                        </div>
                      </div>

                      {p.individualNotes && (
                        <div
                          style={{
                            fontSize: '0.82rem',
                            color: 'var(--text-secondary, #334155)',
                            backgroundColor: 'var(--surface-subtle, #f8fafc)',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            borderLeft: `3px solid ${themeColor}`,
                            fontStyle: 'italic',
                          }}
                        >
                          "{p.individualNotes}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--surface-subtle, #f8fafc)',
          }}
        >
          {isCoach && onEditMinutes ? (
            <button
              type="button"
              className="apid-btn apid-btn-outline"
              onClick={() => {
                onClose();
                onEditMinutes(session);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.84rem',
                color: 'var(--brand-gold, #ca8a04)',
                borderColor: 'var(--brand-gold, #ca8a04)',
              }}
            >
              <Edit3 size={14} /> Edit Minutes & Attendance
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            className="apid-btn apid-btn-primary"
            onClick={onClose}
            style={{
              padding: '0.45rem 1.25rem',
              fontSize: '0.84rem',
              fontWeight: 600,
              backgroundColor: '#334155',
              borderColor: '#334155',
              color: '#ffffff',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
