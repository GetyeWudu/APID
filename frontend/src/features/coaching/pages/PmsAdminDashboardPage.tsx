import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, CheckCircle2, ClipboardList, Users } from 'lucide-react';
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
import { PMS_MODULE_PERMISSIONS } from '../../../shared/auth/workspaceResolver';
import type {
  PreviewPmsAssignment,
  PreviewSkillDevRequest,
} from '../../../shared/mocks/boaPreviewFixtures';
import { coachingPreviewAdapter } from '../api/coachingDashboardApi';
import type { PmsDashboardFilters } from '../api/coachingDashboardTypes';
import { PmsAssignmentsTab } from '../components/PmsAssignmentsTab';
import { PmsReportsTab } from '../components/PmsReportsTab';
import { PmsUploadPreviewTab } from '../components/PmsUploadPreviewTab';
import { RatingDistributionCard } from '../components/RatingDistributionCard';
import { SkillDevApprovalTab } from '../components/SkillDevApprovalTab';
import {
  classifyRating,
  isMandatoryCoachingRounded,
} from '../utils/ratingClassification';

type PmsTabKey = 'overview' | 'uploads' | 'approvals' | 'reports';

interface PmsTabMeta {
  key: PmsTabKey;
  label: string;
  anyPermissions: string[];
}

const PMS_TABS: PmsTabMeta[] = [
  {
    key: 'overview',
    label: 'Coaching Overview',
    anyPermissions: [
      'COACHING_ASSIGNMENT_VIEW_ALL',
      'COACHING_COACH_REPLACE',
      'COACHING_INITIATIVE_CREATE',
      'COACHING_REPORT_VIEW_ALL',
    ],
  },
  {
    key: 'uploads',
    label: 'Appraisal Upload',
    anyPermissions: ['PMS_REPORT_UPLOAD'],
  },
  {
    key: 'approvals',
    label: 'Skill Requests',
    anyPermissions: ['COACHING_REQUEST_APPROVE'],
  },
  {
    key: 'reports',
    label: 'Reports & Export',
    anyPermissions: ['COACHING_REPORT_VIEW_ALL'],
  },
];

