import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  ClipboardCheck,
  GitPullRequest,
  HeartHandshake,
  UserRound,
  Users,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import { EMPLOYEE_WORKSPACE_PERMISSIONS } from '../../../shared/auth/workspaceResolver';
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
import { mentoringPairingApi } from '../../mentoring/api/mentoringPairingApi';
import { mentorApplicationApi } from '../../mentoring/api/mentorApplicationApi';
import { mentoringMatchApi } from '../../mentoring/api/mentoringMatchApi';
import { mentoringTrainerApi } from '../../mentoring/api/mentoringTrainerApi';
import { MentoringRequestsPanel } from '../../mentoring/components/MentoringRequestsPanel';
import { workspaceLiveApi } from '../api/workspaceDashboardApi';

export function WorkspaceDashboardPage() {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const canAccessWorkspace = hasAnyPermission(EMPLOYEE_WORKSPACE_PERMISSIONS);
  const canReviewMentorApplications = canAccessWorkspace && hasPermission('TRAINER_APPLICATION_REVIEW');
  const canManageMentoringMatches = canAccessWorkspace && hasPermission('MENTORING_MATCH_MANAGE');
  const canViewMentorRoster = canAccessWorkspace && hasAnyPermission([
    'TRAINER_DIRECT_APPOINT',
    'TRAINER_STATUS_MANAGE',
    'MENTORING_MATCH_MANAGE',
    'MENTORING_REPORT_VIEW_ALL',
  ]);
  const canViewMentoringReports = canAccessWorkspace && hasPermission('MENTORING_REPORT_VIEW_ALL');

  const identityQuery = useQuery({
    queryKey: ['workspace', 'identity', user?.id],
    queryFn: workspaceLiveApi.loadMyIdentity,
    enabled: canAccessWorkspace,
  });
  const hrApplicationsQuery = useQuery({
    queryKey: ['mentoring', 'applications'],
    queryFn: mentorApplicationApi.list,
    enabled: canReviewMentorApplications,
  });
  const hrMatchRequestsQuery = useQuery({
    queryKey: ['mentoring', 'hr-match-requests'],
    queryFn: mentoringMatchApi.listForHr,
    enabled: canManageMentoringMatches,
  });
  const hrTrainersQuery = useQuery({
    queryKey: ['mentoring', 'trainers'],
    queryFn: mentoringTrainerApi.listRoster,
    enabled: canViewMentorRoster,
  });
  const hrOverviewQuery = useQuery({
    queryKey: ['mentoring', 'hr-overview'],
    queryFn: mentoringTrainerApi.getOverview,
    enabled: canViewMentoringReports,
  });
  const pairingRequestsQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'requests', user?.id],
    queryFn: mentoringPairingApi.listMyRequests,
    enabled: canAccessWorkspace,
  });
  const relationshipsQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'relationships', user?.id],
    queryFn: mentoringPairingApi.listMyRelationships,
    enabled: canAccessWorkspace,
  });

  if (!canAccessWorkspace) {
    return (
      <div className="apid-card">
        <EmptyState
          title="No Employee Workspace Permissions"
          description="Your account does not hold EMPLOYEE_PORTAL_ACCESS or COACHING_REQUEST_SUBMIT."
        />
      </div>
    );
  }

  if (identityQuery.isLoading || pairingRequestsQuery.isLoading || relationshipsQuery.isLoading) {
    return <LoadingSkeleton rows={6} height={28} />;
  }

  const failedQuery = identityQuery.isError
    ? identityQuery
    : pairingRequestsQuery.isError
      ? pairingRequestsQuery
      : relationshipsQuery.isError
        ? relationshipsQuery
        : null;
  if (failedQuery) {
    const message = failedQuery === identityQuery
      ? 'Unable to load your live employee profile.'
      : failedQuery === pairingRequestsQuery
        ? 'Unable to load your mentoring requests.'
        : 'Unable to load your mentoring relationships.';
    return (
      <ErrorState
        message={message}
        onRetry={() => {
          void failedQuery.refetch();
        }}
      />
    );
  }

  if (!identityQuery.data) {
    return (
      <ErrorState
        message="Unable to load your live employee profile."
        onRetry={() => void identityQuery.refetch()}
      />
    );
  }

  const { linkedEmployee, activeSkills } = identityQuery.data;
  if (!linkedEmployee) {
    return (
      <div className="boa-stack">
        <PageHeader title="Overview" subtitle="Your role-based employee and mentoring activity." source="live" />
        <div className="apid-card" data-testid="unlinked-profile-state">
          <EmptyState
            title="Profile Not Linked Yet"
            description={`Your account "${user?.username ?? ''}" is signed in, but it is not linked to an employee profile yet. Ask your Administrator to link your account under Employees & Org.`}
            icon={<Building2 size={34} />}
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

  const requests = pairingRequestsQuery.data ?? [];
  const relationships = relationshipsQuery.data ?? [];
  const currentRelationships = relationships.filter(
    (relationship) =>
      relationship.memberStatus === 'ACTIVE' &&
      (relationship.relationshipStatus === 'ACTIVE' || relationship.relationshipStatus === 'PAUSED')
  );
  const totalPairCount = new Set(relationships.map((relationship) => relationship.relationshipId)).size;
  const mentorPairCount = new Set(
    relationships
      .filter((relationship) => relationship.currentUserRole === 'MENTOR')
      .map((relationship) => relationship.relationshipId)
  ).size;
  const traineePairCount = new Set(
    relationships
      .filter((relationship) => relationship.currentUserRole === 'TRAINEE')
      .map((relationship) => relationship.relationshipId)
  ).size;
  const incomingRequests = requests.filter((request) => request.status === 'PENDING' && request.incoming);
  const outgoingRequests = requests.filter(
    (request) =>
      request.status === 'PENDING' &&
      !request.incoming &&
      request.initiatedByMentor &&
      request.mentorUserId === user?.id
  );
  const isMentor =
    (user?.roles.some((role) => role.trim().toLowerCase() === 'mentor') ?? false) || mentorPairCount > 0;
  const activeRelationships = currentRelationships.filter(
    (relationship) => relationship.relationshipStatus === 'ACTIVE'
  );
  const activePairCount = new Set(activeRelationships.map((relationship) => relationship.relationshipId)).size;
  const activeMentorCount = new Set(
    activeRelationships
      .filter((relationship) => relationship.currentUserRole === 'TRAINEE')
      .map((relationship) => relationship.mentorUserId)
  ).size;
  const activeTraineeCount = new Set(
    activeRelationships
      .filter((relationship) => relationship.currentUserRole === 'MENTOR')
      .map((relationship) => relationship.traineeUserId)
  ).size;
  const hrActivityQueries = [
    canReviewMentorApplications ? hrApplicationsQuery : null,
    canManageMentoringMatches ? hrMatchRequestsQuery : null,
    canViewMentorRoster ? hrTrainersQuery : null,
    canViewMentoringReports ? hrOverviewQuery : null,
  ].filter((query): query is NonNullable<typeof query> => query !== null);
  const hasHrActivityAccess = hrActivityQueries.length > 0;
  const hrActivityLoading = hrActivityQueries.some((query) => query.isLoading);
  const hrActivityError = hrActivityQueries.some((query) => query.isError);
  const activeHrMentorUserIds = new Set(
    (hrTrainersQuery.data ?? [])
      .filter((trainer) => trainer.status === 'ACTIVE' && trainer.acceptingNewPairings !== false)
      .map((trainer) => trainer.userId)
      .filter((userId): userId is number => userId !== null)
  );
  const activeHrMentorCount = activeHrMentorUserIds.size;
  const pendingHrApplications = (hrApplicationsQuery.data ?? [])
    .filter((application) => application.status === 'PENDING').length;
  const openHrMatchRequests = (hrMatchRequestsQuery.data ?? [])
    .filter((request) => request.status === 'OPEN').length;

  return (
    <div className="boa-stack">
      <PageHeader
        title="Overview"
        subtitle="Your live employee profile, team responsibilities, and mentoring activity."
        source="live"
      />

      <section className="apid-card">
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
            {(user?.roles ?? [])
              .map((role) => (
                <StatusPill key={role} label={role} tone="neutral" />
              ))}
            <DataSourceBadge source="live" />
          </div>
        </div>
      </section>

      {hasHrActivityAccess && (
        <section className="boa-stack" aria-label="HR mentoring activity">
          <div className="boa-card-header">
            <div>
              <h2 className="boa-card-title">HR Mentoring Activity</h2>
              <p className="boa-card-subtitle">
                Review workload, matching requests, and current mentoring assignments.
              </p>
            </div>
            <Link to="/mentoring/hr" className="apid-btn apid-btn-outline apid-btn-sm">
              Open HR mentoring
            </Link>
          </div>
          {hrActivityLoading ? (
            <LoadingSkeleton rows={2} height={72} />
          ) : hrActivityError ? (
            <ErrorState
              message="Unable to load HR mentoring activity."
              onRetry={() => {
                hrActivityQueries.forEach((query) => {
                  if (query.isError) void query.refetch();
                });
              }}
            />
          ) : (
            <div className="boa-stack">
              <div className="boa-kpi-grid" style={{ marginBottom: 0 }}>
                {canReviewMentorApplications && (
                  <StatCard
                    label="Pending Applications"
                    value={pendingHrApplications}
                    subtext="Awaiting HR review"
                    icon={<ClipboardCheck size={16} />}
                  />
                )}
                {canManageMentoringMatches && (
                  <StatCard
                    label="Awaiting Matching"
                    value={openHrMatchRequests}
                    subtext="Trainees waiting for a mentor"
                    icon={<GitPullRequest size={16} />}
                  />
                )}
                {canViewMentorRoster && (
                  <StatCard
                    label="Approved Mentors"
                    value={activeHrMentorCount}
                    subtext="Active approved mentors"
                    icon={<UserRound size={16} />}
                  />
                )}
                {canViewMentoringReports && (
                  <StatCard
                    label="Active Assignments"
                    value={hrOverviewQuery.data?.activeRelationships ?? 0}
                    subtext="Current mentoring relationships"
                    icon={<HeartHandshake size={16} />}
                  />
                )}
                {canViewMentoringReports && hrOverviewQuery.data && (
                  <StatCard
                    label="Relationship Completion"
                    value={`${hrOverviewQuery.data.completionRatePct}%`}
                    subtext={`${hrOverviewQuery.data.completedRelationships} completed relationships`}
                    icon={<HeartHandshake size={16} />}
                  />
                )}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="boa-kpi-grid" aria-label="Role overview metrics" style={{ marginBottom: 0 }}>
        <StatCard
          label="Active Mentors"
          value={activeMentorCount}
          subtext="Mentors currently mentoring you"
          icon={<UserRound size={16} />}
        />
        <StatCard
          label="Active Trainees"
          value={activeTraineeCount}
          subtext="Trainees you currently mentor"
          icon={<UsersRound size={16} />}
        />
        <StatCard
          label="Incoming Requests"
          value={incomingRequests.length}
          subtext="Awaiting your response"
          icon={<Users size={16} />}
        />
        <StatCard
          label="Outgoing Requests"
          value={outgoingRequests.length}
          subtext="Mentoring requests you sent awaiting a response"
          icon={<ArrowUpRight size={16} />}
        />
        <StatCard
          label="Available Skills"
          value={activeSkills.length}
          subtext="Active catalog skills, including approved custom skills"
          icon={<Building2 size={16} />}
        />
      </section>

      <section className="boa-stack" aria-label="Pairing">
        <div className="boa-card-header">
          <div>
            <h2 className="boa-card-title">Pairing</h2>
            <p className="boa-card-subtitle">A summary of your mentoring relationships.</p>
          </div>
        </div>
        <div className="boa-kpi-grid" aria-label="Pairing metrics" style={{ marginBottom: 0 }}>
          <StatCard
            label="Total pairings"
            value={totalPairCount}
            subtext="All mentoring relationships"
            icon={<HeartHandshake size={16} />}
          />
          <StatCard
            label="As mentor"
            value={mentorPairCount}
            subtext="Relationships where you mentor"
            icon={<ArrowUpRight size={16} />}
          />
          <StatCard
            label="As trainee"
            value={traineePairCount}
            subtext="Relationships where you are mentored"
            icon={<ArrowDownRight size={16} />}
          />
          <StatCard
            label="Active"
            value={activePairCount}
            subtext="Current active relationships"
            icon={<UsersRound size={16} />}
          />
        </div>
      </section>

      <MentoringRequestsPanel
        requests={requests}
        currentUserId={user?.id ?? 0}
        view="all"
        showActive={false}
      />

      {isMentor && (
        <div className="apid-card" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h3 className="boa-card-title">Mentor Workspace</h3>
            <p className="boa-card-subtitle">Manage invitations, trainee requests, and your mentor profile.</p>
          </div>
          <Link to="/mentoring?view=trainer" className="apid-btn apid-btn-primary apid-btn-sm">
            Open mentor workspace
          </Link>
        </div>
      )}
    </div>
  );
}
