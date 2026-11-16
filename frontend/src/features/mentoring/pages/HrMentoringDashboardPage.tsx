import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award, CheckCircle2, ClipboardCheck, GitPullRequest } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  PermissionGate,
  StatCard,
} from '../../../shared/components/ui';
import { HR_MODULE_PERMISSIONS } from '../../../shared/auth/workspaceResolver';
import { skillsApi } from '../../admin/skills/api/skillsApi';
import { mentorApplicationApi } from '../api/mentorApplicationApi';
import { mentoringMatchApi } from '../api/mentoringMatchApi';
import { mentoringTrainerApi } from '../api/mentoringTrainerApi';
import { HrAnalyticsTab } from '../components/HrAnalyticsTab';
import { HrMatchingTab } from '../components/HrMatchingTab';
import { SkillSupplyDemandCard } from '../components/SkillSupplyDemandCard';
import { TrainerApplicationsTab } from '../components/TrainerApplicationsTab';
import { TrainerRosterTab } from '../components/TrainerRosterTab';

type HrTabKey = 'overview' | 'applications' | 'trainers' | 'matching' | 'analytics';

interface HrTabMeta {
  key: HrTabKey;
  label: string;
  anyPermissions: string[];
}

const HR_TABS: HrTabMeta[] = [
  { key: 'overview', label: 'Mentoring Overview', anyPermissions: HR_MODULE_PERMISSIONS },
  { key: 'applications', label: 'Trainer Applications', anyPermissions: ['TRAINER_APPLICATION_REVIEW'] },
  {
    key: 'trainers',
    label: 'Approved Trainers',
    anyPermissions: ['TRAINER_DIRECT_APPOINT', 'TRAINER_STATUS_MANAGE', 'MENTORING_REPORT_VIEW_ALL'],
  },
  { key: 'matching', label: 'Match Requests & Reassignments', anyPermissions: ['MENTORING_MATCH_MANAGE', 'TRAINER_STATUS_MANAGE'] },
  { key: 'analytics', label: 'Outcomes', anyPermissions: ['MENTORING_REPORT_VIEW_ALL'] },
];

