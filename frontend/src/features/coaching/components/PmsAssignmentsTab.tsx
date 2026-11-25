import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  RefreshCw,
  Eye,
  BarChart2,
  AlertTriangle,
  Download,
  Loader2,
  Users,
  Layers,
  ShieldAlert,
  Calendar,
} from 'lucide-react';
import {
  DataSourceBadge,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  useToast,
} from '../../../shared/components/ui';
import { pmsReportApi } from '../api/pmsReportApi';
import { DistrictBarChart } from './reports/DistrictBarChart';
import { CoachingLifecycleDonut } from './reports/CoachingLifecycleDonut';
import { OperationalAlertsRadar } from './reports/OperationalAlertsRadar';
import { SharedCascadingFilterBar, type SharedFilterValues } from './reports/SharedCascadingFilterBar';
import { TalentDossierDrawer } from './reports/TalentDossierDrawer';
import { TablePagination } from './reports/TablePagination';
import { AiExecutiveBriefingBanner } from './ai/AiExecutiveBriefingBanner';
import { AskApidCopilotDrawer } from './ai/AskApidCopilotDrawer';

export function PmsAssignmentsTab() {
  const { pushToast } = useToast();

  // Active Quarter ID
  const activeQuarterId = 2; // FY 2026/27 · Q2

  // Excel Export State
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      await pmsReportApi.downloadDistrictExcel(
        activeQuarterId,
        filterValues.district !== 'ALL' ? filterValues.district : undefined
      );
    } catch (err) {
      console.error('Failed to export district Excel scorecard', err);
      pushToast({
        title: 'Export Failed',
        message: 'Could not export district Excel scorecard.',
        tone: 'err',
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Copilot Drawer State
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Shared Cascading Filters State
  const [filterValues, setFilterValues] = useState<SharedFilterValues>({
    district: 'ALL',
    branch: 'ALL',
    performanceBand: 'ALL',
    status: 'ALL',
    search: '',
  });

  // KPI Quick Filter (e.g. clicking a macro card)
  const [kpiFilter, setKpiFilter] = useState<string>('ALL');

  // Filter for Mid-Quarter Stalled Assignments (0 sessions past mid-quarter gate)
  const [isStalledFilterActive, setIsStalledFilterActive] = useState<boolean>(false);

  // Selected dossier for drawer
  const [selectedDossierAssignmentId, setSelectedDossierAssignmentId] = useState<number | null>(null);

  // 1. Fetch Hierarchical Analytics (District & Branch Rollup + Macro KPIs)
  const analyticsQuery = useQuery({
    queryKey: ['hierarchical-analytics', activeQuarterId],
    queryFn: () => pmsReportApi.getHierarchicalAnalytics(activeQuarterId),
    staleTime: 30_000,
  });

  // 2. Fetch Filtered Coachee Talents Roster
  const talentsQuery = useQuery({
    queryKey: [
      'pms-coaching-talents-roster',
      activeQuarterId,
      filterValues.district,
      filterValues.branch,
      filterValues.performanceBand,
      filterValues.status,
      filterValues.search,
      kpiFilter,
    ],
    queryFn: () =>
      pmsReportApi.getTalents({
        quarterId: activeQuarterId,
        district: filterValues.district !== 'ALL' ? filterValues.district : undefined,
        branch: filterValues.branch !== 'ALL' ? filterValues.branch : undefined,
        performanceBand: filterValues.performanceBand !== 'ALL' ? filterValues.performanceBand : undefined,
        status: filterValues.status !== 'ALL' ? filterValues.status : undefined,
        kpiType: kpiFilter !== 'ALL' ? kpiFilter : undefined,
        search: filterValues.search.trim() || undefined,
      }),
    staleTime: 15_000,
  });

  // 3. Query dossier for talent drawer
  const dossierQuery = useQuery({
    queryKey: ['pms-talent-dossier', selectedDossierAssignmentId],
    queryFn: () =>
      selectedDossierAssignmentId ? pmsReportApi.getTalentDossier(selectedDossierAssignmentId) : null,
    enabled: !!selectedDossierAssignmentId,
  });

  const resetAllFilters = () => {
    setFilterValues({
      district: 'ALL',
      branch: 'ALL',
      performanceBand: 'ALL',
      status: 'ALL',
      search: '',
    });
    setKpiFilter('ALL');
    setIsStalledFilterActive(false);
    setCurrentPage(1);
  };

  const analytics = analyticsQuery.data;
  const rawTalents = talentsQuery.data ?? [];
  const talents = isStalledFilterActive
    ? rawTalents.filter((t) => t.completedSessions === 0)
    : rawTalents;

  const totalItems = talents.length;
  const paginatedTalents = talents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-4">
      {/* 1. Header Banner */}
      <div className="apid-card bg-gradient-to-r from-amber-500/10 via-slate-500/5 to-transparent p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center gap-1">
              <BarChart2 size={12} /> APID Coaching Intelligence
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {analytics?.fiscalQuarterName || 'FY 2026/27 · Q2'}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Quarterly Coaching Administration &amp; Operational Roster
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Executive oversight, district-level performance tracking, and actionable remediation monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DataSourceBadge source="live" />
          <button
            type="button"
            disabled={isExportingExcel}
            className="apid-btn apid-btn-outline apid-btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              backgroundColor: isExportingExcel ? '#f3f4f6' : '#ffffff',
              color: '#0f172a',
              fontWeight: 600,
            }}
            onClick={handleExportExcel}
            title="Download official multi-tab Bank of Abyssinia Excel Scorecard"
          >
            {isExportingExcel ? (
              <Loader2 size={13} className="spin" style={{ color: '#16a34a' }} />
            ) : (
              <Download size={13} style={{ color: '#16a34a' }} />
            )}
            <span>{isExportingExcel ? 'Exporting...' : 'Export Excel'}</span>
          </button>
          <button
            type="button"
            className="apid-btn apid-btn-outline apid-btn-sm"
            onClick={() => {
              void analyticsQuery.refetch();
              void talentsQuery.refetch();
            }}
            disabled={analyticsQuery.isFetching || talentsQuery.isFetching}
          >
            <RefreshCw
              size={13}
              className={analyticsQuery.isFetching || talentsQuery.isFetching ? 'spin' : ''}
            />{' '}
            Refresh Analytics
          </button>
        </div>
      </div>

      {/* 1.5. AI Executive Intelligence Briefing */}
      <AiExecutiveBriefingBanner
        quarterId={activeQuarterId}
        onOpenCopilot={() => setIsCopilotOpen(true)}
      />

      {/* 2. Clickable Executive Macro KPI Ribbon */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        {/* Total Monitored */}
        <div
          onClick={resetAllFilters}
          className="apid-card p-3.5 cursor-pointer hover:border-slate-400 dark:hover:border-slate-600 transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Monitored</span>
            <Users size={14} className="text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            {analytics?.totalEmployeesMonitored || 151}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Bank-wide staff</span>
            <span className="text-amber-600 dark:text-amber-400 font-medium">Reset Filters &rarr;</span>
          </div>
        </div>

        {/* Requiring Remediation */}
        <div
          onClick={() => {
            resetAllFilters();
            setKpiFilter('REQUIRING_COACHING');
          }}
          className={`apid-card p-3.5 cursor-pointer transition flex flex-col justify-between ${
            kpiFilter === 'REQUIRING_COACHING'
              ? 'ring-2 ring-amber-500 border-amber-500'
              : 'hover:border-amber-400 dark:hover:border-amber-600'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 font-medium">
            <span>In Remediation</span>
            <Layers size={14} />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
            {analytics?.totalCoachingAssignments || 49}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Score &lt; 3.0 trigger</span>
            <span className="text-amber-600 dark:text-amber-400 font-medium">Filter Roster &rarr;</span>
          </div>
        </div>

        {/* Critical Tier */}
        <div
          onClick={() => {
            setFilterValues((prev) => ({ ...prev, performanceBand: 'CRITICAL' }));
            setKpiFilter('CRITICAL');
          }}
          className={`apid-card p-3.5 cursor-pointer transition flex flex-col justify-between ${
            kpiFilter === 'CRITICAL' || filterValues.performanceBand === 'CRITICAL'
              ? 'ring-2 ring-red-500 border-red-500'
              : 'hover:border-red-400 dark:hover:border-red-600'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-red-600 dark:text-red-400 font-medium">
            <span>Critical Tier (&lt; 2.0)</span>
            <ShieldAlert size={14} />
          </div>
          <div className="text-2xl font-extrabold text-red-600 dark:text-red-400 mt-1">
            {analytics?.criticalCount || 17}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>10 Mandatory Sess.</span>
            <span className="text-red-600 dark:text-red-400 font-medium">Inspect Cohort &rarr;</span>
          </div>
        </div>

        {/* Target Sessions Delivery */}
        <div className="apid-card p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Session Delivery</span>
            <Calendar size={14} className="text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            {analytics?.totalCompletedSessions || 0}{' '}
            <span className="text-xs font-normal text-slate-400">
              / {analytics?.totalTargetSessions || 362}
            </span>
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
            {analytics?.overallCompletionRate || 0.0}% Target Met
          </div>
        </div>

        {/* Overdue / At-Risk */}
        <div
          onClick={() => {
            setKpiFilter('OVERDUE');
          }}
          className={`apid-card p-3.5 cursor-pointer transition flex flex-col justify-between ${
            kpiFilter === 'OVERDUE'
              ? 'ring-2 ring-amber-500 border-amber-500'
              : 'hover:border-amber-400 dark:hover:border-amber-600'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 font-medium">
            <span>Attention Required</span>
            <AlertTriangle size={14} />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
            {analytics?.attentionRequiredCount || 17}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Stalled &gt; 14 days</span>
            <span className="text-amber-600 dark:text-amber-400 font-medium">Review &rarr;</span>
          </div>
        </div>
      </div>

      {/* 3. Interactive Graphical Visualizations Grid (Recharts) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        {/* District Bar Chart */}
        <div className="apid-card p-4">
          <DistrictBarChart
            districts={analytics?.districts ?? []}
            selectedDistrict={filterValues.district}
            onSelectDistrict={(district) =>
              setFilterValues((prev) => ({
                ...prev,
                district,
                branch: 'ALL',
              }))
            }
          />
        </div>

        {/* Lifecycle & Risk Donut Chart */}
        <div className="apid-card p-4">
          <CoachingLifecycleDonut
            criticalCount={analytics?.criticalCount || 0}
            moderateCount={analytics?.moderateCount || 0}
            completedSessions={analytics?.totalCompletedSessions || 0}
            totalTargetSessions={analytics?.totalTargetSessions || 0}
            attentionCount={analytics?.attentionRequiredCount || 0}
            onFilterBand={(band) => {
              setFilterValues((prev) => ({ ...prev, performanceBand: band }));
              setKpiFilter(band);
            }}
          />
        </div>
      </div>

      {/* 4. Operational Priority Alerts */}
      <OperationalAlertsRadar
        analytics={analytics ?? null}
        onFilterBranch={(district, branch) => {
          setFilterValues((prev) => ({
            ...prev,
            district,
            branch,
          }));
        }}
        onFilterCritical={() => {
          setFilterValues((prev) => ({ ...prev, performanceBand: 'CRITICAL' }));
          setKpiFilter('CRITICAL');
        }}
      />

      {/* 5. Cascading Multi-Tier Filter Bar */}
      <SharedCascadingFilterBar
        quarterId={activeQuarterId}
        filters={filterValues}
        onChange={(updates) => setFilterValues((prev) => ({ ...prev, ...updates }))}
        onReset={resetAllFilters}
      />

      {/* 6. Active Coaching Roster Table */}
      <div className="apid-card">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Coaching Assignments Roster
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {talents.length} Coachees
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Inspect session evidence, AI minutes, and manage coach allocations.
            </p>
          </div>

          {(filterValues.district !== 'ALL' ||
            filterValues.branch !== 'ALL' ||
            filterValues.performanceBand !== 'ALL' ||
            kpiFilter !== 'ALL' ||
            isStalledFilterActive ||
            filterValues.search) && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400">Active filter:</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {[
                  isStalledFilterActive ? '⚠️ Stalled (0 Sessions)' : null,
                  filterValues.search ? `Search: "${filterValues.search}"` : null,
                  filterValues.district !== 'ALL' ? filterValues.district : null,
                  filterValues.branch !== 'ALL' ? filterValues.branch.replace(' Branch Operations', '') : null,
                  filterValues.performanceBand !== 'ALL' ? filterValues.performanceBand : null,
                  kpiFilter !== 'ALL' ? `KPI: ${kpiFilter}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline cursor-pointer ml-1"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {talentsQuery.isLoading ? (
          <LoadingSkeleton rows={6} height={28} />
        ) : talentsQuery.isError ? (
          <ErrorState
            message="Failed to load coaching talents from server."
            onRetry={() => void talentsQuery.refetch()}
          />
        ) : talents.length === 0 ? (
          <EmptyState
            title="No Coachees Found"
            description="No staff members match the selected district, branch, or performance filter."
          />
        ) : (
          <div className="apid-table-wrap">
            <table className="apid-table">
              <thead>
                <tr>
                  <th>Coachee &amp; Branch</th>
                  <th>Starting Score</th>
                  <th>Primary Focus Gap</th>
                  <th>Assigned Coach</th>
                  <th>Sessions Progress</th>
                  <th>Trajectory</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTalents.map((item) => {
                  const isCritical = item.startingRating < 2.0;
                  return (
                    <tr
                      key={item.assignmentId}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                      onClick={() => setSelectedDossierAssignmentId(item.assignmentId)}
                      title="Click anywhere to open full coachee development dossier"
                    >
                      <td>
                        <div style={{ fontWeight: 700 }}>{item.coacheeName}</div>
                        <div className="boa-muted" style={{ fontSize: '0.77rem' }}>
                          {item.coacheeStaffId} · {item.department.replace(' Branch Operations', '')}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {item.directorate}
                        </div>
                      </td>

                      <td>
                        <div className="tabular-nums" style={{ fontWeight: 700 }}>
                          {item.startingRating.toFixed(4)}
                        </div>
                        <div style={{ marginTop: '0.2rem' }}>
                          <span
                            className={`boa-pill ${
                              isCritical ? 'boa-pill-err' : 'boa-pill-warn'
                            }`}
                            style={{ fontSize: '0.7rem' }}
                          >
                            {isCritical ? 'CRITICAL (<2.0)' : 'MODERATE'}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="text-xs text-slate-700 dark:text-slate-300 max-w-[200px] truncate" title={item.targetWeaknessKpi}>
                          {item.targetWeaknessKpi}
                        </div>
                      </td>

                      <td>
                        {item.coachName ? (
                          <div>
                            <div style={{ fontWeight: 600 }}>{item.coachName}</div>
                            <div className="boa-muted" style={{ fontSize: '0.76rem' }}>
                              Coach
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--warn)', fontWeight: 600, fontSize: '0.82rem' }}>
                            Unassigned
                          </span>
                        )}
                      </td>

                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs">
                            {item.completedSessions} / {item.approvedTarget}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({item.deliveryPercentage}%)
                          </span>
                        </div>
                        <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.deliveryPercentage >= 100
                                ? 'bg-emerald-500'
                                : item.deliveryPercentage > 0
                                ? 'bg-amber-500'
                                : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                            style={{ width: `${Math.min(100, item.deliveryPercentage)}%` }}
                          />
                        </div>
                      </td>

                      <td>
                        {item.attentionRequired ? (
                          <span className="boa-pill boa-pill-err" style={{ fontSize: '0.7rem' }} title={item.attentionReason || 'Needs Attention'}>
                            <AlertTriangle size={11} /> AT RISK
                          </span>
                        ) : (
                          <span className="boa-pill boa-pill-neutral" style={{ fontSize: '0.7rem' }}>
                            {item.progressTrajectory}
                          </span>
                        )}
                      </td>

                      <td className="apid-actions-cell" onClick={(e) => e.stopPropagation()}>
                        {/* Single Unified Action Button */}
                        <button
                          type="button"
                          className="apid-btn apid-btn-outline apid-btn-sm"
                          onClick={() => setSelectedDossierAssignmentId(item.assignmentId)}
                          title="Open full coachee development dossier & session evidence"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}
                        >
                          <Eye size={13} /> View Dossier
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!talentsQuery.isLoading && totalItems > 0 && (
          <TablePagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        )}
      </div>

      {/* 7. Drawers & Modals */}

      {/* Talent Dossier Drawer */}
      <TalentDossierDrawer
        dossier={dossierQuery.data ?? null}
        isOpen={selectedDossierAssignmentId !== null}
        onClose={() => setSelectedDossierAssignmentId(null)}
        loading={dossierQuery.isLoading}
      />

      {/* Ask APID Decision Copilot Drawer */}
      <AskApidCopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        quarterId={activeQuarterId}
        onOpenDossier={(assignmentId) => setSelectedDossierAssignmentId(assignmentId)}
        onFilterBranch={(district, branch) => setFilterValues((prev) => ({ ...prev, district, branch }))}
        onFilterDistrict={(district) => setFilterValues((prev) => ({ ...prev, district, branch: 'ALL' }))}
      />
    </div>
  );
}
