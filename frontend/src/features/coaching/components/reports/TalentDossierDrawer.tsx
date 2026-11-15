import React from 'react';
import {
  X,
  Target,
  Award,
  AlertTriangle,
  Clock,
  Video,
  Phone,
  MapPin,
  CheckCircle2,
  FileText,
  Star,
  User,
} from 'lucide-react';
import type { PmsTalentDossier, SessionProgressLog } from '../../api/pmsReportApi';

interface TalentDossierDrawerProps {
  dossier: PmsTalentDossier | null;
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
}

export const TalentDossierDrawer: React.FC<TalentDossierDrawerProps> = ({
  dossier,
  isOpen,
  onClose,
  loading,
}) => {
  if (!isOpen) return null;

  const getAssessmentBadge = (assessment: SessionProgressLog['coachAssessment']) => {
    switch (assessment) {
      case 'MASTERED':
        return (
          <span className="boa-pill boa-pill-ok">
            <CheckCircle2 size={12} /> Mastered
          </span>
        );
      case 'ON_TRACK':
        return (
          <span className="boa-pill boa-pill-info">
            <CheckCircle2 size={12} /> On Track
          </span>
        );
      case 'PROGRESSING':
        return (
          <span className="boa-pill boa-pill-warn">
            <Clock size={12} /> Progressing
          </span>
        );
      case 'NEEDS_IMPROVEMENT':
        return (
          <span className="boa-pill boa-pill-err">
            <AlertTriangle size={12} /> Needs Improvement
          </span>
        );
      default:
        return (
          <span className="boa-pill boa-pill-neutral">
            Pending Review
          </span>
        );
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'VIRTUAL_VIDEO':
        return <Video size={13} style={{ color: 'var(--info)' }} />;
      case 'PHONE_CALL':
        return <Phone size={13} style={{ color: 'var(--ok)' }} />;
      default:
        return <MapPin size={13} style={{ color: 'var(--brand-gold, #ca8a04)' }} />;
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
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1200,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '740px',
          height: '100%',
          background: 'var(--surface, #ffffff)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-10px 0 35px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            background: 'var(--surface-subtle)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  background: 'rgba(202, 138, 4, 0.12)',
                  color: '#b45309',
                }}
              >
                Performance Transformation Dossier
              </span>
              {dossier?.ratingBand === 'CRITICAL' ? (
                <span className="boa-pill boa-pill-err" style={{ fontSize: '0.68rem' }}>
                  Critical Remediation (&lt; 2.0)
                </span>
              ) : (
                <span className="boa-pill boa-pill-warn" style={{ fontSize: '0.68rem' }}>
                  Moderate Remediation
                </span>
              )}
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {dossier?.coacheeName || 'Loading Dossier...'}
              <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--muted)' }}>
                ({dossier?.coacheeStaffId})
              </span>
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
              {dossier?.jobTitle} • {dossier?.department} • {dossier?.directorate}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="apid-btn apid-btn-outline apid-btn-sm"
            style={{ padding: '0.35rem', borderRadius: '8px' }}
            title="Close Drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {loading || !dossier ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
              Loading performance transformation details...
            </div>
          ) : (
            <>
              {/* Attention Warning Alert if applicable */}
              {dossier.attentionRequired && (
                <div
                  className="apid-alert apid-alert-danger"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem',
                    marginBottom: 0,
                  }}
                >
                  <AlertTriangle size={18} style={{ color: 'var(--err)', flexShrink: 0, marginTop: '0.1rem' }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.15rem' }}>
                      Coaching Rhythm Attention Alert
                    </strong>
                    <span style={{ fontSize: '0.8rem' }}>{dossier.attentionReason}</span>
                  </div>
                </div>
              )}

              {/* Top Overview Cards: Performance Gap & Target Pacing */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* 1. Appraisal Baseline Gap */}
                <div
                  className="apid-card"
                  style={{
                    padding: '1rem',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--muted)',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <Target size={14} style={{ color: 'var(--brand-gold, #ca8a04)' }} />
                    <span>Appraisal Baseline &amp; Gap</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--err)' }}>
                      {Number(dossier.startingRating).toFixed(2)}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>/ 5.0 Baseline</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)' }}>
                      {dossier.fiscalQuarterName}
                    </span>
                  </div>
                  <div
                    style={{
                      padding: '0.65rem',
                      background: 'var(--surface-subtle)',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.2rem' }}>
                      Focus: {dossier.targetWeaknessKpi}
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>
                      Target: {dossier.targetScore} • Actual: {dossier.actualScore}
                    </div>
                  </div>
                </div>

                {/* 2. Target Commitment & Pacing */}
                <div
                  className="apid-card"
                  style={{
                    padding: '1rem',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--muted)',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Award size={14} style={{ color: 'var(--info)' }} />
                      <span>Target Delivery</span>
                    </div>
                    <strong style={{ color: 'var(--info)', fontSize: '0.85rem' }}>
                      {dossier.deliveryPercentage}%
                    </strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)' }}>
                      {dossier.completedSessions}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                      of {dossier.approvedTarget} sessions completed
                    </span>
                    {dossier.isExtensionApproved && (
                      <span
                        className="boa-pill boa-pill-info"
                        style={{ marginLeft: 'auto', fontSize: '0.68rem' }}
                      >
                        +{dossier.extensionSessionsAdded} Extended
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: '6px',
                      background: 'var(--border)',
                      borderRadius: '999px',
                      overflow: 'hidden',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, dossier.deliveryPercentage)}%`,
                        height: '100%',
                        background: 'var(--info)',
                        borderRadius: '999px',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.74rem',
                      color: 'var(--muted)',
                    }}
                  >
                    <span>Coach: <strong style={{ color: 'var(--text)' }}>{dossier.coachName}</strong></span>
                    <span>{dossier.remainingSessions} remaining</span>
                  </div>
                </div>
              </div>

              {/* Section Header: Session by Session Two-Way Progress Log */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <FileText size={16} style={{ color: 'var(--brand-gold, #ca8a04)' }} />
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: 'var(--text)',
                      }}
                    >
                      Two-Way Session-by-Session Audit ({dossier.sessionLogs.length} Sessions)
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>
                    Coach &amp; Coachee Mutual Reports
                  </span>
                </div>

                {dossier.sessionLogs.length === 0 ? (
                  <div
                    style={{
                      padding: '2.5rem',
                      textAlign: 'center',
                      border: '2px dashed var(--border)',
                      borderRadius: '10px',
                      background: 'var(--surface-subtle)',
                    }}
                  >
                    <Clock size={28} style={{ color: 'var(--muted)', margin: '0 auto 0.5rem' }} />
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text)' }}>
                      No sessions conducted yet
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                      Session discussion minutes, coach assessment, and coachee practice reflections will appear here as meetings are conducted.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {dossier.sessionLogs.map((s) => {
                      const isCompleted = s.sessionStatus === 'COMPLETED';
                      return (
                        <div
                          key={s.sessionId}
                          style={{
                            padding: '1rem',
                            borderRadius: '10px',
                            border: '1px solid var(--border)',
                            background: isCompleted ? 'var(--surface)' : 'var(--surface-subtle)',
                            boxShadow: isCompleted ? 'var(--shadow-card)' : 'none',
                          }}
                        >
                          {/* Session Card Header */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingBottom: '0.65rem',
                              borderBottom: '1px solid var(--border)',
                              marginBottom: '0.75rem',
                              flexWrap: 'wrap',
                              gap: '0.5rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '999px',
                                  background: 'rgba(202, 138, 4, 0.15)',
                                  color: '#b45309',
                                  fontWeight: 800,
                                  fontSize: '0.75rem',
                                }}
                              >
                                {s.sequenceNumber}
                              </span>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>
                                  {s.sessionTitle}
                                </div>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    fontSize: '0.74rem',
                                    color: 'var(--muted)',
                                    marginTop: '0.15rem',
                                  }}
                                >
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    {getModeIcon(s.meetingMode)}
                                    {s.durationMinutes} min
                                  </span>
                                  <span>•</span>
                                  <span>
                                    {s.conductedAt
                                      ? new Date(s.conductedAt).toLocaleDateString(undefined, {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric',
                                        })
                                      : new Date(s.scheduledStartTime).toLocaleDateString(undefined, {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric',
                                        })}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              {getAssessmentBadge(s.coachAssessment)}
                              <span
                                className={`boa-pill ${isCompleted ? 'boa-pill-ok' : 'boa-pill-warn'}`}
                                style={{ fontSize: '0.68rem' }}
                              >
                                {s.sessionStatus}
                              </span>
                            </div>
                          </div>

                          {/* Two-Way Progress: Coach Box vs Coachee Box */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: '0.75rem',
                            }}
                          >
                            {/* 1. Coach Log */}
                            <div
                              style={{
                                padding: '0.75rem',
                                borderRadius: '8px',
                                background: 'var(--surface-subtle)',
                                border: '1px solid var(--border)',
                                fontSize: '0.78rem',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  borderBottom: '1px solid var(--border)',
                                  paddingBottom: '0.35rem',
                                  marginBottom: '0.45rem',
                                }}
                              >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, color: 'var(--text)' }}>
                                  <User size={13} style={{ color: 'var(--brand-gold, #ca8a04)' }} />
                                  Coach: {s.coachName}
                                </span>
                                <span style={{ fontSize: '0.68rem', color: 'var(--muted)', textTransform: 'uppercase' }}>
                                  Evaluation
                                </span>
                              </div>

                              <div style={{ marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: '0.15rem' }}>
                                  Discussion Minutes
                                </span>
                                {s.sessionDiscussionMinutes ? (
                                  <p style={{ margin: 0, color: 'var(--text)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                                    {s.sessionDiscussionMinutes}
                                  </p>
                                ) : (
                                  <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                                    No discussion notes logged.
                                  </span>
                                )}
                              </div>

                              {s.actionItemsAssigned && (
                                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
                                  <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: '#b45309', display: 'block', marginBottom: '0.15rem' }}>
                                    Action Items Assigned
                                  </span>
                                  <p style={{ margin: 0, fontWeight: 500, color: 'var(--text)', lineHeight: 1.45 }}>
                                    {s.actionItemsAssigned}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* 2. Coachee Progress Log */}
                            <div
                              style={{
                                padding: '0.75rem',
                                borderRadius: '8px',
                                background: 'rgba(2, 132, 199, 0.04)',
                                border: '1px solid rgba(2, 132, 199, 0.2)',
                                fontSize: '0.78rem',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  borderBottom: '1px solid rgba(2, 132, 199, 0.15)',
                                  paddingBottom: '0.35rem',
                                  marginBottom: '0.45rem',
                                }}
                              >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, color: 'var(--text)' }}>
                                  <User size={13} style={{ color: 'var(--info)' }} />
                                  Coachee: {s.coacheeName}
                                </span>
                                <span
                                  className={`boa-pill ${
                                    s.coacheeAttendanceStatus === 'ATTENDED' ? 'boa-pill-ok' : 'boa-pill-neutral'
                                  }`}
                                  style={{ fontSize: '0.66rem' }}
                                >
                                  {s.coacheeAttendanceStatus}
                                </span>
                              </div>

                              <div style={{ marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--info)', display: 'block', marginBottom: '0.15rem' }}>
                                  Practice Reflection &amp; Evidence
                                </span>
                                {s.coacheeProgressNotes ? (
                                  <p style={{ margin: 0, color: 'var(--text)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                                    {s.coacheeProgressNotes}
                                  </p>
                                ) : (
                                  <span style={{ color: 'var(--warn)', fontStyle: 'italic' }}>
                                    ⚠️ Awaiting coachee practice submission
                                  </span>
                                )}
                              </div>

                              {s.feedbackRating && (
                                <div
                                  style={{
                                    borderTop: '1px solid rgba(2, 132, 199, 0.15)',
                                    paddingTop: '0.4rem',
                                    marginTop: '0.4rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.2rem',
                                    color: 'var(--muted)',
                                    fontSize: '0.72rem',
                                  }}
                                >
                                  <span style={{ fontWeight: 600, marginRight: '0.2rem' }}>Rating:</span>
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      size={12}
                                      style={{
                                        color: star <= s.feedbackRating! ? '#f59e0b' : 'var(--border)',
                                        fill: star <= s.feedbackRating! ? '#f59e0b' : 'none',
                                      }}
                                    />
                                  ))}
                                  {s.feedbackComment && (
                                    <span style={{ marginLeft: '0.4rem', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      &quot;{s.feedbackComment}&quot;
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface-subtle)',
          }}
        >
          <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>
            Bank of Abyssinia • Enterprise PMS Performance Monitoring
          </span>
          <button
            type="button"
            onClick={onClose}
            className="apid-btn apid-btn-secondary apid-btn-sm"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
