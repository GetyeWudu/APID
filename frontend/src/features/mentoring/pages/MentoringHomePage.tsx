import { useQuery } from '@tanstack/react-query';
import { GraduationCap, ShieldAlert } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import { EMPLOYEE_WORKSPACE_PERMISSIONS } from '../../../shared/auth/workspaceResolver';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
} from '../../../shared/components/ui';
import { workspaceLiveApi } from '../../workspace/api/workspaceDashboardApi';
import { mentoringPairingApi } from '../api/mentoringPairingApi';
import { mentorDirectoryApi } from '../api/mentorDirectoryApi';
import { ApplyForMentorForm } from '../components/ApplyForMentorForm';
import { MentorDirectory } from '../components/MentorDirectory';
import { MentoringRequestsPanel } from '../components/MentoringRequestsPanel';
import { MentoringMatchRequestForm } from '../components/MentoringMatchRequestForm';
import { MentoringRecommendations } from '../components/MentoringRecommendations';
import { MentorProfileForm } from '../components/MentorProfileForm';
import { MentoringConnectionsPanel } from '../components/MentoringConnectionsPanel';
import { MentoringSessionsPage } from './MentoringSessionsPage';
import './MentoringDashboard.css';

type MentoringViewKey =
  | 'overview'
  | 'directory'
  | 'trainee'
  | 'requests'
  | 'sessions'
  | 'trainee-sessions'
  | 'trainer'
  | 'trainer-profile'
  | 'trainer-sessions'
  | 'apply';

