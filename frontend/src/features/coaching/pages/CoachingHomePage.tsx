import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, ShieldAlert } from 'lucide-react';
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
import { CoachingTab } from '../../workspace/components/CoachingTab';
import type { ChatMessageItem } from '../../workspace/components/IsolatedChatPanel';

type CoachingViewKey = 'plan' | 'sessions' | 'coachees';

export function CoachingHomePage() {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const [coachingChatExtra, setCoachingChatExtra] = useState<ChatMessageItem[]>([]);

  const requestedView = searchParams.get('view') as CoachingViewKey | null;
  const activeView: CoachingViewKey =
    requestedView === 'sessions' || requestedView === 'coachees' ? requestedView : 'plan';

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

  const { linkedEmployee, directReports, activeSkills } = identityQuery.data;
  const workspaceData = effectiveWorkspace!;
  const allCoachingMsgs = [...workspaceData.chatCoachingMessages, ...coachingChatExtra];

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

  const viewMeta =
    activeView === 'coachees'
      ? {
          title: 'People I Coach & Team',
          subtitle: 'Manage assigned coachees, submit session reports, and request skill-development coaching.',
        }
      : activeView === 'sessions'
        ? {
            title: 'Sessions & Coaching Channel',
            subtitle: 'Upcoming coaching meetings and private coach ↔ talent messages.',
          }
        : {
            title: 'My Coach & Action Plan',
            subtitle: 'Your current coaching pathway, assigned coach, and next scheduled session.',
          };

  const section =
    activeView === 'coachees' ? 'coachees' : activeView === 'sessions' ? 'chat' : 'talent';

  return (
    <div className="boa-stack">
      <PageHeader
        title={viewMeta.title}
        subtitle={viewMeta.subtitle}
        source="preview"
        actions={
          activeConfigQuery.data ? (
            <StatusPill
              label={`${activeConfigQuery.data.activeQuarter.label} · Cutoff Rounded < ${activeConfigQuery.data.publicConfig.mandatoryCutoffRounded}`}
              tone="info"
            />
          ) : undefined
        }
      />

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

      <CoachingTab
        workspace={workspaceData}
        directReports={directReports}
        activeSkills={activeSkills}
        chatMessages={allCoachingMsgs}
        onAppendChat={appendMessage}
        section={section}
      />
    </div>
  );
}

