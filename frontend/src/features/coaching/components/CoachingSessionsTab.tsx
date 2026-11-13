import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  Video,
  Phone,
  MapPin,
  Plus,
  CheckCircle2,
  FileText,
  Star,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  coachingSessionApi,
  CoachingSessionItem,
} from '../api/coachingSessionApi';
import { MyCoacheeItem } from '../api/coachingAssignmentApi';
import { StatusPill } from '../../../shared/components/ui';
import { ScheduleSessionModal } from './ScheduleSessionModal';
import { CompleteSessionModal } from './CompleteSessionModal';
import { RescheduleModal } from './RescheduleModal';
import { SessionFeedbackModal } from './SessionFeedbackModal';
import { DailyVideoModal } from './DailyVideoModal';

interface CoachingSessionsTabProps {
  myCoachees: MyCoacheeItem[];
  currentEmployeeId?: number;
}

export const CoachingSessionsTab: React.FC<CoachingSessionsTabProps> = ({
  myCoachees,
  currentEmployeeId,
}) => {
  const queryClient = useQueryClient();

  // Active filter: 'all' | 'upcoming' | 'completed'
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('all');

  // Modals state
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [selectedForComplete, setSelectedForComplete] = useState<CoachingSessionItem | null>(null);
  const [selectedForReschedule, setSelectedForReschedule] = useState<CoachingSessionItem | null>(null);
  const [selectedForFeedback, setSelectedForFeedback] = useState<CoachingSessionItem | null>(null);
  const [selectedForVideo, setSelectedForVideo] = useState<CoachingSessionItem | null>(null);

  // Expanded notes state
  const [expandedSessionIds, setExpandedSessionIds] = useState<Record<number, boolean>>({});

  const toggleExpand = (id: number) => {
    setExpandedSessionIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Fetch coaching sessions
  const { data: sessions = [], isLoading, refetch } = useQuery({
    queryKey: ['coaching-sessions'],
    queryFn: () => coachingSessionApi.getMySessions(),
  });

  // Respond invitation mutation
  const respondMutation = useMutation({
    mutationFn: ({ sessionId, accept }: { sessionId: number; accept: boolean }) =>
      coachingSessionApi.respondInvitation(sessionId, { accept }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching-sessions'] });
    },
  });

  const filteredSessions = sessions.filter((s) => {
    if (filter === 'upcoming') {
      return s.status === 'CONFIRMED' || s.status === 'PROPOSED' || s.status === 'IN_PROGRESS';
    }
    if (filter === 'completed') {
      return s.status === 'COMPLETED';
    }
    return true;
  });

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusTone = (status: CoachingSessionItem['status']) => {
    switch (status) {
      case 'CONFIRMED':
        return 'ok';
      case 'IN_PROGRESS':
        return 'info';
      case 'COMPLETED':
        return 'ok';
      case 'PROPOSED':
        return 'warn';
      case 'RESCHEDULE_PENDING':
        return 'warn';
      case 'CANCELLED':
      case 'EXPIRED':
        return 'err';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="boa-stack">
      {/* Top Action & Metric Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'var(--surface, #ffffff)',
          padding: '1.25rem',
          borderRadius: '10px',
          border: '1px solid var(--border, #e2e8f0)',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
            Coaching Sessions & Scheduling
          </h2>
          <p className="boa-muted" style={{ margin: '0.2rem 0 0', fontSize: '0.86rem' }}>
            Flexible 1-on-1 PMS & cohort skill development sessions with Daily.co video and performance tracking.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              background: 'var(--surface-subtle, #f1f5f9)',
              padding: '0.2rem',
              borderRadius: '6px',
            }}
          >
            {(['all', 'upcoming', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: filter === tab ? '#ffffff' : 'transparent',
                  color: filter === tab ? 'var(--text-primary, #0f172a)' : 'var(--muted, #64748b)',
                  boxShadow: filter === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="apid-btn apid-btn-primary"
            onClick={() => setIsScheduleOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: 'var(--brand-gold, #ca8a04)',
              borderColor: 'var(--brand-gold, #ca8a04)',
              color: '#fff',
            }}
          >
            <Plus size={16} /> Schedule Session
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="apid-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="boa-muted">Loading scheduled sessions...</div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredSessions.length === 0 && (
        <div
          className="apid-card"
          style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            background: 'var(--surface, #ffffff)',
          }}
        >
          <Calendar size={42} style={{ color: 'var(--muted, #94a3b8)', margin: '0 auto 1rem' }} />
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>No Sessions Found</h3>
          <p className="boa-muted" style={{ margin: '0 auto 1.5rem', maxWidth: 460, fontSize: '0.88rem' }}>
            {filter === 'upcoming'
              ? 'You have no upcoming coaching meetings scheduled.'
              : filter === 'completed'
              ? 'No completed sessions logged yet.'
              : 'You do not have any coaching sessions scheduled yet. Click below to organize your first meeting.'}
          </p>
          <button
            type="button"
            className="apid-btn apid-btn-primary"
            onClick={() => setIsScheduleOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: 'var(--brand-gold, #ca8a04)',
              borderColor: 'var(--brand-gold, #ca8a04)',
              color: '#fff',
            }}
          >
            <Plus size={16} /> Schedule a Session
          </button>
        </div>
      )}

      {/* Session Cards Grid */}
      {!isLoading && filteredSessions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredSessions.map((session) => {
            const isCoach = currentEmployeeId
              ? session.coachEmployeeId === currentEmployeeId
              : true;
            const currentParticipant = currentEmployeeId
              ? session.participants.find((p) => p.employeeId === currentEmployeeId)
              : null;
            const isExpanded = !!expandedSessionIds[session.id];

            return (
              <div
                key={session.id}
                className="apid-card"
                style={{
                  background: 'var(--surface, #ffffff)',
                  border: '1px solid var(--border, #e2e8f0)',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                {/* Header row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                        {session.title}
                      </h3>
                      <StatusPill
                        label={session.pathway === 'SELF_DEVELOPMENT' ? 'SKILL DEV' : 'MANDATORY PMS'}
                        tone={session.pathway === 'SELF_DEVELOPMENT' ? 'info' : 'warn'}
                      />
                      <StatusPill
                        label={session.status.replace(/_/g, ' ')}
                        tone={getStatusTone(session.status)}
                      />
                    </div>

                    {session.targetPmsGoalName && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--brand-gold, #ca8a04)', fontWeight: 600 }}>
                        🎯 Target Goal: {session.targetPmsGoalName}
                      </div>
                    )}
                  </div>

                  {/* Mode & Timing Badge */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: 'var(--surface-subtle, #f8fafc)',
                      padding: '0.4rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border, #e2e8f0)',
                    }}
                  >
                    {session.meetingMode === 'VIRTUAL_VIDEO' ? (
                      <Video size={16} style={{ color: '#0284c7' }} />
                    ) : session.meetingMode === 'PHONE_CALL' ? (
                      <Phone size={16} style={{ color: '#16a34a' }} />
                    ) : (
                      <MapPin size={16} style={{ color: '#9333ea' }} />
                    )}
                    <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                      {session.meetingMode === 'VIRTUAL_VIDEO'
                        ? 'Daily.co Video'
                        : session.meetingMode === 'PHONE_CALL'
                        ? 'Phone'
                        : session.meetingLocation || 'In-Person'}
                    </span>
                    <span style={{ color: 'var(--muted, #94a3b8)' }}>•</span>
                    <span style={{ fontSize: '0.84rem', color: 'var(--muted, #64748b)' }}>
                      {session.durationMinutes} mins
                    </span>
                  </div>
                </div>

                {/* Timing & Participants Info Row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '1rem',
                    padding: '0.75rem',
                    background: 'var(--surface-subtle, #f8fafc)',
                    borderRadius: '8px',
                    fontSize: '0.86rem',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--muted, #64748b)', marginBottom: '0.2rem' }}>
                      SCHEDULED TIME
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                      <Clock size={14} style={{ color: 'var(--brand-gold, #ca8a04)' }} />
                      {formatDateTime(session.scheduledStartTime)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--muted, #64748b)', marginBottom: '0.2rem' }}>
                      COACH
                    </div>
                    <div style={{ fontWeight: 600 }}>
                      {session.coachFullName || 'Coach Assigned'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--muted, #64748b)', marginBottom: '0.2rem' }}>
                      COACHEE(S) ({session.participants.filter((p) => p.role === 'COACHEE').length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {session.participants
                        .filter((p) => p.role === 'COACHEE')
                        .map((p) => (
                          <span
                            key={p.id}
                            style={{
                              background: '#fff',
                              border: '1px solid var(--border, #cbd5e1)',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              fontSize: '0.78rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                          >
                            <strong>{p.fullName}</strong>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                color:
                                  p.invitationStatus === 'ACCEPTED'
                                    ? '#16a34a'
                                    : p.invitationStatus === 'DECLINED'
                                    ? '#ef4444'
                                    : '#ca8a04',
                              }}
                            >
                              ({p.invitationStatus})
                            </span>
                            {session.status === 'COMPLETED' && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '0 0.25rem',
                                  borderRadius: 2,
                                  background: p.attendanceStatus === 'ATTENDED' ? '#dcfce7' : '#fee2e2',
                                  color: p.attendanceStatus === 'ATTENDED' ? '#15803d' : '#b91c1c',
                                  fontWeight: 600,
                                }}
                              >
                                {p.attendanceStatus}
                              </span>
                            )}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>

                {/* Expanded Minutes / Action Items / Feedback */}
                {session.status === 'COMPLETED' && session.sessionNotesMinutes && (
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleExpand(session.id)}
                      className="apid-btn apid-btn-outline"
                      style={{
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.78rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <FileText size={13} />
                      {isExpanded ? 'Hide Minutes & Assessment' : 'View Minutes & Assessment'}
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>

                    {isExpanded && (
                      <div
                        style={{
                          marginTop: '0.75rem',
                          padding: '1rem',
                          background: 'var(--surface-subtle, #f8fafc)',
                          borderRadius: '8px',
                          border: '1px solid var(--border, #e2e8f0)',
                          fontSize: '0.86rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.6rem',
                        }}
                      >
                        <div>
                          <strong>Discussion Minutes:</strong>
                          <p style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-line', color: 'var(--text-secondary, #334155)' }}>
                            {session.sessionNotesMinutes}
                          </p>
                        </div>

                        {session.actionItems && (
                          <div>
                            <strong>Agreed Action Items:</strong>
                            <p style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-line', color: 'var(--text-secondary, #334155)' }}>
                              {session.actionItems}
                            </p>
                          </div>
                        )}

                        {/* Individual Assessments */}
                        <div>
                          <strong>Participant Assessments:</strong>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.35rem' }}>
                            {session.participants
                              .filter((p) => p.role === 'COACHEE')
                              .map((p) => (
                                <div
                                  key={p.id}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '0.8rem',
                                    padding: '0.35rem 0.5rem',
                                    background: '#fff',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border, #cbd5e1)',
                                  }}
                                >
                                  <span>
                                    <strong>{p.fullName}</strong>: {p.coachAssessment || 'PROGRESSING'}
                                    {p.individualNotes && (
                                      <span style={{ color: 'var(--muted, #64748b)', marginLeft: '0.5rem' }}>
                                        ({p.individualNotes})
                                      </span>
                                    )}
                                  </span>
                                  {p.feedbackRating && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: '#ca8a04', fontWeight: 600 }}>
                                      <Star size={13} fill="#ca8a04" /> {p.feedbackRating}/5
                                    </span>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer Action Buttons */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.6rem',
                    borderTop: '1px solid var(--border, #f1f5f9)',
                    paddingTop: '0.75rem',
                  }}
                >
                  {/* Coachee Invitation Acceptance Buttons (if pending) */}
                  {currentParticipant && currentParticipant.invitationStatus === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted, #64748b)' }}>
                        Invitation:
                      </span>
                      <button
                        type="button"
                        className="apid-btn apid-btn-primary"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                        onClick={() => respondMutation.mutate({ sessionId: session.id, accept: true })}
                        disabled={respondMutation.isPending}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="apid-btn apid-btn-outline"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', color: '#ef4444' }}
                        onClick={() => respondMutation.mutate({ sessionId: session.id, accept: false })}
                        disabled={respondMutation.isPending}
                      >
                        Decline
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginLeft: 'auto' }}>
                    {/* Join Daily.co Video */}
                    {session.meetingMode === 'VIRTUAL_VIDEO' &&
                      session.status !== 'CANCELLED' &&
                      session.status !== 'COMPLETED' && (
                        <button
                          type="button"
                          className="apid-btn apid-btn-primary"
                          onClick={() => setSelectedForVideo(session)}
                          style={{
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.82rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            backgroundColor: '#0284c7',
                            borderColor: '#0284c7',
                            color: '#fff',
                          }}
                        >
                          <Video size={14} /> Join Video Call
                        </button>
                      )}

                    {/* Reschedule (for upcoming sessions) */}
                    {(session.status === 'CONFIRMED' || session.status === 'PROPOSED') && (
                      <button
                        type="button"
                        className="apid-btn apid-btn-outline"
                        onClick={() => setSelectedForReschedule(session)}
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem' }}
                      >
                        Reschedule
                      </button>
                    )}

                    {/* Log Minutes / Complete (if Coach or Admin) */}
                    {isCoach && session.status !== 'CANCELLED' && (
                      <button
                        type="button"
                        className="apid-btn apid-btn-outline"
                        onClick={() => setSelectedForComplete(session)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.82rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          borderColor: 'var(--brand-gold, #ca8a04)',
                          color: 'var(--brand-gold, #ca8a04)',
                        }}
                      >
                        <CheckCircle2 size={14} />
                        {session.status === 'COMPLETED' ? 'Edit Minutes' : 'Log Minutes & Complete'}
                      </button>
                    )}

                    {/* Feedback (if completed) */}
                    {session.status === 'COMPLETED' && (
                      <button
                        type="button"
                        className="apid-btn apid-btn-outline"
                        onClick={() => setSelectedForFeedback(session)}
                        style={{
                          padding: '0.35rem 0.65rem',
                          fontSize: '0.82rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <Star size={13} style={{ color: '#ca8a04' }} /> Give Feedback
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Session Modal */}
      <ScheduleSessionModal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        myCoachees={myCoachees}
      />

      {/* Log Minutes & Attendance Modal */}
      <CompleteSessionModal
        session={selectedForComplete}
        isOpen={selectedForComplete !== null}
        onClose={() => setSelectedForComplete(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['coaching-sessions'] });
          refetch();
        }}
      />

      {/* Reschedule Proposal Modal */}
      <RescheduleModal
        session={selectedForReschedule}
        isOpen={selectedForReschedule !== null}
        onClose={() => setSelectedForReschedule(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['coaching-sessions'] });
          refetch();
        }}
      />

      {/* Feedback Modal */}
      <SessionFeedbackModal
        session={selectedForFeedback}
        isOpen={selectedForFeedback !== null}
        onClose={() => setSelectedForFeedback(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['coaching-sessions'] });
          refetch();
        }}
      />

      {/* Daily.co Video Meeting Modal */}
      <DailyVideoModal
        session={selectedForVideo}
        isOpen={selectedForVideo !== null}
        onClose={() => setSelectedForVideo(null)}
      />
    </div>
  );
};
