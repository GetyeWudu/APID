import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award, Building2, ClipboardCheck, ShieldAlert, Users } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import {
  AvatarBadge,
  DataSourceBadge,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  StatCard,
  StatusPill,
} from '../../../shared/components/ui';
import { EMPLOYEE_WORKSPACE_PERMISSIONS } from '../../../shared/auth/workspaceResolver';
import { workspaceLiveApi, workspacePreviewAdapter } from '../api/workspaceDashboardApi';
import { CoachingTab } from '../components/CoachingTab';
import type { ChatMessageItem } from '../components/IsolatedChatPanel';
import { MentoringTab } from '../components/MentoringTab';

type WorkspaceTabKey = 'overview' | 'coaching' | 'mentoring';

export function WorkspaceDashboardPage() {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Strictly dev-only participation flag toggles (never visible in production builds)
  const [devCoachOverride, setDevCoachOverride] = useState<boolean | null>(null);
  const [devTrainerOverride, setDevTrainerOverride] = useState<boolean | null>(null);

  const [coachingChatExtra, setCoachingChatExtra] = useState<ChatMessageItem[]>([]);
  const [mentoringChatExtra, setMentoringChatExtra] = useState<ChatMessageItem[]>([]);

  const identityQuery = useQuery({
    queryKey: ['workspace', 'identity', user?.id],
    queryFn: workspaceLiveApi.loadMyIdentity,
  });

  const previewQuery = useQuery({
    queryKey: ['workspace', 'preview-participation'],
    queryFn: workspacePreviewAdapter.getParticipationPreview,
  });

  const requestedTab = (searchParams.get('tab') as WorkspaceTabKey | null) ?? 'overview';
  const activeTab: WorkspaceTabKey =
    requestedTab === 'coaching' || requestedTab === 'mentoring' ? requestedTab : 'overview';

  const selectTab = (key: WorkspaceTabKey) => {
    if (key === 'overview') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: key });
    }
  };

  const effectiveWorkspace = useMemo(() => {
    const base = previewQuery.data?.workspace;
    if (!base) return null;
    const isCoachDefault =
      (identityQuery.data?.directReports.length ?? 0) > 0 || base.isAssignedCoach;
    return {
      ...base,
      isAssignedCoach:
        import.meta.env.DEV && devCoachOverride !== null ? devCoachOverride : isCoachDefault,
      isApprovedTrainer:
        import.meta.env.DEV && devTrainerOverride !== null
          ? devTrainerOverride
          : base.isApprovedTrainer,
    };
  }, [previewQuery.data, identityQuery.data, devCoachOverride, devTrainerOverride]);

  if (!hasAnyPermission(EMPLOYEE_WORKSPACE_PERMISSIONS)) {
    return (
      <div className="apid-card">
        <EmptyState
          title="No Employee Workspace Permissions"
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
        message="Unable to load your live employee profile."
        onRetry={() => void identityQuery.refetch()}
      />
    );
  }

  const { linkedEmployee, directReports, activeSkills } = identityQuery.data;

  // Identity-driven honest empty state when login user has no linked employee profile yet
  if (!linkedEmployee) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <PageHeader
          title="Employee Profile"
          subtitle="Your employee profile and reporting information from Bank of Abyssinia."
          source="live"
        />

        <div className="apid-card" data-testid="unlinked-profile-state">
          <EmptyState
            title="Profile Not Linked Yet"
            description={`Your account "${user?.username ?? ''}" is signed in, but it is not linked to an employee profile yet. Ask your Administrator to link your account under Employees & Org.`}
            icon={<ShieldAlert size={34} />}
            action={
              hasPermission('HIERARCHY_MANAGE') ? (
                <Link to="/admin?tab=organization" className="apid-btn apid-btn-primary apid-btn-sm">
                  Go to Employees &amp; Org
                </Link>
              ) : undefined
            }
          />
        </div>
      </div>
    );
  }

  const workspaceData = effectiveWorkspace!;
  const availableTrainers = previewQuery.data?.availableTrainers ?? [];
  const allCoachingMsgs = [...workspaceData.chatCoachingMessages, ...coachingChatExtra];
  const allMentoringMsgs = [...workspaceData.chatMentoringMessages, ...mentoringChatExtra];

  const appendMessage = (channel: 'coaching' | 'mentoring', body: string) => {
    const item: ChatMessageItem = {
      id: `msg-${Date.now()}`,
      sender: 'You',
      body,
      time: 'Just now',
    };
    if (channel === 'coaching') {
      setCoachingChatExtra((prev) => [...prev, item]);
    } else {
      setMentoringChatExtra((prev) => [...prev, item]);
    }
  };

  const workspaceHeading =
    activeTab === 'coaching'
      ? 'My Coaching'
      : activeTab === 'mentoring'
        ? 'My Mentoring'
        : 'Overview';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <PageHeader
        title={workspaceHeading}
        subtitle="Your personal coaching, mentoring, and team reporting view."
        source="live"
      />

      {/* Live Bank of Abyssinia Identity Card */}
      <div className="apid-card">
        <div className="boa-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            <AvatarBadge name={linkedEmployee.fullName} size={46} />
            <div>
              <h2 className="boa-card-title" style={{ fontSize: '1.1rem' }}>
                {linkedEmployee.fullName}
              </h2>
              <div className="boa-muted" style={{ fontSize: '0.84rem' }}>
                Employee #{linkedEmployee.employeeNumber} · {linkedEmployee.position || linkedEmployee.job || 'Staff Member'}
              </div>
              <div className="boa-muted" style={{ fontSize: '0.8rem', marginTop: '0.15rem' }}>
                <Building2 size={13} style={{ verticalAlign: 'text-bottom', marginRight: '0.25rem' }} />
                {linkedEmployee.departmentName || 'Unassigned Department'}
                {linkedEmployee.parentDepartmentName ? ` (${linkedEmployee.parentDepartmentName})` : ''}
                {linkedEmployee.managerFullName ? ` · Reports to: ${linkedEmployee.managerFullName}` : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <StatusPill
              label={linkedEmployee.employmentStatus}
              tone={linkedEmployee.employmentStatus === 'ACTIVE' ? 'ok' : 'warn'}
            />
            <DataSourceBadge source="live" />
          </div>
        </div>

        {/* Navigation tabs */}
        <div className="apid-tabs" role="tablist" aria-label="Workspace sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'overview'}
            className={`apid-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => selectTab('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'coaching'}
            className={`apid-tab ${activeTab === 'coaching' ? 'active' : ''}`}
            onClick={() => selectTab('coaching')}
          >
            My Coaching
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'mentoring'}
            className={`apid-tab ${activeTab === 'mentoring' ? 'active' : ''}`}
            onClick={() => selectTab('mentoring')}
          >
            My Mentoring
          </button>
        </div>
      </div>

      {/* Strictly development-only flag inspector */}
      {import.meta.env.DEV && (
        <div
          className="apid-card"
          data-testid="dev-participation-sandbox"
          style={{ padding: '0.75rem 1rem', background: '#fffbeb', borderColor: '#fde68a' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
              fontSize: '0.8rem',
            }}
          >
            <div>
              <strong>Sample Role View:</strong> Toggle Coach or Trainer view to preview role cards.
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="apid-btn apid-btn-outline apid-btn-sm"
                onClick={() =>
                  setDevCoachOverride((prev) => !(prev ?? workspaceData.isAssignedCoach))
                }
              >
                Coach Flag: {workspaceData.isAssignedCoach ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                className="apid-btn apid-btn-outline apid-btn-sm"
                onClick={() =>
                  setDevTrainerOverride((prev) => !(prev ?? workspaceData.isApprovedTrainer))
                }
              >
                Trainer Flag: {workspaceData.isApprovedTrainer ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="boa-stack">
          <div className="boa-kpi-grid" style={{ marginBottom: 0 }}>
            <StatCard
              label="Direct Reports"
              value={directReports.length}
              subtext={
                directReports.length > 0
                  ? 'Employees reporting to you'
                  : 'Individual contributor'
              }
              icon={<Users size={16} />}
            />
            <StatCard
              label="Coaching Progress"
              value={`${workspaceData.talentPlan.progressPct}%`}
              subtext={workspaceData.talentPlan.quarter}
              badge={workspaceData.hasTalentAssignment ? 'ACTIVE PLAN' : 'NONE'}
              badgeTone="info"
              icon={<ClipboardCheck size={16} />}
            />
            <StatCard
              label="Mentoring Sessions"
              value={`${workspaceData.mentoringAsTrainee.sessionsCompleted}/${workspaceData.mentoringAsTrainee.sessionsPlanned}`}
              subtext={workspaceData.mentoringAsTrainee.skillName}
              badge="SAMPLE"
              badgeTone="neutral"
              icon={<Award size={16} />}
            />
            <StatCard
              label="Available Skills"
              value={activeSkills.length}
              subtext="Bank of Abyssinia skills catalog"
              icon={<Building2 size={16} />}
            />
          </div>

          {directReports.length > 0 && (
            <div className="apid-card">
              <div className="boa-card-header">
                <div>
                  <h3 className="boa-card-title">My Direct Reports</h3>
                  <p className="boa-card-subtitle">
                    Employees reporting directly to {linkedEmployee.fullName}.
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
                    </tr>
                  </thead>
                  <tbody>
                    {directReports.map((dr) => (
                      <tr key={dr.id}>
                        <td className="tabular-nums"><strong>{dr.employeeNumber}</strong></td>
                        <td>{dr.fullName}</td>
                        <td>{dr.departmentName ?? '—'}</td>
                        <td>{dr.position || dr.job || '—'}</td>
                        <td>
                          <StatusPill
                            label={dr.employmentStatus}
                            tone={dr.employmentStatus === 'ACTIVE' ? 'ok' : 'warn'}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="apid-card">
            <div className="boa-card-header">
              <div>
                <h3 className="boa-card-title">Quick Navigation</h3>
                <p className="boa-card-subtitle">
                  Open your Coaching plans or browse available Trainers under Mentoring.
                </p>
              </div>
              <DataSourceBadge source="preview" />
            </div>
            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="apid-btn apid-btn-primary apid-btn-sm"
                onClick={() => selectTab('coaching')}
              >
                Open My Coaching
              </button>
              <button
                type="button"
                className="apid-btn apid-btn-outline apid-btn-sm"
                onClick={() => selectTab('mentoring')}
              >
                Open My Mentoring &amp; Trainer Directory
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'coaching' && (
        <CoachingTab
          workspace={workspaceData}
          directReports={directReports}
          activeSkills={activeSkills}
          chatMessages={allCoachingMsgs}
          onAppendChat={(body) => appendMessage('coaching', body)}
        />
      )}

      {activeTab === 'mentoring' && (
        <MentoringTab
          workspace={workspaceData}
          availableTrainers={availableTrainers}
          activeSkills={activeSkills}
          chatMessages={allMentoringMsgs}
          onAppendChat={(body) => appendMessage('mentoring', body)}
        />
      )}
    </div>
  );
}