export function HrMentoringDashboardPage() {
  const { hasAnyPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const visibleTabs = useMemo(
    () => HR_TABS.filter((tab) => hasAnyPermission(tab.anyPermissions)),
    [hasAnyPermission]
  );
  const requestedTab = searchParams.get('tab') as HrTabKey | null;
  const activeTab = visibleTabs.find((tab) => tab.key === requestedTab)?.key ?? visibleTabs[0]?.key ?? null;

  const canReviewApplications = hasAnyPermission(['TRAINER_APPLICATION_REVIEW']);
  const canManageTrainers = hasAnyPermission([
    'TRAINER_DIRECT_APPOINT',
    'TRAINER_STATUS_MANAGE',
    'MENTORING_REPORT_VIEW_ALL',
    'MENTORING_MATCH_MANAGE',
  ]);
  const canAppointTrainers = hasAnyPermission(['TRAINER_DIRECT_APPOINT']);
  const canManageMatches = hasAnyPermission(['MENTORING_MATCH_MANAGE']);
  const canViewReports = hasAnyPermission(['MENTORING_REPORT_VIEW_ALL']);

  const applicationsQuery = useQuery({
    queryKey: ['mentoring', 'applications'],
    queryFn: mentorApplicationApi.list,
    enabled: canReviewApplications,
  });
  const trainersQuery = useQuery({
    queryKey: ['mentoring', 'trainers'],
    queryFn: mentoringTrainerApi.listRoster,
    enabled: canManageTrainers,
  });
  const candidatesQuery = useQuery({
    queryKey: ['mentoring', 'appointment-candidates'],
    queryFn: mentoringTrainerApi.listAppointmentCandidates,
    enabled: canAppointTrainers,
  });
  const skillsQuery = useQuery({
    queryKey: ['mentoring', 'active-skills'],
    queryFn: skillsApi.listActive,
    enabled: canAppointTrainers,
  });
  const matchRequestsQuery = useQuery({
    queryKey: ['mentoring', 'hr-match-requests'],
    queryFn: mentoringMatchApi.listForHr,
    enabled: canManageMatches,
  });
  const overviewQuery = useQuery({
    queryKey: ['mentoring', 'hr-overview'],
    queryFn: mentoringTrainerApi.getOverview,
    enabled: canViewReports,
  });

  if (!hasAnyPermission(HR_MODULE_PERMISSIONS) || !activeTab) {
    return (
      <div className="apid-card">
        <EmptyState title="No HR Mentoring Access" description="Your account does not have permission to view HR Mentoring." />
      </div>
    );
  }

  const activeQueries = [
    canReviewApplications ? applicationsQuery : null,
    canManageTrainers ? trainersQuery : null,
    canAppointTrainers ? candidatesQuery : null,
    canAppointTrainers ? skillsQuery : null,
    canManageMatches ? matchRequestsQuery : null,
    canViewReports ? overviewQuery : null,
  ].filter((query): query is NonNullable<typeof query> => query !== null);
  const isLoading = activeQueries.some((query) => query.isLoading);
  const failedQuery = activeQueries.find((query) => query.isError);
  const failedMessage = failedQuery === applicationsQuery
    ? 'Failed to load trainer applications.'
    : failedQuery === trainersQuery
      ? 'Failed to load trainer authorizations.'
      : failedQuery === candidatesQuery
        ? 'Failed to load employee appointment candidates.'
        : failedQuery === skillsQuery
          ? 'Failed to load the active skills catalog.'
          : failedQuery === matchRequestsQuery
            ? 'Failed to load HR matching requests.'
            : 'Failed to load mentoring analytics.';

  if (isLoading) return <LoadingSkeleton rows={6} height={28} />;
  if (failedQuery) {
    return (
      <ErrorState
        message={failedMessage}
        onRetry={() => activeQueries.forEach((query) => void query.refetch())}
      />
    );
  }

  const applications = applicationsQuery.data ?? [];
  const trainers = trainersQuery.data ?? [];
  const overview = overviewQuery.data;
  const matchRequests = matchRequestsQuery.data ?? [];
  const activeTrainers = trainers.filter((trainer) => trainer.status === 'ACTIVE').length;
  const openMatches = matchRequests.filter((request) => request.status === 'OPEN').length;
  const activeSkills = skillsQuery.data ?? [];

  return (
    <div className="boa-stack">
      <PageHeader
        title={visibleTabs.find((tab) => tab.key === activeTab)?.label ?? 'Mentoring'}
        subtitle="Manage trainer applications, authorizations, HR matching, and mentoring outcomes."
        source="live"
      />

      <div className="boa-kpi-grid" style={{ marginBottom: 0 }}>
        {canReviewApplications && (
          <StatCard
            label="Pending Applications"
            value={applications.filter((application) => application.status === 'PENDING').length}
            subtext="Awaiting HR review"
            icon={<ClipboardCheck size={16} />}
          />
        )}
        {canManageTrainers && (
          <StatCard label="Active Trainers" value={overview?.activeTrainers ?? activeTrainers} icon={<Award size={16} />} />
        )}
        {canManageMatches && (
          <StatCard label="Awaiting Matching" value={openMatches} icon={<GitPullRequest size={16} />} />
        )}
        {canViewReports && overview && (
          <StatCard
            label="Relationship Completion"
            value={`${overview.completionRatePct}%`}
            subtext={`${overview.completedRelationships} completed relationships`}
            icon={<CheckCircle2 size={16} />}
          />
        )}
      </div>

      {activeTab === 'overview' && (
        <div className="boa-stack">
          {overview && (
            <SkillSupplyDemandCard
              liveSkillNames={overview.skillSupplyDemand.map((row) => row.skillName)}
              skillSupplyDemand={overview.skillSupplyDemand}
            />
          )}
          {canReviewApplications && (
            <PermissionGate permission="TRAINER_APPLICATION_REVIEW">
              <TrainerApplicationsTab applications={applications} />
            </PermissionGate>
          )}
          {!overview && !canReviewApplications && (
            <EmptyState title="No overview data available" description="Your permissions do not include mentoring reports." />
          )}
        </div>
      )}

      {activeTab === 'applications' && (
        <PermissionGate permission="TRAINER_APPLICATION_REVIEW">
          <TrainerApplicationsTab applications={applications} />
        </PermissionGate>
      )}

      {activeTab === 'trainers' && (
        <PermissionGate anyPermissions={['TRAINER_DIRECT_APPOINT', 'TRAINER_STATUS_MANAGE', 'MENTORING_REPORT_VIEW_ALL']}>
          <TrainerRosterTab
            trainers={trainers}
            candidates={candidatesQuery.data ?? []}
            skills={activeSkills.map((skill) => ({ id: skill.id, name: skill.name }))}
          />
        </PermissionGate>
      )}

      {activeTab === 'matching' && (
        <PermissionGate anyPermissions={['MENTORING_MATCH_MANAGE', 'TRAINER_STATUS_MANAGE']}>
          <HrMatchingTab requests={matchRequests} trainers={trainers} />
        </PermissionGate>
      )}

      {activeTab === 'analytics' && overview && (
        <PermissionGate permission="MENTORING_REPORT_VIEW_ALL">
          <HrAnalyticsTab overview={overview} trainers={trainers} />
        </PermissionGate>
      )}
    </div>
  );
}
