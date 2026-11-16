import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  Video,
  Phone,
  MapPin,
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
  Award,
  Sliders,
  PlusCircle,
} from 'lucide-react';
import { useAuth } from '../../../app/AuthContext';
import { coreConfigApi } from '../../admin/config/api/coreConfigApi';
import {
  coachingSessionApi,
  coachingGovernanceApi,
  CoachingSessionItem,
} from '../api/coachingSessionApi';
import { MyCoacheeItem } from '../api/coachingAssignmentApi';
import { ScheduleSessionModal } from './ScheduleSessionModal';
import { ScheduleSeriesModal } from './ScheduleSeriesModal';
import { TargetActionModal } from './TargetActionModal';
import { CompleteSessionModal } from './CompleteSessionModal';
import { RescheduleModal } from './RescheduleModal';
import { SessionFeedbackModal } from './SessionFeedbackModal';
import { DailyVideoModal } from './DailyVideoModal';
import { DeclineInvitationModal } from './DeclineInvitationModal';
import { TalentProgressModal } from './TalentProgressModal';

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
  const { hasAnyPermission } = useAuth();

  const canSchedule =
    (myCoachees && myCoachees.length > 0) ||
    hasAnyPermission(['ADMIN_PORTAL_ACCESS', 'PMS_ADMIN_ACCESS', 'HR_ADMIN_ACCESS', 'COACHING_INITIATIVE_CREATE']);

  // Primary stream filter: 'all' | 'pms' | 'skills'
  const [streamFilter, setStreamFilter] = useState<StreamFilter>('all');

  // Secondary lifecycle filter: 'all' | 'upcoming' | 'completed'
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Modals state
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isSeriesOpen, setIsSeriesOpen] = useState(false);
  const [targetActionState, setTargetActionState] = useState<{
    isOpen: boolean;
    mode: 'EXTENSION' | 'EARLY_COMPLETION';
  }>({ isOpen: false, mode: 'EXTENSION' });
  const [selectedForComplete, setSelectedForComplete] = useState<CoachingSessionItem | null>(null);
  const [selectedForReschedule, setSelectedForReschedule] = useState<CoachingSessionItem | null>(null);
  const [selectedForFeedback, setSelectedForFeedback] = useState<CoachingSessionItem | null>(null);
  const [selectedForVideo, setSelectedForVideo] = useState<CoachingSessionItem | null>(null);
  const [selectedForDecline, setSelectedForDecline] = useState<CoachingSessionItem | null>(null);
  const [selectedForTalentProgress, setSelectedForTalentProgress] = useState<{
    session: CoachingSessionItem;
    existingNotes?: string;
  } | null>(null);

  // Expanded notes state
  const [expandedSessionIds, setExpandedSessionIds] = useState<Record<number, boolean>>({});

  const toggleExpand = (id: number) => {
    setExpandedSessionIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Expanded roadmap per series state
  const [expandedSeriesRoadmaps, setExpandedSeriesRoadmaps] = useState<Record<number, boolean>>({});

  const toggleSeriesRoadmap = (seriesId: number) => {
    setExpandedSeriesRoadmaps((prev) => ({ ...prev, [seriesId]: !prev[seriesId] }));
  };

  // Fetch system configs for coaching policies (e.g. 15-min early video join window)
  const { data: activeConfig } = useQuery({
    queryKey: ['core', 'active-config'],
    queryFn: coreConfigApi.getActiveConfig,
    staleTime: 60_000,
  });
  const earlyJoinMinutes = activeConfig?.publicConfig?.coachingEarlyJoinWindowMinutes ?? 15;

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

  // Respond reschedule proposal mutation (Coach accept/reject)
  const respondRescheduleMutation = useMutation({
    mutationFn: ({ sessionId, accept }: { sessionId: number; accept: boolean }) =>
      coachingSessionApi.respondPendingReschedule(sessionId, { accept }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching-sessions'] });
      refetch();
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

  const primaryAssignmentId = myCoachees?.[0]?.assignmentId || pmsSessions?.[0]?.assignmentId;
  const { data: targetData } = useQuery({
    queryKey: ['coaching-target', primaryAssignmentId],
    queryFn: () => coachingGovernanceApi.getTarget({ assignmentId: primaryAssignmentId ? Number(primaryAssignmentId) : undefined }),
    enabled: !!primaryAssignmentId,
  });

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

  // Group sessions by seriesId for unified recurring rhythm cards
  const groupSessionsBySeries = (sessionList: CoachingSessionItem[]) => {
    const seriesMap = new Map<number, CoachingSessionItem[]>();
    const standalone: CoachingSessionItem[] = [];

    for (const session of sessionList) {
      if (session.seriesId) {
        if (!seriesMap.has(session.seriesId)) {
          seriesMap.set(session.seriesId, []);
        }
        seriesMap.get(session.seriesId)!.push(session);
      } else {
        standalone.push(session);
      }
    }

    seriesMap.forEach((items) => {
      items.sort((a, b) => {
        if (a.sequenceNumber != null && b.sequenceNumber != null) {
          return a.sequenceNumber - b.sequenceNumber;
        }
        return new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime();
      });
    });

    return { seriesMap, standalone };
  };

  const pmsSeriesData = useMemo(
    () => groupSessionsBySeries(visiblePmsSessions),
    [visiblePmsSessions]
  );
  const skillSeriesData = useMemo(
    () => groupSessionsBySeries(visibleSkillSessions),
    [visibleSkillSessions]
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

    // Time window calculations for Smart Video & Log Minutes
    const nowMs = Date.now();
    const startMs = new Date(session.scheduledStartTime).getTime();
    const durationMs = (session.durationMinutes || 30) * 60 * 1000;
    const endMs = session.scheduledEndTime
      ? new Date(session.scheduledEndTime).getTime()
      : startMs + durationMs;
    const earlyJoinMs = earlyJoinMinutes * 60 * 1000;
    const callOpensAt = startMs - earlyJoinMs;
    const callClosesAt = endMs + 30 * 60 * 1000;

    const isTooEarlyForCall = nowMs < callOpensAt;
    const isCallActive = nowMs >= callOpensAt && nowMs <= callClosesAt;
    const isMeetingStarted = nowMs >= startMs;

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

                  {/* Series Sequence Badge */}
                  {session.sequenceNumber && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: '#2563eb',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                      }}
                    >
                      Session #{session.sequenceNumber}
                    </span>
                  )}

                  {/* Extension Session Badge */}
                  {session.isExtensionSession && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px',
                        background: 'rgba(234, 88, 12, 0.1)',
                        color: '#ea580c',
                        border: '1px solid rgba(234, 88, 12, 0.25)',
                      }}
                    >
                      Extension
                    </span>
                  )}
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

              {/* Reschedule Pending Attention Banner */}
              {session.status === 'RESCHEDULE_PENDING' && (
                <div
                  style={{
                    marginTop: '0.65rem',
                    padding: '0.65rem 0.9rem',
                    background: 'rgba(234, 88, 12, 0.08)',
                    border: '1px solid rgba(234, 88, 12, 0.25)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.6rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <Clock size={16} style={{ color: '#ea580c', marginTop: '2px', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#9a3412' }}>
                        Reschedule Requested
                        {session.pendingRescheduleProposal?.proposedByFullName
                          ? ` by ${session.pendingRescheduleProposal.proposedByFullName}`
                          : ''}
                      </div>
                      {session.pendingRescheduleProposal && (
                        <div style={{ fontSize: '0.78rem', color: '#7c2d12', marginTop: '0.15rem' }}>
                          Proposed: <strong>{new Date(session.pendingRescheduleProposal.proposedStartTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</strong>
                          {session.pendingRescheduleProposal.reason && ` — "${session.pendingRescheduleProposal.reason}"`}
                        </div>
                      )}
                    </div>
                  </div>

                  {isCoach && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        type="button"
                        className="apid-btn"
                        style={{
                          padding: '0.25rem 0.65rem',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          background: '#16a34a',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                        }}
                        onClick={() => respondRescheduleMutation.mutate({ sessionId: session.id, accept: true })}
                        disabled={respondRescheduleMutation.isPending}
                      >
                        Accept New Time
                      </button>
                      <button
                        type="button"
                        className="apid-btn apid-btn-outline"
                        style={{
                          padding: '0.25rem 0.65rem',
                          fontSize: '0.76rem',
                          color: '#64748b',
                          borderColor: '#cbd5e1',
                        }}
                        onClick={() => respondRescheduleMutation.mutate({ sessionId: session.id, accept: false })}
                        disabled={respondRescheduleMutation.isPending}
                      >
                        Keep Original Time
                      </button>
                    </div>
                  )}
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

                        {/* Progress update indicator chip */}
                        {p.coacheeProgressNotes && (
                          <span
                            title={`Progress update: "${p.coacheeProgressNotes}"`}
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                              background: '#f0fdf4',
                              color: '#15803d',
                              border: '1px solid #bbf7d0',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                            }}
                          >
                            <CheckCircle2 size={10} /> Progress Shared
                          </span>
                        )}

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
              {/* Left Side: Pending Invitation Response Actions & Talent Progress Update */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {session.status !== 'COMPLETED' &&
                  session.status !== 'CANCELLED' &&
                  currentParticipant &&
                  currentParticipant.invitationStatus === 'PENDING' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
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
                        onClick={() => setSelectedForDecline(session)}
                        disabled={respondMutation.isPending}
                      >
                        Unable to Attend
                      </button>
                    </div>
                  )}

                {/* Coachee Self-Progress Reporting Button */}
                {currentParticipant && currentParticipant.role === 'COACHEE' && (
                  <button
                    type="button"
                    className="apid-btn apid-btn-outline"
                    onClick={() =>
                      setSelectedForTalentProgress({
                        session,
                        existingNotes: currentParticipant.coacheeProgressNotes || '',
                      })
                    }
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      borderColor: currentParticipant.coacheeProgressNotes ? '#16a34a' : 'var(--border, #cbd5e1)',
                      color: currentParticipant.coacheeProgressNotes ? '#15803d' : 'var(--text-primary, #0f172a)',
                      background: currentParticipant.coacheeProgressNotes ? 'rgba(22, 163, 74, 0.08)' : 'transparent',
                    }}
                  >
                    <Award size={13} style={{ color: currentParticipant.coacheeProgressNotes ? '#16a34a' : '#64748b' }} />
                    <span>{currentParticipant.coacheeProgressNotes ? 'Edit My Progress' : 'Share My Progress'}</span>
                  </button>
                )}

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

                {/* Log Minutes / Complete Button (Time guarded: disabled before start time) */}
                {isCoach && session.status !== 'CANCELLED' && (
                  !isMeetingStarted && session.status !== 'COMPLETED' ? (
                    <button
                      type="button"
                      disabled
                      className="apid-btn apid-btn-outline"
                      title={`Log minutes unlocks once meeting starts at ${time}`}
                      style={{
                        padding: '0.4rem 0.85rem',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        borderColor: '#e2e8f0',
                        color: '#94a3b8',
                        background: '#f8fafc',
                        cursor: 'not-allowed',
                      }}
                    >
                      <Clock size={14} />
                      <span>Log Minutes (Starts {time})</span>
                    </button>
                  ) : (
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
                  )
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

                {/* Primary Action: Daily.co Video Call (Window guarded) */}
                {session.meetingMode === 'VIRTUAL_VIDEO' &&
                  session.status !== 'CANCELLED' &&
                  session.status !== 'COMPLETED' && (
                    isTooEarlyForCall ? (
                      <button
                        type="button"
                        disabled
                        className="apid-btn apid-btn-outline"
                        title={`Call room opens ${earlyJoinMinutes} minutes before the scheduled time (${new Date(callOpensAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })})`}
                        style={{
                          padding: '0.45rem 0.95rem',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          color: '#64748b',
                          borderColor: '#cbd5e1',
                          background: '#f8fafc',
                          cursor: 'not-allowed',
                        }}
                      >
                        <Clock size={14} style={{ color: '#94a3b8' }} />
                        <span>Opens {earlyJoinMinutes}m before call</span>
                      </button>
                    ) : isCallActive ? (
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
                    ) : (
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: '#94a3b8',
                          padding: '0.35rem 0.5rem',
                        }}
                      >
                        Meeting ended
                      </span>
                    )
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

            {/* Coachee Self-Progress Updates & Reflections */}
            {coachees.some((p) => p.coacheeProgressNotes) && (
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
                  <Award size={14} style={{ color: themeColor }} />
                  COACHEE SELF-PROGRESS & ACTION UPDATES
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                  {coachees
                    .filter((p) => p.coacheeProgressNotes)
                    .map((p) => (
                      <div
                        key={p.id}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          padding: '0.75rem 1rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.84rem' }}>{p.fullName}</span>
                          <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 600 }}>
                            {p.coacheeProgressSubmittedAt
                              ? new Date(p.coacheeProgressSubmittedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
                              : 'Submitted'}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#334155', fontStyle: 'italic', lineHeight: 1.45 }}>
                          "{p.coacheeProgressNotes}"
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render an Executive Recurring Coaching Rhythm Series Card (Parent Hub)
  const renderSeriesCard = (seriesId: number, seriesSessions: CoachingSessionItem[]) => {
    if (!seriesSessions || seriesSessions.length === 0) return null;

    const sorted = [...seriesSessions].sort(
      (a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0)
    );
    const totalCount = sorted.length;
    const completedCount = sorted.filter((s) => s.status === 'COMPLETED').length;
    const progressPercent = Math.round((completedCount / totalCount) * 100);
    const isAllCompleted = completedCount === totalCount;

    // Next upcoming/active session in sequence
    const nextSession =
      sorted.find((s) => s.status !== 'COMPLETED' && s.status !== 'CANCELLED') ||
      sorted[sorted.length - 1];

    const cleanTitle = sorted[0].title.replace(/\s*—\s*Session\s*\d+$/i, '');
    const isPms = sorted[0].pathway === 'MANDATORY_PMS';
    const { weekday, time } = parseDateParts(sorted[0].scheduledStartTime);
    const duration = sorted[0].durationMinutes || 45;
    const coachName = sorted[0].coachFullName || 'Designated Coach';
    const coachees = sorted[0].participants.filter((p) => p.role === 'COACHEE');
    const isRoadmapOpen = !!expandedSeriesRoadmaps[seriesId];

    const themeColor = isPms ? 'var(--brand-gold, #ca8a04)' : '#2563eb';
    const themeBg = isPms ? 'rgba(202, 138, 4, 0.08)' : 'rgba(37, 99, 235, 0.08)';
    const themeBorder = isPms ? 'rgba(202, 138, 4, 0.25)' : 'rgba(37, 99, 235, 0.25)';

    return (
      <div
        key={`series-${seriesId}`}
        className="apid-card"
        style={{
          background: 'var(--surface, #ffffff)',
          border: '1px solid var(--border, #e2e8f0)',
          borderLeft: `5px solid ${themeColor}`,
          borderRadius: '14px',
          padding: 0,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          marginBottom: '1.5rem',
        }}
      >
        {/* SERIES EXECUTIVE HEADER */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            background: isPms
              ? 'linear-gradient(135deg, rgba(202, 138, 4, 0.07) 0%, rgba(255, 255, 255, 0.95) 100%)'
              : 'linear-gradient(135deg, rgba(37, 99, 235, 0.07) 0%, rgba(255, 255, 255, 0.95) 100%)',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '6px',
                  background: themeBg,
                  color: themeColor,
                  border: `1px solid ${themeBorder}`,
                }}
              >
                {isPms ? <Target size={13} /> : <Sparkles size={13} />}
                {isPms ? 'MANDATORY PMS RHYTHM' : 'SKILL COHORT RHYTHM'}
              </span>

              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.55rem',
                  borderRadius: '6px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                }}
              >
                {totalCount}-Week Rhythm
              </span>

              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.55rem',
                  borderRadius: '6px',
                  background: '#ffffff',
                  color: 'var(--muted, #64748b)',
                  border: '1px solid var(--border, #e2e8f0)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <Clock size={12} style={{ color: themeColor }} />
                Weekly • Every {weekday} at {time} ({duration}m)
              </span>
            </div>

            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
              {cleanTitle}
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.82rem', color: 'var(--muted, #64748b)', flexWrap: 'wrap' }}>
              <span>
                <strong style={{ color: 'var(--text-primary, #0f172a)' }}>Coach:</strong> {coachName}
              </span>
              <span>•</span>
              <span>
                <strong style={{ color: 'var(--text-primary, #0f172a)' }}>Coachee:</strong>{' '}
                {coachees.map((c) => c.fullName).join(', ') || 'Designated Talent'}
              </span>
            </div>
          </div>

          {/* Progress Indicator */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '0.4rem',
              minWidth: 170,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
                {completedCount} of {totalCount} Completed
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.1rem 0.45rem',
                  borderRadius: '4px',
                  background: isAllCompleted ? '#dcfce7' : 'rgba(202, 138, 4, 0.12)',
                  color: isAllCompleted ? '#15803d' : themeColor,
                }}
              >
                {progressPercent}%
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: 7,
                background: '#e2e8f0',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: isAllCompleted ? '#16a34a' : themeColor,
                  borderRadius: 4,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        </div>

        {/* SPOTLIGHT: NEXT UPCOMING FOCUS OCCURRENCE */}
        {isAllCompleted ? (
          <div style={{ padding: '2rem', textAlign: 'center', background: '#f0fdf4' }}>
            <CheckCircle2 size={36} color="#16a34a" style={{ margin: '0 auto 0.6rem' }} />
            <h4 style={{ margin: '0 0 0.25rem', color: '#15803d', fontWeight: 800, fontSize: '1.05rem' }}>
              All {totalCount} Coaching Sessions Completed!
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#166534' }}>
              The full quarterly coaching rhythm has been verified and successfully delivered.
            </p>
          </div>
        ) : (
          <div style={{ padding: '1.25rem 1.75rem', background: '#ffffff' }}>
            <div
              style={{
                fontSize: '0.74rem',
                fontWeight: 800,
                letterSpacing: '0.06em',
                color: themeColor,
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Sparkles size={14} />
              NEXT FOCUS SESSION — OCCURRENCE #{nextSession.sequenceNumber} OF {totalCount}
            </div>

            {/* Spotlight Card: Individual Interactive Meeting Card */}
            <div>
              {renderMeetingCard(nextSession)}
            </div>
          </div>
        )}

        {/* COLLAPSIBLE 12-WEEK ROADMAP ACCORDION */}
        <div
          style={{
            borderTop: '1px solid var(--border, #e2e8f0)',
            background: 'var(--surface-subtle, #f8fafc)',
          }}
        >
          <button
            type="button"
            onClick={() => toggleSeriesRoadmap(seriesId)}
            style={{
              width: '100%',
              padding: '0.9rem 1.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <Calendar size={15} style={{ color: themeColor }} />
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                {isRoadmapOpen ? `Hide Full ${totalCount}-Week Rhythm Schedule` : `View All ${totalCount} Scheduled Occurrences`}
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '0.12rem 0.5rem',
                  borderRadius: '10px',
                  background: 'rgba(0,0,0,0.06)',
                  color: 'var(--muted, #64748b)',
                  fontWeight: 600,
                }}
              >
                {completedCount} done · {totalCount - completedCount} remaining
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                color: themeColor,
                fontSize: '0.82rem',
                fontWeight: 700,
              }}
            >
              <span>{isRoadmapOpen ? 'Collapse Roadmap' : 'Expand 12-Week Roadmap'}</span>
              {isRoadmapOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          {isRoadmapOpen && (
            <div style={{ padding: '0 1.75rem 1.5rem 1.75rem', overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.82rem',
                  background: '#ffffff',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid var(--border, #e2e8f0)',
                }}
              >
                <thead>
                  <tr style={{ background: 'var(--surface-subtle, #f1f5f9)', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 700, color: '#475569' }}>#</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Date & Day</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Time</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Quarter Milestone / Focus</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Status</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: '#475569' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((occ) => {
                    const occParts = parseDateParts(occ.scheduledStartTime);
                    const isNext = occ.id === nextSession.id;
                    const isCompleted = occ.status === 'COMPLETED';

                    let milestoneText = `Session #${occ.sequenceNumber} Performance Remediation`;
                    let milestoneBadge: string | null = null;
                    if (occ.sequenceNumber === 1) {
                      milestoneText = 'Initial Alignment & Baseline Review';
                    } else if (occ.sequenceNumber === 6) {
                      milestoneText = 'Week 6 Mid-Quarter Progress Checkpoint';
                      milestoneBadge = 'Buffer / Checkpoint';
                    } else if (occ.sequenceNumber === totalCount) {
                      milestoneText = 'Week 12 Quarter Close & Final Evaluation';
                      milestoneBadge = 'Quarter Evaluation';
                    } else if (occ.isExtensionSession) {
                      milestoneText = 'Post-Target Extension Session';
                      milestoneBadge = 'Extension';
                    }

                    return (
                      <tr
                        key={occ.id}
                        style={{
                          borderBottom: '1px solid var(--border, #f1f5f9)',
                          background: isNext ? 'rgba(202, 138, 4, 0.05)' : isCompleted ? '#fafafa' : '#ffffff',
                          fontWeight: isNext ? 600 : 400,
                        }}
                      >
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              background: isCompleted ? '#dcfce7' : isNext ? themeColor : '#f1f5f9',
                              color: isCompleted ? '#15803d' : isNext ? '#ffffff' : '#64748b',
                            }}
                          >
                            {occ.sequenceNumber ?? '•'}
                          </span>
                        </td>

                        <td style={{ padding: '0.65rem 0.85rem', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                            {occParts.month} {occParts.day}, {new Date(occ.scheduledStartTime).getFullYear()}
                          </span>
                          <span style={{ color: 'var(--muted, #64748b)', marginLeft: '0.35rem', fontSize: '0.78rem' }}>
                            ({occParts.weekday})
                          </span>
                        </td>

                        <td style={{ padding: '0.65rem 0.85rem', whiteSpace: 'nowrap', color: 'var(--text-secondary, #334155)' }}>
                          {occParts.time} ({occ.durationMinutes}m)
                        </td>

                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span>{milestoneText}</span>
                            {milestoneBadge && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '4px',
                                  background: milestoneBadge === 'Extension' ? 'rgba(234, 88, 12, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                  color: milestoneBadge === 'Extension' ? '#ea580c' : '#2563eb',
                                }}
                              >
                                {milestoneBadge}
                              </span>
                            )}
                            {isNext && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '4px',
                                  background: 'rgba(202, 138, 4, 0.15)',
                                  color: 'var(--brand-gold, #ca8a04)',
                                }}
                              >
                                Current Focus
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '0.65rem 0.85rem', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              background:
                                occ.status === 'COMPLETED' ? '#dcfce7' :
                                occ.status === 'CONFIRMED' ? 'rgba(22, 163, 74, 0.1)' :
                                occ.status === 'RESCHEDULE_PENDING' ? 'rgba(234, 88, 12, 0.1)' : '#f1f5f9',
                              color:
                                occ.status === 'COMPLETED' ? '#15803d' :
                                occ.status === 'CONFIRMED' ? '#16a34a' :
                                occ.status === 'RESCHEDULE_PENDING' ? '#ea580c' : '#64748b',
                            }}
                          >
                            {occ.status === 'RESCHEDULE_PENDING' ? 'Reschedule Pending' : occ.status}
                          </span>
                        </td>

                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                            {isCompleted && occ.sessionNotesMinutes && (
                              <button
                                type="button"
                                className="apid-btn apid-btn-outline"
                                onClick={() => toggleExpand(occ.id)}
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.74rem' }}
                                title="View Discussion Minutes"
                              >
                                <FileText size={12} /> Minutes
                              </button>
                            )}

                            {(occ.status === 'CONFIRMED' || occ.status === 'PROPOSED') && (
                              <button
                                type="button"
                                className="apid-btn apid-btn-outline"
                                onClick={() => setSelectedForReschedule(occ)}
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.74rem' }}
                                title="Reschedule This Occurrence"
                              >
                                Reschedule
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
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

          {/* Primary Action Button: Standard Bank Recurring Coaching Rhythm */}
          {canSchedule && (
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <button
                type="button"
                className="apid-btn apid-btn-primary"
                onClick={() => setIsSeriesOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  backgroundColor: 'var(--brand-gold, #ca8a04)',
                  borderColor: 'var(--brand-gold, #ca8a04)',
                  color: '#ffffff',
                  fontWeight: 700,
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(202, 138, 4, 0.25)',
                }}
              >
                <Calendar size={16} /> Set Meeting Rhythm
              </button>
            </div>
          )}
        </div>

        {/* ────────────────── COACHING TARGET & LIFECYCLE GOVERNANCE CARD ────────────────── */}
        {targetData && (
          <div
            style={{
              marginTop: '1.25rem',
              marginBottom: '1rem',
              background: 'linear-gradient(135deg, rgba(202, 138, 4, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)',
              border: '1px solid rgba(202, 138, 4, 0.25)',
              borderRadius: '12px',
              padding: '1.1rem 1.4rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Top row: Policy name & Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                paddingBottom: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Sliders size={18} color="var(--brand-gold, #ca8a04)" />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Coaching Target Governance & Progress
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        background:
                          targetData.status === 'COMPLETED_EARLY'
                            ? 'rgba(34, 197, 94, 0.15)'
                            : targetData.status === 'EXTENDED'
                            ? 'rgba(234, 88, 12, 0.15)'
                            : 'rgba(59, 130, 246, 0.15)',
                        color:
                          targetData.status === 'COMPLETED_EARLY'
                            ? '#16a34a'
                            : targetData.status === 'EXTENDED'
                            ? '#ea580c'
                            : '#2563eb',
                      }}
                    >
                      {targetData.status.replace('_', ' ')}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Standard Policy: {targetData.policyName}
                  </span>
                </div>
              </div>

              {/* Action Buttons for Coach */}
              {canSchedule && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="apid-btn apid-btn-outline"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    onClick={() => setTargetActionState({ isOpen: true, mode: 'EXTENSION' })}
                  >
                    <PlusCircle size={14} color="var(--brand-gold)" /> Request Extension (+Sessions)
                  </button>
                  <button
                    type="button"
                    className="apid-btn apid-btn-outline"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    onClick={() => setTargetActionState({ isOpen: true, mode: 'EARLY_COMPLETION' })}
                  >
                    <Award size={14} color="var(--success)" /> Mark Objectives Achieved Early
                  </button>
                </div>
              )}
            </div>

            {/* Bottom row: The 4 Governance Numbers in Executive Metric Tiles */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
                gap: '0.75rem',
              }}
            >
              {/* Metric 1: Policy Baseline */}
              <div
                style={{
                  background: 'var(--surface, #ffffff)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.65rem 0.9rem',
                }}
              >
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>
                  1. Bank Policy Guide
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {targetData.policyBaseline}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Suggested Baseline</span>
              </div>

              {/* Metric 2: Approved Target */}
              <div
                style={{
                  background: 'var(--surface, #ffffff)',
                  border: '1px solid var(--brand-gold, #ca8a04)',
                  borderRadius: '8px',
                  padding: '0.65rem 0.9rem',
                }}
              >
                <span style={{ fontSize: '0.74rem', color: 'var(--brand-gold, #ca8a04)', fontWeight: 700, display: 'block' }}>
                  2. Agreed Target
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand-gold, #ca8a04)' }}>
                  {targetData.approvedTarget}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Active Commitment</span>
              </div>

              {/* Metric 3: Planned Sessions */}
              <div
                style={{
                  background: 'var(--surface, #ffffff)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.65rem 0.9rem',
                }}
              >
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>
                  3. Scheduled Meetings
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {targetData.plannedOccurrences}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Planned on Calendar</span>
              </div>

              {/* Metric 4: Completed Sessions */}
              <div
                style={{
                  background: 'var(--surface, #ffffff)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.65rem 0.9rem',
                }}
              >
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>
                  4. Completed Meetings
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a' }}>
                  {targetData.completedSessions}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Delivered & Verified</span>
              </div>

              {/* Metric 5: Remaining Sessions */}
              <div
                style={{
                  background: 'var(--surface, #ffffff)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.65rem 0.9rem',
                }}
              >
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>
                  Remaining Commitment
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: targetData.remainingApprovedSessions > 0 ? '#ea580c' : '#16a34a' }}>
                  {targetData.remainingApprovedSessions}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Sessions to complete</span>
              </div>
            </div>
          </div>
        )}

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
            onClick={() => setIsSeriesOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: 'var(--brand-gold, #ca8a04)',
              borderColor: 'var(--brand-gold, #ca8a04)',
              color: '#fff',
            }}
          >
            <Calendar size={16} /> Set Meeting Rhythm
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

              {/* Series Rhythm Hub Cards & Standalone Sessions */}
              {visiblePmsSessions.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Series Recurring Rhythm Cards */}
                  {Array.from(pmsSeriesData.seriesMap.entries()).map(([seriesId, seriesSessions]) =>
                    renderSeriesCard(seriesId, seriesSessions)
                  )}

                  {/* Standalone Sessions (if any) */}
                  {pmsSeriesData.standalone.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      {pmsSeriesData.seriesMap.size > 0 && (
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--muted, #64748b)', marginBottom: '0.75rem' }}>
                          Standalone & Ad-Hoc Sessions
                        </h4>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {pmsSeriesData.standalone.map(renderMeetingCard)}
                      </div>
                    </div>
                  )}
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

              {/* Series Rhythm Hub Cards & Standalone Cohorts */}
              {visibleSkillSessions.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Series Recurring Rhythm Cards */}
                  {Array.from(skillSeriesData.seriesMap.entries()).map(([seriesId, seriesSessions]) =>
                    renderSeriesCard(seriesId, seriesSessions)
                  )}

                  {/* Standalone Sessions (if any) */}
                  {skillSeriesData.standalone.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      {skillSeriesData.seriesMap.size > 0 && (
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--muted, #64748b)', marginBottom: '0.75rem' }}>
                          Standalone Skill Workshops
                        </h4>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {skillSeriesData.standalone.map(renderMeetingCard)}
                      </div>
                    </div>
                  )}
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

      {/* Schedule Single Session Modal */}
      <ScheduleSessionModal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        myCoachees={myCoachees}
      />

      {/* Schedule Recurring Rhythm Series Modal */}
      <ScheduleSeriesModal
        isOpen={isSeriesOpen}
        onClose={() => setIsSeriesOpen(false)}
        myCoachees={myCoachees}
      />

      {/* Target Action Modal (Extension or Early Completion) */}
      {targetData && (
        <TargetActionModal
          isOpen={targetActionState.isOpen}
          onClose={() => setTargetActionState((prev) => ({ ...prev, isOpen: false }))}
          target={targetData}
          mode={targetActionState.mode}
        />
      )}

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

      {/* Decline Invitation Modal with Mandatory Reason */}
      <DeclineInvitationModal
        isOpen={selectedForDecline !== null}
        onClose={() => setSelectedForDecline(null)}
        sessionTitle={selectedForDecline?.title || 'Coaching Session'}
        onConfirmDecline={async (reason) => {
          if (selectedForDecline) {
            await coachingSessionApi.respondInvitation(selectedForDecline.id, {
              accept: false,
              declineReason: reason,
            });
            queryClient.invalidateQueries({ queryKey: ['coaching-sessions'] });
            refetch();
          }
        }}
        onRequestReschedule={() => {
          if (selectedForDecline) {
            setSelectedForReschedule(selectedForDecline);
          }
        }}
      />

      {/* Talent Self-Progress Reporting Modal */}
      <TalentProgressModal
        isOpen={selectedForTalentProgress !== null}
        onClose={() => setSelectedForTalentProgress(null)}
        sessionTitle={selectedForTalentProgress?.session.title || 'Coaching Session'}
        existingNotes={selectedForTalentProgress?.existingNotes}
        onSubmitProgress={async (notes) => {
          if (selectedForTalentProgress) {
            await coachingSessionApi.submitCoacheeProgress(selectedForTalentProgress.session.id, {
              progressNotes: notes,
            });
            queryClient.invalidateQueries({ queryKey: ['coaching-sessions'] });
            refetch();
          }
        }}
      />
    </div>
  );
};
