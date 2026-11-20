import { useMemo, useState } from 'react';
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

type HrTabKey = 'applications' | 'mentor-management' | 'direct-matching' | 'matching' | 'analytics';
type MentorManagementSection = 'profile-updates' | 'removal-requests' | 'access';

interface HrTabMeta {
  key: HrTabKey;
  label: string;
  anyPermissions: string[];
}

const HR_TABS: HrTabMeta[] = [
  { key: 'applications', label: 'Trainer Applications', anyPermissions: ['TRAINER_APPLICATION_REVIEW'] },
  {
    key: 'mentor-management',
    label: 'Mentor Management',
    anyPermissions: ['TRAINER_STATUS_MANAGE', 'TRAINER_APPLICATION_REVIEW'],
  },
  { key: 'direct-matching', label: 'Match Mentor & Trainee', anyPermissions: ['MENTORING_MATCH_MANAGE'] },
  { key: 'matching', label: 'Match Requests & Reassignments', anyPermissions: ['MENTORING_MATCH_MANAGE', 'TRAINER_STATUS_MANAGE'] },
  { key: 'analytics', label: 'Outcomes', anyPermissions: ['MENTORING_REPORT_VIEW_ALL'] },
];

const MENTOR_MANAGEMENT_SECTIONS: Array<{
  key: MentorManagementSection;
  label: string;
  anyPermissions: string[];
}> = [
  { key: 'profile-updates', label: 'Update request management', anyPermissions: ['TRAINER_APPLICATION_REVIEW'] },
  { key: 'removal-requests', label: 'Removal requests', anyPermissions: ['TRAINER_STATUS_MANAGE'] },
  { key: 'access', label: 'Manage access', anyPermissions: ['TRAINER_STATUS_MANAGE'] },
];

