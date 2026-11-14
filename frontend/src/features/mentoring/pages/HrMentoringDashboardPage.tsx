import { useMemo, useState } from 'react';
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
  SvgSparkline,
} from '../../../shared/components/ui';
import { HR_MODULE_PERMISSIONS } from '../../../shared/auth/workspaceResolver';
import type {
  PreviewCertifiedTrainer,
  PreviewMentoringRequest,
} from '../../../shared/mocks/boaPreviewFixtures';
import { mentorApplicationApi } from '../api/mentorApplicationApi';
import { mentorDirectoryApi } from '../api/mentorDirectoryApi';
import { mentoringPreviewAdapter } from '../api/mentoringDashboardApi';
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
  {
    key: 'overview',
    label: 'Mentoring Overview',
    anyPermissions: HR_MODULE_PERMISSIONS,
  },
  {
    key: 'applications',
    label: 'Trainer Applications',
    anyPermissions: ['TRAINER_APPLICATION_REVIEW'],
  },
  {
    key: 'trainers',
    label: 'Approved Trainers',
    anyPermissions: ['TRAINER_DIRECT_APPOINT', 'TRAINER_STATUS_MANAGE', 'MENTORING_REPORT_VIEW_ALL'],
  },
  {
    key: 'matching',
    label: 'Match Requests',
    anyPermissions: ['MENTORING_MATCH_MANAGE'],
  },
  {
    key: 'analytics',
    label: 'Outcomes',
    anyPermissions: ['MENTORING_REPORT_VIEW_ALL'],
  },
];

