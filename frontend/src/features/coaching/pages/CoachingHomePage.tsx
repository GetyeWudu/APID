import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Eye, MessageSquare, ShieldAlert, UserCheck } from 'lucide-react';
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
import { CoachingChatHub } from '../components/chat/CoachingChatHub';
import { coachingAssignmentApi, type MyCoacheeItem } from '../api/coachingAssignmentApi';
import { classifyRating, RATING_BAND_METADATA } from '../utils/ratingClassification';
import { RequestSkillCoachingModal } from '../components/RequestSkillCoachingModal';
import { EmployeeGoalsModal } from '../components/EmployeeGoalsModal';
import { CoachingSessionsTab } from '../components/CoachingSessionsTab';
import { UnifiedCalendarTab } from '../components/calendar/UnifiedCalendarTab';
import { SkillCohortHubTab } from '../components/skills/SkillCohortHubTab';

type CoachingViewKey = 'plan' | 'sessions' | 'channel' | 'progress' | 'calendar' | 'coachees' | 'skills';

export function CoachingHomePage() {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [selectedGoalEmployee, setSelectedGoalEmployee] = useState<{ id: number; name?: string } | null>(null);

  const requestedView = searchParams.get('view') as CoachingViewKey | null;
  const activeView: CoachingViewKey =
    requestedView === 'sessions' ||
    requestedView === 'channel' ||
    requestedView === 'progress' ||
    requestedView === 'calendar' ||
    requestedView === 'coachees' ||
    requestedView === 'skills'
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
    enabled: activeView === 'plan' || activeView === 'skills' || activeView === 'progress',
    retry: false,
  });

  // Live coachees (my-coachees endpoint)
  const myCoacheesQuery = useQuery({
    queryKey: ['coaching', 'my-coachees'],
    queryFn: coachingAssignmentApi.getMyCoachees,
    enabled: activeView === 'coachees' || activeView === 'skills' || activeView === 'sessions' || activeView === 'progress',
    retry: false,
  });

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
          title: 'Skill Development (Cohort Hub)',
          subtitle: 'Collaborative capability building, workshops, and cohort discussions.',
        }
      : activeView === 'coachees'
      ? {
          title: 'My Coachees & Direct Reports',
          subtitle: 'Manage assigned coachees, review team progress, and support direct reports.',
        }
      : activeView === 'calendar'
      ? {
          title: 'Weekly Schedule & Calendar',
          subtitle: 'Unified weekly timetable across Coaching & Mentoring with local Ethiopian Time (EAT).',
        }
      : activeView === 'sessions'
      ? {
          title: 'PMS Remediation Sessions & Scheduling',
          subtitle: 'Scheduled 1-on-1 and small group mandatory performance coaching sessions.',
        }
      : activeView === 'channel'
      ? {
          title: 'PMS Coaching Channel',
          subtitle: 'Confidential audit-logged communication between Coach and Coachee for mandatory appraisal remediation.',
        }
      : activeView === 'progress'
      ? {
          title: 'Appraisal Progress & Feedback',
          subtitle: 'Formal evaluation records, remediation outcomes, and quarter milestones.',
        }
      : {
          title: 'My Remediation Plan & Coach',
          subtitle: 'Your active performance coaching pathway, assigned coach, and triggering appraisal details.',
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

      {/* Skills View: Dedicated Skill-Development Cohort Hub */}
      {activeView === 'skills' && (
        <SkillCohortHubTab
          currentEmployee={linkedEmployee}
          directReports={directReports}
          myCoachees={Array.isArray(myCoacheesQuery.data) ? myCoacheesQuery.data : []}
          activeQuarterId={activeConfigQuery.data?.activeQuarter?.quarterId}
          activeQuarterLabel={activeConfigQuery.data?.activeQuarter?.label}
        />
      )}

      {/* Employee Individual PMS Goals Breakdown Modal */}
      <EmployeeGoalsModal
        employeeId={selectedGoalEmployee?.id ?? null}
        employeeName={selectedGoalEmployee?.name}
        isOpen={selectedGoalEmployee !== null}
        onClose={() => setSelectedGoalEmployee(null)}
      />

      {/* Request Skill Coaching Modal (When triggered from People I Coach) */}
      {activeView === 'coachees' && activeConfigQuery.data?.activeQuarter && (
        <RequestSkillCoachingModal
          isOpen={isSkillModalOpen}
          onClose={() => setIsSkillModalOpen(false)}
          directReports={directReports}
          currentEmployee={linkedEmployee}
          activeQuarterId={activeConfigQuery.data.activeQuarter.quarterId}
          activeQuarterLabel={activeConfigQuery.data.activeQuarter.label}
        />
      )}

      {/* Unified Calendar View */}
      {activeView === 'calendar' && (
        <UnifiedCalendarTab />
      )}

      {/* Sessions View: PMS Remediation Sessions List & Scheduling */}
      {activeView === 'sessions' && (
        <div className="boa-stack">
          <CoachingSessionsTab
            myCoachees={Array.isArray(myCoacheesQuery.data) ? myCoacheesQuery.data : []}
            currentEmployeeId={linkedEmployee.id}
            mode="PMS"
          />
        </div>
      )}

      {/* Dedicated Confidential PMS Coaching Channel */}
      {activeView === 'channel' && (
        <div className="boa-stack">
          <div
            className="apid-card"
            style={{
              padding: '1rem 1.25rem',
              background: 'var(--surface, #ffffff)',
              borderRadius: '12px',
              border: '1px solid var(--border, #e2e8f0)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.12)',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MessageSquare size={18} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  1-on-1 PMS Coaching Channel (Confidential)
                </h4>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--muted, #64748b)' }}>
                  End-to-end audit logged channel between Coach and Coachee for mandatory appraisal remediation.
                </p>
              </div>
            </div>

            <CoachingChatHub
              currentEmployeeId={linkedEmployee.id}
              currentUserId={user?.id}
              mode="MANDATORY"
            />
          </div>
        </div>
      )}

      {/* Dedicated PMS Progress & Feedback */}
      {activeView === 'progress' && (
        <div className="boa-stack">
          {renderMyPlan()}
        </div>
      )}
    </div>
  );
}
