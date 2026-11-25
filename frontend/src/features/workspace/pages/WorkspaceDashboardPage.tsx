import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
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
import '../../mentoring/pages/MentoringDashboard.css';

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
      <div className="boa-stack mentoring-dashboard workspace-dashboard-page">
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
    .filter((application) => application.status === 'PENDING' && application.applicationType !== 'PROFILE_UPDATE')
    .length;
  const openHrMatchRequests = (hrMatchRequestsQuery.data ?? [])
    .filter((request) => request.status === 'OPEN').length;

  return (
    <div className="boa-stack mentoring-dashboard workspace-dashboard-page">
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
        <section className="apid-card hr-activity-card" aria-label="HR mentoring activity">
          <div className="boa-card-header" style={{ marginBottom: 0 }}>
            <div>
              <h2 className="boa-card-title">HR Mentoring Activity</h2>
              <p className="boa-card-subtitle">
                Review workload, matching requests, and current mentoring assignments.
              </p>
            </div>
            <Link to="/mentoring/hr" className="apid-btn apid-btn-outline apid-btn-sm">
              <span>Open HR mentoring</span>
              <ArrowRight size={14} style={{ marginLeft: '0.25rem' }} />
            </Link>
          </div>
          {hrActivityLoading ? (
            <div style={{ marginTop: '1rem' }}>
              <LoadingSkeleton rows={2} height={72} />
            </div>
          ) : hrActivityError ? (
            <div style={{ marginTop: '1rem' }}>
              <ErrorState
                message="Unable to load HR mentoring activity."
                onRetry={() => {
                  hrActivityQueries.forEach((query) => {
                    if (query.isError) void query.refetch();
                  });
                }}
              />
            </div>
          ) : (
            <div className="hr-activity-strip">
              {canReviewMentorApplications && (
                <Link
                  to="/mentoring/hr?tab=applications"
                  className="hr-activity-item"
                  title="View pending trainer applications"
                >
                  <div className="hr-activity-item__header">
                    <span
                      className="hr-activity-item__icon"
                      style={{
                        backgroundColor: pendingHrApplications > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(232, 244, 241, 0.8)',
                        color: pendingHrApplications > 0 ? '#d97706' : '#087e70',
                      }}
                      aria-hidden="true"
                    >
                      <ClipboardCheck size={16} />
                    </span>
                    <ArrowUpRight size={14} className="hr-activity-item__arrow" />
                  </div>
                  <div className="hr-activity-item__value">{pendingHrApplications}</div>
                  <div className="hr-activity-item__label">Pending Applications</div>
                  <div className="hr-activity-item__subtext">Awaiting HR review</div>
                </Link>
              )}
              {canManageMentoringMatches && (
                <Link
                  to="/mentoring/hr?tab=matching"
                  className="hr-activity-item"
                  title="View trainees awaiting matching"
                >
                  <div className="hr-activity-item__header">
                    <span
                      className="hr-activity-item__icon"
                      style={{
                        backgroundColor: openHrMatchRequests > 0 ? 'rgba(2, 132, 199, 0.12)' : 'rgba(232, 244, 241, 0.8)',
                        color: openHrMatchRequests > 0 ? '#0284c7' : '#087e70',
                      }}
                      aria-hidden="true"
                    >
                      <GitPullRequest size={16} />
                    </span>
                    <ArrowUpRight size={14} className="hr-activity-item__arrow" />
                  </div>
                  <div className="hr-activity-item__value">{openHrMatchRequests}</div>
                  <div className="hr-activity-item__label">Awaiting Matching</div>
                  <div className="hr-activity-item__subtext">Trainees waiting for a mentor</div>
                </Link>
              )}
              {canViewMentorRoster && (
                <Link
                  to="/mentoring/hr?tab=mentor-management"
                  className="hr-activity-item"
                  title="View approved mentor roster"
                >
                  <div className="hr-activity-item__header">
                    <span
                      className="hr-activity-item__icon"
                      style={{
                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                        color: '#059669',
                      }}
                      aria-hidden="true"
                    >
                      <UserRound size={16} />
                    </span>
                    <ArrowUpRight size={14} className="hr-activity-item__arrow" />
                  </div>
                  <div className="hr-activity-item__value">{activeHrMentorCount}</div>
                  <div className="hr-activity-item__label">Approved Mentors</div>
                  <div className="hr-activity-item__subtext">Active approved mentors</div>
                </Link>
              )}
              {canViewMentoringReports && (
                <Link
                  to="/mentoring/hr?tab=analytics"
                  className="hr-activity-item"
                  title="View active mentoring assignments"
                >
                  <div className="hr-activity-item__header">
                    <span
                      className="hr-activity-item__icon"
                      style={{
                        backgroundColor: 'rgba(139, 92, 246, 0.12)',
                        color: '#7c3aed',
                      }}
                      aria-hidden="true"
                    >
                      <HeartHandshake size={16} />
                    </span>
                    <ArrowUpRight size={14} className="hr-activity-item__arrow" />
                  </div>
                  <div className="hr-activity-item__value">
                    {hrOverviewQuery.data?.activeRelationships ?? 0}
                  </div>
                  <div className="hr-activity-item__label">Active Assignments</div>
                  <div className="hr-activity-item__subtext">Current mentoring relationships</div>
                </Link>
              )}
              {canViewMentoringReports && hrOverviewQuery.data && (
                <Link
                  to="/mentoring/hr?tab=analytics"
                  className="hr-activity-item"
                  title="View relationship completion analytics"
                >
                  <div className="hr-activity-item__header">
                    <span
                      className="hr-activity-item__icon"
                      style={{
                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                        color: '#059669',
                      }}
                      aria-hidden="true"
                    >
                      <CheckCircle2 size={16} />
                    </span>
                    <ArrowUpRight size={14} className="hr-activity-item__arrow" />
                  </div>
                  <div className="hr-activity-item__value">
                    {hrOverviewQuery.data.completionRatePct}%
                  </div>
                  <div className="hr-activity-item__label">Relationship Completion</div>
                  <div className="hr-activity-item__subtext">
                    {hrOverviewQuery.data.completedRelationships} completed relationships
                  </div>
                </Link>
              )}
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
