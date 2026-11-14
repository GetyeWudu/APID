import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award, Building2, ChevronDown, ChevronUp, Eye, MessageSquare, ShieldAlert, UserCheck, UserPlus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import { EMPLOYEE_WORKSPACE_PERMISSIONS } from '../../../shared/auth/workspaceResolver';
import {
  DataSourceBadge,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  StatusPill,
} from '../../../shared/components/ui';
import { coreConfigApi } from '../../admin/config/api/coreConfigApi';
import { workspaceLiveApi, workspacePreviewAdapter } from '../../workspace/api/workspaceDashboardApi';
import { IsolatedChatPanel, type ChatMessageItem } from '../../workspace/components/IsolatedChatPanel';
import { coachingAssignmentApi, type MyCoacheeItem } from '../api/coachingAssignmentApi';
import { classifyRating, RATING_BAND_METADATA } from '../utils/ratingClassification';
import { RequestSkillCoachingModal } from '../components/RequestSkillCoachingModal';
import { SkillCoachingRequestsList } from '../components/SkillCoachingRequestsList';
import { EmployeeGoalsModal } from '../components/EmployeeGoalsModal';
import { CoachingSessionsTab } from '../components/CoachingSessionsTab';

type CoachingViewKey = 'plan' | 'sessions' | 'coachees' | 'skills';