export function HrMentoringDashboardPage() {
  const { hasAnyPermission } = useAuth();
  const [searchParams] = useSearchParams();

  const [appointedTrainers, setAppointedTrainers] = useState<PreviewCertifiedTrainer[]>([]);
  const [trainerStatusOverrides, setTrainerStatusOverrides] = useState<
    Record<string, PreviewCertifiedTrainer['trainerAuthStatus']>
  >({});
  const [matchedRequests, setMatchedRequests] = useState<Record<string, PreviewMentoringRequest['status']>>({});

  const visibleTabs = useMemo(
    () => HR_TABS.filter((t) => hasAnyPermission(t.anyPermissions)),
    [hasAnyPermission]
  );

  const requestedTab = searchParams.get('tab') as HrTabKey | null;
  const activeTab = visibleTabs.find((t) => t.key === requestedTab)?.key ?? visibleTabs[0]?.key ?? null;

  const overviewQuery = useQuery({
    queryKey: ['mentoring', 'hr-preview'],
    queryFn: mentoringPreviewAdapter.getOverview,
  });

  const canReviewApplications = hasAnyPermission(['TRAINER_APPLICATION_REVIEW']);
  const applicationsQuery = useQuery({
    queryKey: ['mentoring', 'applications'],
    queryFn: mentorApplicationApi.list,
    enabled: canReviewApplications,
  });
  const canViewMentorCount = hasAnyPermission(['MENTORING_REPORT_VIEW_ALL']);
  const mentorCountQuery = useQuery({
    queryKey: ['mentoring', 'active-mentor-count'],
    queryFn: mentorDirectoryApi.countActiveMentors,
    enabled: canViewMentorCount,
  });

  const mergedTrainers = useMemo(
    () =>
      [...appointedTrainers, ...(overviewQuery.data?.trainers ?? [])].map((tr) => {
        const overrideStatus = trainerStatusOverrides[tr.id];
        return overrideStatus ? { ...tr, trainerAuthStatus: overrideStatus } : tr;
      }),
    [overviewQuery.data, appointedTrainers, trainerStatusOverrides]
  );

  const mergedRequests = useMemo(
    () =>
      (overviewQuery.data?.requests ?? []).map((req) => {
        const nextStatus = matchedRequests[req.id];
        return nextStatus ? { ...req, status: nextStatus } : req;
      }),
    [overviewQuery.data, matchedRequests]
  );

  if (!hasAnyPermission(HR_MODULE_PERMISSIONS) || !activeTab) {
    return (
      <div className="apid-card">
        <EmptyState
          title="No HR Mentoring Access"
          description="Your account does not have permission to view HR Mentoring."
        />
      </div>
    );
  }

  const pendingApps = (applicationsQuery.data ?? []).filter((app) => app.status === 'PENDING').length;
  const awaitingMatch = mergedRequests.filter((r) => r.status === 'AWAITING_HR_MATCH').length;

  const activeTabMeta = visibleTabs.find((t) => t.key === activeTab) ?? visibleTabs[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <PageHeader
        title={activeTabMeta.label}
        subtitle="Review trainer applications, manage trainer availability, and match trainees with approved trainers."
        source="preview"
      />

      {overviewQuery.isLoading ||
      (canReviewApplications && applicationsQuery.isLoading) ||
      (canViewMentorCount && mentorCountQuery.isLoading) ? (
        <LoadingSkeleton rows={6} height={28} />
      ) : overviewQuery.isError ||
        !overviewQuery.data ||
        (canReviewApplications && applicationsQuery.isError) ||
        (canViewMentorCount && mentorCountQuery.isError) ? (
        <ErrorState
          message={
            canViewMentorCount && mentorCountQuery.isError
              ? 'Failed to load approved mentor count.'
              : canReviewApplications && applicationsQuery.isError
              ? 'Failed to load mentor applications.'
              : 'Failed to load HR Mentoring preview data.'
          }
          onRetry={() => {
            void overviewQuery.refetch();
            if (canReviewApplications) void applicationsQuery.refetch();
            if (canViewMentorCount) void mentorCountQuery.refetch();
          }}
        />
      ) : (
        <>
          <div className="boa-kpi-grid" style={{ marginBottom: 0 }}>
            {canReviewApplications && (
              <StatCard
                label="Pending Applications"
                value={pendingApps}
                subtext="Awaiting HR certificate review"
                badge={pendingApps > 0 ? 'REVIEW QUEUE' : 'CLEAR'}
                badgeTone={pendingApps > 0 ? 'warn' : 'ok'}
                icon={<ClipboardCheck size={16} />}
              />
            )}
            {canViewMentorCount && (
              <StatCard
                label="Approved Mentors"
                value={mentorCountQuery.data ?? 0}
                icon={<Award size={16} />}
              />
            )}
            <StatCard
              label="Awaiting Matching"
              value={awaitingMatch}
              subtext={`${overviewQuery.data.liveSkillNames.length} active skills available`}
              badge={awaitingMatch > 0 ? 'PENDING' : 'MATCHED'}
              badgeTone={awaitingMatch > 0 ? 'info' : 'ok'}
              icon={<GitPullRequest size={16} />}
            />
            <StatCard
              label="Program Completion"
              value={`${overviewQuery.data.completionRatePct}%`}
              subtext={`Avg feedback ${overviewQuery.data.avgCompletionRating.toFixed(1)}★`}
              badge="OUTCOMES"
              badgeTone="ok"
              icon={<CheckCircle2 size={16} />}
              sparkline={<SvgSparkline values={[78, 82, 85, 89, 91]} title="Completion rate trend" />}
            />
          </div>

          {activeTab === 'overview' && (
            <div className="boa-stack">
              <SkillSupplyDemandCard
                liveSkillNames={overviewQuery.data.liveSkillNames}
                skillSupplyDemand={overviewQuery.data.skillSupplyDemand}
              />
              <PermissionGate permission="TRAINER_APPLICATION_REVIEW">
                <TrainerApplicationsTab
                  applications={applicationsQuery.data ?? []}
                />
              </PermissionGate>
            </div>
          )}

          {activeTab === 'applications' && (
            <PermissionGate permission="TRAINER_APPLICATION_REVIEW">
              <TrainerApplicationsTab
                applications={applicationsQuery.data ?? []}
              />
            </PermissionGate>
          )}

          {activeTab === 'trainers' && (
            <PermissionGate
              anyPermissions={[
                'TRAINER_DIRECT_APPOINT',
                'TRAINER_STATUS_MANAGE',
                'MENTORING_REPORT_VIEW_ALL',
              ]}
            >
              <TrainerRosterTab
                trainers={mergedTrainers}
                liveSkillNames={overviewQuery.data.liveSkillNames}
                onTrainerAppointed={(tr) => setAppointedTrainers((prev) => [tr, ...prev])}
                onTrainerStatusChanged={(id, nextStatus) =>
                  setTrainerStatusOverrides((prev) => ({ ...prev, [id]: nextStatus }))
                }
              />
            </PermissionGate>
          )}

          {activeTab === 'matching' && (
            <PermissionGate permission="MENTORING_MATCH_MANAGE">
              <HrMatchingTab
                requests={mergedRequests}
                trainers={mergedTrainers}
                onMatched={(reqId) =>
                  setMatchedRequests((prev) => ({ ...prev, [reqId]: 'MATCHED' }))
                }
              />
            </PermissionGate>
          )}

          {activeTab === 'analytics' && (
            <PermissionGate permission="MENTORING_REPORT_VIEW_ALL">
              <HrAnalyticsTab
                trainers={mergedTrainers}
                completionRatePct={overviewQuery.data.completionRatePct}
                avgCompletionRating={overviewQuery.data.avgCompletionRating}
              />
            </PermissionGate>
          )}
        </>
      )}
    </div>
  );
}

