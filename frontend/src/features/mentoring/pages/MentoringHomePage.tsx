import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import { EMPLOYEE_WORKSPACE_PERMISSIONS } from '../../../shared/auth/workspaceResolver';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
} from '../../../shared/components/ui';
import { workspaceLiveApi, workspacePreviewAdapter } from '../../workspace/api/workspaceDashboardApi';
import type { ChatMessageItem } from '../../workspace/components/IsolatedChatPanel';
import { MentoringTab } from '../../workspace/components/MentoringTab';

type MentoringViewKey = 'overview' | 'directory' | 'trainer';

export function MentoringHomePage() {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const [mentoringChatExtra, setMentoringChatExtra] = useState<ChatMessageItem[]>([]);

  const requestedView = searchParams.get('view') as MentoringViewKey | null;
  const activeView: MentoringViewKey =
    requestedView === 'directory' || requestedView === 'trainer' ? requestedView : 'overview';

  const identityQuery = useQuery({
    queryKey: ['workspace', 'identity', user?.id],
    queryFn: workspaceLiveApi.loadMyIdentity,
  });

  const previewQuery = useQuery({
    queryKey: ['workspace', 'preview-participation'],
    queryFn: workspacePreviewAdapter.getParticipationPreview,
  });

  if (!hasAnyPermission(EMPLOYEE_WORKSPACE_PERMISSIONS)) {
    return (
      <div className="apid-card">
        <EmptyState
          title="No Personal Mentoring Access"
          description="Your account does not hold EMPLOYEE_PORTAL_ACCESS."
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
        message="Unable to load your mentoring profile."
        onRetry={() => void identityQuery.refetch()}
      />
    );
  }

  const { linkedEmployee, activeSkills } = identityQuery.data;
  if (!linkedEmployee) {
    return (
      <div className="boa-stack">
        <PageHeader
          title="Mentoring & Trainers"
          subtitle="Track your mentoring match, browse certified trainers, or apply as a trainer."
          source="live"
        />
        <div className="apid-card" data-testid="unlinked-profile-state">
          <EmptyState
            title="Profile Not Linked Yet"
            description={`Your account "${user?.username ?? ''}" is not linked to an HR employee profile yet.`}
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

  const workspaceData = previewQuery.data!.workspace;
  const availableTrainers = previewQuery.data?.availableTrainers ?? [];
  const allMentoringMsgs = [...workspaceData.chatMentoringMessages, ...mentoringChatExtra];

  const appendMessage = (body: string) => {
    setMentoringChatExtra((prev) => [
      ...prev,
      { id: `msg-${Date.now()}`, sender: 'You', body, time: 'Just now' },
    ]);
  };

  const viewMeta =
    activeView === 'directory'
      ? {
          title: 'Certified Trainer Directory',
          subtitle: 'Browse active Bank of Abyssinia internal trainers by skill and submit a request.',
        }
      : activeView === 'trainer'
        ? {
            title: 'Trainer Workspace & Certification',
            subtitle: 'Manage incoming trainee requests or apply to become a certified internal trainer.',
          }
        : {
            title: 'My Mentor & Progress',
            subtitle: 'Track your active mentoring match, completed sessions, and trainee ↔ trainer channel.',
          };

  const section =
    activeView === 'directory' ? 'directory' : activeView === 'trainer' ? 'trainer' : 'trainee';

  return (
    <div className="boa-stack">
      <PageHeader title={viewMeta.title} subtitle={viewMeta.subtitle} source="preview" />

      <MentoringTab
        workspace={workspaceData}
        availableTrainers={availableTrainers}
        activeSkills={activeSkills}
        chatMessages={allMentoringMsgs}
        onAppendChat={appendMessage}
        section={section}
      />
    </div>
  );
}

