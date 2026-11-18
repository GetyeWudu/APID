import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Video, MapPin, X, Target, AlertTriangle } from 'lucide-react';
import { coachingSessionApi, CreateSessionPayload, SessionMeetingMode } from '../api/coachingSessionApi';
import { coachingAssignmentApi, MyCoacheeItem } from '../api/coachingAssignmentApi';
import { skillCoachingRequestApi, SkillCoachingRequestItem } from '../api/skillCoachingRequestApi';
import { BANK_OPERATING_TIME_OPTIONS, toEthiopianTime } from '../utils/ethiopianTimeUtils';

interface ScheduleSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  myCoachees: MyCoacheeItem[];
  mode?: 'MANDATORY_PMS' | 'SELF_DEVELOPMENT';
}

export const ScheduleSessionModal: React.FC<ScheduleSessionModalProps> = ({
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
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('15:00');
  const [duration, setDuration] = useState<number>(45);
  const [meetingMode, setMeetingMode] = useState<SessionMeetingMode>('ONLINE');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [selectedGoalId, setSelectedGoalId] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);

  // Load approved skill requests where current user is proposed coach
  const skillRequestsQuery = useQuery<SkillCoachingRequestItem[]>({
    queryKey: ['my-approved-skill-requests'],
    queryFn: async () => {
      const all = await skillCoachingRequestApi.getMyRequests();
      return (all || []).filter((r: SkillCoachingRequestItem) => r.status === 'APPROVED');
    },
    enabled: isOpen,
  });

  // Query my coachees directly if not provided by parent prop
  const coacheesQuery = useQuery<MyCoacheeItem[]>({
    queryKey: ['coaching', 'my-coachees'],
    queryFn: coachingAssignmentApi.getMyCoachees,
    enabled: isOpen && (!myCoachees || myCoachees.length === 0),
  });

  const allCoachees = (myCoachees && myCoachees.length > 0)
    ? myCoachees
    : (coacheesQuery.data || []);

  const mandatoryCoachees = allCoachees.filter((c) => c.pathway !== 'SELF_DEVELOPMENT');

  // When assignment changes, load that coachee's goals for target PMS goal dropdown
  const selectedCoachee = allCoachees.find((c) => c.assignmentId === Number(selectedAssignmentId));
  const goalsQuery = useQuery({
    queryKey: ['employee-performance-goals', selectedCoachee?.coacheeEmployeeId],
    queryFn: () => coachingAssignmentApi.getEmployeePerformanceGoals(selectedCoachee!.coacheeEmployeeId),
    enabled: isOpen && !!selectedCoachee,
  });

  const scheduleMutation = useMutation({
    mutationFn: (payload: CreateSessionPayload) => coachingSessionApi.createSession(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching-sessions'] });
      onClose();
      resetForm();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to schedule coaching session. Please verify dates.');
    },
  });

  const resetForm = () => {
    setTitle('');
    setStartDate('');
    setStartTime('');
    setDuration(45);
    setMeetingLocation('');
    setSelectedAssignmentId('');
    setSelectedSkillRequestId('');
    setSelectedGoalId('');
    setError(null);
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!startDate || !startTime) {
      setError('Please select date and start time.');
      return;
    }

    const dateObj = new Date(`${startDate}T12:00:00`);
    if (dateObj.getDay() === 0) {
      setError('Sunday sessions are not permitted. Bank operations run Monday to Saturday.');
      return;
    }

    const scheduledStartTime = new Date(`${startDate}T${startTime}:00`).toISOString();

    const payload: CreateSessionPayload = {
      title: title.trim(),
      scheduledStartTime,
      durationMinutes: duration,
      meetingMode,
      meetingLocation: meetingLocation.trim() || undefined,
      targetPmsGoalId: selectedGoalId ? Number(selectedGoalId) : undefined,
      additionalAssignmentIds: sessionType === 'MANDATORY_PMS' && additionalAssignmentIds.length > 0 ? additionalAssignmentIds : undefined,
    };

    if (sessionType === 'MANDATORY_PMS') {
      if (!selectedAssignmentId) {
        setError('Please select an assigned coachee.');
        return;
      }
      payload.assignmentId = Number(selectedAssignmentId);
    } else {
      if (!selectedSkillRequestId) {
        setError('Please select an approved skill development cohort.');
        return;
      }
      payload.skillRequestId = Number(selectedSkillRequestId);
    }

    scheduleMutation.mutate(payload);
  };

  const approvedSkillRequests = skillRequestsQuery.data || [];

  return (
    <div
      className="apid-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="apid-card"
        style={{
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          overflowY: 'auto',
          margin: 0,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="boa-card-header"
          style={{
            paddingBottom: '0.85rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={22} color="var(--gold-primary)" />
            <div>
              <h3 className="boa-card-title" style={{ margin: 0, fontSize: '1.2rem' }}>
                {mode === 'MANDATORY_PMS'
                  ? 'Schedule PMS Remediation Session'
                  : mode === 'SELF_DEVELOPMENT'
                  ? 'Schedule Skill Development Workshop'
                  : 'Schedule Coaching Session'}
              </h3>
              <p className="boa-card-subtitle" style={{ margin: 0 }}>
                {mode === 'MANDATORY_PMS'
                  ? 'Set up a mandatory performance appraisal remediation meeting.'
                  : mode === 'SELF_DEVELOPMENT'
                  ? 'Set up a skill development workshop for your approved cohort.'
                  : 'Set up a 1-on-1 PMS touchpoint or group skill-development session.'}
              </p>
            </div>
          </div>
          <button type="button" className="apid-btn apid-btn-ghost" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.2rem 0' }}>
          {error && (
            <div className="apid-alert apid-alert-err" style={{ marginBottom: '1rem' }}>
              <AlertTriangle size={16} style={{ marginRight: '0.4rem' }} />
              {error}
            </div>
          )}

          {/* Session Pathway Picker (Only shown when mode is not preset) */}
          {!mode && (
            <div className="apid-field" style={{ marginBottom: '1rem' }}>
              <label style={{ fontWeight: 600 }}>Coaching Pathway</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  className={`apid-btn ${sessionType === 'MANDATORY_PMS' ? 'apid-btn-primary' : 'apid-btn-secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => {
                    setSessionType('MANDATORY_PMS');
                    setSelectedSkillRequestId('');
                    if (mandatoryCoachees.length > 0 && !selectedAssignmentId) {
                      setSelectedAssignmentId(mandatoryCoachees[0].assignmentId);
                      setTitle(`PMS 1-on-1 Coaching: ${mandatoryCoachees[0].coacheeFullName}`);
                    }
                  }}
                >
                  1-on-1 Mandatory PMS
                </button>
                <button
                  type="button"
                  className={`apid-btn ${sessionType === 'SELF_DEVELOPMENT' ? 'apid-btn-primary' : 'apid-btn-secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => {
                    setSessionType('SELF_DEVELOPMENT');
                    setSelectedAssignmentId('');
                    if ((skillRequestsQuery.data || []).length > 0) {
                      const first = skillRequestsQuery.data![0];
                      setSelectedSkillRequestId(first.id);
                      setTitle(`Skill Cohort: ${first.skillTitle}`);
                    }
                  }}
                >
                  Skill Development Cohort
                </button>
              </div>
            </div>
          )}

          {/* Target Coachee or Skill Cohort */}
          {sessionType === 'MANDATORY_PMS' ? (
            <div className="apid-field" style={{ marginBottom: '1rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.4rem',
                }}
              >
                <label style={{ fontWeight: 600 }}>
                  Select Assigned Coachee(s) *
                </label>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
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
                    ? '👤 1-on-1 PMS Session'
                    : `👥 Joint Group Remediation (${1 + additionalAssignmentIds.length} Coachees)`}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.5rem' }}>
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
                              const nextPrimary = additionalAssignmentIds[0];
                              setSelectedAssignmentId(nextPrimary);
                              setAdditionalAssignmentIds((prev) => prev.slice(1));
                              const found = mandatoryCoachees.find((m) => m.assignmentId === nextPrimary);
                              if (found) setTitle(`PMS 1-on-1 Coaching: ${found.coacheeFullName}`);
                            } else {
                              setSelectedAssignmentId('');
                              setTitle('');
                            }
                          } else {
                            const remaining = additionalAssignmentIds.filter((id) => id !== c.assignmentId);
                            setAdditionalAssignmentIds(remaining);
                            const primaryC = mandatoryCoachees.find((m) => m.assignmentId === Number(selectedAssignmentId));
                            if (remaining.length === 0 && primaryC) {
                              setTitle(`PMS 1-on-1 Coaching: ${primaryC.coacheeFullName}`);
                            } else if (primaryC) {
                              const others = mandatoryCoachees.filter((m) => remaining.includes(m.assignmentId));
                              setTitle(`PMS Joint Coaching: ${primaryC.coacheeFullName}, ${others.map((o) => o.coacheeFullName).join(', ')}`);
                            }
                          }
                        } else {
                          if (!selectedAssignmentId) {
                            setSelectedAssignmentId(c.assignmentId);
                            setTitle(`PMS 1-on-1 Coaching: ${c.coacheeFullName}`);
                          } else {
                            const newAdditional = [...additionalAssignmentIds, c.assignmentId];
                            setAdditionalAssignmentIds(newAdditional);
                            const primaryC = mandatoryCoachees.find((m) => m.assignmentId === Number(selectedAssignmentId));
                            const others = mandatoryCoachees.filter((m) => newAdditional.includes(m.assignmentId));
                            setTitle(`PMS Joint Coaching: ${primaryC?.coacheeFullName || ''}, ${others.map((o) => o.coacheeFullName).join(', ')}`);
                          }
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        padding: '0.6rem 0.8rem',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid var(--gold-primary)' : '1px solid var(--border)',
                        background: isSelected ? 'rgba(245, 158, 11, 0.08)' : 'var(--surface)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by div
                        style={{ width: 17, height: 17, cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '0.86rem', color: 'var(--text)' }}>{c.coacheeFullName}</strong>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              fontWeight: 700,
                            }}
                          >
                            Score &lt; 3.0
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {c.coacheeEmployeeNumber} • {c.coacheeDepartment || 'Branch Operations'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="apid-field" style={{ marginBottom: '1rem' }}>
              <label htmlFor="select-skill-cohort" style={{ fontWeight: 600 }}>
                Select Approved Skill Request & Cohort *
              </label>
              <select
                id="select-skill-cohort"
                className="apid-input"
                value={selectedSkillRequestId}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSelectedSkillRequestId(val);
                  const found = approvedSkillRequests.find((r) => r.id === val);
                  if (found) setTitle(`Skill Cohort: ${found.skillTitle}`);
                }}
                required
              >
                <option value="">-- Select approved skill request --</option>
                {approvedSkillRequests.map((r) => (
                  <option key={r.id} value={r.id}>
                    REQ-{r.id}: {r.skillTitle} ({r.targets?.length || 0} staff: {r.targets?.map((s) => s.employeeFullName).join(', ')})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Session Title */}
          <div className="apid-field" style={{ marginBottom: '1rem' }}>
            <label htmlFor="session-title" style={{ fontWeight: 600 }}>
              Session Title *
            </label>
            <input
              id="session-title"
              type="text"
              className="apid-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly FX Reconciliation Practice"
              required
            />
          </div>

          {/* Target Weakest PMS Goal (Optional for Mandatory) */}
          {sessionType === 'MANDATORY_PMS' && (
            <div className="apid-field" style={{ marginBottom: '1rem' }}>
              <label htmlFor="target-goal" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Target size={15} color="var(--gold-primary)" />
                Target PMS Weakness Focus Area
              </label>
              <select
                id="target-goal"
                className="apid-input"
                value={selectedGoalId}
                onChange={(e) => setSelectedGoalId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">-- General Coaching / Discussion --</option>
                {goalsQuery.isLoading && <option value="" disabled>Loading employee goals...</option>}
                {goalsQuery.data?.goalLines?.map((g) => (
                  <option key={g.id || g.sourceRowNumber} value={g.id || g.sourceRowNumber}>
                    {g.goalName} (Score: {Number(g.goalScore).toFixed(2)} · Weight: {Number(g.weight).toFixed(0)}%)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date, Time & Duration */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div className="apid-field">
              <label htmlFor="session-date" style={{ fontWeight: 600 }}>Date *</label>
              <input
                id="session-date"
                type="date"
                className="apid-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="apid-field">
              <label htmlFor="session-time" style={{ fontWeight: 600 }}>Time (የኢትዮጵያ ሰዓት) *</label>
              <select
                id="session-time"
                className="apid-input"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              >
                {BANK_OPERATING_TIME_OPTIONS.map((opt) => (
                  <option key={opt.timeValue24} value={opt.timeValue24}>
                    {opt.labelDual}
                  </option>
                ))}
              </select>
              {startTime && (
                <div style={{ marginTop: '0.2rem', fontSize: '0.72rem', color: 'var(--gold-primary)', fontWeight: 600 }}>
                  የኢትዮጵያ ሰዓት: {toEthiopianTime(startTime).formattedDual}
                </div>
              )}
            </div>

            <div className="apid-field">
              <label htmlFor="session-duration" style={{ fontWeight: 600 }}>Duration</label>
              <select
                id="session-duration"
                className="apid-input"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes (Std)</option>
                <option value={60}>60 Minutes (Intensive)</option>
                <option value={90}>90 Minutes</option>
              </select>
            </div>
          </div>

          {/* Meeting Mode */}
          <div className="apid-field" style={{ marginBottom: '1rem' }}>
            <label style={{ fontWeight: 600 }}>Delivery Mode *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                className={`apid-btn ${meetingMode === 'ONLINE' || meetingMode === 'VIRTUAL_VIDEO' ? 'apid-btn-primary' : 'apid-btn-outline'}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                onClick={() => setMeetingMode('ONLINE')}
              >
                <Video size={16} /> LiveKit Video
              </button>
              <button
                type="button"
                className={`apid-btn ${meetingMode === 'IN_PERSON' ? 'apid-btn-primary' : 'apid-btn-outline'}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                onClick={() => setMeetingMode('IN_PERSON')}
              >
                <MapPin size={16} /> In-Person
              </button>
              <button
                type="button"
                className={`apid-btn ${meetingMode === 'HYBRID' ? 'apid-btn-primary' : 'apid-btn-outline'}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                onClick={() => setMeetingMode('HYBRID')}
              >
                <Video size={16} /> Hybrid
              </button>
            </div>
          </div>

          {(meetingMode === 'IN_PERSON' || meetingMode === 'HYBRID' || meetingMode === 'PHONE_CALL') && (
            <div className="apid-field" style={{ marginBottom: '1rem' }}>
              <label htmlFor="meeting-location" style={{ fontWeight: 600 }}>
                {meetingMode === 'PHONE_CALL' ? 'Phone Number / Extension' : 'Branch Meeting Room Location'}
              </label>
              <input
                id="meeting-location"
                type="text"
                className="apid-input"
                value={meetingLocation}
                onChange={(e) => setMeetingLocation(e.target.value)}
                placeholder={meetingMode === 'PHONE_CALL' ? 'e.g. BoA Internal Ext 4412 / +251 911 000000' : 'e.g. Bole Branch, Conference Room 2'}
              />
            </div>
          )}

          {/* Actions */}
          <div
            style={{
              borderTop: '1px solid var(--border)',
              paddingTop: '1rem',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.5rem',
            }}
          >
            <button type="button" className="apid-btn apid-btn-secondary" onClick={onClose} disabled={scheduleMutation.isPending}>
              Cancel
            </button>
            <button type="submit" className="apid-btn apid-btn-primary" disabled={scheduleMutation.isPending}>
              {scheduleMutation.isPending ? 'Scheduling...' : 'Confirm Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
