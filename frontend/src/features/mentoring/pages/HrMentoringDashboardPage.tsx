import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  PermissionGate,
} from '../../../shared/components/ui';
import { HR_MODULE_PERMISSIONS } from '../../../shared/auth/workspaceResolver';
import { skillsApi } from '../../admin/skills/api/skillsApi';
import { mentorApplicationApi } from '../api/mentorApplicationApi';
import { mentoringMatchApi } from '../api/mentoringMatchApi';
import { mentoringTrainerApi } from '../api/mentoringTrainerApi';
import { HrAnalyticsTab } from '../components/HrAnalyticsTab';
import { TrainerBadgeRemovalRequestsTab } from '../components/TrainerBadgeRemovalRequestsTab';
import { HrDirectMatchingTab } from '../components/HrDirectMatchingTab';
import { HrMatchingTab } from '../components/HrMatchingTab';
import { TrainerApplicationsTab } from '../components/TrainerApplicationsTab';
import { TrainerRosterTab } from '../components/TrainerRosterTab';
import './MentoringDashboard.css';

type HrTabKey = 'applications' | 'trainers' | 'badge-removal-requests' | 'direct-matching' | 'matching' | 'analytics';

interface HrTabMeta {
  key: HrTabKey;
  label: string;
  anyPermissions: string[];
}

const HR_TABS: HrTabMeta[] = [
  { key: 'applications', label: 'Trainer Applications', anyPermissions: ['TRAINER_APPLICATION_REVIEW'] },
  {
    key: 'trainers',
    label: 'Approved Trainers',
    anyPermissions: ['TRAINER_DIRECT_APPOINT', 'TRAINER_STATUS_MANAGE', 'MENTORING_REPORT_VIEW_ALL'],
  },
  { key: 'badge-removal-requests', label: 'Badge Removal Requests', anyPermissions: ['TRAINER_STATUS_MANAGE'] },
  { key: 'direct-matching', label: 'Match Mentor & Trainee', anyPermissions: ['MENTORING_MATCH_MANAGE'] },
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
  const canManageTrainerStatus = hasAnyPermission(['TRAINER_STATUS_MANAGE']);
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
  const matchingEmployeesQuery = useQuery({
    queryKey: ['mentoring', 'matching-employees'],
    queryFn: mentoringTrainerApi.listMatchingEmployees,
    enabled: canManageMatches,
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
  const badgeRemovalRequestsQuery = useQuery({
    queryKey: ['mentoring', 'badge-removal-requests'],
    queryFn: mentoringTrainerApi.listBadgeRemovalRequests,
    enabled: canManageTrainerStatus && activeTab === 'badge-removal-requests',
  });
  const overviewQuery = useQuery({
    queryKey: ['mentoring', 'hr-overview'],
    queryFn: mentoringTrainerApi.getOverview,
    enabled: canViewReports && activeTab === 'analytics',
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
    canManageMatches ? matchingEmployeesQuery : null,
    canAppointTrainers ? skillsQuery : null,
    canManageMatches ? matchRequestsQuery : null,
    canManageTrainerStatus && activeTab === 'badge-removal-requests' ? badgeRemovalRequestsQuery : null,
    canViewReports && activeTab === 'analytics' ? overviewQuery : null,
  ].filter((query): query is NonNullable<typeof query> => query !== null);
  const isLoading = activeQueries.some((query) => query.isLoading);
  const failedQuery = activeQueries.find((query) => query.isError);
  const failedMessage = failedQuery === applicationsQuery
    ? 'Failed to load trainer applications.'
    : failedQuery === trainersQuery
      ? 'Failed to load trainer authorizations.'
      : failedQuery === candidatesQuery
        ? 'Failed to load employee appointment candidates.'
        : failedQuery === matchingEmployeesQuery
          ? 'Failed to load active matching employees.'
          : failedQuery === skillsQuery
            ? 'Failed to load the active skills catalog.'
            : failedQuery === matchRequestsQuery
              ? 'Failed to load HR matching requests.'
              : failedQuery === badgeRemovalRequestsQuery
                ? 'Failed to load mentor badge removal requests.'
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
  const activeSkills = skillsQuery.data ?? [];

  return (
    <div className="boa-stack mentoring-dashboard">
      <PageHeader
        title={visibleTabs.find((tab) => tab.key === activeTab)?.label ?? 'Mentoring'}
        subtitle="Manage trainer applications, authorizations, HR matching, and mentoring outcomes."
        source="live"
      />

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

      {activeTab === 'badge-removal-requests' && (
        <PermissionGate permission="TRAINER_STATUS_MANAGE">
          <TrainerBadgeRemovalRequestsTab requests={badgeRemovalRequestsQuery.data ?? []} />
        </PermissionGate>
      )}

      {activeTab === 'matching' && (
        <PermissionGate anyPermissions={['MENTORING_MATCH_MANAGE', 'TRAINER_STATUS_MANAGE']}>
          <HrMatchingTab requests={matchRequests} trainers={trainers} />
        </PermissionGate>
      )}

      {activeTab === 'direct-matching' && (
        <PermissionGate permission="MENTORING_MATCH_MANAGE">
          <HrDirectMatchingTab
            employees={matchingEmployeesQuery.data ?? []}
            trainers={trainers}
          />
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
