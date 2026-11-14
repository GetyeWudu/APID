import React, { useState, useMemo } from 'react';
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
  Target,
  Sparkles,
  Users,
  Shield,
  Layers,
} from 'lucide-react';
import {
  coachingSessionApi,
  CoachingSessionItem,
} from '../api/coachingSessionApi';
import { MyCoacheeItem } from '../api/coachingAssignmentApi';
import { ScheduleSessionModal } from './ScheduleSessionModal';
import { CompleteSessionModal } from './CompleteSessionModal';
import { RescheduleModal } from './RescheduleModal';
import { SessionFeedbackModal } from './SessionFeedbackModal';
import { DailyVideoModal } from './DailyVideoModal';

interface CoachingSessionsTabProps {
  myCoachees: MyCoacheeItem[];
  currentEmployeeId?: number;
}

type StreamFilter = 'all' | 'pms' | 'skills';
type StatusFilter = 'all' | 'upcoming' | 'completed';

export const CoachingSessionsTab: React.FC<CoachingSessionsTabProps> = ({
  myCoachees,
  currentEmployeeId,
}) => {
  const queryClient = useQueryClient();

  // Primary stream filter: 'all' | 'pms' | 'skills'
  const [streamFilter, setStreamFilter] = useState<StreamFilter>('all');

  // Secondary lifecycle filter: 'all' | 'upcoming' | 'completed'
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

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

  // Calculate stream counts
  const pmsSessions = useMemo(
    () => sessions.filter((s) => s.pathway === 'MANDATORY_PMS'),
    [sessions]
  );
  const skillSessions = useMemo(
    () => sessions.filter((s) => s.pathway === 'SELF_DEVELOPMENT'),
    [sessions]
  );

  // Filter sessions by status
  const filterByStatus = (list: CoachingSessionItem[]) => {
    if (statusFilter === 'upcoming') {
      return list.filter(
        (s) => s.status === 'CONFIRMED' || s.status === 'PROPOSED' || s.status === 'IN_PROGRESS'
      );
    }
    if (statusFilter === 'completed') {
      return list.filter((s) => s.status === 'COMPLETED');
    }
    return list;
  };

  const visiblePmsSessions = useMemo(
    () => filterByStatus(pmsSessions),
    [pmsSessions, statusFilter]
  );
  const visibleSkillSessions = useMemo(
    () => filterByStatus(skillSessions),
    [skillSessions, statusFilter]
  );

  // Format date parts for calendar tile
  const parseDateParts = (isoString: string) => {
    const d = new Date(isoString);
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const day = d.getDate();
    const weekday = d.toLocaleString('en-US', { weekday: 'short' });
    const time = d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return { month, day, weekday, time };
  };

  const getInitials = (fullName?: string | null) => {
    if (!fullName) return 'U';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  };

  // Render an individual Executive Meeting Card
  const renderMeetingCard = (session: CoachingSessionItem) => {
    const isPms = session.pathway === 'MANDATORY_PMS';
    const isCoach = currentEmployeeId ? session.coachEmployeeId === currentEmployeeId : true;
    const currentParticipant = currentEmployeeId
      ? session.participants.find((p) => p.employeeId === currentEmployeeId)
      : null;
    const isExpanded = !!expandedSessionIds[session.id];
    const { month, day, weekday, time } = parseDateParts(session.scheduledStartTime);
    const coachees = session.participants.filter((p) => p.role === 'COACHEE');

    // Pathway theme colors
    const themeColor = isPms ? 'var(--brand-gold, #ca8a04)' : '#2563eb';
    const themeBg = isPms ? 'rgba(202, 138, 4, 0.08)' : 'rgba(37, 99, 235, 0.08)';
    const themeBorder = isPms ? 'rgba(202, 138, 4, 0.25)' : 'rgba(37, 99, 235, 0.25)';

    // Status styling
    const statusBadges: Record<
      string,
      { label: string; bg: string; color: string; border: string }
    > = {
      CONFIRMED: {
        label: 'Confirmed',
        bg: 'rgba(22, 163, 74, 0.1)',
        color: '#16a34a',
        border: 'rgba(22, 163, 74, 0.25)',
      },
      IN_PROGRESS: {
        label: 'In Progress',
        bg: 'rgba(2, 132, 199, 0.12)',
        color: '#0284c7',
        border: 'rgba(2, 132, 199, 0.3)',
      },
      COMPLETED: {
        label: 'Completed',
        bg: 'rgba(71, 85, 105, 0.1)',
        color: '#475569',
        border: 'rgba(71, 85, 105, 0.2)',
      },
      PROPOSED: {
        label: 'Proposed',
        bg: 'rgba(202, 138, 4, 0.12)',
        color: '#ca8a04',
        border: 'rgba(202, 138, 4, 0.3)',
      },
      RESCHEDULE_PENDING: {
        label: 'Reschedule Pending',
        bg: 'rgba(234, 88, 12, 0.1)',
        color: '#ea580c',
        border: 'rgba(234, 88, 12, 0.25)',
      },
      CANCELLED: {
        label: 'Cancelled',
        bg: 'rgba(239, 68, 68, 0.1)',
        color: '#ef4444',
        border: 'rgba(239, 68, 68, 0.25)',
      },
      EXPIRED: {
        label: 'Expired',
        bg: 'rgba(100, 116, 139, 0.1)',
        color: '#64748b',
        border: 'rgba(100, 116, 139, 0.2)',
      },
    };

    const currentBadge = statusBadges[session.status] || {
      label: session.status,
      bg: '#f1f5f9',
      color: '#475569',
      border: '#cbd5e1',
    };

    return (
      <div
        key={session.id}
        className="apid-card"
        style={{
          background: 'var(--surface, #ffffff)',
          border: '1px solid var(--border, #e2e8f0)',
          borderLeft: `4px solid ${themeColor}`,
          borderRadius: '12px',
          padding: 0,
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          transition: 'all 0.2s ease-in-out',
        }}
      >
        {/* Main Card Content */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(125px, 140px) 1fr',
            alignItems: 'stretch',
          }}
        >
          {/* Column 1: Executive Date & Time Tile */}
          <div
            style={{
              background: 'var(--surface-subtle, #f8fafc)',
              borderRight: '1px solid var(--border, #e2e8f0)',
              padding: '1.25rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            {/* Month Badge */}
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: themeColor,
                background: themeBg,
                padding: '0.15rem 0.6rem',
                borderRadius: '6px',
                marginBottom: '0.25rem',
              }}
            >
              {month}
            </div>

            {/* Day Number */}
            <div
              style={{
                fontSize: '2rem',
                fontWeight: 800,
                lineHeight: 1,
                color: 'var(--text-primary, #0f172a)',
                margin: '0.2rem 0',
              }}
            >
              {day}
            </div>

            {/* Weekday */}
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--muted, #64748b)',
                marginBottom: '0.65rem',
              }}
            >
              {weekday}
            </div>

            {/* Divider */}
            <div
              style={{
                width: '32px',
                height: '1px',
                background: 'var(--border, #e2e8f0)',
                margin: '0 0 0.65rem 0',
              }}
            />

            {/* Time & Duration */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--text-primary, #0f172a)',
              }}
            >
              <Clock size={12} style={{ color: themeColor }} />
              {time}
            </div>
            <div
              style={{
                fontSize: '0.72rem',
                color: 'var(--muted, #64748b)',
                marginTop: '0.15rem',
              }}
            >
              {session.durationMinutes} minutes
            </div>
          </div>

          {/* Column 2: Session Body & Metadata */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            {/* Top Row: Stream Badge, Title, Status & Mode Pill */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginBottom: '0.45rem',
                }}
              >
                {/* Pathway Brand Pill & Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                  {isPms ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px',
                        background: 'rgba(202, 138, 4, 0.12)',
                        color: 'var(--brand-gold, #ca8a04)',
                        border: '1px solid rgba(202, 138, 4, 0.25)',
                      }}
                    >
                      <Target size={12} />
                      MANDATORY PMS 1-ON-1
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px',
                        background: 'rgba(37, 99, 235, 0.1)',
                        color: '#2563eb',
                        border: '1px solid rgba(37, 99, 235, 0.25)',
                      }}
                    >
                      <Sparkles size={12} />
                      SKILL COHORT ({coachees.length} STAFF)
                    </span>
                  )}

                  {/* Lifecycle Status Pill */}
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.55rem',
                      borderRadius: '6px',
                      background: currentBadge.bg,
                      color: currentBadge.color,
                      border: `1px solid ${currentBadge.border}`,
                    }}
                  >
                    {currentBadge.label}
                  </span>
                </div>

                {/* Delivery Mode Badge */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: 'var(--surface-subtle, #f8fafc)',
                    border: '1px solid var(--border, #e2e8f0)',
                    padding: '0.2rem 0.55rem',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #334155)',
                  }}
                >
                  {session.meetingMode === 'VIRTUAL_VIDEO' ? (
                    <>
                      <Video size={13} style={{ color: '#0284c7' }} />
                      <span>Daily.co Live Video</span>
                    </>
                  ) : session.meetingMode === 'PHONE_CALL' ? (
                    <>
                      <Phone size={13} style={{ color: '#16a34a' }} />
                      <span>Phone Call</span>
                    </>
                  ) : (
                    <>
                      <MapPin size={13} style={{ color: '#9333ea' }} />
                      <span>{session.meetingLocation || 'In-Person'}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Session Title */}
              <h3
                style={{
                  margin: '0.35rem 0 0 0',
                  fontSize: '1.18rem',
                  fontWeight: 700,
                  color: 'var(--text-primary, #0f172a)',
                  lineHeight: 1.35,
                }}
              >
                {session.title}
              </h3>

              {/* PMS Goal Alignment Pill (If Mandatory PMS) */}
              {session.targetPmsGoalName && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    marginTop: '0.4rem',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '6px',
                    background: 'rgba(202, 138, 4, 0.08)',
                    border: '1px solid rgba(202, 138, 4, 0.2)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--brand-gold, #ca8a04)',
                  }}
                >
                  <Target size={13} />
                  <span>Target PMS Goal: <strong>{session.targetPmsGoalName}</strong></span>
                </div>
              )}
            </div>

            {/* Middle Row: Coach & Coachee Roster with Avatars */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(180px, 220px) 1fr',
                gap: '1.25rem',
                padding: '0.75rem 1rem',
                background: 'var(--surface-subtle, #f8fafc)',
                borderRadius: '8px',
                border: '1px solid var(--border, #f1f5f9)',
              }}
            >
              {/* Designated Coach */}
              <div>
                <div
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: 'var(--muted, #64748b)',
                    marginBottom: '0.35rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <Shield size={12} style={{ color: themeColor }} />
                  DESIGNATED COACH
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: themeBg,
                      color: themeColor,
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${themeBorder}`,
                      flexShrink: 0,
                    }}
                  >
                    {getInitials(session.coachFullName)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '0.86rem',
                        color: 'var(--text-primary, #0f172a)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {session.coachFullName || 'Coach Assigned'}
                    </div>
                    <div
                      style={{
                        fontSize: '0.74rem',
                        color: 'var(--muted, #64748b)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {session.coachJobTitle || session.coachDepartment || 'Bank of Abyssinia'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Coachee Roster with Invitation & Attendance Chips */}
              <div>
                <div
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: 'var(--muted, #64748b)',
                    marginBottom: '0.35rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <Users size={12} style={{ color: themeColor }} />
                  COACHEE PARTICIPANTS ({coachees.length})
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {coachees.map((p) => {
                    const isAccepted = p.invitationStatus === 'ACCEPTED';
                    const isDeclined = p.invitationStatus === 'DECLINED';
                    const isAttended = p.attendanceStatus === 'ATTENDED';

                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          padding: '0.25rem 0.55rem',
                          background: '#ffffff',
                          border: '1px solid var(--border, #cbd5e1)',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                        }}
                      >
                        {/* Avatar */}
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: '#0f172a',
                            color: '#ffffff',
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {getInitials(p.fullName)}
                        </div>

                        {/* Name */}
                        <span style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                          {p.fullName}
                        </span>

                        {/* Invitation Status Tag */}
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px',
                            background: isAccepted
                              ? 'rgba(22, 163, 74, 0.1)'
                              : isDeclined
                              ? 'rgba(239, 68, 68, 0.1)'
                              : 'rgba(202, 138, 4, 0.12)',
                            color: isAccepted ? '#16a34a' : isDeclined ? '#ef4444' : '#ca8a04',
                          }}
                        >
                          {p.invitationStatus}
                        </span>

                        {/* Attendance Tag if completed */}
                        {session.status === 'COMPLETED' && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                              background: isAttended ? '#dcfce7' : '#fee2e2',
                              color: isAttended ? '#15803d' : '#b91c1c',
                            }}
                          >
                            {p.attendanceStatus}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Row: Action Buttons Hierarchy */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                borderTop: '1px solid var(--border, #f1f5f9)',
                paddingTop: '0.75rem',
              }}
            >
              {/* Left Side: Pending Invitation Response Actions */}
              {currentParticipant && currentParticipant.invitationStatus === 'PENDING' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted, #64748b)' }}>
                    Your Attendance:
                  </span>
                  <button
                    type="button"
                    className="apid-btn"
                    style={{
                      padding: '0.3rem 0.75rem',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      background: '#16a34a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                    }}
                    onClick={() => respondMutation.mutate({ sessionId: session.id, accept: true })}
                    disabled={respondMutation.isPending}
                  >
                    Accept Invite
                  </button>
                  <button
                    type="button"
                    className="apid-btn apid-btn-outline"
                    style={{
                      padding: '0.3rem 0.75rem',
                      fontSize: '0.78rem',
                      color: '#ef4444',
                      borderColor: 'rgba(239, 68, 68, 0.3)',
                    }}
                    onClick={() => respondMutation.mutate({ sessionId: session.id, accept: false })}
                    disabled={respondMutation.isPending}
                  >
                    Decline
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {session.status === 'COMPLETED' && session.sessionNotesMinutes && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(session.id)}
                      className="apid-btn apid-btn-outline"
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.8rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        borderColor: 'var(--border, #cbd5e1)',
                      }}
                    >
                      <FileText size={14} style={{ color: themeColor }} />
                      <span>{isExpanded ? 'Hide Session Minutes' : 'View Session Minutes'}</span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}
                </div>
              )}

              {/* Right Side: Primary and Utility Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {/* Reschedule Button */}
                {(session.status === 'CONFIRMED' || session.status === 'PROPOSED') && (
                  <button
                    type="button"
                    className="apid-btn apid-btn-outline"
                    onClick={() => setSelectedForReschedule(session)}
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                    }}
                  >
                    Reschedule
                  </button>
                )}

                {/* Log Minutes / Complete Button (For Coach or Admin) */}
                {isCoach && session.status !== 'CANCELLED' && (
                  <button
                    type="button"
                    className="apid-btn apid-btn-outline"
                    onClick={() => setSelectedForComplete(session)}
                    style={{
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      borderColor: 'var(--brand-gold, #ca8a04)',
                      color: 'var(--brand-gold, #ca8a04)',
                    }}
                  >
                    <CheckCircle2 size={15} />
                    {session.status === 'COMPLETED' ? 'Edit Minutes' : 'Log Minutes & Attendance'}
                  </button>
                )}

                {/* Feedback Button (Completed) */}
                {session.status === 'COMPLETED' && (
                  <button
                    type="button"
                    className="apid-btn apid-btn-outline"
                    onClick={() => setSelectedForFeedback(session)}
                    style={{
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      color: 'var(--brand-gold, #ca8a04)',
                    }}
                  >
                    <Star size={14} style={{ fill: '#ca8a04', color: '#ca8a04' }} />
                    Give Feedback
                  </button>
                )}

                {/* Primary Action: Join Daily.co Live Video Call */}
                {session.meetingMode === 'VIRTUAL_VIDEO' &&
                  session.status !== 'CANCELLED' &&
                  session.status !== 'COMPLETED' && (
                    <button
                      type="button"
                      className="apid-btn"
                      onClick={() => setSelectedForVideo(session)}
                      style={{
                        padding: '0.45rem 1.15rem',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
                        cursor: 'pointer',
                      }}
                    >
                      <Video size={16} />
                      Join Daily.co Video
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>

        {/* Collapsible Executive Minutes & Assessment Drawer */}
        {session.status === 'COMPLETED' && session.sessionNotesMinutes && isExpanded && (
          <div
            style={{
              padding: '1.25rem 1.5rem',
              background: 'var(--surface-subtle, #f8fafc)',
              borderTop: '1px solid var(--border, #e2e8f0)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Discussion Minutes */}
            <div>
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: 'var(--muted, #64748b)',
                  marginBottom: '0.35rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <FileText size={14} style={{ color: themeColor }} />
                OFFICIAL DISCUSSION MINUTES & OBSERVATIONS
              </div>
              <div
                style={{
                  padding: '0.85rem 1rem',
                  background: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid var(--border, #cbd5e1)',
                  fontSize: '0.88rem',
                  lineHeight: 1.55,
                  color: 'var(--text-secondary, #334155)',
                  whiteSpace: 'pre-line',
                }}
              >
                {session.sessionNotesMinutes}
              </div>
            </div>

            {/* Agreed Next Action Items */}
            {session.actionItems && (
              <div>
                <div
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: 'var(--muted, #64748b)',
                    marginBottom: '0.35rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
                  AGREED NEXT ACTION ITEMS & PRACTICE EXERCISES
                </div>
                <div
                  style={{
                    padding: '0.85rem 1rem',
                    background: '#ffffff',
                    borderRadius: '6px',
                    border: '1px solid var(--border, #cbd5e1)',
                    fontSize: '0.88rem',
                    lineHeight: 1.55,
                    color: 'var(--text-secondary, #334155)',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {session.actionItems}
                </div>
              </div>
            )}

            {/* Individual Coachee Assessments & Feedback Ratings */}
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
                <Star size={14} style={{ color: 'var(--brand-gold, #ca8a04)' }} />
                PARTICIPANT ASSESSMENTS & RATINGS ({coachees.length})
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                {coachees.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid var(--border, #cbd5e1)',
                      borderRadius: '8px',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.86rem' }}>{p.fullName}</span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          background:
                            p.coachAssessment === 'MASTERED'
                              ? '#dcfce7'
                              : p.coachAssessment === 'ON_TRACK'
                              ? '#e0f2fe'
                              : p.coachAssessment === 'NEEDS_IMPROVEMENT'
                              ? '#fee2e2'
                              : 'rgba(202, 138, 4, 0.1)',
                          color:
                            p.coachAssessment === 'MASTERED'
                              ? '#15803d'
                              : p.coachAssessment === 'ON_TRACK'
                              ? '#0284c7'
                              : p.coachAssessment === 'NEEDS_IMPROVEMENT'
                              ? '#b91c1c'
                              : 'var(--brand-gold, #ca8a04)',
                        }}
                      >
                        {p.coachAssessment || 'PROGRESSING'}
                      </span>
                    </div>

                    {p.individualNotes && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted, #64748b)', fontStyle: 'italic' }}>
                        "{p.individualNotes}"
                      </div>
                    )}

                    {p.feedbackRating && (
                      <div
                        style={{
                          marginTop: '0.25rem',
                          paddingTop: '0.35rem',
                          borderTop: '1px solid #f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontSize: '0.78rem',
                          color: 'var(--brand-gold, #ca8a04)',
                          fontWeight: 700,
                        }}
                      >
                        <Star size={13} fill="#ca8a04" />
                        Rating: {p.feedbackRating}/5
                        {p.feedbackComment && (
                          <span style={{ fontWeight: 400, color: 'var(--muted, #64748b)', marginLeft: '0.25rem' }}>
                            · "{p.feedbackComment}"
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="boa-stack">
      {/* ────────────────── TOP CONTROLS & STREAM SWITCHER ────────────────── */}
      <div
        className="apid-card"
        style={{
          background: 'var(--surface, #ffffff)',
          border: '1px solid var(--border, #e2e8f0)',
          borderRadius: '12px',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          {/* Header Title */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  background: 'rgba(202, 138, 4, 0.12)',
                  color: 'var(--brand-gold, #ca8a04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Calendar size={18} />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
                Coaching Sessions & Scheduling
              </h2>
            </div>
            <p className="boa-muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.86rem' }}>
              Structured sessions across 1-on-1 mandatory appraisal remediation and team skill development cohorts.
            </p>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            className="apid-btn apid-btn-primary"
            onClick={() => setIsScheduleOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: 'var(--brand-gold, #ca8a04)',
              borderColor: 'var(--brand-gold, #ca8a04)',
              color: '#ffffff',
              fontWeight: 700,
              padding: '0.5rem 1.1rem',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(202, 138, 4, 0.25)',
            }}
          >
            <Plus size={16} /> Schedule Session
          </button>
        </div>

        {/* ────────────────── FILTER BAR: STREAM TABS + LIFECYCLE ────────────────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            marginTop: '1.25rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border, #f1f5f9)',
          }}
        >
          {/* Stream Segment Switcher (Separates PMS from Skill Dev) */}
          <div
            style={{
              display: 'inline-flex',
              background: 'var(--surface-subtle, #f1f5f9)',
              padding: '0.25rem',
              borderRadius: '8px',
              gap: '0.25rem',
            }}
          >
            {/* All Streams */}
            <button
              type="button"
              onClick={() => setStreamFilter('all')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.85rem',
                fontSize: '0.84rem',
                fontWeight: 700,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                background: streamFilter === 'all' ? '#ffffff' : 'transparent',
                color: streamFilter === 'all' ? 'var(--text-primary, #0f172a)' : 'var(--muted, #64748b)',
                boxShadow: streamFilter === 'all' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <Layers size={14} />
              <span>All Streams</span>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '10px',
                  background: streamFilter === 'all' ? '#0f172a' : 'rgba(100, 116, 139, 0.15)',
                  color: streamFilter === 'all' ? '#ffffff' : 'var(--muted, #64748b)',
                }}
              >
                {sessions.length}
              </span>
            </button>

            {/* Mandatory PMS 1-on-1 */}
            <button
              type="button"
              onClick={() => setStreamFilter('pms')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.85rem',
                fontSize: '0.84rem',
                fontWeight: 700,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                background: streamFilter === 'pms' ? '#ffffff' : 'transparent',
                color: streamFilter === 'pms' ? 'var(--brand-gold, #ca8a04)' : 'var(--muted, #64748b)',
                boxShadow: streamFilter === 'pms' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <Target size={14} />
              <span>Mandatory PMS (1-on-1)</span>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '10px',
                  background: streamFilter === 'pms' ? 'var(--brand-gold, #ca8a04)' : 'rgba(202, 138, 4, 0.15)',
                  color: streamFilter === 'pms' ? '#ffffff' : 'var(--brand-gold, #ca8a04)',
                }}
              >
                {pmsSessions.length}
              </span>
            </button>

            {/* Skill Development Cohorts */}
            <button
              type="button"
              onClick={() => setStreamFilter('skills')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.85rem',
                fontSize: '0.84rem',
                fontWeight: 700,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                background: streamFilter === 'skills' ? '#ffffff' : 'transparent',
                color: streamFilter === 'skills' ? '#2563eb' : 'var(--muted, #64748b)',
                boxShadow: streamFilter === 'skills' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <Sparkles size={14} />
              <span>Skill Cohorts</span>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '10px',
                  background: streamFilter === 'skills' ? '#2563eb' : 'rgba(37, 99, 235, 0.15)',
                  color: streamFilter === 'skills' ? '#ffffff' : '#2563eb',
                }}
              >
                {skillSessions.length}
              </span>
            </button>
          </div>

          {/* Lifecycle Status Filter */}
          <div
            style={{
              display: 'inline-flex',
              background: 'var(--surface-subtle, #f1f5f9)',
              padding: '0.2rem',
              borderRadius: '6px',
              gap: '0.2rem',
            }}
          >
            {(['all', 'upcoming', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: statusFilter === tab ? '#ffffff' : 'transparent',
                  color: statusFilter === tab ? 'var(--text-primary, #0f172a)' : 'var(--muted, #64748b)',
                  boxShadow: statusFilter === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ────────────────── SKELETON LOADING ────────────────── */}
      {isLoading && (
        <div className="apid-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div className="boa-muted">Loading scheduled sessions...</div>
        </div>
      )}

      {/* ────────────────── EMPTY STATE ────────────────── */}
      {!isLoading && sessions.length === 0 && (
        <div
          className="apid-card"
          style={{
            padding: '3.5rem 1.5rem',
            textAlign: 'center',
            background: 'var(--surface, #ffffff)',
            borderRadius: '12px',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(202, 138, 4, 0.1)',
              color: 'var(--brand-gold, #ca8a04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}
          >
            <Calendar size={32} />
          </div>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 700 }}>
            No Coaching Sessions Scheduled
          </h3>
          <p className="boa-muted" style={{ margin: '0 auto 1.5rem', maxWidth: 480, fontSize: '0.9rem' }}>
            You do not have any active or upcoming coaching sessions. Click below to organize your first meeting.
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

      {/* ────────────────── SESSIONS DISPLAY ────────────────── */}
      {!isLoading && sessions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* STREAM SECTION 1: MANDATORY PMS COACHING */}
          {(streamFilter === 'all' || streamFilter === 'pms') && (
            <div>
              {/* Section Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1rem',
                  paddingBottom: '0.5rem',
                  borderBottom: '2px solid rgba(202, 138, 4, 0.25)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '6px',
                      background: 'rgba(202, 138, 4, 0.15)',
                      color: 'var(--brand-gold, #ca8a04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Target size={16} />
                  </div>
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '1.1rem',
                        fontWeight: 800,
                        color: 'var(--text-primary, #0f172a)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      Mandatory PMS Coaching Sessions (1-on-1)
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '0.1rem 0.45rem',
                          borderRadius: '10px',
                          background: 'rgba(202, 138, 4, 0.15)',
                          color: 'var(--brand-gold, #ca8a04)',
                        }}
                      >
                        {visiblePmsSessions.length} {visiblePmsSessions.length === 1 ? 'Meeting' : 'Meetings'}
                      </span>
                    </h3>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--muted, #64748b)' }}>
                      Confidential appraisal performance improvement sessions tied to individual PMS scorecard goals.
                    </p>
                  </div>
                </div>
              </div>

              {/* Cards List */}
              {visiblePmsSessions.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {visiblePmsSessions.map(renderMeetingCard)}
                </div>
              ) : (
                <div
                  style={{
                    padding: '2rem',
                    textAlign: 'center',
                    background: 'var(--surface-subtle, #f8fafc)',
                    borderRadius: '8px',
                    border: '1px dashed var(--border, #cbd5e1)',
                    fontSize: '0.88rem',
                    color: 'var(--muted, #64748b)',
                  }}
                >
                  No mandatory PMS coaching sessions match the selected filter.
                </div>
              )}
            </div>
          )}

          {/* STREAM SECTION 2: SKILL DEVELOPMENT COHORTS */}
          {(streamFilter === 'all' || streamFilter === 'skills') && (
            <div>
              {/* Section Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1rem',
                  paddingBottom: '0.5rem',
                  borderBottom: '2px solid rgba(37, 99, 235, 0.25)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '6px',
                      background: 'rgba(37, 99, 235, 0.12)',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '1.1rem',
                        fontWeight: 800,
                        color: 'var(--text-primary, #0f172a)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      Group Skill Development Cohorts
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '0.1rem 0.45rem',
                          borderRadius: '10px',
                          background: 'rgba(37, 99, 235, 0.12)',
                          color: '#2563eb',
                        }}
                      >
                        {visibleSkillSessions.length} {visibleSkillSessions.length === 1 ? 'Cohort' : 'Cohorts'}
                      </span>
                    </h3>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--muted, #64748b)' }}>
                      Collaborative cohort workshops for targeted capability growth and cross-training.
                    </p>
                  </div>
                </div>
              </div>

              {/* Cards List */}
              {visibleSkillSessions.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {visibleSkillSessions.map(renderMeetingCard)}
                </div>
              ) : (
                <div
                  style={{
                    padding: '2rem',
                    textAlign: 'center',
                    background: 'var(--surface-subtle, #f8fafc)',
                    borderRadius: '8px',
                    border: '1px dashed var(--border, #cbd5e1)',
                    fontSize: '0.88rem',
                    color: 'var(--muted, #64748b)',
                  }}
                >
                  No skill development cohort sessions match the selected filter.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ────────────────── MODALS ────────────────── */}

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