export function MentoringHomePage() {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const [searchParams] = useSearchParams();

  const relationshipsQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'relationships', user?.id],
    queryFn: mentoringPairingApi.listMyRelationships,
    enabled: hasAnyPermission(EMPLOYEE_WORKSPACE_PERMISSIONS),
  });

  const isMentor =
    (user?.roles.some((role) => role.trim().toLowerCase() === 'mentor') ?? false) ||
    Boolean(relationshipsQuery.data?.some((pair) => pair.currentUserRole === 'MENTOR'));

  const requestedView = searchParams.get('view') as MentoringViewKey | null;
  const activeView: MentoringViewKey =
    requestedView === 'directory' ||
    requestedView === 'trainee' ||
    requestedView === 'requests' ||
    requestedView === 'sessions' ||
    requestedView === 'trainee-sessions' ||
    requestedView === 'trainer' ||
    requestedView === 'trainer-profile' ||
    requestedView === 'trainer-sessions' ||
    requestedView === 'apply'
      ? requestedView
      : 'overview';

  const identityQuery = useQuery({
    queryKey: ['workspace', 'identity', user?.id],
    queryFn: workspaceLiveApi.loadMyIdentity,
    enabled: hasAnyPermission(EMPLOYEE_WORKSPACE_PERMISSIONS),
  });

  const mentorsQuery = useQuery({
    queryKey: ['mentoring', 'directory'],
    queryFn: () => mentorDirectoryApi.listMentors(),
    enabled: activeView === 'directory' && hasAnyPermission(EMPLOYEE_WORKSPACE_PERMISSIONS),
  });
  const directoryLocationQuery = useQuery({
    queryKey: ['mentoring', 'directory-location', user?.id],
    queryFn: mentorDirectoryApi.getMyOrganizationPath,
    enabled: activeView === 'directory'
      && hasAnyPermission(EMPLOYEE_WORKSPACE_PERMISSIONS)
      && Boolean(identityQuery.data?.linkedEmployee),
  });

  const pairingRequestsQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'requests', user?.id],
    queryFn: mentoringPairingApi.listMyRequests,
    enabled:
      hasAnyPermission(EMPLOYEE_WORKSPACE_PERMISSIONS) &&
      (activeView === 'overview' || activeView === 'directory' || activeView === 'requests'),
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
      <div className="boa-stack mentoring-dashboard">
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
    if (mentorsQuery.isLoading || pairingRequestsQuery.isLoading || directoryLocationQuery.isLoading) {
      return <LoadingSkeleton rows={6} height={28} />;
    }

    if (mentorsQuery.isError || pairingRequestsQuery.isError || directoryLocationQuery.isError) {
      return (
        <ErrorState
          message="Unable to load mentors or your mentoring requests."
          onRetry={() => {
            void mentorsQuery.refetch();
            void pairingRequestsQuery.refetch();
            void directoryLocationQuery.refetch();
          }}
        />
      );
    }

    return (
      <div className="boa-stack mentoring-dashboard">
        <PageHeader
          title="Find a Mentor"
          subtitle="Describe what you want to learn for AI-powered recommendations, or browse the mentor directory."
          source="live"
        />
        <MentoringRecommendations
          currentUserId={user?.id}
          requests={pairingRequestsQuery.data ?? []}
        />
        <MentoringMatchRequestForm skills={activeSkills} />
        <MentorDirectory
          mentors={mentorsQuery.data ?? []}
          currentUserId={user?.id}
          currentUserOrganizationPath={directoryLocationQuery.data ?? []}
          requests={pairingRequestsQuery.data ?? []}
        />
      </div>
    );
  }

  if (activeView === 'trainer-profile') {
    if (!isMentor) {
      return (
        <div className="boa-stack mentoring-dashboard">
          <PageHeader title="Mentor Profile" subtitle="Manage your public mentor profile." source="live" />
          <div className="apid-card">
            <EmptyState
              title="Mentor Access Required"
              description="Only approved mentors can manage a public mentor profile."
            />
          </div>
        </div>
      );
    }

    return (
      <div className="boa-stack mentoring-dashboard">
        <PageHeader
          title="Mentor Profile"
          subtitle="Keep your expertise, mentoring profile, and trainee capacity up to date for employees seeking a mentor."
          source="live"
        />
        <MentorProfileForm activeSkills={activeSkills} currentUserId={user?.id ?? 0} />
      </div>
    );
  }

  if (activeView === 'requests') {
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

    return (
      <div className="boa-stack mentoring-dashboard">
        <PageHeader
          title="My Requests"
          subtitle="Review mentorship requests you sent and requests mentees sent to you."
          source="live"
        />
        <MentoringRequestsPanel
          requests={pairingRequestsQuery.data ?? []}
          currentUserId={user?.id ?? 0}
          view="all"
        />
      </div>
    );
  }

  if (activeView === 'trainee' || activeView === 'trainer') {
    if (relationshipsQuery.isLoading) {
      return <LoadingSkeleton rows={6} height={28} />;
    }
    if (relationshipsQuery.isError) {
      return (
        <ErrorState
          message="Unable to load your mentoring pairings."
          onRetry={() => void relationshipsQuery.refetch()}
        />
      );
    }
    if (activeView === 'trainer' && !isMentor) {
      return (
        <div className="boa-stack mentoring-dashboard">
          <PageHeader title="My Trainees" subtitle="View your approved mentoring relationships." source="live" />
          <div className="apid-card">
            <EmptyState
              title="Mentor Access Required"
              description="Only approved mentors can view their trainee pairings."
            />
          </div>
        </div>
      );
    }

    return (
      <div className="boa-stack mentoring-dashboard">
        <PageHeader
          title={activeView === 'trainer' ? 'My Trainees' : 'My Mentors'}
          subtitle={
            activeView === 'trainer'
              ? 'Choose a trainee to see each of your mentorship pairings.'
              : 'Choose a mentor to see each of your mentorship pairings.'
          }
          source="live"
        />
        <MentoringConnectionsPanel
          role={activeView === 'trainer' ? 'MENTOR' : 'TRAINEE'}
          relationships={relationshipsQuery.data ?? []}
        />
      </div>
    );
  }

  if (activeView === 'overview') {
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

    return (
      <div className="boa-stack mentoring-dashboard">
        <PageHeader
          title="Mentoring"
          subtitle="Request a mentor or review your mentoring requests and relationships."
          source="live"
        />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link to="/mentoring?view=directory" className="apid-btn apid-btn-outline apid-btn-sm">
            Find a Mentor
          </Link>
          <Link to="/mentoring?view=requests" className="apid-btn apid-btn-outline apid-btn-sm">
            My Requests
          </Link>
        </div>
        <MentoringRequestsPanel
          requests={pairingRequestsQuery.data ?? []}
          currentUserId={user?.id ?? 0}
          view="all"
        />
      </div>
    );
  }

  if (activeView === 'apply') {
    if (isMentor) {
      return (
        <div className="boa-stack mentoring-dashboard">
          <PageHeader
            title="Apply to Become a Mentor"
            subtitle="Approved mentors can request additional skills from their profile."
          />
          <div className="apid-card">
            <EmptyState
              title="You Are Already a Mentor"
              description="Use your mentor profile to request HR approval for additional skills."
              action={
                <Link to="/mentoring?view=trainer-profile" className="apid-btn apid-btn-primary apid-btn-sm">
                  Open mentor profile
                </Link>
              }
            />
          </div>
        </div>
      );
    }
    return (
      <div className="boa-stack mentoring-dashboard">
        <PageHeader
          title="Apply to Become a Mentor"
          subtitle="Complete your profile and supporting documents. A mentor profile is created only after administrator approval."
          actions={
            <div className="mentor-application-page-meta">
              <span className="mentor-application-page-program">
                <GraduationCap size={17} aria-hidden="true" />
                Mentor Development Program
              </span>
              <span className="mentor-application-page-steps">
                <strong>09</strong>
                <span>application steps</span>
              </span>
            </div>
          }
        />
        <ApplyForMentorForm
          activeSkills={activeSkills}
          currentUserId={user?.id ?? 0}
          defaultFullName={linkedEmployee.fullName}
        />
      </div>
    );
  }

  const sessionView = activeView === 'trainer-sessions'
    ? 'mentor'
    : activeView === 'trainee-sessions'
      ? 'trainee'
      : isMentor
        ? 'mentor'
        : 'trainee';
  return <MentoringSessionsPage view={sessionView} />;
}

