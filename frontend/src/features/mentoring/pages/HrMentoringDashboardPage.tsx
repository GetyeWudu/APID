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
  PreviewTrainerApplication,
} from '../../../shared/mocks/boaPreviewFixtures';
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
  const [searchParams, setSearchParams] = useSearchParams();

  // Client-only preview session state overrides
  const [appOverrides, setAppOverrides] = useState<
    Record<string, { status: PreviewTrainerApplication['status']; reviewReason?: string }>
  >({});
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

  const mergedApps = useMemo(
    () =>
      (overviewQuery.data?.applications ?? []).map((app) => {
        const patch = appOverrides[app.id];
        return patch ? { ...app, status: patch.status, reviewReason: patch.reviewReason } : app;
      }),
    [overviewQuery.data, appOverrides]
  );

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

  const selectTab = (key: HrTabKey) => {
    if (key === 'overview') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: key });
    }
  };

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

  const pendingApps = mergedApps.filter((a) => a.status === 'PENDING_REVIEW').length;
  const activeTrainers = mergedTrainers.filter(
    (t) => t.employmentStatus === 'ACTIVE' && t.trainerAuthStatus === 'ACTIVE'
  ).length;
  const awaitingMatch = mergedRequests.filter((r) => r.status === 'AWAITING_HR_MATCH').length;
  const activeTabMeta = visibleTabs.find((t) => t.key === activeTab) ?? visibleTabs[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <PageHeader
        title={activeTabMeta.label}
        subtitle="Review trainer applications, manage trainer availability, and match trainees with approved trainers."
        source="preview"
      />

      <div className="apid-card" style={{ padding: '0.75rem 1rem' }}>
        <div className="apid-tabs" role="tablist" aria-label="HR Mentoring sections">
          {visibleTabs.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                className={`apid-tab ${active ? 'active' : ''}`}
                onClick={() => selectTab(tab.key)}
              >
                {tab.label}
                {tab.key === 'applications' && pendingApps > 0 && ` (${pendingApps})`}
                {tab.key === 'matching' && awaitingMatch > 0 && ` (${awaitingMatch})`}
              </button>
            );
          })}
        </div>
      </div>

      {overviewQuery.isLoading ? (
        <LoadingSkeleton rows={6} height={28} />
      ) : overviewQuery.isError || !overviewQuery.data ? (
        <ErrorState
          message="Failed to load HR Mentoring preview data."
          onRetry={() => void overviewQuery.refetch()}
        />
      ) : (
        <>
          <div className="boa-kpi-grid" style={{ marginBottom: 0 }}>
            <StatCard
              label="Pending Applications"
              value={pendingApps}
              subtext="Awaiting HR certificate review"
              badge={pendingApps > 0 ? 'REVIEW QUEUE' : 'CLEAR'}
              badgeTone={pendingApps > 0 ? 'warn' : 'ok'}
              icon={<ClipboardCheck size={16} />}
            />
            <StatCard
              label="Active Trainers"
              value={activeTrainers}
              subtext={`${mergedTrainers.length} total in trainer directory`}
              badge="CERTIFIED"
              badgeTone="ok"
              icon={<Award size={16} />}
            />
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
                  applications={mergedApps}
                  onApplicationDecided={(appId, decision, reviewReason) =>
                    setAppOverrides((prev) => ({
                      ...prev,
                      [appId]: { status: decision, reviewReason },
                    }))
                  }
                />
              </PermissionGate>
            </div>
          )}

          {activeTab === 'applications' && (
            <PermissionGate permission="TRAINER_APPLICATION_REVIEW">
              <TrainerApplicationsTab
                applications={mergedApps}
                onApplicationDecided={(appId, decision, reviewReason) =>
                  setAppOverrides((prev) => ({
                    ...prev,
                    [appId]: { status: decision, reviewReason },
                  }))
                }
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