export function PmsAdminDashboardPage() {
  const { hasAnyPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<PmsDashboardFilters>({
    performanceQuarter: 'FY26/27 Q1',
    coachingQuarter: 'FY26/27 Q2',
    directorate: 'ALL',
  });

  // Session-only preview mutations merged on top of adapter snapshot
  const [coachOverrides, setCoachOverrides] = useState<
    Record<string, { coachName: string; entries: PreviewPmsAssignment['coachHistory'] }>
  >({});
  const [extraInitiatives, setExtraInitiatives] = useState<PreviewPmsAssignment[]>([]);
  const [requestOverrides, setRequestOverrides] = useState<
    Record<string, { status: PreviewSkillDevRequest['status']; reviewReason?: string }>
  >({});

  const visibleTabs = useMemo(
    () => PMS_TABS.filter((t) => hasAnyPermission(t.anyPermissions)),
    [hasAnyPermission]
  );

  const requestedTab = searchParams.get('tab') as PmsTabKey | null;
  const activeTab = visibleTabs.find((t) => t.key === requestedTab)?.key ?? visibleTabs[0]?.key ?? null;

  const overviewQuery = useQuery({
    queryKey: ['coaching', 'pms-preview', filters],
    queryFn: () => coachingPreviewAdapter.getOverview(filters),
  });

  const mergedAssignments = useMemo(() => {
    const base = overviewQuery.data?.assignments ?? [];
    const combined = [...extraInitiatives, ...base];
    return combined.map((item) => {
      const patch = coachOverrides[item.id];
      if (!patch) return item;
      return {
        ...item,
        coachName: patch.coachName,
        status: item.status === 'PENDING_COACH_ASSIGNMENT' ? 'ACTIVE' : item.status,
        coachHistory: [...item.coachHistory, ...patch.entries],
      };
    });
  }, [overviewQuery.data, extraInitiatives, coachOverrides]);

  const mergedRequests = useMemo(() => {
    const base = overviewQuery.data?.requests ?? [];
    return base.map((req) => {
      const patch = requestOverrides[req.id];
      return patch ? { ...req, status: patch.status, reviewReason: patch.reviewReason } : req;
    });
  }, [overviewQuery.data, requestOverrides]);

  const selectTab = (key: PmsTabKey) => {
    if (key === 'overview') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: key });
    }
  };

  if (!hasAnyPermission(PMS_MODULE_PERMISSIONS) || !activeTab) {
    return (
      <div className="apid-card">
        <EmptyState
          title="No PMS Coaching Access"
          description="Your account does not have permission to view PMS Coaching."
        />
      </div>
    );
  }

  const belowThreeTotal =
    overviewQuery.data?.ratingSeries.filter((r) => isMandatoryCoachingRounded(r)).length ?? 0;

  const grade3PassingCount =
    overviewQuery.data?.ratingSeries.filter((r) => classifyRating(r) === 'GRADE_3_MEETS_STANDARD').length ?? 0;

  const pendingApprovalsCount = mergedRequests.filter((r) => r.status === 'PENDING_APPROVAL').length;
  const overdueCount = mergedAssignments.reduce((acc, a) => acc + a.overdueReports, 0);

  const activeTabMeta = visibleTabs.find((t) => t.key === activeTab) ?? visibleTabs[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <PageHeader
        title={activeTabMeta.label}
        subtitle="Review appraisal ratings (Rounded < 3 requires coaching), manage assigned coaches, and approve skill requests."
        source="preview"
      />

      <div className="apid-alert apid-alert-info">
        <strong>Quarter Schedule:</strong> Appraisals from{' '}
        <strong>{filters.performanceQuarter}</strong> determine coaching cohorts for{' '}
        <strong>{filters.coachingQuarter}</strong>. Showing sample data for preview.
      </div>

      {/* Filters bar */}
      <div className="apid-card" style={{ padding: '0.85rem 1rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
            <div className="apid-field" style={{ minWidth: 170, marginBottom: 0 }}>
              <label htmlFor="pms-perf-q">Performance Quarter</label>
              <select
                id="pms-perf-q"
                className="apid-input"
                value={filters.performanceQuarter}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, performanceQuarter: e.target.value }))
                }
              >
                <option value="FY26/27 Q1">FY26/27 Q1</option>
                <option value="ALL">All Performance Quarters</option>
              </select>
            </div>
            <div className="apid-field" style={{ minWidth: 170, marginBottom: 0 }}>
              <label htmlFor="pms-coach-q">Coaching Quarter</label>
              <select
                id="pms-coach-q"
                className="apid-input"
                value={filters.coachingQuarter}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, coachingQuarter: e.target.value }))
                }
              >
                <option value="FY26/27 Q2">FY26/27 Q2</option>
                <option value="ALL">All Coaching Quarters</option>
              </select>
            </div>
            <div className="apid-field" style={{ minWidth: 210, marginBottom: 0 }}>
              <label htmlFor="pms-dir-filter">Directorate</label>
              <select
                id="pms-dir-filter"
                className="apid-input"
                value={filters.directorate}
                onChange={(e) => setFilters((f) => ({ ...f, directorate: e.target.value }))}
              >
                <option value="ALL">All Bank Directorates</option>
                <option value="Retail & Branch Banking">Retail &amp; Branch Banking</option>
                <option value="Technology & Digital Banking">Technology &amp; Digital Banking</option>
                <option value="Credit & Risk Management">Credit &amp; Risk Management</option>
                <option value="Operations & Treasury">Operations &amp; Treasury</option>
                <option value="HR & Corporate Services">HR &amp; Corporate Services</option>
              </select>
            </div>
          </div>

          <div className="apid-tabs" role="tablist" aria-label="PMS Coaching sections" style={{ borderBottom: 'none', paddingBottom: 0 }}>
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
                  {tab.key === 'approvals' && pendingApprovalsCount > 0 && ` (${pendingApprovalsCount})`}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {overviewQuery.isLoading ? (
        <LoadingSkeleton rows={6} height={28} />
      ) : overviewQuery.isError || !overviewQuery.data ? (
        <ErrorState
          message="Failed to load PMS coaching preview snapshot."
          onRetry={() => void overviewQuery.refetch()}
        />
      ) : (
        <>
          <div className="boa-kpi-grid" style={{ marginBottom: 0 }}>
            <StatCard
              label="Evaluated Staff (Sample)"
              value={overviewQuery.data.evaluatedEmployees}
              subtext={`${belowThreeTotal} with Rounded < 3`}
              badge={`${grade3PassingCount} rounded = 3`}
              badgeTone="info"
              icon={<Users size={16} />}
              sparkline={
                <SvgSparkline values={[18, 22, 19, 25, 24, 28]} title="Evaluated staff trend" />
              }
            />
            <StatCard
              label="Active Cohorts Shown"
              value={mergedAssignments.length}
              subtext={`PMS ${filters.performanceQuarter} → Coach ${filters.coachingQuarter}`}
              badge="IN COHORT"
              badgeTone="info"
              icon={<BarChart3 size={16} />}
            />
            <StatCard
              label="Pending Skill-Dev Queue"
              value={pendingApprovalsCount}
              subtext="Manager requests awaiting review"
              badge={pendingApprovalsCount > 0 ? 'ACTION NEEDED' : 'CLEAR'}
              badgeTone={pendingApprovalsCount > 0 ? 'warn' : 'ok'}
              icon={<ClipboardList size={16} />}
            />
            <StatCard
              label="Overdue Session Reports"
              value={overdueCount}
              subtext="Flagged across active assignments"
              badge={overdueCount > 0 ? 'AT RISK' : 'ON TRACK'}
              badgeTone={overdueCount > 0 ? 'err' : 'ok'}
              icon={overdueCount > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            />
          </div>

          {activeTab === 'overview' && (
            <div className="boa-stack">
              <RatingDistributionCard ratingSeries={overviewQuery.data.ratingSeries} />
              <PermissionGate
                anyPermissions={[
                  'COACHING_ASSIGNMENT_VIEW_ALL',
                  'COACHING_COACH_REPLACE',
                  'COACHING_INITIATIVE_CREATE',
                  'COACHING_REPORT_VIEW_ALL',
                ]}
              >
                <PmsAssignmentsTab
                  assignments={mergedAssignments}
                  onAssignmentCoachUpdated={(id, nextCoach, reason) =>
                    setCoachOverrides((prev) => ({
                      ...prev,
                      [id]: {
                        coachName: nextCoach,
                        entries: [
                          ...(prev[id]?.entries ?? []),
                          {
                            date: new Date().toISOString().slice(0, 10),
                            fromCoach: prev[id]?.coachName ?? 'Previous Coach',
                            toCoach: nextCoach,
                            reason,
                          },
                        ],
                      },
                    }))
                  }
                  onCreateInitiative={(created) =>
                    setExtraInitiatives((prev) => [created, ...prev])
                  }
                />
              </PermissionGate>
            </div>
          )}

          {activeTab === 'uploads' && (
            <PermissionGate permission="PMS_REPORT_UPLOAD">
              <PmsUploadPreviewTab />
            </PermissionGate>
          )}

          {activeTab === 'approvals' && (
            <PermissionGate permission="COACHING_REQUEST_APPROVE">
              <SkillDevApprovalTab
                requests={mergedRequests}
                onRequestUpdated={(id, status, reviewReason) =>
                  setRequestOverrides((prev) => ({
                    ...prev,
                    [id]: { status, reviewReason },
                  }))
                }
              />
            </PermissionGate>
          )}

          {activeTab === 'reports' && (
            <PermissionGate permission="COACHING_REPORT_VIEW_ALL">
              <PmsReportsTab
                directorateCounts={overviewQuery.data.directorateCounts}
                assignments={mergedAssignments}
              />
            </PermissionGate>
          )}
        </>
      )}
    </div>
  );
}

