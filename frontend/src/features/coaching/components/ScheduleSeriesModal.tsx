import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Video, Phone, MapPin, X, AlertTriangle, Sparkles } from 'lucide-react';
import {
  coachingGovernanceApi,
  CadenceType,
  SeriesPreviewResponseData,
  CreateScheduleSeriesPayload,
  SessionMeetingMode
} from '../api/coachingSessionApi';
import { coachingAssignmentApi, MyCoacheeItem } from '../api/coachingAssignmentApi';
import { skillCoachingRequestApi, SkillCoachingRequestItem } from '../api/skillCoachingRequestApi';

interface ScheduleSeriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  myCoachees: MyCoacheeItem[];
}

export const ScheduleSeriesModal: React.FC<ScheduleSeriesModalProps> = ({
  isOpen,
  onClose,
  myCoachees,
}) => {
  const queryClient = useQueryClient();

  const [sessionType, setSessionType] = useState<'MANDATORY_PMS' | 'SELF_DEVELOPMENT'>('MANDATORY_PMS');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | ''>('');
  const [selectedSkillRequestId, setSelectedSkillRequestId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [cadence, setCadence] = useState<CadenceType>('WEEKLY');
  const [dayOfWeek, setDayOfWeek] = useState('WEDNESDAY');
  const [startTime, setStartTime] = useState('15:00');
  const [duration, setDuration] = useState<number>(45);
  const [startDate, setStartDate] = useState(() => {
    // Default to next Wednesday
    const d = new Date();
    d.setDate(d.getDate() + ((3 + 7 - d.getDay()) % 7 || 7));
    return d.toISOString().split('T')[0];
  });
  const [meetingMode, setMeetingMode] = useState<SessionMeetingMode>('VIRTUAL_VIDEO');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [targetSessions, setTargetSessions] = useState<number>(6);
  const [previewData, setPreviewData] = useState<SeriesPreviewResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // Fetch target governance for the selected assignment
  const targetQuery = useQuery({
    queryKey: ['coaching-target', selectedAssignmentId, selectedSkillRequestId],
    queryFn: () =>
      coachingGovernanceApi.getTarget({
        assignmentId: selectedAssignmentId ? Number(selectedAssignmentId) : undefined,
        skillRequestId: selectedSkillRequestId ? Number(selectedSkillRequestId) : undefined,
      }),
    enabled: isOpen && (!!selectedAssignmentId || !!selectedSkillRequestId),
  });

  // Auto-fill target and title when selection changes
  useEffect(() => {
    if (targetQuery.data) {
      setTargetSessions(targetQuery.data.approvedTarget || targetQuery.data.policyBaseline || 6);
    }
  }, [targetQuery.data]);

  useEffect(() => {
    if (sessionType === 'MANDATORY_PMS' && selectedAssignmentId) {
      const coachee = mandatoryCoachees.find((c) => c.assignmentId === Number(selectedAssignmentId));
      if (coachee) {
        setTitle(`Mandatory Performance Coaching — ${coachee.coacheeFullName}`);
      }
    } else if (sessionType === 'SELF_DEVELOPMENT' && selectedSkillRequestId) {
      const req = (skillRequestsQuery.data || []).find((r) => r.id === Number(selectedSkillRequestId));
      if (req) {
        setTitle(`Skill Cohort: ${req.skillTitle}`);
      }
    }
  }, [sessionType, selectedAssignmentId, selectedSkillRequestId, mandatoryCoachees, skillRequestsQuery.data]);

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: () =>
      coachingGovernanceApi.previewSeries({
        firstSessionDate: startDate,
        cadenceType: cadence,
        daysOfWeek: dayOfWeek,
        preferredStartTime: `${startTime}:00`,
        durationMinutes: duration,
        targetOccurrences: targetSessions,
      }),
    onSuccess: (data) => {
      setPreviewData(data);
      setError(null);
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to preview meeting schedule.');
    },
  });

  // Trigger preview on initial load or date change
  useEffect(() => {
    if (isOpen && startDate && startTime && targetSessions > 0) {
      previewMutation.mutate();
    }
  }, [isOpen, startDate, startTime, cadence, dayOfWeek, targetSessions, duration]);

  // Create Series mutation
  const createSeriesMutation = useMutation({
    mutationFn: (payload: CreateScheduleSeriesPayload) => coachingGovernanceApi.createSeries(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['coaching-target'] });
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

    if (!selectedAssignmentId && !selectedSkillRequestId) {
      setError('Please select an employee or skill cohort to coach.');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a descriptive session title.');
      return;
    }

    createSeriesMutation.mutate({
      assignmentId: sessionType === 'MANDATORY_PMS' ? Number(selectedAssignmentId) : undefined,
      skillRequestId: sessionType === 'SELF_DEVELOPMENT' ? Number(selectedSkillRequestId) : undefined,
      title: title.trim(),
      cadenceType: cadence,
      daysOfWeek: dayOfWeek,
      preferredStartTime: `${startTime}:00`,
      durationMinutes: duration,
      meetingMode,
      meetingLocation: meetingLocation.trim() || undefined,
      firstSessionDate: startDate,
      targetOccurrences: targetSessions,
    });
  };

  return (
    <div
      className="apid-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
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
          maxWidth: 820,
          maxHeight: '92vh',
          overflowY: 'auto',
          margin: 0,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
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
                width: 40,
                height: 40,
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
                Set Recurring Meeting Rhythm
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Configure a standard weekly or bi-weekly coaching calendar for the quarter in one click.
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

          {/* Section 1: Who are you coaching? */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              1. Select Coachee or Group Cohort
            </label>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', marginBottom: '0.75rem' }}>
              <button
                type="button"
                className={`apid-btn ${sessionType === 'MANDATORY_PMS' ? 'apid-btn-primary' : 'apid-btn-outline'}`}
                style={{ flex: 1 }}
                onClick={() => setSessionType('MANDATORY_PMS')}
              >
                1-on-1 Performance Coaching (PMS)
              </button>
              <button
                type="button"
                className={`apid-btn ${sessionType === 'SELF_DEVELOPMENT' ? 'apid-btn-primary' : 'apid-btn-outline'}`}
                style={{ flex: 1 }}
                onClick={() => setSessionType('SELF_DEVELOPMENT')}
              >
                Skill Development Cohort
              </button>
            </div>

            {sessionType === 'MANDATORY_PMS' ? (
              <select
                className="apid-input"
                value={selectedAssignmentId}
                onChange={(e) => setSelectedAssignmentId(e.target.value ? Number(e.target.value) : '')}
                required
              >
                <option value="">-- Choose an assigned direct report / coachee --</option>
                {mandatoryCoachees.map((c) => (
                  <option key={c.assignmentId} value={c.assignmentId}>
                    {c.coacheeFullName} ({c.coacheeEmployeeNumber}) — {c.coacheeDepartment || 'Branch Operations'}
                  </option>
                ))}
              </select>
            ) : (
              <select
                className="apid-input"
                value={selectedSkillRequestId}
                onChange={(e) => setSelectedSkillRequestId(e.target.value ? Number(e.target.value) : '')}
                required
              >
                <option value="">-- Choose an approved skill workshop cohort --</option>
                {(skillRequestsQuery.data || []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.skillTitle} ({r.targets?.length ?? 0} Staff Members enrolled)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Section 2: Policy Guidance & Target Commitment */}
          {targetQuery.data && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.06)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                padding: '1rem 1.25rem',
                marginBottom: '1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Sparkles size={16} color="var(--gold-primary)" />
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>
                    Bank Policy Guidance: {targetQuery.data.policyBaseline} Required Sessions
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Standard policy: {targetQuery.data.policyName}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
                  Agreed Target:
                </label>
                <select
                  className="apid-input"
                  style={{ width: 110, padding: '0.4rem 0.6rem', fontWeight: 700 }}
                  value={targetSessions}
                  onChange={(e) => setTargetSessions(Number(e.target.value))}
                >
                  {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                    <option key={num} value={num}>
                      {num} Sessions
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Section 3: Meeting Rhythm & Schedule */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Meeting Rhythm (Cadence)</label>
              <select
                className="apid-input"
                value={cadence}
                onChange={(e) => setCadence(e.target.value as CadenceType)}
              >
                <option value="WEEKLY">Every Week (Standard)</option>
                <option value="BIWEEKLY">Every 2 Weeks (Bi-weekly)</option>
                <option value="TWICE_WEEKLY">Twice a Week (Intensive)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Standing Day of Week</label>
              <select
                className="apid-input"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
              >
                <option value="MONDAY">Every Monday</option>
                <option value="TUESDAY">Every Tuesday</option>
                <option value="WEDNESDAY">Every Wednesday</option>
                <option value="THURSDAY">Every Thursday</option>
                <option value="FRIDAY">Every Friday</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Preferred Start Time</label>
              <input
                type="time"
                className="apid-input"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
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

          {/* Section 4: Title & First Session Date */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr',
              gap: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Rhythm Title</label>
              <input
                type="text"
                className="apid-input"
                placeholder="e.g. Weekly Trade LC Operational Remediation"
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
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Section 5: Delivery Mode */}
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
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Daily.co Live Video</span>
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

          {/* Live Occurrence Preview Table */}
          {previewData && (
            <div style={{ marginTop: '1.25rem', marginBottom: '1.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>
                  Generated Quarterly Calendar Preview ({previewData.generatedOccurrences} of {previewData.targetOccurrences} Scheduled)
                </span>
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: previewData.hasShortfall ? 'var(--danger)' : 'var(--success)',
                    fontWeight: 600,
                  }}
                >
                  {previewData.shortfallMessage}
                </span>
              </div>

              <div
                style={{
                  maxHeight: 180,
                  overflowY: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'rgba(0,0,0,0.15)',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
                      <th style={{ padding: '0.4rem 0.75rem', textAlign: 'left' }}>#</th>
                      <th style={{ padding: '0.4rem 0.75rem', textAlign: 'left' }}>Date & Day</th>
                      <th style={{ padding: '0.4rem 0.75rem', textAlign: 'left' }}>Time Window</th>
                      <th style={{ padding: '0.4rem 0.75rem', textAlign: 'left' }}>Fiscal Week</th>
                      <th style={{ padding: '0.4rem 0.75rem', textAlign: 'left' }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.previewDates.map((p) => (
                      <tr
                        key={p.sequenceNumber}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          background: p.isBufferWeek ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '0.35rem 0.75rem', fontWeight: 600 }}>Session {p.sequenceNumber}</td>
                        <td style={{ padding: '0.35rem 0.75rem' }}>
                          {p.sessionDate} ({p.dayOfWeek})
                        </td>
                        <td style={{ padding: '0.35rem 0.75rem' }}>
                          {p.startTime.substring(0, 5)} – {p.endTime.substring(0, 5)}
                        </td>
                        <td style={{ padding: '0.35rem 0.75rem' }}>Week {p.weekNumber}</td>
                        <td style={{ padding: '0.35rem 0.75rem', color: p.isBufferWeek ? 'var(--gold-primary)' : 'var(--text-muted)' }}>
                          {p.note}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              borderTop: '1px solid var(--border)',
              paddingTop: '1.25rem',
              marginTop: '1.25rem',
            }}
          >
            <button type="button" className="apid-btn apid-btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="apid-btn apid-btn-primary"
              disabled={createSeriesMutation.isPending || !previewData || previewData.generatedOccurrences === 0}
            >
              {createSeriesMutation.isPending
                ? 'Generating Meetings...'
                : `Confirm & Schedule Rhythm (${previewData?.generatedOccurrences || 0} Meetings)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
