import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Clock,
  Check,
  X,
  RefreshCw,
  AlertCircle,
  MapPin,
  Ban,
  Calendar,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import { extractApiErrorMessage } from '../../../shared/api/apiClient';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  StatusPill,
  useToast,
} from '../../../shared/components/ui';
import {
  mentoringPairingApi,
  type MentoringSession,
  type MentoringDeliveryMode,
} from '../api/mentoringPairingApi';
import { MentoringDailyVideoModal } from '../components/MentoringDailyVideoModal';
import { MentoringSessionJoinButton } from '../components/MentoringSessionJoinButton';
import {
  MentoringSessionListHeader,
  MentoringSessionListRow,
} from '../components/MentoringSessionListRow';
import { MentoringSessionReport } from '../components/MentoringSessionReport';
import { MentoringSessionRating } from '../components/MentoringSessionRating';
import { MentoringResourcesPanel } from '../components/MentoringCollaborationTools';
import {
  BANK_OPERATING_TIME_OPTIONS,
  toEthiopianTime,
} from '../../coaching/utils/ethiopianTimeUtils';
import { getMentoringDeliveryModeLabel } from '../utils/mentoringSessionUtils';
import './MentoringDashboard.css';

type SessionView = 'mentor' | 'trainee';

function getErrorMessage(error: unknown, fallback: string) {
  return extractApiErrorMessage(error, fallback);
}

function buildEatIsoString(dateStr: string, timeStr: string, durationMinutes = 0): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const dateUtc = new Date(Date.UTC(year, month - 1, day, hour - 3, minute + durationMinutes));
  return dateUtc.toISOString();
}

function formatSessionStart(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatDualTimeRange(startIso: string, endIso: string) {
  try {
    const startEth = toEthiopianTime(startIso);
    const endEth = toEthiopianTime(endIso);
    const dateFormatted = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Africa/Addis_Ababa',
    }).format(new Date(startIso));

    return {
      date: dateFormatted,
      ethiopianRange: `${startEth.ethiopianHour.toString().padStart(2, '0')}:${startEth.minute.toString().padStart(2, '0')} - ${endEth.ethiopianHour.toString().padStart(2, '0')}:${endEth.minute.toString().padStart(2, '0')} ${startEth.periodAmharic}`,
      eatRange: `${startEth.eatHour12.toString().padStart(2, '0')}:${startEth.minute.toString().padStart(2, '0')} ${startEth.eatAmPm} - ${endEth.eatHour12.toString().padStart(2, '0')}:${endEth.minute.toString().padStart(2, '0')} ${endEth.eatAmPm} EAT`,
    };
  } catch {
    return {
      date: startIso,
      ethiopianRange: 'Time unavailable',
      eatRange: '',
    };
  }
}

