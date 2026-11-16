import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sliders,
  Clock,
  Video,
  AlertCircle,
  CheckCircle2,
  Save,
  RotateCcw,
  ShieldCheck,
  Edit3,
  Plus,
  X,
  Target,
  Sparkles,
} from 'lucide-react';
import { coreConfigApi } from '../../admin/config/api/coreConfigApi';
import { coachingGovernanceApi, CoachingPolicyVersionItem } from '../api/coachingSessionApi';
import { AssignmentPathway } from '../api/coachingAssignmentApi';

export const CoachingRulesTab: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: configSnapshot, isLoading } = useQuery({
    queryKey: ['core', 'active-config'],
    queryFn: coreConfigApi.getActiveConfig,
  });

  const { data: policies = [] } = useQuery<CoachingPolicyVersionItem[]>({
    queryKey: ['coaching-policies'],
    queryFn: () => coachingGovernanceApi.getPolicies(),
  });

  // Operational Rules State
  const [earlyJoinMinutes, setEarlyJoinMinutes] = useState<number>(15);
  const [minNoticeHours, setMinNoticeHours] = useState<number>(4);
  const [maxReschedules, setMaxReschedules] = useState<number>(2);
  const [requireDeclineReason, setRequireDeclineReason] = useState<boolean>(true);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Policy Modal State
  const [editingPolicy, setEditingPolicy] = useState<CoachingPolicyVersionItem | null>(null);
  const [isCreatingPolicy, setIsCreatingPolicy] = useState(false);
  const [policyForm, setPolicyForm] = useState<{
    policyName: string;
    pathway: AssignmentPathway;
    minAppraisalRating: number | string;
    maxAppraisalRating: number | string;
    baselineSessions: number;
    minAllowedSessions: number;
    maxAllowedSessions: number;
    defaultCadence: string;
    requiresPmsApprovalOutsideRange: boolean;
    coachAdjustmentAllowed: boolean;
    allowExtensions: boolean;
    allowEarlyCompletion: boolean;
  }>({
    policyName: '',
    pathway: 'MANDATORY_PMS',
    minAppraisalRating: 0.0,
    maxAppraisalRating: 1.99,
    baselineSessions: 10,
    minAllowedSessions: 8,
    maxAllowedSessions: 12,
    defaultCadence: 'WEEKLY',
    requiresPmsApprovalOutsideRange: true,
    coachAdjustmentAllowed: true,
    allowExtensions: true,
    allowEarlyCompletion: true,
  });

  // Sync operational rules from active config
  useEffect(() => {
    if (configSnapshot?.publicConfig) {
      const cfg = configSnapshot.publicConfig;
      if (cfg.coachingEarlyJoinWindowMinutes !== undefined) {
        setEarlyJoinMinutes(cfg.coachingEarlyJoinWindowMinutes);
      }
      if (cfg.coachingMinRescheduleNoticeHours !== undefined) {
        setMinNoticeHours(cfg.coachingMinRescheduleNoticeHours);
      }
      if (cfg.coachingMaxReschedulesPerSession !== undefined) {
        setMaxReschedules(cfg.coachingMaxReschedulesPerSession);
      }
      if (cfg.coachingRequireDeclineReason !== undefined) {
        setRequireDeclineReason(cfg.coachingRequireDeclineReason);
      }
    }
  }, [configSnapshot]);

  // Operational Rules Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = [
        { configKey: 'coaching.early_join_window_minutes', configValue: String(earlyJoinMinutes) },
        { configKey: 'coaching.min_reschedule_notice_hours', configValue: String(minNoticeHours) },
        { configKey: 'coaching.max_reschedules_per_session', configValue: String(maxReschedules) },
        { configKey: 'coaching.require_decline_reason', configValue: String(requireDeclineReason) },
      ];
      return coreConfigApi.updateConfigs(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['core', 'active-config'] });
      queryClient.invalidateQueries({ queryKey: ['core', 'admin-config'] });
      queryClient.invalidateQueries({ queryKey: ['coaching-sessions'] });
      setSavedSuccess(true);
      setErrorMessage(null);
      setTimeout(() => setSavedSuccess(false), 4000);
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.message || 'Failed to save coaching rules. Please try again.');
    },
  });

  const handleResetDefaults = () => {
    setEarlyJoinMinutes(15);
    setMinNoticeHours(4);
    setMaxReschedules(2);
    setRequireDeclineReason(true);
  };

  // Open Edit Policy Modal
  const handleOpenEdit = (p: CoachingPolicyVersionItem) => {
    setEditingPolicy(p);
    setIsCreatingPolicy(false);
    setPolicyForm({
      policyName: p.policyName,
      pathway: p.pathway,
      minAppraisalRating: p.minAppraisalRating !== null ? p.minAppraisalRating : '',
      maxAppraisalRating: p.maxAppraisalRating !== null ? p.maxAppraisalRating : '',
      baselineSessions: p.baselineSessions,
      minAllowedSessions: p.minAllowedSessions,
      maxAllowedSessions: p.maxAllowedSessions,
      defaultCadence: p.defaultCadence || 'WEEKLY',
      requiresPmsApprovalOutsideRange: p.requiresPmsApprovalOutsideRange,
      coachAdjustmentAllowed: p.coachAdjustmentAllowed,
      allowExtensions: p.allowExtensions,
      allowEarlyCompletion: p.allowEarlyCompletion,
    });
  };

  // Open Create Policy Modal
  const handleOpenCreate = () => {
    setEditingPolicy(null);
    setIsCreatingPolicy(true);
    setPolicyForm({
      policyName: '',
      pathway: 'MANDATORY_PMS',
      minAppraisalRating: 0.0,
      maxAppraisalRating: 1.99,
      baselineSessions: 8,
      minAllowedSessions: 6,
      maxAllowedSessions: 10,
      defaultCadence: 'WEEKLY',
      requiresPmsApprovalOutsideRange: true,
      coachAdjustmentAllowed: true,
      allowExtensions: true,
      allowEarlyCompletion: true,
    });
  };

  // Policy Save / Update Mutation
  const policyMutation = useMutation({
    mutationFn: async () => {
      const payload: Partial<CoachingPolicyVersionItem> = {
        policyName: policyForm.policyName.trim(),
        pathway: policyForm.pathway,
        minAppraisalRating: policyForm.minAppraisalRating !== '' ? Number(policyForm.minAppraisalRating) : null,
        maxAppraisalRating: policyForm.maxAppraisalRating !== '' ? Number(policyForm.maxAppraisalRating) : null,
        baselineSessions: Number(policyForm.baselineSessions),
        minAllowedSessions: Number(policyForm.minAllowedSessions),
        maxAllowedSessions: Number(policyForm.maxAllowedSessions),
        defaultCadence: policyForm.defaultCadence as any,
        requiresPmsApprovalOutsideRange: policyForm.requiresPmsApprovalOutsideRange,
        coachAdjustmentAllowed: policyForm.coachAdjustmentAllowed,
        allowExtensions: policyForm.allowExtensions,
        allowEarlyCompletion: policyForm.allowEarlyCompletion,
      };

      if (editingPolicy) {
        return coachingGovernanceApi.updatePolicy(editingPolicy.id, payload);
      } else {
        return coachingGovernanceApi.createPolicy(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching-policies'] });
      setEditingPolicy(null);
      setIsCreatingPolicy(false);
      setSavedSuccess(true);
      setErrorMessage(null);
      setTimeout(() => setSavedSuccess(false), 4000);
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.message || 'Failed to save policy standard. Please verify form inputs.');
    },
  });

  if (isLoading) {
    return (
      <div className="apid-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#64748b' }}>Loading coaching rules and settings...</p>
      </div>
    );
  }

  return (
    <div className="boa-stack">
      {/* ────────────────── HEADER CARD ────────────────── */}
      <div
        className="apid-card"
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1.25rem 1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: 'rgba(202, 138, 4, 0.12)',
                color: 'var(--brand-gold, #ca8a04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sliders size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Coaching Rules & Policies
              </h2>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.84rem', color: '#64748b' }}>
                Configure bank-wide coaching standards, rating bands, video windows, and reschedule limits.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="apid-btn apid-btn-outline"
              onClick={handleResetDefaults}
              style={{
                padding: '0.45rem 0.9rem',
                fontSize: '0.82rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <RotateCcw size={14} />
              Reset Operational Defaults
            </button>
            <button
              type="button"
              className="apid-btn apid-btn-primary"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              style={{
                padding: '0.45rem 1.15rem',
                fontSize: '0.84rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                backgroundColor: 'var(--brand-gold, #ca8a04)',
                borderColor: 'var(--brand-gold, #ca8a04)',
                color: '#ffffff',
              }}
            >
              <Save size={15} />
              {saveMutation.isPending ? 'Saving...' : 'Save Operational Rules'}
            </button>
          </div>
        </div>

        {/* Success Alert */}
        {savedSuccess && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.84rem',
              color: '#15803d',
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={16} />
            Coaching rules and target standards updated successfully! The new policy is now active.
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.84rem',
              color: '#b91c1c',
            }}
          >
            <AlertCircle size={16} />
            {errorMessage}
          </div>
        )}
      </div>

      {/* ────────────────── OPERATIONAL POLICIES GRID ────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        {/* Rule 1: Smart Video Room Access Window */}
        <div
          className="apid-card"
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '6px',
                  background: 'rgba(2, 132, 199, 0.1)',
                  color: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Video size={15} />
              </div>
              <h3 style={{ fontSize: '0.96rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Video Room Early Access
              </h3>
            </div>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>
              How early before the meeting start time participants can enter the Daily.co video room. Before this window, the join button stays locked.
            </p>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="number"
                min={0}
                max={60}
                step={5}
                value={earlyJoinMinutes}
                onChange={(e) => setEarlyJoinMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                style={{
                  width: '90px',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  textAlign: 'center',
                }}
              />
              <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#334155' }}>
                minutes before call
              </span>
            </div>
            <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.74rem', color: '#94a3b8' }}>
              Default: 15 minutes. Prevents open rooms when meetings are days away.
            </p>
          </div>
        </div>

        {/* Rule 2: Reschedule Advance Notice */}
        <div
          className="apid-card"
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '6px',
                  background: 'rgba(234, 88, 12, 0.1)',
                  color: '#ea580c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Clock size={15} />
              </div>
              <h3 style={{ fontSize: '0.96rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Reschedule Notice Window
              </h3>
            </div>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>
              Minimum hours in advance a coach or coachee must propose a new time before the scheduled meeting.
            </p>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="number"
                min={1}
                max={72}
                value={minNoticeHours}
                onChange={(e) => setMinNoticeHours(Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  width: '90px',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  textAlign: 'center',
                }}
              />
              <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#334155' }}>
                hours in advance
              </span>
            </div>
            <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.74rem', color: '#94a3b8' }}>
              Default: 4 hours. Encourages timely notice for scheduling without friction.
            </p>
          </div>
        </div>

        {/* Rule 3: Max Reschedules per Session */}
        <div
          className="apid-card"
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '6px',
                  background: 'rgba(147, 51, 234, 0.1)',
                  color: '#9333ea',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RotateCcw size={15} />
              </div>
              <h3 style={{ fontSize: '0.96rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Max Reschedules Per Session
              </h3>
            </div>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>
              The maximum number of times a single coaching session can be rescheduled before direct manager coordination is required.
            </p>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="number"
                min={1}
                max={5}
                value={maxReschedules}
                onChange={(e) => setMaxReschedules(Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  width: '90px',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  textAlign: 'center',
                }}
              />
              <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#334155' }}>
                times maximum
              </span>
            </div>
            <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.74rem', color: '#94a3b8' }}>
              Default: 2 reschedules. Protects coaching momentum and schedule predictability.
            </p>
          </div>
        </div>

        {/* Rule 4: Mandatory Reason when Declining */}
        <div
          className="apid-card"
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck size={15} />
              </div>
              <h3 style={{ fontSize: '0.96rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Require Reason on Decline
              </h3>
            </div>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>
              When a talent clicks "Unable to Attend", they must provide a written reason so their coach understands why they cannot make it.
            </p>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={requireDeclineReason}
                onChange={(e) => setRequireDeclineReason(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#1e293b' }}>
                {requireDeclineReason ? 'Mandatory explanation required' : 'Optional reason'}
              </span>
            </label>
            <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.74rem', color: '#94a3b8' }}>
              Enforces clear communication between coach and coachee.
            </p>
          </div>
        </div>
      </div>

      {/* ────────────────── COACHING TARGET STANDARDS BY APPRAISAL SCORE ────────────────── */}
      <div
        className="apid-card"
        style={{
          marginTop: '1.5rem',
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1.5rem',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
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
              <Sliders size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.08rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Coaching Target Standards by Appraisal Rating Band
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                Configurable bank policy baselines mapped to appraisal scores. Admins can customize session numbers, permitted coach ranges, and rhythms anytime.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="apid-btn apid-btn-primary"
            onClick={handleOpenCreate}
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: 'var(--brand-gold, #ca8a04)',
              borderColor: 'var(--brand-gold, #ca8a04)',
              color: '#ffffff',
            }}
          >
            <Plus size={15} /> Add Rating Band Policy
          </button>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Policy Category</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Appraisal Score Band</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Baseline Sessions</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Permitted Coach Range</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Suggested Cadence</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Exception Governance</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => {
                const isPms = p.pathway === 'MANDATORY_PMS';
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        {isPms ? (
                          <Target size={14} color="var(--brand-gold, #ca8a04)" />
                        ) : (
                          <Sparkles size={14} color="#2563eb" />
                        )}
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{p.policyName}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {p.minAppraisalRating !== null && p.maxAppraisalRating !== null ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            background: p.maxAppraisalRating < 2 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(234, 88, 12, 0.1)',
                            color: p.maxAppraisalRating < 2 ? '#b91c1c' : '#c2410c',
                          }}
                        >
                          {p.minAppraisalRating.toFixed(1)} – {p.maxAppraisalRating.toFixed(2)}
                        </span>
                      ) : (
                        <span style={{ color: '#64748b' }}>Any Rating (Elective)</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
                      {p.baselineSessions}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#475569', fontWeight: 600 }}>
                      {p.minAllowedSessions} – {p.maxAllowedSessions} sessions
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>
                      {p.defaultCadence === 'WEEKLY' ? 'Weekly Rhythm' : 'Bi-weekly (Every 2 Weeks)'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          background: p.requiresPmsApprovalOutsideRange ? 'rgba(234, 88, 12, 0.1)' : 'rgba(22, 163, 74, 0.1)',
                          color: p.requiresPmsApprovalOutsideRange ? '#ea580c' : '#16a34a',
                        }}
                      >
                        {p.requiresPmsApprovalOutsideRange ? 'HR Approval Outside Range' : 'Coach Discretion'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="apid-btn apid-btn-outline"
                        onClick={() => handleOpenEdit(p)}
                        style={{
                          padding: '0.25rem 0.65rem',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <Edit3 size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ────────────────── POLICY EDIT / CREATE MODAL ────────────────── */}
      {(editingPolicy || isCreatingPolicy) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            className="apid-card"
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              maxWidth: 580,
              width: '100%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
                background: 'linear-gradient(135deg, rgba(202, 138, 4, 0.08) 0%, rgba(248, 250, 252, 0.9) 100%)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sliders size={18} color="var(--brand-gold, #ca8a04)" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                  {editingPolicy ? 'Edit Coaching Policy Standard' : 'Add Coaching Rating Band Policy'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingPolicy(null);
                  setIsCreatingPolicy(false);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {/* Policy Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Policy Category Name *
                </label>
                <input
                  type="text"
                  value={policyForm.policyName}
                  onChange={(e) => setPolicyForm({ ...policyForm, policyName: e.target.value })}
                  placeholder="e.g. Critical Remediation Policy (Rating < 2.0)"
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                  }}
                />
              </div>

              {/* Pathway & Cadence */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Coaching Pathway
                  </label>
                  <select
                    value={policyForm.pathway}
                    onChange={(e) => setPolicyForm({ ...policyForm, pathway: e.target.value as AssignmentPathway })}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                    }}
                  >
                    <option value="MANDATORY_PMS">Mandatory Appraisal Remediation</option>
                    <option value="SELF_DEVELOPMENT">Group Skill Development Cohort</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Suggested Standing Cadence
                  </label>
                  <select
                    value={policyForm.defaultCadence}
                    onChange={(e) => setPolicyForm({ ...policyForm, defaultCadence: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                    }}
                  >
                    <option value="WEEKLY">Weekly Rhythm (1 session/week)</option>
                    <option value="BIWEEKLY">Bi-weekly (Every 2 weeks)</option>
                    <option value="TWICE_WEEKLY">Twice Weekly (Intensive)</option>
                  </select>
                </div>
              </div>

              {/* Appraisal Rating Band */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Min Appraisal Rating (e.g. 0.0)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={policyForm.minAppraisalRating}
                    onChange={(e) => setPolicyForm({ ...policyForm, minAppraisalRating: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Max Appraisal Rating (e.g. 1.99)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="5"
                    value={policyForm.maxAppraisalRating}
                    onChange={(e) => setPolicyForm({ ...policyForm, maxAppraisalRating: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                    }}
                  />
                </div>
              </div>

              {/* Sessions Baseline & Permitted Range */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--brand-gold, #ca8a04)', marginBottom: '0.35rem' }}>
                    Baseline Sessions *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={policyForm.baselineSessions}
                    onChange={(e) => setPolicyForm({ ...policyForm, baselineSessions: Math.max(1, parseInt(e.target.value) || 1) })}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid var(--brand-gold, #ca8a04)',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      textAlign: 'center',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Min Allowed Sessions *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={policyForm.minAllowedSessions}
                    onChange={(e) => setPolicyForm({ ...policyForm, minAllowedSessions: Math.max(1, parseInt(e.target.value) || 1) })}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.92rem',
                      textAlign: 'center',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Max Allowed Sessions *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={policyForm.maxAllowedSessions}
                    onChange={(e) => setPolicyForm({ ...policyForm, maxAllowedSessions: Math.max(1, parseInt(e.target.value) || 1) })}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.92rem',
                      textAlign: 'center',
                    }}
                  />
                </div>
              </div>

              {/* Exception & Governance Checkboxes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.84rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={policyForm.requiresPmsApprovalOutsideRange}
                    onChange={(e) => setPolicyForm({ ...policyForm, requiresPmsApprovalOutsideRange: e.target.checked })}
                    style={{ width: 17, height: 17 }}
                  />
                  <span>Require PMS Admin approval if Coach proposes sessions outside permitted range</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.84rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={policyForm.coachAdjustmentAllowed}
                    onChange={(e) => setPolicyForm({ ...policyForm, coachAdjustmentAllowed: e.target.checked })}
                    style={{ width: 17, height: 17 }}
                  />
                  <span>Allow Coach to propose individual target adjustments within range</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.84rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={policyForm.allowExtensions}
                    onChange={(e) => setPolicyForm({ ...policyForm, allowExtensions: e.target.checked })}
                    style={{ width: 17, height: 17 }}
                  />
                  <span>Allow Coach to request session extensions (+1 to +4) if gaps remain</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.84rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={policyForm.allowEarlyCompletion}
                    onChange={(e) => setPolicyForm({ ...policyForm, allowEarlyCompletion: e.target.checked })}
                    style={{ width: 17, height: 17 }}
                  />
                  <span>Allow early completion if all development goals are mastered before target</span>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.65rem',
              }}
            >
              <button
                type="button"
                className="apid-btn apid-btn-outline"
                onClick={() => {
                  setEditingPolicy(null);
                  setIsCreatingPolicy(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="apid-btn apid-btn-primary"
                onClick={() => policyMutation.mutate()}
                disabled={policyMutation.isPending || !policyForm.policyName.trim()}
                style={{
                  backgroundColor: 'var(--brand-gold, #ca8a04)',
                  borderColor: 'var(--brand-gold, #ca8a04)',
                  color: '#ffffff',
                  fontWeight: 700,
                }}
              >
                {policyMutation.isPending ? 'Saving...' : 'Save Policy Standard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