export function CoachingHomePage() {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const [coachingChatExtra, setCoachingChatExtra] = useState<ChatMessageItem[]>([]);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [selectedGoalEmployee, setSelectedGoalEmployee] = useState<{ id: number; name?: string } | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const requestedView = searchParams.get('view') as CoachingViewKey | null;
  const activeView: CoachingViewKey =
    requestedView === 'sessions' || requestedView === 'coachees' || requestedView === 'skills'
      ? requestedView
      : 'plan';

  const identityQuery = useQuery({
    queryKey: ['workspace', 'identity', user?.id],
    queryFn: workspaceLiveApi.loadMyIdentity,
  });

  const previewQuery = useQuery({
    queryKey: ['workspace', 'preview-participation'],
    queryFn: workspacePreviewAdapter.getParticipationPreview,
  });

  const activeConfigQuery = useQuery({
    queryKey: ['core', 'active-config'],
    queryFn: coreConfigApi.getActiveConfig,
  });

  // Live coaching plan (my-coaching endpoint)
  const myCoachingQuery = useQuery({
    queryKey: ['coaching', 'my-coaching'],
    queryFn: coachingAssignmentApi.getMyCoaching,
    enabled: activeView === 'plan' || activeView === 'skills',
    retry: false,
  });

  // Live coachees (my-coachees endpoint)
  const myCoacheesQuery = useQuery({
    queryKey: ['coaching', 'my-coachees'],
    queryFn: coachingAssignmentApi.getMyCoachees,
    enabled: activeView === 'coachees' || activeView === 'skills' || activeView === 'sessions',
    retry: false,
  });

  const effectiveWorkspace = useMemo(() => {
    const base = previewQuery.data?.workspace;
    if (!base) return null;
    const isCoachDefault =
      (identityQuery.data?.directReports.length ?? 0) > 0 || base.isAssignedCoach;
    return {
      ...base,
      isAssignedCoach: isCoachDefault,
    };
  }, [previewQuery.data, identityQuery.data]);

  if (!hasAnyPermission(EMPLOYEE_WORKSPACE_PERMISSIONS)) {
    return (
      <div className="apid-card">
        <EmptyState
          title="No Personal Coaching Access"
          description="Your account does not hold EMPLOYEE_PORTAL_ACCESS or COACHING_REQUEST_SUBMIT."
        />
      </div>
    );
  }

  if (identityQuery.isLoading || previewQuery.isLoading) {
    return <LoadingSkeleton rows={6} height={28} />;
  }

  if (identityQuery.isError || !identityQuery.data) {
    return (
      <ErrorState
        message="Unable to load your live employee coaching profile."
        onRetry={() => void identityQuery.refetch()}
      />
    );
  }

  const { linkedEmployee, directReports } = identityQuery.data;
  const workspaceData = effectiveWorkspace;
  const allCoachingMsgs = [...(workspaceData?.chatCoachingMessages ?? []), ...coachingChatExtra];

  const appendMessage = (body: string) => {
    setCoachingChatExtra((prev) => [
      ...prev,
      { id: `msg-${Date.now()}`, sender: 'You', body, time: 'Just now' },
    ]);
  };

  if (!linkedEmployee) {
    return (
      <div className="boa-stack">
        <PageHeader
          title="Performance Coaching"
          subtitle="Track your coaching assignments, sessions, and direct reports."
          source="live"
        />
        <div className="apid-card" data-testid="unlinked-profile-state">
          <EmptyState
            title="Profile Not Linked Yet"
            description={`Your account "${user?.username ?? ''}" is not linked to an HR employee profile yet, so your personal coach and direct reports cannot be resolved.`}
            icon={<ShieldAlert size={34} />}
            action={
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                {hasAnyPermission([
                  'COACHING_ASSIGNMENT_VIEW_ALL',
                  'COACHING_INITIATIVE_CREATE',
                  'ADMIN_PORTAL_ACCESS',
                  'PMS_ADMIN_ACCESS',
                ]) && (
                  <>
                    <Link to="/coaching/pms?tab=policies" className="apid-btn apid-btn-primary apid-btn-sm">
                      Coaching Rules &amp; Policies
                    </Link>
                    <Link to="/coaching/pms" className="apid-btn apid-btn-outline apid-btn-sm">
                      PMS Coaching Overview
                    </Link>
                  </>
                )}
                {hasPermission('HIERARCHY_MANAGE') && (
                  <Link to="/admin?tab=organization" className="apid-btn apid-btn-outline apid-btn-sm">
                    Go to Employees &amp; Org
                  </Link>
                )}
              </div>
            }
          />
        </div>
      </div>
    );
  }

  const viewMeta =
    activeView === 'skills'
      ? {
        title: 'Skill-Development Coaching',
        subtitle: 'Request skill coaching for direct & team staff, designate coaches (line manager, higher manager, or specialist), and track PMS approvals.',
      }
      : activeView === 'coachees'
        ? {
          title: 'People I Coach & Team',
          subtitle: 'Manage assigned coachees, review team progress, and support direct reports.',
        }
        : activeView === 'sessions'
          ? {
            title: 'Sessions & Coaching Channel',
            subtitle: 'Upcoming coaching meetings and private coach ↔ talent communication.',
          }
          : {
            title: 'My Coach & Action Plan',
            subtitle: 'Your current coaching pathway, assigned coach, and triggering performance details.',
          };

  // Render live plan panel (Mandatory PMS appraisal coaching only)
  const renderMyPlan = () => {
    if (myCoachingQuery.isLoading) {
      return <LoadingSkeleton rows={4} height={32} />;
    }

    const mandatoryPlans = (myCoachingQuery.data?.activePlans ?? []).filter(
      (p) => p.pathway === 'MANDATORY_PMS'
    );

    if (mandatoryPlans.length === 0) {
      return (
        <div className="apid-card" data-testid="my-coaching-plan-empty">
          <div className="boa-card-header">
            <div>
              <h3 className="boa-card-title">My Active Coaching Plan</h3>
              <p className="boa-card-subtitle">Mandatory appraisal coaching assignments for the current fiscal cycle.</p>
            </div>
            <DataSourceBadge source="live" />
          </div>
          <EmptyState
            title="No Mandatory Coaching Required"
            description="You do not currently have a mandatory coaching requirement from appraisal ratings (score < 3). If you are enrolled in skill development courses, view them under the Skill Development tab."
          />
        </div>
      );
    }

    return (
      <div className="boa-stack">
        {mandatoryPlans.map((plan) => {
          const bandMeta =
            plan.triggeringRoundedRating != null
              ? RATING_BAND_METADATA[classifyRating(plan.triggeringRoundedRating)]
              : null;

          return (
            <div key={plan.assignmentId} className="apid-card" data-testid="my-coaching-plan">
              <div className="boa-card-header">
                <div>
                  <h3 className="boa-card-title">My Active Coaching Plan</h3>
                  <p className="boa-card-subtitle">
                    Pathway: <strong>{plan.pathway.replace(/_/g, ' ')}</strong> · Quarter:{' '}
                    <strong>{plan.coachingQuarterLabel ?? 'Current'}</strong>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <DataSourceBadge source="live" />
                  <StatusPill
                    label={plan.atRisk ? 'AT RISK' : plan.status}
                    tone={plan.atRisk ? 'err' : plan.status === 'ACTIVE' ? 'info' : 'warn'}
                  />
                </div>
              </div>

              {/* Coach details */}
              <div
                style={{
                  background: 'var(--surface-subtle)',
                  padding: '1rem',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  marginTop: '0.5rem',
                }}
              >
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)' }}>
                  ASSIGNED COACH
                </div>
                {plan.coachFullName ? (
                  <div style={{ marginTop: '0.25rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{plan.coachFullName}</div>
                    <div className="boa-muted" style={{ fontSize: '0.84rem' }}>
                      {plan.coachJobTitle ? `${plan.coachJobTitle} · ` : ''}
                      {plan.coachDepartment ?? 'Bank of Abyssinia'}
                    </div>
                  </div>
                ) : (
                  <div className="apid-alert apid-alert-warn" style={{ marginTop: '0.4rem' }}>
                    A coach has not been designated for your assignment yet. HR or your PMS administrator will assign one shortly.
                  </div>
                )}
              </div>

              {/* Triggering PMS Rating Info */}
              {plan.triggeringRating != null && (
                <div
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '0.85rem 1rem',
                    marginTop: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)' }}>
                      PMS APPRAISAL RESULT
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '0.15rem' }}>
                      Overall Rating: {plan.triggeringRating.toFixed(4)}{' '}
                      <span className="boa-muted" style={{ fontWeight: 400, fontSize: '0.82rem' }}>
                        (Rounded: {plan.triggeringRoundedRating})
                      </span>
                    </div>
                  </div>
                  {bandMeta && <StatusPill label={bandMeta.label} tone={bandMeta.tone} />}
                </div>
              )}

              {/* Goal Breakdown */}
              {plan.triggeringGoals.length > 0 && (
                <div style={{ marginTop: '0.85rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.5rem' }}>
                    Triggering Goal Breakdown
                  </div>
                  <div className="apid-table-wrap">
                    <table className="apid-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Goal Name</th>
                          <th>Score</th>
                          <th>Weight</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.triggeringGoals.map((g) => (
                          <tr key={g.sourceRowNumber}>
                            <td className="tabular-nums">{g.sourceRowNumber}</td>
                            <td>{g.goalName}</td>
                            <td className="tabular-nums font-semibold">{g.goalScore?.toFixed(4) ?? '—'}</td>
                            <td className="tabular-nums">{g.weight != null ? `${g.weight}%` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render live coachees panel (safely handling array)
  const renderMyCoachees = () => {
    if (myCoacheesQuery.isLoading) {
      return <LoadingSkeleton rows={4} height={32} />;
    }

    const coachees: MyCoacheeItem[] = Array.isArray(myCoacheesQuery.data) ? myCoacheesQuery.data : [];

    if (coachees.length === 0) {
      return (
        <div className="apid-card" data-testid="my-assigned-coachees-empty">
          <div className="boa-card-header">
            <div>
              <h3 className="boa-card-title">My Assigned Coachees</h3>
              <p className="boa-card-subtitle">Employees currently assigned to you for quarterly coaching.</p>
            </div>
            <DataSourceBadge source="live" />
          </div>
          <EmptyState
            title="No Coachees Assigned"
            description="You do not currently have any employees assigned to you as their coach."
            icon={<UserCheck size={32} />}
          />
        </div>
      );
    }

    return (
      <div className="apid-card" data-testid="my-assigned-coachees">
        <div className="boa-card-header">
          <div>
            <h3 className="boa-card-title">My Assigned Coachees</h3>
            <p className="boa-card-subtitle">
              You are assigned as coach for {coachees.length} employee{coachees.length > 1 ? 's' : ''}.
            </p>
          </div>
          <DataSourceBadge source="live" />
        </div>
        <div className="apid-table-wrap">
          <table className="apid-table">
            <thead>
              <tr>
                <th>Emp #</th>
                <th>Employee Name</th>
                <th>Department</th>
                <th>Pathway</th>
                <th>Quarter</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coachees.map((c) => (
                <tr
                  key={c.assignmentId}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedGoalEmployee({ id: c.coacheeEmployeeId, name: c.coacheeFullName })}
                  title="Click row to view detailed individual PMS goals"
                >
                  <td className="tabular-nums">
                    <strong>{c.coacheeEmployeeNumber}</strong>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.coacheeFullName}</div>
                    {c.coacheeJobTitle && (
                      <div className="boa-muted" style={{ fontSize: '0.76rem' }}>
                        {c.coacheeJobTitle}
                      </div>
                    )}
                  </td>
                  <td>{c.coacheeDepartment ?? '—'}</td>
                  <td>
                    <StatusPill
                      label={c.pathway === 'SELF_DEVELOPMENT' ? 'SKILL DEV' : 'MANDATORY PMS'}
                      tone={c.pathway === 'SELF_DEVELOPMENT' ? 'info' : 'warn'}
                    />
                  </td>
                  <td>{c.coachingQuarterLabel ?? 'Current'}</td>
                  <td>
                    <StatusPill
                      label={c.atRisk ? 'AT RISK' : c.status}
                      tone={c.atRisk ? 'err' : c.status === 'ACTIVE' ? 'ok' : 'warn'}
                    />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="apid-btn apid-btn-outline"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedGoalEmployee({ id: c.coacheeEmployeeId, name: c.coacheeFullName });
                      }}
                    >
                      <Eye size={13} style={{ marginRight: '0.3rem' }} />
                      View Goals
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="boa-stack">
      <PageHeader
        title={viewMeta.title}
        subtitle={viewMeta.subtitle}
        source="live"
        actions={
          activeConfigQuery.data?.activeQuarter ? (
            <StatusPill
              label={`${activeConfigQuery.data.activeQuarter.label} · Cutoff Rounded < ${activeConfigQuery.data.publicConfig?.mandatoryCutoffRounded ?? 3}`}
              tone="info"
            />
          ) : undefined
        }
      />

      {/* Plan View: Live active coaching plan or empty state */}
      {activeView === 'plan' && renderMyPlan()}

      {/* Coachees View: Live assigned coachees */}
      {activeView === 'coachees' && renderMyCoachees()}

      {/* Coachees View: Also show direct reports if any */}
      {activeView === 'coachees' && directReports.length > 0 && (
        <div className="apid-card">
          <div className="boa-card-header">
            <div>
              <h3 className="boa-card-title">My Direct Reports</h3>
              <p className="boa-card-subtitle">
                <Building2 size={13} style={{ verticalAlign: 'text-bottom', marginRight: '0.25rem' }} />
                Staff reporting directly to {linkedEmployee.fullName}.
              </p>
            </div>
            <DataSourceBadge source="live" />
          </div>
          <div className="apid-table-wrap">
            <table className="apid-table">
              <thead>
                <tr>
                  <th>Emp #</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Position</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {directReports.map((dr) => (
                  <tr
                    key={dr.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedGoalEmployee({ id: dr.id, name: dr.fullName })}
                    title="Click row to view detailed individual PMS goals"
                  >
                    <td className="tabular-nums">
                      <strong>{dr.employeeNumber}</strong>
                    </td>
                    <td>{dr.fullName}</td>
                    <td>{dr.departmentName ?? '—'}</td>
                    <td>{dr.position || dr.job || '—'}</td>
                    <td>
                      <StatusPill
                        label={dr.employmentStatus}
                        tone={dr.employmentStatus === 'ACTIVE' ? 'ok' : 'warn'}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="apid-btn apid-btn-outline"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGoalEmployee({ id: dr.id, name: dr.fullName });
                        }}
                      >
                        <Eye size={13} style={{ marginRight: '0.3rem' }} />
                        View Goals
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Skills View: Dedicated Skill-Development Coaching Hub */}
      {activeView === 'skills' && (
        <div className="boa-stack">
          {/* For Managers: Action Banner to Request Skill Coaching */}
          {directReports.length > 0 && (
            <div
              className="apid-card"
              style={{
                background: 'linear-gradient(135deg, rgba(202, 138, 4, 0.08) 0%, rgba(15, 23, 42, 0.03) 100%)',
                border: '1px solid rgba(202, 138, 4, 0.25)',
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
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '1.1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                    }}
                  >
                    <Award size={20} style={{ color: 'var(--brand-gold, #ca8a04)' }} />
                    Targeted Skill Development Hub
                  </h3>
                  <p className="boa-muted" style={{ margin: '0.35rem 0 0 0', fontSize: '0.86rem', maxWidth: 640 }}>
                    Nominate staff for mandatory or strategic capability growth. You can coach direct reports yourself as Line Manager, or designate your Higher Manager or a Bank Specialist to coach. All requests flow to PMS Admin for formal approval.
                  </p>
                </div>
                <button
                  type="button"
                  className="apid-btn apid-btn-primary"
                  onClick={() => setIsSkillModalOpen(true)}
                >
                  <UserPlus size={15} style={{ marginRight: '0.35rem' }} />
                  Request Skill Coaching
                </button>
              </div>
            </div>
          )}

          {/* Enrolled Skill Coaching Courses (For employees receiving skill coaching, e.g. Lidia & Azeb) */}
          {(() => {
            const enrolledSkills = (myCoachingQuery.data?.activePlans ?? []).filter(
              (p) => p.pathway === 'SELF_DEVELOPMENT'
            );
            if (enrolledSkills.length === 0 && directReports.length === 0) {
              return (
                <div className="apid-card">
                  <div className="boa-card-header">
                    <div>
                      <h3 className="boa-card-title">My Enrolled Skill Coaching</h3>
                      <p className="boa-card-subtitle">Active skill-development coaching plans assigned to you.</p>
                    </div>
                    <DataSourceBadge source="live" />
                  </div>
                  <EmptyState
                    title="No Skill Development Assigned"
                    description="You are not currently enrolled in any skill development coaching programs. When your line manager requests skill training for you and it is approved by PMS, it will appear here."
                    icon={<Award size={32} />}
                  />
                </div>
              );
            }
            if (enrolledSkills.length > 0) {
              return (
                <div className="boa-stack">
                  {enrolledSkills.map((plan) => (
                    <div key={plan.assignmentId} className="apid-card">
                      <div className="boa-card-header">
                        <div>
                          <h3 className="boa-card-title">My Enrolled Skill Coaching</h3>
                          <p className="boa-card-subtitle">
                            Pathway: <strong>SELF DEVELOPMENT</strong> · Cycle:{' '}
                            <strong>{plan.coachingQuarterLabel ?? 'Current'}</strong>
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <DataSourceBadge source="live" />
                          <StatusPill
                            label={plan.atRisk ? 'AT RISK' : plan.status}
                            tone={plan.atRisk ? 'err' : plan.status === 'ACTIVE' ? 'ok' : 'warn'}
                          />
                        </div>
                      </div>

                      {/* Coach details */}
                      <div
                        style={{
                          background: 'var(--surface-subtle)',
                          padding: '1rem',
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          marginTop: '0.5rem',
                        }}
                      >
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)' }}>
                          ASSIGNED COACH
                        </div>
                        {plan.coachFullName ? (
                          <div style={{ marginTop: '0.25rem' }}>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{plan.coachFullName}</div>
                            <div className="boa-muted" style={{ fontSize: '0.84rem' }}>
                              {plan.coachJobTitle ? `${plan.coachJobTitle} · ` : ''}
                              {plan.coachDepartment ?? 'Bank of Abyssinia'}
                            </div>
                          </div>
                        ) : (
                          <div className="apid-alert apid-alert-warn" style={{ marginTop: '0.4rem' }}>
                            A coach has not been designated for your assignment yet.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            }
            return null;
          })()}

          {/* Staff I Coach in Skill Development (Direct view showing Azeb, Lidia, etc. assigned to this coach) */}
          {(() => {
            const skillCoachees = (Array.isArray(myCoacheesQuery.data) ? myCoacheesQuery.data : []).filter(
              (c) => c.pathway === 'SELF_DEVELOPMENT'
            );
            if (skillCoachees.length === 0) return null;
            return (
              <div className="apid-card" style={{ marginTop: '1rem' }}>
                <div className="boa-card-header">
                  <div>
                    <h3 className="boa-card-title">Staff I Coach in Skill Development</h3>
                    <p className="boa-card-subtitle">
                      Employees currently assigned to you for quarterly skill-growth coaching ({skillCoachees.length} staff).
                    </p>
                  </div>
                  <DataSourceBadge source="live" />
                </div>
                <div className="apid-table-wrap">
                  <table className="apid-table">
                    <thead>
                      <tr>
                        <th>Emp #</th>
                        <th>Coachee Name</th>
                        <th>Department</th>
                        <th>Position</th>
                        <th>Quarter</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {skillCoachees.map((c) => (
                        <tr
                          key={c.assignmentId}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSelectedGoalEmployee({ id: c.coacheeEmployeeId, name: c.coacheeFullName })}
                          title="Click row to view detailed individual PMS goals"
                        >
                          <td className="tabular-nums">
                            <strong>{c.coacheeEmployeeNumber}</strong>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{c.coacheeFullName}</div>
                          </td>
                          <td>{c.coacheeDepartment ?? '—'}</td>
                          <td>{c.coacheeJobTitle ?? '—'}</td>
                          <td>{c.coachingQuarterLabel ?? 'Current'}</td>
                          <td>
                            <StatusPill
                              label={c.atRisk ? 'AT RISK' : c.status}
                              tone={c.atRisk ? 'err' : c.status === 'ACTIVE' ? 'ok' : 'warn'}
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="apid-btn apid-btn-outline"
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGoalEmployee({ id: c.coacheeEmployeeId, name: c.coacheeFullName });
                              }}
                            >
                              <Eye size={13} style={{ marginRight: '0.3rem' }} />
                              View Goals
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* For Managers Only: Submitted Skill Development Requests Tracker */}
          {directReports.length > 0 && <SkillCoachingRequestsList />}
        </div>
      )}

      {/* Employee Individual PMS Goals Breakdown Modal */}
      <EmployeeGoalsModal
        employeeId={selectedGoalEmployee?.id ?? null}
        employeeName={selectedGoalEmployee?.name}
        isOpen={selectedGoalEmployee !== null}
        onClose={() => setSelectedGoalEmployee(null)}
      />

      {/* Request Skill Coaching Modal */}
      {(activeView === 'coachees' || activeView === 'skills') && activeConfigQuery.data?.activeQuarter && (
        <RequestSkillCoachingModal
          isOpen={isSkillModalOpen}
          onClose={() => setIsSkillModalOpen(false)}
          directReports={directReports}
          currentEmployee={linkedEmployee}
          activeQuarterId={activeConfigQuery.data.activeQuarter.quarterId}
          activeQuarterLabel={activeConfigQuery.data.activeQuarter.label}
        />
      )}

      {/* Sessions View: Sessions List, Scheduling & Private Coach Channel */}
      {activeView === 'sessions' && (
        <div className="boa-stack">
          <CoachingSessionsTab
            myCoachees={Array.isArray(myCoacheesQuery.data) ? myCoacheesQuery.data : []}
            currentEmployeeId={linkedEmployee.id}
          />

          {/* Collapsible Coaching Discussion Channel */}
          <div
            className="apid-card"
            style={{
              padding: '1rem 1.25rem',
              background: 'var(--surface, #ffffff)',
              borderRadius: '12px',
              border: '1px solid var(--border, #e2e8f0)',
              marginTop: '0.5rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
              }}
              onClick={() => setIsChatOpen((prev) => !prev)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '8px',
                    background: 'rgba(2, 132, 199, 0.1)',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>
                    Coaching Discussion Channel (Talent ↔ Coach)
                  </h4>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--muted, #64748b)' }}>
                    Private communication thread with coachees and assigned coaches ({allCoachingMsgs.length} messages)
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="apid-btn apid-btn-outline"
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                {isChatOpen ? 'Collapse Channel' : 'Open Channel'}
                {isChatOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {isChatOpen && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border, #f1f5f9)' }}>
                <IsolatedChatPanel
                  contextTitle="Coaching Channel (Talent ↔ Coach)"
                  contextKey="coaching"
                  messages={allCoachingMsgs}
                  onSendMessage={appendMessage}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
