import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Video,
  Phone,
  MapPin,
  X,
  AlertTriangle,
  Sparkles,
  Clock,
  Lock,
  Info,
  CheckCircle2,
  Plus,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import {
  coachingGovernanceApi,
  SeriesPreviewResponseData,
  CreateScheduleSeriesPayload,
  SessionMeetingMode,
  CustomSessionSlot,
} from '../api/coachingSessionApi';
import { coachingAssignmentApi, MyCoacheeItem } from '../api/coachingAssignmentApi';
import { skillCoachingRequestApi, SkillCoachingRequestItem } from '../api/skillCoachingRequestApi';
import { coreConfigApi } from '../../admin/config/api/coreConfigApi';
import { BANK_OPERATING_TIME_OPTIONS, toEthiopianTime } from '../utils/ethiopianTimeUtils';

interface ScheduleSeriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  myCoachees: MyCoacheeItem[];
  mode?: 'MANDATORY_PMS' | 'SELF_DEVELOPMENT';
}

interface PlannedSessionItem {
  clientId: string;
  sessionDate: string; // "YYYY-MM-DD"
  startTime: string;   // "HH:mm"
}

// Date helpers for Monday-to-Saturday banking calendar weeks
function getMonday(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

const AMHARIC_DAYS: Record<number, string> = {
  1: 'ሰኞ',
  2: 'ማክሰኞ',
  3: 'ረቡዕ',
  4: 'ሐሙስ',
  5: 'ዓርብ',
  6: 'ቅዳሜ',
};

const ENGLISH_DAYS: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

export const ScheduleSeriesModal: React.FC<ScheduleSeriesModalProps> = ({
  isOpen,
  onClose,
  myCoachees,
  mode,
}) => {
  const queryClient = useQueryClient();

  const [sessionType, setSessionType] = useState<'MANDATORY_PMS' | 'SELF_DEVELOPMENT'>(mode ?? 'MANDATORY_PMS');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | ''>('');
  const [additionalAssignmentIds, setAdditionalAssignmentIds] = useState<number[]>([]);
  const [selectedSkillRequestId, setSelectedSkillRequestId] = useState<number | ''>('');
  const [title, setTitle] = useState('');

  const [startDate, setStartDate] = useState(() => {
    // Default to next Wednesday
    const d = new Date();
    d.setDate(d.getDate() + ((3 + 7 - d.getDay()) % 7 || 7));
    return formatDate(d);
  });
  const [duration, setDuration] = useState<number>(45);
  const [meetingMode, setMeetingMode] = useState<SessionMeetingMode>('VIRTUAL_VIDEO');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [targetSessions, setTargetSessions] = useState<number>(6);

  // Planned sessions array for explicit week-by-week customization
  const [plannedSessions, setPlannedSessions] = useState<PlannedSessionItem[]>([]);
  const [numberOfWeeks, setNumberOfWeeks] = useState<number>(4);

  const [previewData, setPreviewData] = useState<SeriesPreviewResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Active admin policy configurations
  const activeConfigQuery = useQuery({
    queryKey: ['core-active-config'],
    queryFn: coreConfigApi.getActiveConfig,
    enabled: isOpen,
  });

  const publicConfig = activeConfigQuery.data?.publicConfig;
  const maxSessionsPerWeek = publicConfig?.coachingMaxSessionsPerWeek ?? 3;
  const allowSaturday = publicConfig?.coachingAllowSaturdayScheduling ?? true;
  const allowJointGroup = publicConfig?.coachingAllowJointPmsGroup ?? true;
  const maxJointGroupSize = publicConfig?.coachingMaxJointGroupSize ?? 4;

  // Skill cohorts query
  const skillRequestsQuery = useQuery<SkillCoachingRequestItem[]>({
    queryKey: ['my-approved-skill-requests'],
    queryFn: async () => {
      const all = await skillCoachingRequestApi.getMyRequests();
      return (all || []).filter((r: SkillCoachingRequestItem) => r.status === 'APPROVED');
    },
    enabled: isOpen,
  });

  // Query coachees if needed
  const coacheesQuery = useQuery<MyCoacheeItem[]>({
    queryKey: ['coaching', 'my-coachees'],
    queryFn: coachingAssignmentApi.getMyCoachees,
    enabled: isOpen && (!myCoachees || myCoachees.length === 0),
  });

  const allCoachees = (myCoachees && myCoachees.length > 0) ? myCoachees : (coacheesQuery.data || []);
  const mandatoryCoachees = allCoachees.filter((c) => c.pathway !== 'SELF_DEVELOPMENT');

  // Combined targets query for all selected coachees
  const allSelectedAssignmentIds = useMemo(() => {
    if (sessionType !== 'MANDATORY_PMS') return [];
    return [
      selectedAssignmentId ? Number(selectedAssignmentId) : null,
      ...additionalAssignmentIds,
    ].filter((id): id is number => id !== null);
  }, [sessionType, selectedAssignmentId, additionalAssignmentIds]);

  interface TargetResultItem {
    id: number;
    target: any;
    name: string;
    rating?: number | null;
  }

  const targetsQuery = useQuery<TargetResultItem[]>({
    queryKey: ['coaching-targets-all', allSelectedAssignmentIds, selectedSkillRequestId],
    queryFn: async () => {
      if (sessionType === 'SELF_DEVELOPMENT' && selectedSkillRequestId) {
        const t = await coachingGovernanceApi.getTarget({ skillRequestId: Number(selectedSkillRequestId) });
        return [{ id: Number(selectedSkillRequestId), target: t, name: 'Cohort', rating: null }];
      }
      if (allSelectedAssignmentIds.length === 0) return [];
      const results = await Promise.all(
        allSelectedAssignmentIds.map(async (id) => {
          const t = await coachingGovernanceApi.getTarget({ assignmentId: id });
          const coachee = mandatoryCoachees.find((c) => c.assignmentId === id);
          return {
            id,
            target: t,
            name: coachee?.coacheeFullName || `Coachee #${id}`,
            rating: coachee?.appraisalRating ?? null,
          };
        })
      );
      return results;
    },
    enabled: isOpen && (allSelectedAssignmentIds.length > 0 || !!selectedSkillRequestId),
  });

  // Calculate target constraints across all participants
  const targetGovernance = useMemo(() => {
    const list = targetsQuery.data || [];
    if (list.length === 0) {
      return {
        baseline: 6,
        minAllowed: 4,
        maxAllowed: 12,
        coachAdjustmentAllowed: true,
        policyName: 'Standard Remediation Policy',
        hasDisparity: false,
        disparityItems: [] as { name: string; baseline: number; rating?: number | null }[],
      };
    }

    const baselines = list.map((item) => item.target.approvedTarget || item.target.policyBaseline || 6);
    const minAlloweds = list.map((item) => item.target.minAllowedSessions ?? 4);
    const maxAlloweds = list.map((item) => item.target.maxAllowedSessions ?? 12);
    const adjustmentsAllowed = list.every((item) => item.target.coachAdjustmentAllowed ?? true);

    const maxBaseline = Math.max(...baselines);
    const maxMinAllowed = Math.max(...minAlloweds);
    const maxMaxAllowed = Math.max(...maxAlloweds);

    const uniqueBaselines = new Set(baselines);
    const hasDisparity = list.length > 1 && uniqueBaselines.size > 1;

    const disparityItems = list.map((item) => ({
      name: item.name,
      baseline: item.target.approvedTarget || item.target.policyBaseline || 6,
      rating: item.rating,
    }));

    return {
      baseline: maxBaseline,
      minAllowed: maxMinAllowed,
      maxAllowed: maxMaxAllowed,
      coachAdjustmentAllowed: adjustmentsAllowed,
      policyName: list[0].target.policyName,
      hasDisparity,
      disparityItems,
    };
  }, [targetsQuery.data]);

  // Synchronize target sessions with policy
  useEffect(() => {
    if (targetGovernance) {
      if (!targetGovernance.coachAdjustmentAllowed) {
        setTargetSessions(targetGovernance.baseline);
      } else {
        setTargetSessions((prev) => {
          if (prev < targetGovernance.minAllowed) return targetGovernance.baseline;
          if (prev > targetGovernance.maxAllowed) return targetGovernance.maxAllowed;
          return prev;
        });
      }
    }
  }, [targetGovernance]);

  // Auto-select first mandatory coachee
  useEffect(() => {
    if (sessionType === 'MANDATORY_PMS' && mandatoryCoachees.length > 0 && !selectedAssignmentId) {
      setSelectedAssignmentId(mandatoryCoachees[0].assignmentId);
    }
  }, [sessionType, mandatoryCoachees, selectedAssignmentId]);

  useEffect(() => {
    if (mode) {
      setSessionType(mode);
    }
  }, [mode]);

  // Synchronize title based on participants
  useEffect(() => {
    if (sessionType === 'MANDATORY_PMS' && selectedAssignmentId) {
      const coachee = mandatoryCoachees.find((c) => c.assignmentId === Number(selectedAssignmentId));
      const additional = mandatoryCoachees.filter((c) => additionalAssignmentIds.includes(c.assignmentId));
      if (additional.length > 0) {
        const names = [coachee?.coacheeFullName, ...additional.map((c) => c.coacheeFullName)].filter(Boolean).join(', ');
        setTitle(`Mandatory Performance Coaching — Group (${names})`);
      } else if (coachee) {
        setTitle(`Mandatory Performance Coaching — ${coachee.coacheeFullName}`);
      }
    } else if (sessionType === 'SELF_DEVELOPMENT' && selectedSkillRequestId) {
      const req = (skillRequestsQuery.data || []).find((r) => r.id === Number(selectedSkillRequestId));
      if (req) {
        setTitle(`Skill Workshop: ${req.skillTitle}`);
      }
    }
  }, [sessionType, selectedAssignmentId, additionalAssignmentIds, selectedSkillRequestId, mandatoryCoachees, skillRequestsQuery.data]);

  // Active quarter info
  const activeQuarter = activeConfigQuery.data?.activeQuarter;

  // Calendar weeks structure computed from startDate
  const startMondayDate = useMemo(() => getMonday(startDate), [startDate]);

  // Maximum available weeks until active quarter deadline (e.g. Dec 31 for Q2)
  const maxAvailableWeeksInQuarter = useMemo(() => {
    if (!activeQuarter?.endDate || !startMondayDate) return 12;
    const qEndMon = getMonday(activeQuarter.endDate);
    const diffMs = qEndMon.getTime() - startMondayDate.getTime();
    const diffWeeks = Math.round(diffMs / (7 * 86400000)) + 1;
    return Math.max(1, Math.min(diffWeeks, 12));
  }, [activeQuarter, startMondayDate]);

  // Auto-drafting helper: Generates a starting schedule distribution adhering to bank cap & quarter deadline
  const generateDraftSchedule = useCallback(
    (daysPerWeek: number, targetCount: number, baseDateStr: string) => {
      const allowedDaysPerWeek = Math.min(daysPerWeek, maxSessionsPerWeek);
      const startMon = getMonday(baseDateStr);
      const slots: PlannedSessionItem[] = [];

      // Pick default days based on allowedDaysPerWeek
      let defaultDayOffsets = [2]; // Wednesday (index 2 relative to Monday)
      if (allowedDaysPerWeek === 2) defaultDayOffsets = [0, 3]; // Monday, Thursday
      if (allowedDaysPerWeek === 3) defaultDayOffsets = [0, 2, 4]; // Monday, Wednesday, Friday
      if (allowedDaysPerWeek === 4) defaultDayOffsets = [0, 1, 3, 4]; // Mon, Tue, Thu, Fri

      let weekIdx = 0;
      let totalCreated = 0;

      while (totalCreated < targetCount && weekIdx < maxAvailableWeeksInQuarter) {
        const weekMon = addDays(startMon, weekIdx * 7);

        for (const offset of defaultDayOffsets) {
          if (totalCreated >= targetCount) break;
          const sessionD = addDays(weekMon, offset);
          const dateStr = formatDate(sessionD);

          // Stop if session exceeds active quarter end date
          if (activeQuarter?.endDate && dateStr > activeQuarter.endDate) {
            break;
          }

          // If session is in the past relative to baseDateStr on the first week, bump to next available day
          if (dateStr < baseDateStr && weekIdx === 0) {
            continue;
          }

          slots.push({
            clientId: `slot-${Date.now()}-${totalCreated}-${Math.random()}`,
            sessionDate: dateStr,
            startTime: '',
          });
          totalCreated++;
        }
        weekIdx++;
      }

      setNumberOfWeeks(Math.min(Math.max(weekIdx, 4), maxAvailableWeeksInQuarter));
      return slots;
    },
    [maxSessionsPerWeek, maxAvailableWeeksInQuarter, activeQuarter]
  );

  // Clear planner when modal opens so coach starts with clean slate
  useEffect(() => {
    if (isOpen) {
      setPlannedSessions([]);
      setPreviewData(null);
      setError(null);
    }
  }, [isOpen]);

  // Group planned sessions by Monday-to-Saturday week number
  const weekGroups = useMemo(() => {
    const groups: {
      weekNumber: number;
      mondayDate: Date;
      saturdayDate: Date;
      dateRangeLabel: string;
      sessions: (PlannedSessionItem & { sequenceNumber: number })[];
      availableDays: { dateStr: string; label: string; dayOfWeek: number }[];
    }[] = [];

    // Sort planned sessions chronologically
    const sorted = [...plannedSessions].sort((a, b) => {
      const cmp = a.sessionDate.localeCompare(b.sessionDate);
      if (cmp !== 0) return cmp;
      return a.startTime.localeCompare(b.startTime);
    });

    const maxWeek = Math.min(
      Math.max(
        numberOfWeeks,
        ...sorted.map((s) => {
          const sMon = getMonday(s.sessionDate);
          return Math.round((sMon.getTime() - startMondayDate.getTime()) / (7 * 86400000)) + 1;
        }),
        Math.min(4, maxAvailableWeeksInQuarter)
      ),
      maxAvailableWeeksInQuarter
    );

    for (let w = 1; w <= maxWeek; w++) {
      const wMon = addDays(startMondayDate, (w - 1) * 7);
      const wSat = addDays(wMon, 5);

      const monStr = formatDate(wMon);
      const satStr = formatDate(wSat);

      // Available days in this week (Monday through Saturday, skipping Sunday and days past quarter end)
      const daysInWeek: { dateStr: string; label: string; dayOfWeek: number }[] = [];
      for (let d = 0; d < (allowSaturday ? 6 : 5); d++) {
        const cur = addDays(wMon, d);
        const dayNum = cur.getDay();
        const curStr = formatDate(cur);

        // Exclude days that exceed active quarter deadline
        if (activeQuarter?.endDate && curStr > activeQuarter.endDate) {
          continue;
        }

        daysInWeek.push({
          dateStr: curStr,
          label: `${ENGLISH_DAYS[dayNum]} (${AMHARIC_DAYS[dayNum]}) — ${curStr}`,
          dayOfWeek: dayNum,
        });
      }

      if (daysInWeek.length === 0) continue;

      const isQuarterEndWeek = Boolean(activeQuarter?.endDate && satStr >= activeQuarter.endDate);
      const weekEndStr = isQuarterEndWeek && activeQuarter?.endDate ? activeQuarter.endDate : satStr;

      const weekSessions = sorted
        .filter((s) => s.sessionDate >= monStr && s.sessionDate <= weekEndStr)
        .map((s) => ({
          ...s,
          sequenceNumber: sorted.indexOf(s) + 1,
        }));

      groups.push({
        weekNumber: w,
        mondayDate: wMon,
        saturdayDate: wSat,
        dateRangeLabel: isQuarterEndWeek
          ? `${monStr} – ${weekEndStr} (Quarter Final Window)`
          : `${monStr} – ${satStr}`,
        sessions: weekSessions,
        availableDays: daysInWeek,
      });
    }

    return groups;
  }, [plannedSessions, startMondayDate, numberOfWeeks, allowSaturday, activeQuarter, maxAvailableWeeksInQuarter]);

  // Session mutation handlers
  const handleUpdateSessionDate = (clientId: string, newDate: string) => {
    setPlannedSessions((prev) =>
      prev.map((s) => (s.clientId === clientId ? { ...s, sessionDate: newDate } : s))
    );
  };

  const handleUpdateSessionTime = (clientId: string, newTime: string) => {
    setPlannedSessions((prev) =>
      prev.map((s) => (s.clientId === clientId ? { ...s, startTime: newTime } : s))
    );
  };

  const handleRemoveSession = (clientId: string) => {
    setPlannedSessions((prev) => prev.filter((s) => s.clientId !== clientId));
  };

  const handleAddSessionToWeek = (weekNumber: number) => {
    const group = weekGroups.find((g) => g.weekNumber === weekNumber);
    if (!group) return;

    if (group.sessions.length >= maxSessionsPerWeek) {
      setError(`Cannot exceed ${maxSessionsPerWeek} session(s) in Week ${weekNumber} per Bank Coaching Policy.`);
      return;
    }

    // Pick first unused day in week that is >= startDate if week 1
    const existingDates = new Set(group.sessions.map((s) => s.sessionDate));
    const candidateDay =
      group.availableDays.find(
        (d) => !existingDates.has(d.dateStr) && (group.weekNumber > 1 || d.dateStr >= startDate)
      ) ||
      group.availableDays.find((d) => !existingDates.has(d.dateStr)) ||
      group.availableDays[0];

    const newSession: PlannedSessionItem = {
      clientId: `slot-${Date.now()}-${Math.random()}`,
      sessionDate: candidateDay.dateStr,
      startTime: '',
    };

    setPlannedSessions((prev) => [...prev, newSession]);
    setError(null);
  };

  const handleAddNextWeek = () => {
    if (numberOfWeeks < maxAvailableWeeksInQuarter) {
      setNumberOfWeeks((prev) => Math.min(prev + 1, maxAvailableWeeksInQuarter));
    }
  };

  const handleRemoveEmptyWeek = (weekNumber: number) => {
    const group = weekGroups.find((g) => g.weekNumber === weekNumber);
    if (group && group.sessions.length === 0 && weekNumber > 4) {
      setNumberOfWeeks((prev) => Math.max(prev - 1, 4));
    }
  };

  // Convert planned sessions to backend custom format
  const customSessionsPayload = useMemo<CustomSessionSlot[]>(() => {
    const sorted = [...plannedSessions].sort((a, b) => {
      const cmp = a.sessionDate.localeCompare(b.sessionDate);
      if (cmp !== 0) return cmp;
      return a.startTime.localeCompare(b.startTime);
    });

    return sorted.map((s, idx) => ({
      sequenceNumber: idx + 1,
      sessionDate: s.sessionDate,
      startTime: `${s.startTime}:00`,
    }));
  }, [plannedSessions]);

  // Preview mutation for live conflict and shortfall checking
  const previewMutation = useMutation({
    mutationFn: () =>
      coachingGovernanceApi.previewSeries({
        firstSessionDate: startDate,
        cadenceType: 'CUSTOM',
        daysOfWeek: 'CUSTOM',
        preferredStartTime: `${plannedSessions[0]?.startTime || '15:00'}:00`,
        durationMinutes: duration,
        targetOccurrences: targetSessions,
        assignmentId: sessionType === 'MANDATORY_PMS' && selectedAssignmentId ? Number(selectedAssignmentId) : undefined,
        skillRequestId: sessionType === 'SELF_DEVELOPMENT' && selectedSkillRequestId ? Number(selectedSkillRequestId) : undefined,
        additionalAssignmentIds: sessionType === 'MANDATORY_PMS' && additionalAssignmentIds.length > 0 ? additionalAssignmentIds : undefined,
        customSessions: customSessionsPayload,
      }),
    onSuccess: (data) => {
      setPreviewData(data);
      setError(null);
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to preview meeting schedule.');
    },
  });

  // Trigger preview on session modifications only when all slots have an assigned time
  useEffect(() => {
    const allHaveTime = plannedSessions.length > 0 && plannedSessions.every((s) => Boolean(s.startTime));
    if (isOpen && allHaveTime) {
      previewMutation.mutate();
    } else {
      setPreviewData(null);
      setError(null);
    }
  }, [isOpen, plannedSessions, targetSessions, duration, selectedAssignmentId, additionalAssignmentIds, selectedSkillRequestId]);

  // Create Series mutation
  const createSeriesMutation = useMutation({
    mutationFn: (payload: CreateScheduleSeriesPayload) => coachingGovernanceApi.createSeries(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['coaching-targets-all'] });
      queryClient.invalidateQueries({ queryKey: ['coaching', 'my-coachees'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to establish recurring meeting rhythm.');
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (sessionType === 'MANDATORY_PMS' && !selectedAssignmentId) {
      setError('Please select an eligible coachee to establish this performance rhythm.');
      return;
    }

    if (sessionType === 'SELF_DEVELOPMENT' && !selectedSkillRequestId) {
      setError('Please select an approved skill cohort workshop.');
      return;
    }

    if (plannedSessions.length === 0) {
      setError('Please add at least one coaching session.');
      return;
    }

    if (plannedSessions.length !== targetSessions) {
      setError(`Planned sessions (${plannedSessions.length}) must equal agreed target (${targetSessions}).`);
      return;
    }

    if (hasIncompleteTime) {
      setError('Please select a meeting time for each planned session.');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a descriptive session rhythm title.');
      return;
    }

    createSeriesMutation.mutate({
      assignmentId: sessionType === 'MANDATORY_PMS' ? Number(selectedAssignmentId) : undefined,
      skillRequestId: sessionType === 'SELF_DEVELOPMENT' ? Number(selectedSkillRequestId) : undefined,
      additionalAssignmentIds: sessionType === 'MANDATORY_PMS' && additionalAssignmentIds.length > 0 ? additionalAssignmentIds : undefined,
      title: title.trim(),
      cadenceType: 'CUSTOM',
      daysOfWeek: 'CUSTOM',
      preferredStartTime: `${plannedSessions[0]?.startTime || '15:00'}:00`,
      durationMinutes: duration,
      meetingMode,
      meetingLocation: meetingLocation.trim() || undefined,
      firstSessionDate: startDate,
      targetOccurrences: targetSessions,
      customSessions: customSessionsPayload,
    });
  };

  const isCountValid = plannedSessions.length === targetSessions;
  const hasIncompleteTime = plannedSessions.length > 0 && plannedSessions.some((s) => !s.startTime);

  return (
    <div
      className="apid-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        className="apid-card"
        style={{
          width: '100%',
          maxWidth: 920,
          maxHeight: '94vh',
          overflowY: 'auto',
          margin: 0,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.55)',
          borderRadius: '12px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(to right, rgba(245, 158, 11, 0.08), transparent)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Calendar size={22} color="var(--gold-primary)" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>
                {sessionType === 'MANDATORY_PMS'
                  ? 'Interactive Weekly Coaching Planner'
                  : 'Schedule Skill Development Workshop'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Customize session days & Ethiopian sunrise hours week-by-week (Mon–Sat) up to your weekly cap.
              </p>
            </div>
          </div>
          <button type="button" className="apid-btn apid-btn-ghost" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {error && (
            <div
              className="apid-alert apid-alert-err"
              style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Coachee Selection */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                1. Select Assigned Coachee(s)
              </label>

              {sessionType === 'MANDATORY_PMS' && (
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '12px',
                    background: selectedAssignmentId
                      ? additionalAssignmentIds.length > 0
                        ? 'rgba(99, 102, 241, 0.15)'
                        : 'rgba(245, 158, 11, 0.15)'
                      : 'rgba(239, 68, 68, 0.1)',
                    color: selectedAssignmentId
                      ? additionalAssignmentIds.length > 0
                        ? '#6366f1'
                        : 'var(--gold-primary)'
                      : '#ef4444',
                  }}
                >
                  {!selectedAssignmentId
                    ? '⚠️ Select at least 1 coachee'
                    : additionalAssignmentIds.length === 0
                    ? '👤 1-on-1 PMS Coaching'
                    : `👥 Joint Group Remediation (${1 + additionalAssignmentIds.length} Coachees)`}
                </span>
              )}
            </div>

            {sessionType === 'MANDATORY_PMS' ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.6rem' }}>
                  {mandatoryCoachees.map((c) => {
                    const isPrimary = Number(selectedAssignmentId) === c.assignmentId;
                    const isAdditional = additionalAssignmentIds.includes(c.assignmentId);
                    const isSelected = isPrimary || isAdditional;

                    return (
                      <div
                        key={c.assignmentId}
                        onClick={() => {
                          if (isSelected) {
                            if (isPrimary) {
                              if (additionalAssignmentIds.length > 0) {
                                setSelectedAssignmentId(additionalAssignmentIds[0]);
                                setAdditionalAssignmentIds((prev) => prev.slice(1));
                              } else {
                                setSelectedAssignmentId('');
                              }
                            } else {
                              setAdditionalAssignmentIds((prev) => prev.filter((id) => id !== c.assignmentId));
                            }
                          } else {
                            if (!selectedAssignmentId) {
                              setSelectedAssignmentId(c.assignmentId);
                            } else {
                              if (!allowJointGroup) {
                                setError('Joint PMS group remediation is currently disabled by Bank Coaching Policy.');
                                return;
                              }
                              if (1 + additionalAssignmentIds.length >= maxJointGroupSize) {
                                setError(`Joint PMS groups cannot exceed ${maxJointGroupSize} talents per Bank Policy.`);
                                return;
                              }
                              setAdditionalAssignmentIds((prev) => [...prev, c.assignmentId]);
                            }
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '8px',
                          border: isSelected ? '2px solid var(--gold-primary)' : '1px solid var(--border)',
                          background: isSelected ? 'rgba(245, 158, 11, 0.08)' : 'var(--surface)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // handled by parent div
                          style={{ width: 17, height: 17, cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <strong style={{ fontSize: '0.88rem', color: 'var(--text)' }}>{c.coacheeFullName}</strong>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                fontWeight: 700,
                              }}
                            >
                              Rating: {c.appraisalRating ? Number(c.appraisalRating).toFixed(1) : '< 3.0'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            {c.coacheeEmployeeNumber} • {c.coacheeDepartment || 'Branch Operations'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {additionalAssignmentIds.length > 0 && (
                  <p style={{ margin: '0.45rem 0 0 0', fontSize: '0.76rem', color: '#6366f1', fontWeight: 600 }}>
                    💡 Joint PMS Group Remediation: All {1 + additionalAssignmentIds.length} coachees are synchronized in the same schedule rhythm with atomic double-booking conflict detection.
                  </p>
                )}
              </div>
            ) : (
              <select
                className="apid-input"
                style={{ marginTop: '0.35rem' }}
                value={selectedSkillRequestId}
                onChange={(e) => setSelectedSkillRequestId(e.target.value ? Number(e.target.value) : '')}
                required
              >
                <option value="">-- Choose an approved skill workshop cohort --</option>
                {(skillRequestsQuery.data || []).map((r) => {
                  const count = r.targets?.length ?? 1;
                  return (
                    <option key={r.id} value={r.id}>
                      {r.skillTitle} ({count} {count === 1 ? 'Talent' : 'Talents'} enrolled)
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Section 2: Policy Guidance, Disparity Handling & Target Commitment */}
          <div
            style={{
              background: targetGovernance.hasDisparity ? 'rgba(99, 102, 241, 0.07)' : 'rgba(245, 158, 11, 0.06)',
              border: targetGovernance.hasDisparity ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '8px',
              padding: '1rem 1.25rem',
              marginBottom: '1.25rem',
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
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Sparkles size={16} color={targetGovernance.hasDisparity ? '#6366f1' : 'var(--gold-primary)'} />
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>
                    Bank Policy Guidance: {targetGovernance.baseline} Required Sessions
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Standard policy: {targetGovernance.policyName}
                </p>
              </div>

              {/* Target sessions selection or lock */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
                  Agreed Target:
                </label>

                {!targetGovernance.coachAdjustmentAllowed ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.75rem',
                      borderRadius: '6px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: 'var(--gold-primary)',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                    }}
                  >
                    <Lock size={14} />
                    <span>Fixed: {targetGovernance.baseline} Sessions</span>
                  </div>
                ) : (
                  <select
                    className="apid-input"
                    style={{ width: 130, padding: '0.4rem 0.6rem', fontWeight: 700 }}
                    value={targetSessions}
                    onChange={(e) => {
                      const newTarget = Number(e.target.value);
                      setTargetSessions(newTarget);
                    }}
                  >
                    {Array.from(
                      { length: targetGovernance.maxAllowed - targetGovernance.minAllowed + 1 },
                      (_, i) => targetGovernance.minAllowed + i
                    ).map((num) => (
                      <option key={num} value={num}>
                        {num} Sessions {num === targetGovernance.baseline ? '(Recommended)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Score Disparity Alert Banner */}
            {targetGovernance.hasDisparity && (
              <div
                style={{
                  marginTop: '0.85rem',
                  padding: '0.75rem 0.9rem',
                  borderRadius: '6px',
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  fontSize: '0.8rem',
                  color: 'var(--text)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, color: '#6366f1', marginBottom: '0.3rem' }}>
                  <Info size={16} />
                  <span>Joint Remediation Pacing & Milestone Alignment</span>
                </div>
                <p style={{ margin: '0 0 0.35rem 0', color: 'var(--text-muted)' }}>
                  Selected coachees possess differing performance appraisal ratings and baseline requirements:
                </p>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                  {targetGovernance.disparityItems.map((item) => (
                    <span
                      key={item.name}
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border)',
                        fontWeight: 600,
                        fontSize: '0.78rem',
                      }}
                    >
                      {item.name}: Rating {item.rating ? Number(item.rating).toFixed(1) : '< 3.0'} → <strong>{item.baseline} Sessions Required</strong>
                    </span>
                  ))}
                </div>
                <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  ✓ The joint schedule target is aligned to {targetGovernance.baseline} sessions so no coachee is shortchanged. Coachees with lower targets will hit their formal completion milestone when reaching their respective requirement.
                </p>
              </div>
            )}
          </div>

          {/* Section 3: Metadata & Quick Drafting Controls */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr',
              gap: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Rhythm Title</label>
              <input
                type="text"
                className="apid-input"
                placeholder="e.g. Weekly Operations & Remediation Rhythm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>First Session Date</label>
              <input
                type="date"
                className="apid-input"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Duration</label>
              <select
                className="apid-input"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes (Recommended)</option>
                <option value={60}>60 Minutes</option>
              </select>
            </div>
          </div>

          {/* Section 4: Quick Pacing Presets & Target Counter Bar */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
              marginBottom: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Quick Draft:
              </span>
              <button
                type="button"
                className="apid-btn apid-btn-outline"
                style={{ padding: '0.3rem 0.65rem', fontSize: '0.76rem' }}
                onClick={() => setPlannedSessions(generateDraftSchedule(1, targetSessions, startDate))}
              >
                ⚡ 1 Session / Week
              </button>
              {maxSessionsPerWeek >= 2 && (
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.76rem' }}
                  onClick={() => setPlannedSessions(generateDraftSchedule(2, targetSessions, startDate))}
                >
                  ⚡ 2 Sessions / Week
                </button>
              )}
              {maxSessionsPerWeek >= 3 && (
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.76rem' }}
                  onClick={() => setPlannedSessions(generateDraftSchedule(3, targetSessions, startDate))}
                >
                  ⚡ 3 Sessions / Week
                </button>
              )}
              {plannedSessions.length > 0 && (
                <button
                  type="button"
                  className="apid-btn apid-btn-ghost"
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.76rem', color: '#ef4444', fontWeight: 600 }}
                  onClick={() => {
                    setPlannedSessions([]);
                    setPreviewData(null);
                    setError(null);
                  }}
                >
                  ✕ Clear All
                </button>
              )}
            </div>

            {/* Pacing Compliance Pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '20px',
                background: isCountValid ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: isCountValid ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
                color: isCountValid ? '#22c55e' : '#ef4444',
                fontSize: '0.82rem',
                fontWeight: 700,
              }}
            >
              {isCountValid ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>
                Planned: {plannedSessions.length} / {targetSessions} Sessions
                {!isCountValid && (
                  <span style={{ fontWeight: 500, marginLeft: '0.25rem' }}>
                    ({plannedSessions.length < targetSessions ? `Need ${targetSessions - plannedSessions.length} more` : `${plannedSessions.length - targetSessions} over target`})
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Section 5: Week-by-Week Interactive Schedule Cards */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  2. Week-by-Week Schedule Breakdown ({activeQuarter?.label || 'FY 2026/27 · Q2'} — Ends {activeQuarter?.endDate || '2026-12-31'})
                </label>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                  Available in active quarter: <strong>{maxAvailableWeeksInQuarter} weeks</strong> remaining from start date
                </div>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--gold-primary)', fontWeight: 600 }}>
                Weekly Cap: Max {maxSessionsPerWeek} session(s) per week
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {weekGroups.map((group) => {
                const isCapped = group.sessions.length >= maxSessionsPerWeek;
                const isBuffer = group.weekNumber === 6 || group.weekNumber === 12;

                return (
                  <div
                    key={group.weekNumber}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      background: isBuffer ? 'rgba(245, 158, 11, 0.03)' : 'rgba(0, 0, 0, 0.15)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Week Header */}
                    <div
                      style={{
                        padding: '0.65rem 0.95rem',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderBottom: group.sessions.length > 0 ? '1px solid var(--border)' : 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            background: isBuffer ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                            color: isBuffer ? 'var(--gold-primary)' : 'var(--text)',
                            fontWeight: 700,
                            fontSize: '0.78rem',
                          }}
                        >
                          Week {group.weekNumber}
                        </span>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                          {group.dateRangeLabel}
                        </span>
                        {isBuffer && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--gold-primary)', fontWeight: 600 }}>
                            (Quarter Buffer Window)
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span
                          style={{
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            color: group.sessions.length > maxSessionsPerWeek ? '#ef4444' : 'var(--text-muted)',
                          }}
                        >
                          {group.sessions.length} / {maxSessionsPerWeek} Sessions
                        </span>

                        <button
                          type="button"
                          className="apid-btn apid-btn-outline"
                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          disabled={isCapped}
                          onClick={() => handleAddSessionToWeek(group.weekNumber)}
                        >
                          <Plus size={13} />
                          <span>Add Session</span>
                        </button>
                      </div>
                    </div>

                    {/* Week Sessions List */}
                    {group.sessions.length > 0 ? (
                      <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                        {group.sessions.map((s) => {
                          const ethTime = toEthiopianTime(s.startTime);
                          // Conflict check from preview
                          const previewOcc = previewData?.previewDates.find(
                            (p) => p.sequenceNumber === s.sequenceNumber
                          );
                          const hasConflict = previewOcc?.hasConflict;
                          const milestoneHit = targetGovernance.disparityItems.find(
                            (d) => d.baseline === s.sequenceNumber && s.sequenceNumber < targetGovernance.baseline
                          );

                          return (
                            <div
                              key={s.clientId}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'auto 1.8fr 1.6fr auto',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.55rem 0.75rem',
                                borderRadius: '6px',
                                background: hasConflict
                                  ? 'rgba(239, 68, 68, 0.12)'
                                  : milestoneHit
                                  ? 'rgba(99, 102, 241, 0.08)'
                                  : 'var(--surface)',
                                border: hasConflict
                                  ? '1px solid rgba(239, 68, 68, 0.4)'
                                  : '1px solid var(--border)',
                              }}
                            >
                              {/* Session Sequence Badge */}
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: '50%',
                                  background: 'rgba(255, 255, 255, 0.06)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: '0.76rem',
                                  color: 'var(--text)',
                                }}
                              >
                                #{s.sequenceNumber}
                              </div>

                              {/* Working Day Selector */}
                              <div>
                                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                                  Day of Week (Mon–Sat):
                                </label>
                                <select
                                  className="apid-input"
                                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem' }}
                                  value={s.sessionDate}
                                  onChange={(e) => handleUpdateSessionDate(s.clientId, e.target.value)}
                                >
                                  {group.availableDays.map((d) => (
                                    <option key={d.dateStr} value={d.dateStr}>
                                      {d.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Time Selector */}
                              <div>
                                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                                  Start Time (የኢትዮጵያ ሰዓት / EAT):
                                </label>
                                <select
                                  className="apid-input"
                                  style={{
                                    fontSize: '0.78rem',
                                    padding: '0.3rem 0.5rem',
                                    borderColor: !s.startTime ? '#f59e0b' : undefined,
                                    background: !s.startTime ? 'rgba(245, 158, 11, 0.05)' : undefined,
                                  }}
                                  value={s.startTime}
                                  onChange={(e) => handleUpdateSessionTime(s.clientId, e.target.value)}
                                >
                                  <option value="">-- Select Time (የኢትዮጵያ ሰዓት) --</option>
                                  {BANK_OPERATING_TIME_OPTIONS.map((opt) => (
                                    <option key={opt.timeValue24} value={opt.timeValue24}>
                                      {opt.labelDual}
                                    </option>
                                  ))}
                                </select>

                                {!s.startTime ? (
                                  <div
                                    style={{
                                      marginTop: '0.2rem',
                                      fontSize: '0.72rem',
                                      color: '#f59e0b',
                                      fontWeight: 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                    }}
                                  >
                                    <span>⚠️ Please select meeting time</span>
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      marginTop: '0.2rem',
                                      fontSize: '0.7rem',
                                      color: 'var(--gold-primary)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                      fontWeight: 600,
                                    }}
                                  >
                                    <Clock size={10} />
                                    <span>{ethTime.formattedDual}</span>
                                  </div>
                                )}
                              </div>

                              {/* Action & Feedback */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSession(s.clientId)}
                                  className="apid-btn apid-btn-ghost"
                                  style={{ padding: '0.3rem 0.45rem', color: '#ef4444' }}
                                  title="Remove session"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>

                              {/* Milestone / Conflict notice row */}
                              {(hasConflict || milestoneHit) && (
                                <div
                                  style={{
                                    gridColumn: '1 / -1',
                                    fontSize: '0.74rem',
                                    fontWeight: 600,
                                    color: hasConflict ? '#ef4444' : '#6366f1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    paddingTop: '0.2rem',
                                  }}
                                >
                                  {hasConflict ? (
                                    <>
                                      <AlertTriangle size={13} />
                                      <span>⚠️ Collision: {previewOcc?.conflictDetails}</span>
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 size={13} />
                                      <span>🏁 Milestone Reached: {milestoneHit?.name} ({milestoneHit?.baseline}/{milestoneHit?.baseline} Sessions Completed)</span>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '0.85rem 1rem',
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          fontStyle: 'italic',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>No sessions planned for this week (Audit / Month-end / Rest Window).</span>
                        {group.weekNumber === weekGroups.length && group.weekNumber > 4 && (
                          <button
                            type="button"
                            className="apid-btn apid-btn-ghost"
                            style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem', color: '#ef4444' }}
                            onClick={() => handleRemoveEmptyWeek(group.weekNumber)}
                            title={`Remove empty Week ${group.weekNumber}`}
                          >
                            ✕ Remove Week {group.weekNumber}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add More Weeks Button (Capped at Active Quarter Deadline) */}
            <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}>
              {weekGroups.length < maxAvailableWeeksInQuarter ? (
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  style={{ padding: '0.4rem 0.9rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  onClick={handleAddNextWeek}
                >
                  <Plus size={14} />
                  <span>Extend Schedule (Add Week {weekGroups.length + 1} of {maxAvailableWeeksInQuarter})</span>
                </button>
              ) : (
                <div
                  style={{
                    padding: '0.4rem 0.9rem',
                    borderRadius: '6px',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: 'var(--gold-primary)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Lock size={13} />
                  <span>
                    {activeQuarter?.label || 'FY 2026/27 · Q2'} Deadline Reached ({maxAvailableWeeksInQuarter} of {maxAvailableWeeksInQuarter} Weeks Available — Ends {activeQuarter?.endDate || '2026-12-31'})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Section 6: Delivery Mode */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
              Meeting Delivery Mode
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <label
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 0.8rem',
                  border: meetingMode === 'VIRTUAL_VIDEO' ? '2px solid var(--gold-primary)' : '1px solid var(--border)',
                  borderRadius: '6px',
                  background: meetingMode === 'VIRTUAL_VIDEO' ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="meetingMode"
                  checked={meetingMode === 'VIRTUAL_VIDEO'}
                  onChange={() => setMeetingMode('VIRTUAL_VIDEO')}
                />
                <Video size={18} color="var(--gold-primary)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>LiveKit Video Call</span>
              </label>

              <label
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 0.8rem',
                  border: meetingMode === 'IN_PERSON' ? '2px solid var(--gold-primary)' : '1px solid var(--border)',
                  borderRadius: '6px',
                  background: meetingMode === 'IN_PERSON' ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="meetingMode"
                  checked={meetingMode === 'IN_PERSON'}
                  onChange={() => setMeetingMode('IN_PERSON')}
                />
                <MapPin size={18} color="var(--gold-primary)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Branch / In Person</span>
              </label>

              <label
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 0.8rem',
                  border: meetingMode === 'PHONE_CALL' ? '2px solid var(--gold-primary)' : '1px solid var(--border)',
                  borderRadius: '6px',
                  background: meetingMode === 'PHONE_CALL' ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="meetingMode"
                  checked={meetingMode === 'PHONE_CALL'}
                  onChange={() => setMeetingMode('PHONE_CALL')}
                />
                <Phone size={18} color="var(--gold-primary)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Phone Call</span>
              </label>
            </div>

            {meetingMode === 'IN_PERSON' && (
              <div style={{ marginTop: '0.75rem' }}>
                <input
                  type="text"
                  className="apid-input"
                  placeholder="Enter branch meeting room or office location..."
                  value={meetingLocation}
                  onChange={(e) => setMeetingLocation(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--border)',
              paddingTop: '1.25rem',
              marginTop: '1.25rem',
            }}
          >
            {plannedSessions.length > 0 ? (
              <button
                type="button"
                className="apid-btn apid-btn-outline"
                onClick={() => {
                  setPlannedSessions([]);
                  setPreviewData(null);
                  setError(null);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#ef4444' }}
              >
                <Trash2 size={14} />
                <span>Clear All Sessions</span>
              </button>
            ) : (
              <button
                type="button"
                className="apid-btn apid-btn-outline"
                onClick={() => setPlannedSessions(generateDraftSchedule(Math.min(1, maxSessionsPerWeek), targetSessions, startDate))}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}
              >
                <RotateCcw size={14} />
                <span>Auto-Draft (1 Session / Week)</span>
              </button>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="apid-btn apid-btn-outline" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="apid-btn apid-btn-primary"
                disabled={
                  createSeriesMutation.isPending ||
                  !isCountValid ||
                  hasIncompleteTime ||
                  Boolean(previewData?.hasConflict)
                }
                style={{
                  backgroundColor: !isCountValid || hasIncompleteTime || previewData?.hasConflict ? '#94a3b8' : undefined,
                  cursor: !isCountValid || hasIncompleteTime || previewData?.hasConflict ? 'not-allowed' : undefined,
                }}
              >
                {createSeriesMutation.isPending
                  ? 'Generating Meetings...'
                  : !isCountValid
                  ? `Plan ${targetSessions} Sessions (${plannedSessions.length}/${targetSessions})`
                  : hasIncompleteTime
                  ? `Select Times (${plannedSessions.filter((s) => Boolean(s.startTime)).length}/${targetSessions} Set)`
                  : previewData?.hasConflict
                  ? 'Cannot Schedule — Time Conflict'
                  : `Confirm & Schedule Rhythm (${plannedSessions.length} Meetings)`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
