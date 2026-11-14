import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award, Building2, ShieldAlert, Users } from 'lucide-react';
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
import { mentoringPairingApi } from '../../mentoring/api/mentoringPairingApi';
import { MentoringPairChatPanel } from '../../mentoring/components/MentoringPairChatPanel';
import { MentoringRequestsPanel } from '../../mentoring/components/MentoringRequestsPanel';
import { workspaceLiveApi, workspacePreviewAdapter } from '../api/workspaceDashboardApi';
import { IsolatedChatPanel, type ChatMessageItem } from '../components/IsolatedChatPanel';

type WorkspaceTabKey = 'overview' | 'mentoring' | 'chat';

export function WorkspaceDashboardPage() {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMentor = user?.roles.some((role) => role.trim().toLowerCase() === 'mentor') ?? false;
  const requestedTab = (searchParams.get('tab') as WorkspaceTabKey | null) ?? 'overview';
  const activeTab: WorkspaceTabKey =
    requestedTab === 'mentoring' || requestedTab === 'chat'
      ? requestedTab
      : 'overview';
  const pairingIdParam = searchParams.get('pairingId');
  const isPairChat = activeTab === 'chat' && pairingIdParam !== null;

  // Strictly dev-only participation flag toggles (never visible in production builds)
  const [devTrainerOverride, setDevTrainerOverride] = useState<boolean | null>(null);

  const [mentoringChatExtra, setMentoringChatExtra] = useState<ChatMessageItem[]>([]);

  const identityQuery = useQuery({
    queryKey: ['workspace', 'identity', user?.id],
    queryFn: workspaceLiveApi.loadMyIdentity,
    enabled: !isPairChat,
  });

  const previewQuery = useQuery({
    queryKey: ['workspace', 'preview-participation'],
    queryFn: workspacePreviewAdapter.getParticipationPreview,
    enabled: !isPairChat,
  });

  const pairingRequestsQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'requests', user?.id],
    queryFn: mentoringPairingApi.listMyRequests,
    enabled: Boolean(user && hasAnyPermission(EMPLOYEE_WORKSPACE_PERMISSIONS) && !isPairChat),
  });

  const selectTab = (key: WorkspaceTabKey) => {
    const nextParams = new URLSearchParams();
    if (key !== 'overview') nextParams.set('tab', key);
    const pairingId = searchParams.get('pairingId');
    if (key === 'chat' && pairingId) nextParams.set('pairingId', pairingId);
    setSearchParams(nextParams);
  };

  const effectiveWorkspace = useMemo(() => {
    const base = previewQuery.data?.workspace;
    if (!base) return null;
    return {
      ...base,
      isApprovedTrainer:
        import.meta.env.DEV && devTrainerOverride !== null
          ? devTrainerOverride
          : base.isApprovedTrainer || isMentor,
    };
  }, [previewQuery.data, devTrainerOverride, isMentor]);

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

  if (isPairChat) {
    const pairingId = Number(pairingIdParam);
    if (!Number.isSafeInteger(pairingId) || pairingId <= 0) {
      return (
        <div className="apid-card">
          <EmptyState title="Invalid Pairing" description="The pairing identifier in this chat link is not valid." />
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <PageHeader title="Chat" subtitle="Your private conversation for this mentoring pairing." source="live" />
        <MentoringPairChatPanel relationshipId={pairingId} />
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
  const allMentoringMsgs = [...workspaceData.chatMentoringMessages, ...mentoringChatExtra];

  const appendMessage = (body: string) => {
    const item: ChatMessageItem = {
      id: `msg-${Date.now()}`,
      sender: 'You',
      body,
      time: 'Just now',
    };
    setMentoringChatExtra((prev) => [...prev, item]);
  };

  const workspaceHeading =
    activeTab === 'chat'
      ? 'Chat'
      : activeTab === 'mentoring'
        ? 'My Mentoring'
        : 'Employee Dashboard';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <PageHeader
        title={workspaceHeading}
        subtitle={
          activeTab === 'chat'
            ? searchParams.has('pairingId')
              ? 'Your private conversation for this mentoring pairing.'
              : 'Your private conversations for active mentoring relationships.'
            : 'Your employee overview, mentoring, and team reporting.'
        }
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
            aria-selected={activeTab === 'mentoring'}
            className={`apid-tab ${activeTab === 'mentoring' ? 'active' : ''}`}
            onClick={() => selectTab('mentoring')}
          >
            My Mentoring
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'chat'}
            className={`apid-tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => selectTab('chat')}
          >
            Chat
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
              <strong>Sample Role View:</strong> Toggle mentor status to preview mentor features.
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                  Explore Mentoring or open your employee Chat.
                </p>
              </div>
              <DataSourceBadge source="preview" />
            </div>
            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="apid-btn apid-btn-outline apid-btn-sm"
                onClick={() => selectTab('mentoring')}
              >
                Open My Mentoring
              </button>
              <button
                type="button"
                className="apid-btn apid-btn-outline apid-btn-sm"
                onClick={() => selectTab('chat')}
              >
                Open Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'mentoring' &&
        (pairingRequestsQuery.isLoading ? (
          <LoadingSkeleton rows={6} height={28} />
        ) : pairingRequestsQuery.isError ? (
          <ErrorState
            message="Unable to load your mentoring requests."
            onRetry={() => void pairingRequestsQuery.refetch()}
          />
        ) : (
          <div className="boa-stack">
            <div>
              <Link to="/mentoring?view=directory" className="apid-btn apid-btn-primary apid-btn-sm">
                Find a Mentor
              </Link>
            </div>
            <MentoringRequestsPanel
              requests={pairingRequestsQuery.data ?? []}
              currentUserId={user?.id ?? 0}
            />
          </div>
        ))}

      {activeTab === 'chat' && (
        <div className="boa-stack">
          {workspaceData.hasTraineeRelationship ||
            workspaceData.mentoringAsTrainer.activeTrainees > 0 ? (
            <IsolatedChatPanel
              contextTitle="Mentoring Conversation"
              contextKey="mentoring"
              messages={allMentoringMsgs}
              onSendMessage={appendMessage}
            />
          ) : (
            <div className="apid-card">
              <EmptyState
                title="No Conversations Yet"
                description="Mentoring conversations appear here when you have an active mentoring relationship."
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