export function HrMentoringDashboardPage() {
  const { hasAnyPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const [selectedManagementSection, setSelectedManagementSection] =
    useState<MentorManagementSection>('profile-updates');
  const visibleTabs = useMemo(
    () => HR_TABS.filter((tab) => hasAnyPermission(tab.anyPermissions)),
    [hasAnyPermission]
  );
  const requestedTabValue = searchParams.get('tab');
  const requestedTab = (requestedTabValue === 'badge-removal-requests'
    ? 'mentor-management'
    : requestedTabValue) as HrTabKey | null;
  const activeTab = visibleTabs.find((tab) => tab.key === requestedTab)?.key ?? visibleTabs[0]?.key ?? null;

  const canReviewApplications = hasAnyPermission(['TRAINER_APPLICATION_REVIEW']);
  const canManageTrainerStatus = hasAnyPermission(['TRAINER_STATUS_MANAGE']);
  const canManageMatches = hasAnyPermission(['MENTORING_MATCH_MANAGE']);
  const canViewReports = hasAnyPermission(['MENTORING_REPORT_VIEW_ALL']);
  const visibleManagementSections = MENTOR_MANAGEMENT_SECTIONS
    .filter((section) => hasAnyPermission(section.anyPermissions));
  const activeManagementSection = visibleManagementSections.find(
    (section) => section.key === selectedManagementSection
  )?.key ?? visibleManagementSections[0]?.key ?? null;
  const canLoadTrainers = (
    activeTab === 'matching'
      && hasAnyPermission(['TRAINER_STATUS_MANAGE', 'MENTORING_MATCH_MANAGE'])
  ) || (activeTab === 'direct-matching' && canManageMatches)
    || (activeTab === 'mentor-management' && activeManagementSection === 'access' && canManageTrainerStatus)
    || (activeTab === 'analytics' && canViewReports);

  const applicationsQuery = useQuery({
    queryKey: ['mentoring', 'applications'],
    queryFn: mentorApplicationApi.list,
    enabled: canReviewApplications && (
      activeTab === 'applications'
      || (activeTab === 'mentor-management' && activeManagementSection === 'profile-updates')
    ),
  });
  const trainersQuery = useQuery({
    queryKey: ['mentoring', 'trainers'],
    queryFn: mentoringTrainerApi.listRoster,
    enabled: canLoadTrainers,
  });
  const matchingEmployeesQuery = useQuery({
    queryKey: ['mentoring', 'matching-employees'],
    queryFn: mentoringTrainerApi.listMatchingEmployees,
    enabled: canManageMatches && activeTab === 'direct-matching',
  });
  const matchRequestsQuery = useQuery({
    queryKey: ['mentoring', 'hr-match-requests'],
    queryFn: mentoringMatchApi.listForHr,
    enabled: canManageMatches && activeTab === 'matching',
  });
  const badgeRemovalRequestsQuery = useQuery({
    queryKey: ['mentoring', 'badge-removal-requests'],
    queryFn: mentoringTrainerApi.listBadgeRemovalRequests,
    enabled: canManageTrainerStatus
      && activeTab === 'mentor-management'
      && activeManagementSection === 'removal-requests',
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
    canReviewApplications && (
      activeTab === 'applications'
      || (activeTab === 'mentor-management' && activeManagementSection === 'profile-updates')
    ) ? applicationsQuery : null,
    canLoadTrainers ? trainersQuery : null,
    canManageMatches && activeTab === 'direct-matching' ? matchingEmployeesQuery : null,
    canManageMatches && activeTab === 'matching' ? matchRequestsQuery : null,
    canManageTrainerStatus && activeTab === 'mentor-management'
      && activeManagementSection === 'removal-requests'
      ? badgeRemovalRequestsQuery
      : null,
    canViewReports && activeTab === 'analytics' ? overviewQuery : null,
  ].filter((query): query is NonNullable<typeof query> => query !== null);
  const isLoading = activeQueries.some((query) => query.isLoading);
  const failedQuery = activeQueries.find((query) => query.isError);
  const failedMessage = failedQuery === applicationsQuery
    ? 'Failed to load trainer applications.'
    : failedQuery === trainersQuery
      ? 'Failed to load trainer authorizations.'
      : failedQuery === matchingEmployeesQuery
        ? 'Failed to load active matching employees.'
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

  return (
    <div className="boa-stack mentoring-dashboard">
      <PageHeader
        title={visibleTabs.find((tab) => tab.key === activeTab)?.label ?? 'Mentoring'}
        subtitle={activeTab === 'mentor-management'
          ? 'Review profile updates, removal requests, and mentor access.'
          : 'Manage trainer applications, HR matching, and mentoring outcomes.'}
        source="live"
      />

      {activeTab === 'applications' && (
        <PermissionGate permission="TRAINER_APPLICATION_REVIEW">
          <TrainerApplicationsTab
            applications={applications.filter((application) => application.applicationType !== 'PROFILE_UPDATE')}
          />
        </PermissionGate>
      )}

      {activeTab === 'mentor-management' && activeManagementSection && (
        <div className="boa-stack">
          <div
            role="tablist"
            aria-label="Mentor Management sections"
            style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
          >
            {visibleManagementSections.map((section) => (
              <button
                key={section.key}
                type="button"
                role="tab"
                aria-selected={activeManagementSection === section.key}
                className={`apid-btn ${activeManagementSection === section.key ? 'apid-btn-primary' : 'apid-btn-outline'}`}
                onClick={() => setSelectedManagementSection(section.key)}
              >
                {section.label}
              </button>
            ))}
          </div>
          {activeManagementSection === 'profile-updates' && canReviewApplications && (
            <PermissionGate permission="TRAINER_APPLICATION_REVIEW">
              <TrainerApplicationsTab
                applications={applications}
                mode="profile-updates"
              />
            </PermissionGate>
          )}
          {activeManagementSection === 'removal-requests' && canManageTrainerStatus && (
            <PermissionGate permission="TRAINER_STATUS_MANAGE">
              <TrainerBadgeRemovalRequestsTab requests={badgeRemovalRequestsQuery.data ?? []} />
            </PermissionGate>
          )}
          {activeManagementSection === 'access' && canManageTrainerStatus && (
            <PermissionGate permission="TRAINER_STATUS_MANAGE">
              <TrainerRosterTab trainers={trainers} candidates={[]} skills={[]} mode="access" />
            </PermissionGate>
          )}
        </div>
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
