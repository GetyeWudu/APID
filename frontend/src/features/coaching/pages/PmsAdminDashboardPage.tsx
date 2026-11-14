import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, CheckCircle2, ClipboardList, Sliders, Users } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { coachingPreviewAdapter } from '../api/coachingDashboardApi';
import type { PmsDashboardFilters } from '../api/coachingDashboardTypes';
import { PmsAssignmentsTab } from '../components/PmsAssignmentsTab';
import { PmsReportsTab } from '../components/PmsReportsTab';
import { PmsUploadPreviewTab } from '../components/PmsUploadPreviewTab';
import { RatingDistributionCard } from '../components/RatingDistributionCard';
import { SkillDevApprovalTab } from '../components/SkillDevApprovalTab';
import { CoachingRulesTab } from '../components/CoachingRulesTab';
import { skillCoachingRequestApi } from '../api/skillCoachingRequestApi';
import {
  classifyRating,
  isMandatoryCoachingRounded,
} from '../utils/ratingClassification';

type PmsTabKey = 'overview' | 'uploads' | 'approvals' | 'reports' | 'policies';

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
  {
    key: 'policies',
    label: 'Coaching Rules & Policies',
    anyPermissions: [
      'COACHING_ASSIGNMENT_VIEW_ALL',
      'COACHING_INITIATIVE_CREATE',
      'ADMIN_PORTAL_ACCESS',
      'PMS_ADMIN_ACCESS',
    ],
  },
];

export function PmsAdminDashboardPage() {
  const { hasAnyPermission } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [filters, setFilters] = useState<PmsDashboardFilters>({
    performanceQuarter: 'FY26/27 Q1',
    coachingQuarter: 'FY26/27 Q2',
    directorate: 'ALL',
  });

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

  const mergedAssignments = overviewQuery.data?.assignments ?? [];
  const mergedRequests = overviewQuery.data?.requests ?? [];

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

  const livePendingRequestsQuery = useQuery({
    queryKey: ['coaching', 'skill-requests', 'pending'],
    queryFn: skillCoachingRequestApi.getPendingRequests,
    enabled: hasAnyPermission(['COACHING_REQUEST_APPROVE']),
  });

  const pendingApprovalsCount = Array.isArray(livePendingRequestsQuery.data)
    ? livePendingRequestsQuery.data.length
    : mergedRequests.filter((r) => r.status === 'PENDING_APPROVAL').length;
  const overdueCount = mergedAssignments.reduce((acc, a) => acc + a.overdueReports, 0);

  const activeTabMeta = visibleTabs.find((t) => t.key === activeTab) ?? visibleTabs[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <PageHeader
        title={activeTabMeta.label}
        subtitle={
          activeTab === 'policies'
            ? 'Configure minimum sessions, early video call access windows, and reschedule limits for the entire bank.'
            : 'Review appraisal ratings (Rounded < 3 requires coaching), manage assigned coaches, and approve skill requests.'
        }
        source={activeTab === 'policies' ? 'live' : 'preview'}
      />

      {/* Horizontal Tabs Switcher */}
      <div
        className="apid-card"
        style={{
          padding: '0.4rem',
          background: 'var(--surface-subtle, #f8fafc)',
          border: '1px solid var(--border, #e2e8f0)',
          borderRadius: '10px',
          display: 'flex',
          gap: '0.4rem',
          flexWrap: 'wrap',
        }}
      >
        {visibleTabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                const search = tab.key === 'overview' ? '' : `?tab=${tab.key}`;
                navigate(`/coaching/pms${search}`);
              }}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: isActive ? 700 : 500,
                border: 'none',
                background: isActive ? '#ffffff' : 'transparent',
                color: isActive ? 'var(--brand-gold, #ca8a04)' : 'var(--text-secondary, #475569)',
                boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.key === 'policies' && <Sliders size={14} />}
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'policies' ? (
        <PermissionGate
          anyPermissions={[
            'COACHING_ASSIGNMENT_VIEW_ALL',
            'COACHING_INITIATIVE_CREATE',
            'ADMIN_PORTAL_ACCESS',
            'PMS_ADMIN_ACCESS',
          ]}
        >
          <CoachingRulesTab />
        </PermissionGate>
      ) : (
        <>
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
                <PmsAssignmentsTab />
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
              <SkillDevApprovalTab />
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
    </>
  )}
</div>
  );
}

