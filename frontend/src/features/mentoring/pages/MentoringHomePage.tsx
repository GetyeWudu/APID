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
import { mentoringPairingApi } from '../api/mentoringPairingApi';
import { mentorDirectoryApi } from '../api/mentorDirectoryApi';
import { ApplyForMentorForm } from '../components/ApplyForMentorForm';
import { MentorDirectory } from '../components/MentorDirectory';
import { MentorInvitationForm } from '../components/MentorInvitationForm';
import { MentoringRequestsPanel } from '../components/MentoringRequestsPanel';

type MentoringViewKey =
  | 'overview'
  | 'directory'
  | 'trainee'
  | 'trainee-sessions'
  | 'trainer'
  | 'trainer-sessions'
  | 'apply';

export function MentoringHomePage() {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const [mentoringChatExtra, setMentoringChatExtra] = useState<ChatMessageItem[]>([]);
  const isMentor = user?.roles.some((role) => role.trim().toLowerCase() === 'mentor') ?? false;

  const requestedView = searchParams.get('view') as MentoringViewKey | null;
  const activeView: MentoringViewKey =
    requestedView === 'directory' ||
    requestedView === 'trainee' ||
    requestedView === 'trainee-sessions' ||
    requestedView === 'trainer' ||
    requestedView === 'trainer-sessions' ||
    requestedView === 'apply'
      ? requestedView
      : 'overview';

  const identityQuery = useQuery({
    queryKey: ['workspace', 'identity', user?.id],
    queryFn: workspaceLiveApi.loadMyIdentity,
    enabled: hasAnyPermission(EMPLOYEE_WORKSPACE_PERMISSIONS),
  });

  const previewQuery = useQuery({
    queryKey: ['workspace', 'preview-participation'],
    queryFn: workspacePreviewAdapter.getParticipationPreview,
    enabled: activeView === 'trainee-sessions' || activeView === 'trainer-sessions',
  });

  const mentorsQuery = useQuery({
    queryKey: ['mentoring', 'directory'],
    queryFn: mentorDirectoryApi.listMentors,
    enabled: activeView === 'directory' && hasAnyPermission(EMPLOYEE_WORKSPACE_PERMISSIONS),
  });

  const pairingRequestsQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'requests', user?.id],
    queryFn: mentoringPairingApi.listMyRequests,
    enabled: hasAnyPermission(EMPLOYEE_WORKSPACE_PERMISSIONS),
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

  if (identityQuery.isLoading) {
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
          title="Mentoring"
          subtitle="Learn with a mentor, find mentors by skill, or apply to become a mentor."
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

  if (activeView === 'directory') {
    if (mentorsQuery.isLoading || pairingRequestsQuery.isLoading) {
      return <LoadingSkeleton rows={6} height={28} />;
    }

    if (mentorsQuery.isError || pairingRequestsQuery.isError) {
      return (
        <ErrorState
          message="Unable to load mentors or your mentoring requests."
          onRetry={() => {
            void mentorsQuery.refetch();
            void pairingRequestsQuery.refetch();
          }}
        />
      );
    }

    return (
      <div className="boa-stack">
        <PageHeader
          title="Find a Mentor"
          subtitle="Browse active mentors by their linked skills."
          source="live"
        />
        <MentorDirectory
          mentors={mentorsQuery.data ?? []}
          currentUserId={user?.id}
          requests={pairingRequestsQuery.data ?? []}
        />
      </div>
    );
  }

  if (activeView === 'overview' || activeView === 'trainee' || activeView === 'trainer') {
    if (pairingRequestsQuery.isLoading) {
      return <LoadingSkeleton rows={6} height={28} />;
    }
    if (pairingRequestsQuery.isError) {
      return (
        <ErrorState
          message="Unable to load your mentoring requests."
          onRetry={() => void pairingRequestsQuery.refetch()}
        />
      );
    }
    if (activeView === 'trainer' && !isMentor) {
      return (
        <div className="boa-stack">
          <PageHeader title="My Trainees" subtitle="Mentor invitations and requests." source="live" />
          <div className="apid-card">
            <EmptyState
              title="Mentor Access Required"
              description="Only approved mentors can invite employees or respond to trainee requests."
            />
          </div>
        </div>
      );
    }

    const view = activeView === 'trainer' ? 'mentor' : activeView === 'trainee' ? 'trainee' : 'all';
    const title =
      activeView === 'trainer'
        ? 'My Trainees'
        : activeView === 'trainee'
          ? 'My Mentor'
          : 'Mentoring';
    const subtitle =
      activeView === 'trainer'
        ? 'Invite employees to a one-to-one pairing or class, and respond to mentorship requests.'
        : activeView === 'trainee'
          ? 'Request a mentor, respond to invitations, and track your active relationships.'
          : 'Manage mentoring invitations, requests, and active pairings.';

    return (
      <div className="boa-stack">
        <PageHeader title={title} subtitle={subtitle} source="live" />
        {activeView === 'trainer' && user?.id && <MentorInvitationForm currentUserId={user.id} />}
        {activeView === 'trainee' && (
          <div>
            <Link to="/mentoring?view=directory" className="apid-btn apid-btn-primary apid-btn-sm">
              Find a Mentor
            </Link>
          </div>
        )}
        {activeView === 'overview' && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link to="/mentoring?view=directory" className="apid-btn apid-btn-outline apid-btn-sm">
              Find a Mentor
            </Link>
            {isMentor && (
              <Link to="/mentoring?view=trainer" className="apid-btn apid-btn-outline apid-btn-sm">
                Invite Employees
              </Link>
            )}
          </div>
        )}
        <MentoringRequestsPanel
          requests={pairingRequestsQuery.data ?? []}
          currentUserId={user?.id ?? 0}
          view={view}
        />
      </div>
    );
  }

  if (previewQuery.isLoading) {
    return <LoadingSkeleton rows={6} height={28} />;
  }

  if (activeView === 'apply') {
    return (
      <div className="boa-stack">
        <PageHeader
          title="Apply to Become a Mentor"
          subtitle="Choose a catalog skill, enter a custom skill, or provide both, then upload proof."
        />
        <ApplyForMentorForm activeSkills={activeSkills} />
      </div>
    );
  }

  const workspaceData = previewQuery.data!.workspace;
  const allMentoringMsgs = [...workspaceData.chatMentoringMessages, ...mentoringChatExtra];

  const appendMessage = (body: string) => {
    setMentoringChatExtra((prev) => [
      ...prev,
      { id: `msg-${Date.now()}`, sender: 'You', body, time: 'Just now' },
    ]);
  };

  const viewMeta =
    activeView === 'trainer-sessions'
      ? {
          title: 'Mentor Sessions',
          subtitle: 'View sessions scheduled with your trainees.',
        }
      : {
          title: 'My Sessions',
          subtitle: 'Track your learning sessions with your mentor.',
        };
  const section = activeView === 'trainer-sessions' ? 'trainer-sessions' : 'trainee-sessions';

  return (
    <div className="boa-stack">
      <PageHeader title={viewMeta.title} subtitle={viewMeta.subtitle} source="preview" />

      <MentoringTab
        workspace={workspaceData}
        activeSkills={activeSkills}
        chatMessages={allMentoringMsgs}
        onAppendChat={appendMessage}
        section={section}
        isMentor={isMentor}
      />
    </div>
  );
}