export function MentoringSessionsPage({ view }: { view: SessionView }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { pushToast } = useToast();

  const [selectedRelationshipId, setSelectedRelationshipId] = useState(
    searchParams.get('relationshipId') ?? ''
  );
  const [isCreateFormOpen, setCreateFormOpen] = useState(Boolean(searchParams.get('relationshipId')));

  // Create Form State
  const [createDate, setCreateDate] = useState('');
  const [createTime, setCreateTime] = useState('09:00');
  const [createDuration, setCreateDuration] = useState(45);
  const [createDeliveryMode, setCreateDeliveryMode] = useState<MentoringDeliveryMode>('ONLINE');
  const [createTitle, setCreateTitle] = useState('');
  const [selectedTraineeUserId, setSelectedTraineeUserId] = useState('');
  const [createAgenda, setCreateAgenda] = useState('');
  const [createMeetingUrl, setCreateMeetingUrl] = useState('');
  const [createLocation, setCreateLocation] = useState('');

  // Modals state
  const [declineSessionTarget, setDeclineSessionTarget] = useState<MentoringSession | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const [rescheduleSessionTarget, setRescheduleSessionTarget] = useState<MentoringSession | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('09:00');
  const [rescheduleDuration, setRescheduleDuration] = useState(45);
  const [rescheduleReason, setRescheduleReason] = useState('');

  const [cancelSessionTarget, setCancelSessionTarget] = useState<MentoringSession | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const [selectedForVideo, setSelectedForVideo] = useState<MentoringSession | null>(null);

  // Queries
  const relationshipsQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'relationships', user?.id],
    queryFn: mentoringPairingApi.listMyRelationships,
  });

  const sessionsQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'my-sessions', user?.id],
    queryFn: mentoringPairingApi.listMySessions,
  });

  const invalidateData = () => {
    void queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'my-sessions'] });
    void queryClient.invalidateQueries({ queryKey: ['scheduling', 'calendar'] });
  };

  // Mutations
  const createSessionMutation = useMutation({
    mutationFn: (variables: {
      relationshipId: number;
      input: {
        title: string;
        agenda?: string;
        scheduledStart: string;
        scheduledEnd: string;
        deliveryMode: MentoringDeliveryMode;
        meetingUrl?: string;
        location?: string;
        traineeUserId?: number;
      };
    }) => mentoringPairingApi.createSession(variables.relationshipId, variables.input),
    onSuccess: () => {
      pushToast({
        title: 'Session Scheduled',
        message: 'The mentoring session has been booked and invitation sent to the trainee.',
        tone: 'ok',
      });
      setCreateFormOpen(false);
      setCreateTitle('');
      setSelectedTraineeUserId('');
      setCreateAgenda('');
      setCreateMeetingUrl('');
      setCreateLocation('');
      invalidateData();
    },
    onError: (err) => {
      pushToast({
        title: 'Scheduling Failed',
        message: getErrorMessage(err, 'Failed to book mentoring session.'),
        tone: 'err',
      });
    },
  });

  const respondMutation = useMutation({
    mutationFn: (variables: {
      relationshipId: number;
      sessionId: number;
      input: { accept: boolean; declineReason?: string };
    }) => mentoringPairingApi.respondSession(variables.relationshipId, variables.sessionId, variables.input),
    onSuccess: (_, variables) => {
      pushToast({
        title: variables.input.accept ? 'Session Confirmed' : 'Session Declined',
        message: variables.input.accept
          ? 'You have accepted the session. It is locked into your calendar.'
          : 'You declined the session invitation. Your mentor has been notified.',
        tone: variables.input.accept ? 'ok' : 'info',
      });
      setDeclineSessionTarget(null);
      setDeclineReason('');
      invalidateData();
    },
    onError: (err) => {
      pushToast({
        title: 'Action Failed',
        message: getErrorMessage(err, 'Unable to respond to session invitation.'),
        tone: 'err',
      });
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: (variables: {
      relationshipId: number;
      sessionId: number;
      input: { proposedStart: string; proposedEnd: string; reason: string };
    }) => mentoringPairingApi.proposeReschedule(variables.relationshipId, variables.sessionId, variables.input),
    onSuccess: () => {
      pushToast({
        title: 'Reschedule Proposed',
        message: 'Your proposed time has been submitted to your mentor for confirmation.',
        tone: 'ok',
      });
      setRescheduleSessionTarget(null);
      setRescheduleReason('');
      invalidateData();
    },
    onError: (err) => {
      pushToast({
        title: 'Reschedule Proposal Failed',
        message: getErrorMessage(err, 'Could not propose reschedule. Check for conflicts or Sunday restrictions.'),
        tone: 'err',
      });
    },
  });

  const respondRescheduleMutation = useMutation({
    mutationFn: (variables: { relationshipId: number; sessionId: number; accept: boolean }) =>
      mentoringPairingApi.respondReschedule(variables.relationshipId, variables.sessionId, variables.accept),
    onSuccess: (_, variables) => {
      pushToast({
        title: variables.accept ? 'Reschedule Accepted' : 'Reschedule Declined',
        message: variables.accept
          ? 'The session has been updated to the trainee’s proposed time.'
          : 'The proposed reschedule was declined. The original session time remains.',
        tone: variables.accept ? 'ok' : 'info',
      });
      invalidateData();
    },
    onError: (err) => {
      pushToast({
        title: 'Action Failed',
        message: getErrorMessage(err, 'Could not respond to reschedule proposal.'),
        tone: 'err',
      });
    },
  });

  const cancelSessionMutation = useMutation({
    mutationFn: (variables: { relationshipId: number; sessionId: number; reason: string }) =>
      mentoringPairingApi.cancelSession(variables.relationshipId, variables.sessionId, variables.reason),
    onSuccess: () => {
      pushToast({
        title: 'Session Cancelled',
        message: 'The session and its central calendar reservation have been released.',
        tone: 'ok',
      });
      setCancelSessionTarget(null);
      setCancelReason('');
      invalidateData();
    },
    onError: (err) => {
      pushToast({
        title: 'Cancellation Failed',
        message: getErrorMessage(err, 'Could not cancel the session.'),
        tone: 'err',
      });
    },
  });

  if (relationshipsQuery.isLoading || sessionsQuery.isLoading) {
    return <LoadingSkeleton rows={6} height={28} />;
  }
  if (relationshipsQuery.isError || sessionsQuery.isError) {
    const error = relationshipsQuery.error ?? sessionsQuery.error;
    return (
      <ErrorState
        message={getErrorMessage(error, 'Unable to load your mentoring sessions.')}
        onRetry={() => {
          void relationshipsQuery.refetch();
          void sessionsQuery.refetch();
        }}
      />
    );
  }

  const allRelationships = relationshipsQuery.data ?? [];
  const roleRelationships = allRelationships.filter((pair) =>
    view === 'mentor' ? pair.currentUserRole === 'MENTOR' : pair.currentUserRole === 'TRAINEE'
  );

  const relationshipsById = new Map<number, (typeof allRelationships)[number]>();
  allRelationships.forEach((pair) => relationshipsById.set(pair.relationshipId, pair));

  const roleRelationshipIds = new Set(roleRelationships.map((r) => r.relationshipId));
  const sessions = (sessionsQuery.data ?? []).filter((session) =>
    roleRelationshipIds.has(session.relationshipId)
  );

  const traineesByRelationship = new Map<number, string[]>();
  for (const pair of allRelationships) {
    const names = traineesByRelationship.get(pair.relationshipId) ?? [];
    if (!names.includes(pair.traineeName)) {
      names.push(pair.traineeName);
      traineesByRelationship.set(pair.relationshipId, names);
    }
  }

  const activeMentorRelationships = roleRelationships
    .filter((pair) => pair.currentUserRole === 'MENTOR' && pair.relationshipStatus === 'ACTIVE')
    .filter((pair, index, pairs) =>
      pairs.findIndex((candidate) => candidate.relationshipId === pair.relationshipId) === index
    );
  const selectedMentoringRelationship = activeMentorRelationships.find(
    (pair) => pair.relationshipId === Number(selectedRelationshipId)
  );
  const selectedGroupTrainees = allRelationships.filter(
    (pair) =>
      pair.relationshipId === Number(selectedRelationshipId)
      && pair.currentUserRole === 'MENTOR'
      && pair.memberStatus === 'ACTIVE'
  );

  const handleCreateSessionSubmit = (e: FormEvent) => {
    e.preventDefault();
    const relId = Number(selectedRelationshipId);
    if (!relId || !createDate || !createTime || !createTitle.trim()) {
      pushToast({
        title: 'Required Fields Missing',
        message: 'Please select an active pairing, specify a title, date, and meeting time.',
        tone: 'err',
      });
      return;
    }

    let traineeUserId: number | undefined;
    if (selectedMentoringRelationship?.requestType === 'GROUP') {
      traineeUserId = Number(selectedTraineeUserId);
      const selectedTraineeIsActive = selectedGroupTrainees.some(
        (pair) => pair.traineeUserId === traineeUserId
      );
      if (!Number.isSafeInteger(traineeUserId) || !selectedTraineeIsActive) {
        pushToast({
          title: 'Select a trainee',
          message: 'Choose the active trainee who should receive this group-pairing session.',
          tone: 'err',
        });
        return;
      }
    }

    const checkDate = new Date(`${createDate}T12:00:00`);
    if (checkDate.getDay() === 0) {
      pushToast({
        title: 'Sunday Lockout',
        message: 'Bank policy strictly prohibits scheduling sessions on Sundays.',
        tone: 'err',
      });
      return;
    }

    const scheduledStart = buildEatIsoString(createDate, createTime, 0);
    const scheduledEnd = buildEatIsoString(createDate, createTime, createDuration);

    if (new Date(scheduledStart).getTime() <= Date.now()) {
      pushToast({
        title: 'Invalid Time',
        message: 'Mentoring sessions must be scheduled for a future time slot.',
        tone: 'err',
      });
      return;
    }

    createSessionMutation.mutate({
      relationshipId: relId,
      input: {
        title: createTitle.trim(),
        agenda: createAgenda.trim() || undefined,
        scheduledStart,
        scheduledEnd,
        deliveryMode: createDeliveryMode,
        meetingUrl: createDeliveryMode === 'ONLINE' ? createMeetingUrl.trim() || undefined : undefined,
        location: createDeliveryMode === 'IN_PERSON' ? createLocation.trim() || undefined : undefined,
        traineeUserId,
      },
    });
  };

  const handleProposeRescheduleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!rescheduleSessionTarget || !rescheduleDate || !rescheduleTime || !rescheduleReason.trim()) {
      pushToast({
        title: 'Incomplete Proposal',
        message: 'Please pick a proposed date, time, and provide an explanatory reason.',
        tone: 'err',
      });
      return;
    }

    const checkDate = new Date(`${rescheduleDate}T12:00:00`);
    if (checkDate.getDay() === 0) {
      pushToast({
        title: 'Sunday Lockout',
        message: 'Sessions cannot be rescheduled to a Sunday.',
        tone: 'err',
      });
      return;
    }

    const proposedStart = buildEatIsoString(rescheduleDate, rescheduleTime, 0);
    const proposedEnd = buildEatIsoString(rescheduleDate, rescheduleTime, rescheduleDuration);

    if (new Date(proposedStart).getTime() <= Date.now()) {
      pushToast({
        title: 'Invalid Time',
        message: 'Proposed reschedule time must be in the future.',
        tone: 'err',
      });
      return;
    }

    rescheduleMutation.mutate({
      relationshipId: rescheduleSessionTarget.relationshipId,
      sessionId: rescheduleSessionTarget.id,
      input: {
        proposedStart,
        proposedEnd,
        reason: rescheduleReason.trim(),
      },
    });
  };

  const title = view === 'mentor' ? 'Mentoring Sessions (Trainer)' : 'My Mentoring Sessions (Trainee)';

  return (
    <div className="boa-stack mentoring-dashboard">
      <PageHeader
        title={title}
        subtitle={
          view === 'mentor'
            ? 'Flexible ad-hoc scheduling for your trainees and cohorts with automated cross-module conflict prevention.'
            : 'Accept, decline, or propose new times for sessions scheduled by your mentor.'
        }
        source="live"
        actions={
          view === 'mentor' && activeMentorRelationships.length > 0 ? (
            <button
              type="button"
              className="apid-btn apid-btn-primary apid-btn-sm"
              onClick={() => setCreateFormOpen((open) => !open)}
            >
              <CalendarDays size={15} />
              {isCreateFormOpen ? 'Close Scheduler' : 'Schedule Single Session'}
            </button>
          ) : undefined
        }
      />

      {/* Inline Session Creation Form */}
      {view === 'mentor' && isCreateFormOpen && (
        <form className="apid-card boa-stack" onSubmit={handleCreateSessionSubmit}>
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
            <h2 className="boa-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={18} className="text-amber-500" />
              Schedule Single Mentoring Session
            </h2>
            <p className="boa-card-subtitle">
              Unlike mandatory PMS rhythms, mentoring sessions are flexible and arranged on-demand. Double booking is checked across all bank coaching and mentoring events.
            </p>
          </div>

          <div className="boa-grid-2">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Mentoring Pairing / Class *</label>
              <select
                className="apid-input"
                value={selectedRelationshipId}
                onChange={(e) => {
                  if (createSessionMutation.isError) createSessionMutation.reset();
                  setSelectedRelationshipId(e.target.value);
                  setSelectedTraineeUserId('');
                  const nextParams = new URLSearchParams(searchParams);
                  if (e.target.value) nextParams.set('relationshipId', e.target.value);
                  else nextParams.delete('relationshipId');
                  setSearchParams(nextParams, { replace: true });
                }}
                required
              >
                <option value="">Select an active pairing</option>
                {activeMentorRelationships.map((pair) => (
                  <option key={pair.relationshipId} value={pair.relationshipId}>
                    {pair.requestType === 'GROUP' ? 'Class Cohort' : '1-on-1 Mentee'} ·{' '}
                    {(traineesByRelationship.get(pair.relationshipId) ?? [pair.traineeName]).join(', ')}
                    {pair.skillName ? ` (${pair.skillName})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedMentoringRelationship?.requestType === 'GROUP' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }} htmlFor="mentoring-session-trainee">
                  Session for trainee *
                </label>
                <select
                  id="mentoring-session-trainee"
                  className="apid-input"
                  value={selectedTraineeUserId}
                  onChange={(event) => {
                    if (createSessionMutation.isError) createSessionMutation.reset();
                    setSelectedTraineeUserId(event.target.value);
                  }}
                  required
                >
                  <option value="">Select one trainee</option>
                  {selectedGroupTrainees.map((trainee) => (
                    <option key={trainee.memberId} value={trainee.traineeUserId}>
                      {trainee.traineeName}
                    </option>
                  ))}
                </select>
                <span className="boa-muted" style={{ fontSize: '0.78rem' }}>
                  Only this trainee will receive and see the session.
                </span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Session Title *</label>
              <input
                className="apid-input"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="e.g. Core Banking System Orientation"
                maxLength={180}
                required
              />
            </div>
          </div>

          <div className="boa-grid-3">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Date (Mon–Sat) *</label>
              <input
                type="date"
                className="apid-input"
                value={createDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                  if (createSessionMutation.isError) createSessionMutation.reset();
                  setCreateDate(e.target.value);
                }}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Start Time (የኢትዮጵያ ሰዓት / EAT) *</label>
              <select
                className="apid-input"
                value={createTime}
                onChange={(e) => {
                  if (createSessionMutation.isError) createSessionMutation.reset();
                  setCreateTime(e.target.value);
                }}
                required
              >
                {BANK_OPERATING_TIME_OPTIONS.map((opt) => (
                  <option key={opt.timeValue24} value={opt.timeValue24}>
                    {opt.labelDual}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Duration *</label>
              <select
                className="apid-input"
                value={createDuration}
                onChange={(e) => {
                  if (createSessionMutation.isError) createSessionMutation.reset();
                  setCreateDuration(Number(e.target.value));
                }}
              >
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes (Recommended)</option>
                <option value={60}>60 Minutes (1 Hour)</option>
                <option value={90}>90 Minutes (1.5 Hours)</option>
              </select>
            </div>
          </div>

          <div className="boa-grid-2">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Delivery Mode *</label>
              <select
                className="apid-input"
                value={createDeliveryMode}
                onChange={(e) => setCreateDeliveryMode(e.target.value as MentoringDeliveryMode)}
              >
                <option value="ONLINE">Online Video Call (LiveKit)</option>
                <option value="IN_PERSON">In-Person (Branch / Training Center)</option>
                <option value="HYBRID">Hybrid</option>
              </select>
              {(createDeliveryMode === 'ONLINE' || createDeliveryMode === 'HYBRID') && (
                <span style={{ fontSize: '0.78rem', color: '#0284c7', fontWeight: 500, marginTop: '0.2rem' }}>
                  ✨ A secure LiveKit video room will be automatically provisioned for this session.
                </span>
              )}
            </div>

            {createDeliveryMode === 'IN_PERSON' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Branch / Room Location</label>
                <input
                  className="apid-input"
                  value={createLocation}
                  onChange={(e) => setCreateLocation(e.target.value)}
                  placeholder="e.g. Bole Medhanialem Branch, 2nd Floor Meeting Room"
                />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Meeting Video Link (Optional Override)</label>
                <input
                  type="url"
                  className="apid-input"
                  value={createMeetingUrl}
                  onChange={(e) => setCreateMeetingUrl(e.target.value)}
                  placeholder="Leave empty to use automatic LiveKit video room"
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Agenda & Learning Objectives</label>
            <textarea
              className="apid-input"
              rows={3}
              value={createAgenda}
              onChange={(e) => setCreateAgenda(e.target.value)}
              placeholder="Outline topics to cover, preparation materials, or key competencies..."
              maxLength={2000}
            />
          </div>

          {createSessionMutation.isError && (
            <div
              className="apid-card"
              style={{
                borderLeft: '4px solid #ef4444',
                background: '#fef2f2',
                color: '#991b1b',
                padding: '0.85rem 1rem',
                margin: '0.25rem 0',
              }}
              role="alert"
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#dc2626' }} />
                <div>
                  <strong style={{ fontSize: '0.92rem' }}>Scheduling Conflict / Restriction</strong>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.87rem', lineHeight: 1.45, color: '#7f1d1d' }}>
                    {getErrorMessage(createSessionMutation.error, 'A scheduling conflict or policy restriction prevented booking.')}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="apid-btn apid-btn-outline apid-btn-sm"
              onClick={() => setCreateFormOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="apid-btn apid-btn-primary apid-btn-sm"
              disabled={createSessionMutation.isPending}
            >
              <CalendarDays size={15} />
              {createSessionMutation.isPending ? 'Confirming with Reservation Engine...' : 'Schedule & Reserve'}
            </button>
          </div>
        </form>
      )}

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <section className="apid-card">
          <EmptyState
            title="No mentoring sessions found"
            description={
              view === 'mentor'
                ? 'Click "Schedule Single Session" above to invite your mentee or class cohort to an ad-hoc session.'
                : 'Sessions scheduled by your mentor will appear here with options to accept, decline, or propose a new time.'
            }
          />
        </section>
      ) : (
        <div className="mentoring-session-list" role="list" aria-label="Mentoring sessions">
          <MentoringSessionListHeader />
          {sessions.map((session) => {
            const pair = relationshipsById.get(session.relationshipId);
            const partnerLabel = pair
              ? view === 'mentor'
                ? session.traineeName ?? (traineesByRelationship.get(pair.relationshipId) ?? [pair.traineeName]).join(', ')
                : pair.mentorName
              : 'Mentoring pairing';
            const pairLabel = pair
              ? `${pair.mentorName} → ${session.traineeName
                ?? (traineesByRelationship.get(pair.relationshipId) ?? [pair.traineeName]).join(', ')}`
              : 'Mentoring pairing';

            const timeDetails = formatDualTimeRange(session.scheduledStart, session.scheduledEnd);
            const isMentor = view === 'mentor';
            const isTrainee = view === 'trainee';

            let statusTone: 'ok' | 'err' | 'warn' | 'info' | 'neutral' = 'neutral';
            let statusText = session.status as string;

            if (session.status === 'CONFIRMED') {
              statusTone = 'ok';
              statusText = 'CONFIRMED';
            } else if (session.status === 'SCHEDULED') {
              statusTone = 'warn';
              statusText = 'AWAITING TRAINEE RSVP';
            } else if (session.status === 'RESCHEDULE_PROPOSED') {
              statusTone = 'info';
              statusText = 'RESCHEDULE REQUESTED';
            } else if (session.status === 'DECLINED') {
              statusTone = 'err';
              statusText = 'DECLINED';
            } else if (session.status === 'CANCELLED') {
              statusTone = 'err';
              statusText = 'CANCELLED';
            } else if (session.status === 'COMPLETED') {
              statusTone = 'ok';
              statusText = 'COMPLETED';
            }

            return (
              <MentoringSessionListRow
                key={session.id}
                session={session}
                approach={getMentoringDeliveryModeLabel(session.deliveryMode)}
                startTime={formatSessionStart(session.scheduledStart)}
                statusLabel={statusText}
                statusTone={statusTone}
                pairLabel={pairLabel}
              >
              <article className="boa-stack mentoring-session-detail-content">
                <div className="mentoring-session-detail-summary">
                  <div>
                    <div className="mentoring-session-detail-badges">
                      <StatusPill label={statusText} tone={statusTone} />
                      <span className="boa-pill mentoring-session-approach">
                        {session.deliveryMode.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="boa-muted mentoring-session-participants">
                      <strong>{isMentor ? 'Trainee(s):' : 'Mentor:'}</strong> {partnerLabel}
                      {pair?.skillName ? ` · Skill: ${pair.skillName}` : ''}
                    </p>
                  </div>

                  <div className="mentoring-session-detail-actions">
                    <Link
                      to={`/mentoring/pairing/${session.relationshipId}`}
                      className="apid-btn apid-btn-outline apid-btn-sm"
                    >
                      View Pairing
                    </Link>
                    {(session.deliveryMode === 'ONLINE' || session.deliveryMode === 'HYBRID') &&
                      isMentoringSessionDay(session.scheduledStart) &&
                      session.status !== 'CANCELLED' &&
                      session.status !== 'DECLINED' && (
                        <button
                          type="button"
                          onClick={() => setSelectedForVideo(session)}
                          className="apid-btn apid-btn-sm"
                          style={{
                            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                            color: '#ffffff',
                            border: 'none',
                            fontWeight: 600,
                            boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            cursor: 'pointer',
                          }}
                        >
                          <Video size={14} /> Join LiveKit Video
                        </button>
                    )}
                    <MentoringSessionJoinButton
                      session={session}
                      onJoin={() => setSelectedForVideo(session)}
                    />
                  </div>
                </div>

                {/* Ethiopian Dual Clock Time Banner */}
                <div
                  className="mentoring-session-time-summary"
                >
                  <div className="mentoring-session-time-main">
                    <Clock size={18} className="text-amber-600" />
                    <div>
                      <div className="mentoring-session-time-primary">
                        {timeDetails.date} · {timeDetails.ethiopianRange}
                      </div>
                      <div className="boa-muted mentoring-session-time-secondary">
                        International Clock: {timeDetails.eatRange}
                      </div>
                    </div>
                  </div>

                  {session.location && (
                    <div className="mentoring-session-location">
                      <MapPin size={15} className="text-blue-500" />
                      <span>{session.location}</span>
                    </div>
                  )}
                </div>

                {/* Agenda */}
                {session.agenda && (
                  <p className="mentoring-session-agenda">
                    <strong>Agenda:</strong> {session.agenda}
                  </p>
                )}

                <MentoringSessionReport session={session} isMentor={isMentor} />
                <MentoringSessionRating
                  relationshipId={session.relationshipId}
                  sessionId={session.id}
                  isMentee={isTrainee}
                  sessionStatus={session.status}
                  scheduledEnd={session.scheduledEnd}
                />
                <MentoringResourcesPanel
                  relationshipId={session.relationshipId}
                  sessionId={session.id}
                  canAdd={
                    view === 'mentor'
                    && pair?.currentUserRole === 'MENTOR'
                    && pair?.relationshipStatus === 'ACTIVE'
                  }
                />

                {/* Reschedule Proposal Banner (when RESCHEDULE_PROPOSED) */}
                {session.status === 'RESCHEDULE_PROPOSED' && session.proposedStart && session.proposedEnd && (
                  <div
                    style={{
                      background: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '8px',
                      padding: '0.85rem 1rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#1d4ed8' }}>
                      <RefreshCw size={16} />
                      Reschedule Proposal Pending Mentor Approval
                    </div>
                    {(() => {
                      const propTime = formatDualTimeRange(session.proposedStart, session.proposedEnd);
                      return (
                        <p style={{ margin: '0.35rem 0', fontSize: '0.88rem' }}>
                          <strong>Proposed New Slot:</strong> {propTime.date} · {propTime.ethiopianRange} ({propTime.eatRange})
                        </p>
                      );
                    })()}
                    {session.rescheduleReason && (
                      <p style={{ margin: '0.2rem 0', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-subtle)' }}>
                        <strong>Reason:</strong> "{session.rescheduleReason}"
                      </p>
                    )}

                    {isMentor && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <button
                          type="button"
                          className="apid-btn apid-btn-primary apid-btn-sm"
                          onClick={() =>
                            respondRescheduleMutation.mutate({
                              relationshipId: session.relationshipId,
                              sessionId: session.id,
                              accept: true,
                            })
                          }
                          disabled={respondRescheduleMutation.isPending}
                        >
                          <Check size={14} /> Accept New Time
                        </button>
                        <button
                          type="button"
                          className="apid-btn apid-btn-outline apid-btn-sm"
                          onClick={() =>
                            respondRescheduleMutation.mutate({
                              relationshipId: session.relationshipId,
                              sessionId: session.id,
                              accept: false,
                            })
                          }
                          disabled={respondRescheduleMutation.isPending}
                        >
                          <X size={14} /> Keep Original Time
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Decline reason notice */}
                {session.status === 'DECLINED' && session.declineReason && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: '6px',
                      padding: '0.5rem 0.85rem',
                      fontSize: '0.84rem',
                      color: '#b91c1c',
                    }}
                  >
                    <strong>Declined by Trainee:</strong> "{session.declineReason}"
                  </div>
                )}

                {/* Cancellation reason notice */}
                {session.status === 'CANCELLED' && session.cancellationReason && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: '6px',
                      padding: '0.5rem 0.85rem',
                      fontSize: '0.84rem',
                      color: '#b91c1c',
                    }}
                  >
                    <strong>Cancellation Reason:</strong> "{session.cancellationReason}"
                  </div>
                )}

                {/* Trainee RSVP Action Buttons */}
                {isTrainee && session.status === 'SCHEDULED' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      paddingTop: '0.5rem',
                      borderTop: '1px solid var(--border)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, marginRight: '0.25rem' }}>Your Response:</span>
                    <button
                      type="button"
                      className="apid-btn apid-btn-primary apid-btn-sm"
                      onClick={() =>
                        respondMutation.mutate({
                          relationshipId: session.relationshipId,
                          sessionId: session.id,
                          input: { accept: true },
                        })
                      }
                      disabled={respondMutation.isPending}
                    >
                      <Check size={14} /> Accept Session
                    </button>
                    <button
                      type="button"
                      className="apid-btn apid-btn-outline apid-btn-sm"
                      onClick={() => {
                        setRescheduleSessionTarget(session);
                        setRescheduleDate(session.scheduledStart.split('T')[0]);
                      }}
                    >
                      <RefreshCw size={14} /> Propose New Time
                    </button>
                    <button
                      type="button"
                      className="apid-btn apid-btn-outline apid-btn-sm"
                      style={{ color: '#dc2626' }}
                      onClick={() => setDeclineSessionTarget(session)}
                    >
                      <X size={14} /> Decline
                    </button>
                  </div>
                )}

                {/* Mentor Cancel Button */}
                {isMentor && (session.status === 'SCHEDULED' || session.status === 'CONFIRMED') && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      paddingTop: '0.5rem',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <button
                      type="button"
                      className="apid-btn apid-btn-outline apid-btn-sm"
                      style={{ color: '#dc2626' }}
                      onClick={() => setCancelSessionTarget(session)}
                    >
                      <Ban size={14} /> Cancel Session
                    </button>
                  </div>
                )}
              </article>
              </MentoringSessionListRow>
            );
          })}
        </div>
      )}

      {/* Decline Modal */}
      {declineSessionTarget && (
        <div className="apid-modal-backdrop" onClick={() => setDeclineSessionTarget(null)}>
          <div
            className="apid-card apid-modal"
            style={{
              maxWidth: '500px',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="boa-card-header"
              style={{
                paddingBottom: '0.75rem',
                borderBottom: '1px solid var(--border)',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <h3 className="boa-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}>
                  <AlertCircle size={20} className="text-red-500" />
                  Decline Mentoring Session
                </h3>
                <p className="boa-card-subtitle" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
                  Bank policy requires an explanatory reason when declining a scheduled session so that your mentor can plan accordingly.
                </p>
              </div>
              <button
                type="button"
                className="apid-btn apid-btn-ghost apid-btn-sm"
                onClick={() => setDeclineSessionTarget(null)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.86rem' }}>Reason for Declining *</label>
                <textarea
                  className="apid-input"
                  rows={3}
                  value={declineReason}
                  onChange={(e) => {
                    if (respondMutation.isError) respondMutation.reset();
                    setDeclineReason(e.target.value);
                  }}
                  placeholder="e.g. Branch audit scheduled during this time slot..."
                  required
                />
              </div>

              {respondMutation.isError && (
                <div
                  className="apid-card"
                  style={{
                    borderLeft: '4px solid #ef4444',
                    background: '#fef2f2',
                    color: '#991b1b',
                    padding: '0.75rem 1rem',
                  }}
                  role="alert"
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#dc2626' }} />
                    <div>
                      <strong style={{ fontSize: '0.9rem' }}>Decline Error</strong>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#7f1d1d' }}>
                        {getErrorMessage(respondMutation.error, 'Could not respond to session invitation.')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="apid-modal-actions" style={{ marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="apid-btn apid-btn-outline apid-btn-sm"
                  onClick={() => {
                    setDeclineSessionTarget(null);
                    setDeclineReason('');
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="apid-btn apid-btn-primary apid-btn-sm"
                  style={{ background: '#dc2626', borderColor: '#dc2626' }}
                  disabled={!declineReason.trim() || respondMutation.isPending}
                  onClick={() =>
                    respondMutation.mutate({
                      relationshipId: declineSessionTarget.relationshipId,
                      sessionId: declineSessionTarget.id,
                      input: { accept: false, declineReason: declineReason.trim() },
                    })
                  }
                >
                  Confirm Decline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Propose Reschedule Modal */}
      {rescheduleSessionTarget && (
        <div className="apid-modal-backdrop" onClick={() => setRescheduleSessionTarget(null)}>
          <div
            className="apid-card apid-modal"
            style={{
              maxWidth: '560px',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="boa-card-header"
              style={{
                paddingBottom: '0.75rem',
                borderBottom: '1px solid var(--border)',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <h3 className="boa-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}>
                  <RefreshCw size={20} className="text-amber-500" />
                  Propose New Mentoring Session Time
                </h3>
                <p className="boa-card-subtitle" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
                  Select an alternative day and Ethiopian sunrise operating time. The central scheduler will verify that neither participant has conflicting coaching or mentoring meetings.
                </p>
              </div>
              <button
                type="button"
                className="apid-btn apid-btn-ghost apid-btn-sm"
                onClick={() => setRescheduleSessionTarget(null)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleProposeRescheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="boa-grid-2" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.86rem' }}>Proposed Date (Mon–Sat) *</label>
                  <input
                    type="date"
                    className="apid-input"
                    value={rescheduleDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => {
                      if (rescheduleMutation.isError) rescheduleMutation.reset();
                      setRescheduleDate(e.target.value);
                    }}
                    required
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.86rem' }}>Proposed Start (የኢትዮጵያ ሰዓት) *</label>
                  <select
                    className="apid-input"
                    value={rescheduleTime}
                    onChange={(e) => {
                      if (rescheduleMutation.isError) rescheduleMutation.reset();
                      setRescheduleTime(e.target.value);
                    }}
                    required
                  >
                    {BANK_OPERATING_TIME_OPTIONS.map((opt) => (
                      <option key={opt.timeValue24} value={opt.timeValue24}>
                        {opt.labelDual}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.86rem' }}>Duration *</label>
                <select
                  className="apid-input"
                  value={rescheduleDuration}
                  onChange={(e) => {
                    if (rescheduleMutation.isError) rescheduleMutation.reset();
                    setRescheduleDuration(Number(e.target.value));
                  }}
                >
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes (Recommended)</option>
                  <option value={60}>60 Minutes (1 Hour)</option>
                  <option value={90}>90 Minutes (1.5 Hours)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.86rem' }}>Reason for Rescheduling *</label>
                <textarea
                  className="apid-input"
                  rows={3}
                  value={rescheduleReason}
                  onChange={(e) => {
                    if (rescheduleMutation.isError) rescheduleMutation.reset();
                    setRescheduleReason(e.target.value);
                  }}
                  placeholder="Explain why you are requesting this new time..."
                  required
                />
              </div>

              {rescheduleMutation.isError && (
                <div
                  className="apid-card"
                  style={{
                    borderLeft: '4px solid #ef4444',
                    background: '#fef2f2',
                    color: '#991b1b',
                    padding: '0.75rem 1rem',
                  }}
                  role="alert"
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#dc2626' }} />
                    <div>
                      <strong style={{ fontSize: '0.9rem' }}>Reschedule Conflict / Error</strong>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#7f1d1d' }}>
                        {getErrorMessage(rescheduleMutation.error, 'Could not propose reschedule.')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="apid-modal-actions" style={{ marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="apid-btn apid-btn-outline apid-btn-sm"
                  onClick={() => {
                    setRescheduleSessionTarget(null);
                    setRescheduleReason('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="apid-btn apid-btn-primary apid-btn-sm"
                  disabled={rescheduleMutation.isPending}
                >
                  <RefreshCw size={14} />
                  {rescheduleMutation.isPending ? 'Checking Conflicts...' : 'Submit Reschedule Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Modal (Mentor) */}
      {cancelSessionTarget && (
        <div className="apid-modal-backdrop" onClick={() => setCancelSessionTarget(null)}>
          <div
            className="apid-card apid-modal"
            style={{
              maxWidth: '500px',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="boa-card-header"
              style={{
                paddingBottom: '0.75rem',
                borderBottom: '1px solid var(--border)',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <h3 className="boa-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}>
                  <Ban size={20} className="text-red-500" />
                  Cancel Mentoring Session
                </h3>
                <p className="boa-card-subtitle" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
                  Cancelling this session releases all central reservations on both the mentor and trainee calendars.
                </p>
              </div>
              <button
                type="button"
                className="apid-btn apid-btn-ghost apid-btn-sm"
                onClick={() => setCancelSessionTarget(null)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.86rem' }}>Reason for Cancellation</label>
                <textarea
                  className="apid-input"
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => {
                    if (cancelSessionMutation.isError) cancelSessionMutation.reset();
                    setCancelReason(e.target.value);
                  }}
                  placeholder="e.g. Schedule conflicts or training rescheduled..."
                />
              </div>

              {cancelSessionMutation.isError && (
                <div
                  className="apid-card"
                  style={{
                    borderLeft: '4px solid #ef4444',
                    background: '#fef2f2',
                    color: '#991b1b',
                    padding: '0.75rem 1rem',
                  }}
                  role="alert"
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#dc2626' }} />
                    <div>
                      <strong style={{ fontSize: '0.9rem' }}>Cancellation Error</strong>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#7f1d1d' }}>
                        {getErrorMessage(cancelSessionMutation.error, 'Could not cancel the session.')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="apid-modal-actions" style={{ marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="apid-btn apid-btn-outline apid-btn-sm"
                  onClick={() => {
                    setCancelSessionTarget(null);
                    setCancelReason('');
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="apid-btn apid-btn-primary apid-btn-sm"
                  style={{ background: '#dc2626', borderColor: '#dc2626' }}
                  disabled={cancelSessionMutation.isPending}
                  onClick={() =>
                    cancelSessionMutation.mutate({
                      relationshipId: cancelSessionTarget.relationshipId,
                      sessionId: cancelSessionTarget.id,
                      reason: cancelReason.trim() || 'Cancelled by mentor',
                    })
                  }
                >
                  Confirm Cancellation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedForVideo && (
        <MentoringDailyVideoModal
          session={selectedForVideo}
          isOpen={Boolean(selectedForVideo)}
          onClose={() => setSelectedForVideo(null)}
          relationshipId={selectedForVideo.relationshipId}
          mentorName={relationshipsById.get(selectedForVideo.relationshipId)?.mentorName}
          traineeName={
            traineesByRelationship.get(selectedForVideo.relationshipId)?.[0] ||
            relationshipsById.get(selectedForVideo.relationshipId)?.traineeName
          }
        />
      )}
    </div>
  );
}
