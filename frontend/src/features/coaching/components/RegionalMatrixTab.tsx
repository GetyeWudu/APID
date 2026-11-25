import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building,
  MapPin,
  ChevronDown,
  ChevronRight,
  Download,
  Search,
  Loader2,
  RefreshCw,
  Layers,
  AlertTriangle,
  ChevronsUpDown,
} from 'lucide-react';
import { pmsReportApi } from '../api/pmsReportApi';
import { useToast } from '../../../shared/components/ui';

export const RegionalMatrixTab: React.FC = () => {
  const activeQuarterId = 2; // FY 2026/27 · Q2
  const { pushToast } = useToast();

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('ALL');
  const [selectedDeficit, setSelectedDeficit] = useState<string>('ALL');
  const [filterHealth, setFilterHealth] = useState<'ALL' | 'CRITICAL' | 'ZERO_EXEC' | 'ACTIVE'>('ALL');
  const [sortBy, setSortBy] = useState<'NAME' | 'RISK_DESC' | 'STAFF_DESC' | 'EXEC_ASC'>('RISK_DESC');

  // Accordion Expand State
  const [expandedDistricts, setExpandedDistricts] = useState<Record<string, boolean>>({
    'Central District': true,
    Central: true,
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch hierarchical analytics
  const {
    data: analytics,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['hierarchical-analytics', activeQuarterId],
    queryFn: () => pmsReportApi.getHierarchicalAnalytics(activeQuarterId),
    staleTime: 30_000,
  });

  const allDistricts = analytics?.districts ?? [];

  // Extract all unique districts for dropdown selector
  const availableDistricts = useMemo(() => {
    return allDistricts.map((d) => d.districtName).sort();
  }, [allDistricts]);

  // Extract all unique competency deficits for dropdown selector
  const availableDeficits = useMemo(() => {
    const set = new Set<string>();
    allDistricts.forEach((d) => {
      if (d.primarySkillGap) set.add(d.primarySkillGap);
      d.branches.forEach((b) => {
        if (b.primarySkillGap) set.add(b.primarySkillGap);
      });
    });
    return Array.from(set).sort();
  }, [allDistricts]);

  // Filter and sort districts
  const processedDistricts = useMemo(() => {
    let list = [...allDistricts];

    // 1. District dropdown filter
    if (selectedDistrict !== 'ALL') {
      list = list.filter((d) => d.districtName === selectedDistrict);
    }

    // 2. Deficit dropdown filter
    if (selectedDeficit !== 'ALL') {
      list = list.filter(
        (d) =>
          d.primarySkillGap === selectedDeficit ||
          d.branches.some((b) => b.primarySkillGap === selectedDeficit)
      );
    }

    // 3. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((d) => {
        const matchDist = d.districtName.toLowerCase().includes(q);
        const matchBranch = d.branches.some((b) => b.branchName.toLowerCase().includes(q));
        const matchDeficit = d.primarySkillGap?.toLowerCase().includes(q) ?? false;
        return matchDist || matchBranch || matchDeficit;
      });
    }

    // 4. Pacing health filter
    if (filterHealth === 'CRITICAL') {
      list = list.filter((d) => d.criticalCount > 0);
    } else if (filterHealth === 'ZERO_EXEC') {
      list = list.filter((d) => d.completionRate === 0);
    } else if (filterHealth === 'ACTIVE') {
      list = list.filter((d) => d.completionRate > 0);
    }

    // 5. Sort
    list.sort((a, b) => {
      switch (sortBy) {
        case 'NAME':
          return a.districtName.localeCompare(b.districtName);
        case 'RISK_DESC':
          return b.criticalCount - a.criticalCount;
        case 'STAFF_DESC':
          return b.coacheesCount - a.coacheesCount;
        case 'EXEC_ASC':
          return a.completionRate - b.completionRate;
        default:
          return 0;
      }
    });

    return list;
  }, [allDistricts, selectedDistrict, selectedDeficit, searchQuery, filterHealth, sortBy]);

  // Pagination calculations
  const totalPages = Math.ceil(processedDistricts.length / pageSize) || 1;
  const pagedDistricts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedDistricts.slice(start, start + pageSize);
  }, [processedDistricts, currentPage, pageSize]);

  const toggleExpand = (distName: string) => {
    setExpandedDistricts((prev) => ({
      ...prev,
      [distName]: !prev[distName],
    }));
  };

  const handleToggleExpandAll = () => {
    const areAllVisibleExpanded = pagedDistricts.every((d) => !!expandedDistricts[d.districtName]);
    const newState: Record<string, boolean> = { ...expandedDistricts };
    pagedDistricts.forEach((d) => {
      newState[d.districtName] = !areAllVisibleExpanded;
    });
    setExpandedDistricts(newState);
  };

  const handleExportExcel = async (distName?: string) => {
    try {
      setIsExporting(true);
      await pmsReportApi.downloadDistrictExcel(activeQuarterId, distName);
      pushToast({
        title: 'Export Complete',
        message: distName
          ? `Scorecard for ${distName} exported successfully.`
          : 'Bank-Wide Regional performance scorecard exported to Excel.',
        tone: 'ok',
      });
    } catch (err) {
      console.error('Failed to export district Excel scorecard', err);
      pushToast({
        title: 'Export Failed',
        message: 'Could not export district Excel scorecard.',
        tone: 'err',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Macro metrics
  const totalDistrictsCount = allDistricts.length;
  const totalBranchesCount = allDistricts.reduce((acc, d) => acc + d.branches.length, 0);
  const totalRemediation = allDistricts.reduce((acc, d) => acc + d.coacheesCount, 0);
  const totalCritical = allDistricts.reduce((acc, d) => acc + d.criticalCount, 0);

  const areAllVisibleExpanded = pagedDistricts.length > 0 && pagedDistricts.every((d) => !!expandedDistricts[d.districtName]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* 1. Header & Actions */}
      <div
        className="apid-card p-4"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'linear-gradient(135deg, rgba(238, 242, 255, 0.4) 0%, rgba(248, 250, 252, 0.8) 100%)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#1e40af',
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
            >
              Enterprise Scalability Grid
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              Supporting 200+ Districts &amp; 1,000+ Branches
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)' }}>
            Regional &amp; Branch Comparative Performance Matrix
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}>
            Hierarchical drilldown into district coaching delivery velocity, critical performance gaps, and branch execution pacing.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className="apid-btn apid-btn-outline apid-btn-sm"
            onClick={() => handleExportExcel()}
            disabled={isExporting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            {isExporting ? <Loader2 size={13} className="spin" /> : <Download size={13} style={{ color: '#16a34a' }} />}
            <span>Export Bank-Wide Scorecard</span>
          </button>
          <button
            type="button"
            className="apid-btn apid-btn-outline apid-btn-sm"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw size={13} className={isFetching ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Macro Metrics Ribbon */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div className="apid-card p-3.5">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '0.75rem' }}>
            <span>Operating Districts</span>
            <Building size={15} style={{ color: '#6366f1' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', marginTop: '0.35rem' }}>
            {totalDistrictsCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
            Across all banking territories
          </div>
        </div>

        <div className="apid-card p-3.5">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '0.75rem' }}>
            <span>Active Branches</span>
            <MapPin size={15} style={{ color: '#0ea5e9' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', marginTop: '0.35rem' }}>
            {totalBranchesCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
            Engaged in coaching remediation
          </div>
        </div>

        <div className="apid-card p-3.5">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '0.75rem' }}>
            <span>Total Staff in Remediation</span>
            <Layers size={15} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#b45309', marginTop: '0.35rem' }}>
            {totalRemediation}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
            Assigned to mandatory coaching
          </div>
        </div>

        <div className="apid-card p-3.5" style={{ borderLeft: '3px solid #ef4444' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '0.75rem' }}>
            <span>Critical Tier Deficit</span>
            <AlertTriangle size={15} style={{ color: '#ef4444' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626', marginTop: '0.35rem' }}>
            {totalCritical}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '0.25rem' }}>
            Appraisal rating &lt; 2.0
          </div>
        </div>
      </div>

      {/* 3. Scalable Filter & Search Controls */}
      <div
        className="apid-card p-3.5"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          {/* Instant Search */}
          <div style={{ position: 'relative', minWidth: '260px', flex: 1, maxWidth: '380px' }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}
            />
            <input
              type="text"
              placeholder="Search district, branch, or deficit..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem 0.45rem 2rem',
                fontSize: '0.78rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
                color: 'var(--text)',
              }}
            />
          </div>

          {/* District Dropdown Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>District:</span>
            <select
              value={selectedDistrict}
              onChange={(e) => {
                setSelectedDistrict(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '0.4rem 0.65rem',
                fontSize: '0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
                color: 'var(--text)',
                minWidth: '170px',
              }}
            >
              <option value="ALL">All Regional Districts ({allDistricts.length})</option>
              {availableDistricts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Competency Gap / Deficit Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Skill Gap:</span>
            <select
              value={selectedDeficit}
              onChange={(e) => {
                setSelectedDeficit(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '0.4rem 0.65rem',
                fontSize: '0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
                color: 'var(--text)',
                maxWidth: '220px',
              }}
            >
              <option value="ALL">All Competency Deficits</option>
              {availableDeficits.map((def) => (
                <option key={def} value={def}>
                  {def}
                </option>
              ))}
            </select>
          </div>

          {/* Expand All / Collapse All Button */}
          <button
            type="button"
            className="apid-btn apid-btn-outline apid-btn-sm"
            onClick={handleToggleExpandAll}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.74rem',
              padding: '0.4rem 0.65rem',
            }}
          >
            <ChevronsUpDown size={13} />
            <span>{areAllVisibleExpanded ? 'Collapse Visible Branches' : 'Expand Visible Branches'}</span>
          </button>
        </div>

        {/* Row 2: Pacing Filters & Sort Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
          {/* Pacing Filter */}
          <div style={{ display: 'inline-flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            {(
              [
                ['ALL', 'All Districts'],
                ['CRITICAL', 'Has Critical Risk'],
                ['ZERO_EXEC', '0% Execution'],
                ['ACTIVE', 'Active Delivery (>0%)'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setFilterHealth(key);
                  setCurrentPage(1);
                }}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.72rem',
                  fontWeight: filterHealth === key ? 700 : 500,
                  backgroundColor: filterHealth === key ? 'var(--surface-subtle)' : 'var(--surface)',
                  color: filterHealth === key ? 'var(--brand-gold, #ca8a04)' : 'var(--text)',
                  border: 'none',
                  borderRight: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Sort selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                style={{
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.74rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--text)',
                }}
              >
                <option value="RISK_DESC">Critical Risk (Highest First)</option>
                <option value="STAFF_DESC">Staff in Remediation (Highest First)</option>
                <option value="EXEC_ASC">Execution Rate (Lowest Pacing First)</option>
                <option value="NAME">District Name (A-Z)</option>
              </select>
            </div>

            {/* Reset Filters */}
            {(selectedDistrict !== 'ALL' || selectedDeficit !== 'ALL' || filterHealth !== 'ALL' || searchQuery.trim()) && (
              <button
                type="button"
                className="apid-btn apid-btn-outline apid-btn-sm"
                onClick={() => {
                  setSelectedDistrict('ALL');
                  setSelectedDeficit('ALL');
                  setFilterHealth('ALL');
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Scalable District Hierarchy Table */}
      <div className="apid-card" style={{ overflow: 'hidden' }}>
        <div
          style={{
            padding: '0.85rem 1rem',
            borderBottom: '1px solid var(--border)',
            backgroundColor: 'var(--surface-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div>
            <strong style={{ fontSize: '0.88rem', color: 'var(--text)' }}>
              Regional Performance Matrix ({processedDistricts.length} Districts Filtered)
            </strong>
            <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.72rem', color: 'var(--muted)' }}>
              District rollups and expandable branch performance metrics.
            </p>
          </div>

          {/* Rows per page selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Districts per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                padding: '0.2rem 0.4rem',
                fontSize: '0.72rem',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
                color: 'var(--text)',
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
            <Loader2 size={20} className="spin" style={{ display: 'inline-block', marginRight: '0.5rem' }} />
            Loading Bank of Abyssinia regional performance grid...
          </div>
        ) : pagedDistricts.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem' }}>
            No districts match the selected search or filter criteria.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="apid-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-subtle)', borderBottom: '1.5px solid var(--border)' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', minWidth: '240px' }}>Regional District / Branch</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>Total Staff</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>In Remediation</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>Critical Risk (&lt; 2.0)</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>Target Sessions</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>Execution Rate</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Primary Competency Gap</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>Export</th>
                </tr>
              </thead>
              <tbody>
                {pagedDistricts.map((d) => {
                  const isExpanded = !!expandedDistricts[d.districtName];
                  const hasCritical = d.criticalCount > 0;
                  const criticalRatio = d.coacheesCount > 0 ? Math.round((d.criticalCount / d.coacheesCount) * 100) : 0;
                  const execPillColor =
                    d.completionRate >= 50
                      ? { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' }
                      : d.completionRate > 0
                      ? { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' }
                      : { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' };

                  return (
                    <React.Fragment key={d.districtName}>
                      {/* District Row */}
                      <tr
                        style={{
                          backgroundColor: isExpanded ? 'rgba(241, 245, 249, 0.4)' : 'var(--surface)',
                          borderBottom: '1px solid var(--border)',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                        }}
                        onClick={() => toggleExpand(d.districtName)}
                      >
                        <td style={{ padding: '0.8rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 22,
                                height: 22,
                                borderRadius: '4px',
                                backgroundColor: 'var(--surface-subtle)',
                                color: 'var(--muted)',
                              }}
                            >
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </span>
                            <div>
                              <strong style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{d.districtName}</strong>
                              <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginLeft: '0.45rem' }}>
                                ({d.branches.length} {d.branches.length === 1 ? 'branch' : 'branches'})
                              </span>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '0.8rem 0.85rem', textAlign: 'center', color: 'var(--text)', fontWeight: 600 }}>
                          {d.totalStaff}
                        </td>

                        <td style={{ padding: '0.8rem 0.85rem', textAlign: 'center', color: 'var(--text)', fontWeight: 700 }}>
                          {d.coacheesCount}
                        </td>

                        <td style={{ padding: '0.8rem 0.85rem', textAlign: 'center' }}>
                          {hasCritical ? (
                            <span
                              style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: '999px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                backgroundColor: '#fef2f2',
                                color: '#dc2626',
                                border: '1px solid #fecaca',
                              }}
                            >
                              {d.criticalCount} ({criticalRatio}%)
                            </span>
                          ) : (
                            <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>0 (0%)</span>
                          )}
                        </td>

                        <td style={{ padding: '0.8rem 0.85rem', textAlign: 'center', color: 'var(--muted)', fontWeight: 600 }}>
                          {d.completedSessions} / {d.targetSessions}
                        </td>

                        <td style={{ padding: '0.8rem 0.85rem', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.55rem',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              backgroundColor: execPillColor.bg,
                              color: execPillColor.text,
                              border: `1px solid ${execPillColor.border}`,
                            }}
                          >
                            {d.completionRate.toFixed(1)}%
                          </span>
                        </td>

                        <td style={{ padding: '0.8rem 1rem', color: 'var(--text)', fontWeight: 500 }}>
                          {d.primarySkillGap || 'Branch Operations'}
                        </td>

                        <td style={{ padding: '0.8rem 0.85rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            className="apid-btn apid-btn-outline apid-btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleExportExcel(d.districtName);
                            }}
                            title={`Export ${d.districtName} Excel Scorecard`}
                            style={{ padding: '0.2rem 0.45rem', fontSize: '0.68rem' }}
                          >
                            <Download size={11} style={{ color: '#16a34a' }} />
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Branches Sub-rows */}
                      {isExpanded &&
                        d.branches.map((b) => (
                          <tr
                            key={b.branchName}
                            style={{
                              backgroundColor: 'rgba(248, 250, 252, 0.7)',
                              borderBottom: '1px solid var(--border)',
                              fontSize: '0.74rem',
                            }}
                          >
                            <td style={{ padding: '0.55rem 1rem 0.55rem 2.8rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <MapPin size={12} style={{ color: 'var(--muted)' }} />
                                <span style={{ color: 'var(--text)', fontWeight: 600 }}>
                                  {b.branchName.replace(' Branch Operations', '')}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '0.55rem 0.85rem', textAlign: 'center', color: 'var(--muted)' }}>
                              {b.totalStaff}
                            </td>
                            <td style={{ padding: '0.55rem 0.85rem', textAlign: 'center', color: 'var(--text)', fontWeight: 600 }}>
                              {b.coacheesCount}
                            </td>
                            <td style={{ padding: '0.55rem 0.85rem', textAlign: 'center' }}>
                              {b.criticalCount > 0 ? (
                                <span style={{ color: '#dc2626', fontWeight: 700 }}>{b.criticalCount}</span>
                              ) : (
                                <span style={{ color: 'var(--muted)' }}>0</span>
                              )}
                            </td>
                            <td style={{ padding: '0.55rem 0.85rem', textAlign: 'center', color: 'var(--muted)' }}>
                              {b.completedSessions} / {b.targetSessions}
                            </td>
                            <td style={{ padding: '0.55rem 0.85rem', textAlign: 'center' }}>
                              <span style={{ fontWeight: 600, color: b.completionRate > 0 ? '#16a34a' : 'var(--muted)' }}>
                                {b.completionRate.toFixed(1)}%
                              </span>
                            </td>
                            <td style={{ padding: '0.55rem 1rem', color: 'var(--muted)' }}>
                              {b.primarySkillGap || 'Branch Operations'}
                            </td>
                            <td style={{ padding: '0.55rem 0.85rem', textAlign: 'center' }}>
                              <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Branch</span>
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Pagination Bar */}
        <div
          style={{
            padding: '0.75rem 1rem',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
            backgroundColor: 'var(--surface-subtle)',
          }}
        >
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
            Showing {processedDistricts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, processedDistricts.length)} of {processedDistricts.length} districts (
            {totalBranchesCount} branches total)
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <button
              type="button"
              className="apid-btn apid-btn-outline apid-btn-sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
            >
              Previous
            </button>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0 0.4rem', color: 'var(--text)' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              className="apid-btn apid-btn-outline apid-btn-sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
