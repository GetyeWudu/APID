import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  AlertTriangle,
  RefreshCw,
  Search,
  Bell,
  Clock,
  Sparkles,
  Users,
  ChevronDown,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { pmsReportApi, type MidQuarterInactivityItem } from '../api/pmsReportApi';
import { TopRatedCoachesCard } from './reports/TopRatedCoachesCard';
import { MidQuarterInactivityAlert } from './reports/MidQuarterInactivityAlert';
import { useToast } from '../../../shared/components/ui';

interface GroupedCoachStall {
  coachId: number | null;
  coachName: string;
  coachStaffId: string;
  coachEmail: string | null;
  coachees: MidQuarterInactivityItem[];
  totalCoachees: number;
  totalCompleted: number;
  totalTarget: number;
  criticalCount: number;
  elapsedWeeks: number;
  primaryBranch: string;
  primaryDistrict: string;
}

export const CoachQualityTab: React.FC = () => {
  const activeQuarterId = 2; // FY 2026/27 · Q2
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('ALL');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL_STALL' | 'BEHIND_PACING'>('ALL');
  const [viewMode, setViewMode] = useState<'COACH_GROUPED' | 'ASSIGNMENT'>('COACH_GROUPED');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Expanded Coaches state for grouped view
  const [expandedCoaches, setExpandedCoaches] = useState<Record<string, boolean>>({});

  // Nudge Action state
  const [notifyingCoachId, setNotifyingCoachId] = useState<number | null>(null);

  // 1. Fetch Inactivity & Pacing data
  const inactivityQuery = useQuery({
    queryKey: ['midquarter-inactivity', activeQuarterId],
    queryFn: () => pmsReportApi.getMidQuarterInactivity(activeQuarterId),
    staleTime: 10_000,
  });

  // 2. Fetch Top Coaches data
  const topCoachesQuery = useQuery({
    queryKey: ['top-rated-coaches', activeQuarterId],
    queryFn: () => pmsReportApi.getTopCoaches(activeQuarterId),
    staleTime: 10_000,
  });

  const allStalled = inactivityQuery.data ?? [];
  const topCoaches = topCoachesQuery.data ?? [];

  // Extract available unique districts for cascading dropdown
  const availableDistricts = useMemo(() => {
    const set = new Set<string>();
    allStalled.forEach((item) => {
      if (item.district) set.add(item.district);
    });
    return Array.from(set).sort();
  }, [allStalled]);

  // Extract available unique branches based on selected district
  const availableBranches = useMemo(() => {
    const set = new Set<string>();
    allStalled.forEach((item) => {
      if (selectedDistrict === 'ALL' || item.district === selectedDistrict) {
        if (item.department) set.add(item.department);
      }
    });
    return Array.from(set).sort();
  }, [allStalled, selectedDistrict]);

  // Filtered stalled list
  const filteredStalled = useMemo(() => {
    return allStalled.filter((item) => {
      // Severity filter
      if (severityFilter !== 'ALL' && item.severity !== severityFilter) {
        return false;
      }
      // District filter
      if (selectedDistrict !== 'ALL' && item.district !== selectedDistrict) {
        return false;
      }
      // Branch filter
      if (selectedBranch !== 'ALL' && item.department !== selectedBranch) {
        return false;
      }
      // Search query (Coach, Coachee, Staff ID, Branch)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCoach = item.coachName.toLowerCase().includes(q) || item.coachStaffId.toLowerCase().includes(q);
        const matchCoachee = item.coacheeName.toLowerCase().includes(q) || item.coacheeStaffId.toLowerCase().includes(q);
        const matchBranch = item.department.toLowerCase().includes(q) || item.district.toLowerCase().includes(q);
        return matchCoach || matchCoachee || matchBranch;
      }
      return true;
    });
  }, [allStalled, severityFilter, selectedDistrict, selectedBranch, searchQuery]);

  // Group by Coach (for Coach Consolidation View)
  const groupedCoaches = useMemo(() => {
    const map = new Map<string, GroupedCoachStall>();

    filteredStalled.forEach((item) => {
      const key = item.coachStaffId || item.coachName;
      let existing = map.get(key);
      if (!existing) {
        existing = {
          coachId: item.coachEmployeeId,
          coachName: item.coachName,
          coachStaffId: item.coachStaffId,
          coachEmail: item.coachEmail,
          coachees: [],
          totalCoachees: 0,
          totalCompleted: 0,
          totalTarget: 0,
          criticalCount: 0,
          elapsedWeeks: item.elapsedWeeks,
          primaryBranch: item.department,
          primaryDistrict: item.district,
        };
        map.set(key, existing);
      }
      existing.coachees.push(item);
      existing.totalCoachees += 1;
      existing.totalCompleted += item.completedSessions;
      existing.totalTarget += item.targetSessions;
      if (item.completedSessions === 0) {
        existing.criticalCount += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.criticalCount - a.criticalCount || b.totalCoachees - a.totalCoachees);
  }, [filteredStalled]);

  // Pagination for Assignment view
  const totalAssignmentPages = Math.ceil(filteredStalled.length / pageSize) || 1;
  const pagedAssignments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStalled.slice(start, start + pageSize);
  }, [filteredStalled, currentPage, pageSize]);

  // Pagination for Grouped Coach view
  const totalCoachPages = Math.ceil(groupedCoaches.length / pageSize) || 1;
  const pagedCoaches = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return groupedCoaches.slice(start, start + pageSize);
  }, [groupedCoaches, currentPage, pageSize]);

  const toggleCoachExpand = (coachStaffId: string) => {
    setExpandedCoaches((prev) => ({
      ...prev,
      [coachStaffId]: !prev[coachStaffId],
    }));
  };

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['midquarter-inactivity'] });
    void queryClient.invalidateQueries({ queryKey: ['top-rated-coaches'] });
    pushToast({
      title: 'Refreshed',
      message: 'Coach quality & mid-quarter pacing data reloaded.',
      tone: 'info',
    });
  };

  const handleSendNudge = async (targetId: number, coachName: string) => {
    try {
      setNotifyingCoachId(targetId);
      await pmsReportApi.notifyAllStalledCoaches(activeQuarterId);
      pushToast({
        title: 'Nudge Dispatched',
        message: `Escalation notification delivered to Coach ${coachName}.`,
        tone: 'ok',
      });
    } catch (err) {
      pushToast({
        title: 'Dispatch Failed',
        message: 'Could not send notification to coach.',
        tone: 'err',
      });
    } finally {
      setNotifyingCoachId(null);
    }
  };

  const ratedCoachesCount = topCoaches.filter((c) => c.averageRating !== null && c.averageRating > 0).length;
  const criticalStallCount = allStalled.filter((s) => s.severity === 'CRITICAL_STALL').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* 1. Header & KPI Ribbon */}
      <div
        className="apid-card p-4"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'linear-gradient(135deg, rgba(254, 249, 195, 0.15) 0%, rgba(238, 242, 255, 0.2) 100%)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#b45309',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              FY 2026/27 · Q2 Mid-Quarter Audit
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              Week 7/8 Checkpoint
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)' }}>
            Coach Quality, CSAT Ratings &amp; Pacing Governance
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}>
            Coachee satisfaction evaluations, top coach recognition, and proactive mid-quarter remediation pacing.
          </p>
        </div>

        <button
          type="button"
          className="apid-btn apid-btn-outline apid-btn-sm"
          onClick={handleRefresh}
          disabled={inactivityQuery.isFetching || topCoachesQuery.isFetching}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <RefreshCw size={13} className={inactivityQuery.isFetching ? 'spin' : ''} />
          <span>Refresh Ratings &amp; Pacing</span>
        </button>
      </div>

      {/* 2. Executive Quick Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div className="apid-card p-3.5">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '0.75rem' }}>
            <span>Top-Rated Coaches</span>
            <Award size={15} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#b45309', marginTop: '0.35rem' }}>
            {ratedCoachesCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
            Received 4★ and 5★ coachee ratings
          </div>
        </div>

        <div className="apid-card p-3.5" style={{ borderLeft: '3px solid #ef4444' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '0.75rem' }}>
            <span>Critical Stalls (0 of 10)</span>
            <AlertTriangle size={15} style={{ color: '#ef4444' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626', marginTop: '0.35rem' }}>
            {criticalStallCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '0.25rem' }}>
            Past Week 5 mid-quarter gate
          </div>
        </div>

        <div className="apid-card p-3.5">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '0.75rem' }}>
            <span>Average CSAT Rating</span>
            <Sparkles size={15} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', marginTop: '0.35rem' }}>
            4.85 <span style={{ fontSize: '0.9rem', color: '#f59e0b' }}>★</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
            Bank-wide post-session average
          </div>
        </div>

        <div className="apid-card p-3.5">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '0.75rem' }}>
            <span>Pacing Policy Window</span>
            <Clock size={15} style={{ color: '#6366f1' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', marginTop: '0.35rem' }}>
            Week 8
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
            Target: ≥ 5 sessions completed
          </div>
        </div>
      </div>

      {/* 3. Top-Rated Performance Coaches Leaderboard */}
      <TopRatedCoachesCard quarterId={activeQuarterId} />

      {/* 4. Mid-Quarter Inactivity Alert Banner */}
      <MidQuarterInactivityAlert quarterId={activeQuarterId} />

      {/* 5. Smart Filter Bar for Stalled Coaching Roster */}
      <div
        className="apid-card p-3.5"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Filter size={15} style={{ color: '#d97706' }} />
            <strong style={{ fontSize: '0.88rem', color: 'var(--text)' }}>
              Pacing Audit &amp; Smart Escalation Filters
            </strong>
          </div>

          {/* View Mode Toggle: Grouped by Coach vs Flat Assignment */}
          <div style={{ display: 'inline-flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => {
                setViewMode('COACH_GROUPED');
                setCurrentPage(1);
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.74rem',
                fontWeight: viewMode === 'COACH_GROUPED' ? 700 : 500,
                backgroundColor: viewMode === 'COACH_GROUPED' ? 'var(--surface-subtle)' : 'var(--surface)',
                color: viewMode === 'COACH_GROUPED' ? '#b45309' : 'var(--muted)',
                border: 'none',
                borderRight: '1px solid var(--border)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <Users size={12} />
              <span>Group by Coach ({groupedCoaches.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('ASSIGNMENT');
                setCurrentPage(1);
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.74rem',
                fontWeight: viewMode === 'ASSIGNMENT' ? 700 : 500,
                backgroundColor: viewMode === 'ASSIGNMENT' ? 'var(--surface-subtle)' : 'var(--surface)',
                color: viewMode === 'ASSIGNMENT' ? '#b45309' : 'var(--muted)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              All Coachee Assignments ({filteredStalled.length})
            </button>
          </div>
        </div>

        {/* Cascading Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* District Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>District:</span>
            <select
              value={selectedDistrict}
              onChange={(e) => {
                setSelectedDistrict(e.target.value);
                setSelectedBranch('ALL'); // Reset branch when district changes
                setCurrentPage(1);
              }}
              style={{
                padding: '0.35rem 0.6rem',
                fontSize: '0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
                color: 'var(--text)',
                minWidth: '150px',
              }}
            >
              <option value="ALL">All Regional Districts</option>
              {availableDistricts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Branch Dropdown (Cascades based on selected district) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Branch:</span>
            <select
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '0.35rem 0.6rem',
                fontSize: '0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
                color: 'var(--text)',
                minWidth: '160px',
              }}
            >
              <option value="ALL">All Branches {selectedDistrict !== 'ALL' ? `in ${selectedDistrict}` : ''}</option>
              {availableBranches.map((b) => (
                <option key={b} value={b}>
                  {b.replace(' Branch Operations', '')}
                </option>
              ))}
            </select>
          </div>

          {/* Severity Buttons */}
          <div style={{ display: 'inline-flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => {
                setSeverityFilter('ALL');
                setCurrentPage(1);
              }}
              style={{
                padding: '0.35rem 0.6rem',
                fontSize: '0.72rem',
                fontWeight: severityFilter === 'ALL' ? 700 : 500,
                backgroundColor: severityFilter === 'ALL' ? 'var(--surface-subtle)' : 'var(--surface)',
                color: 'var(--text)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              All Statuses
            </button>
            <button
              type="button"
              onClick={() => {
                setSeverityFilter('CRITICAL_STALL');
                setCurrentPage(1);
              }}
              style={{
                padding: '0.35rem 0.6rem',
                fontSize: '0.72rem',
                fontWeight: severityFilter === 'CRITICAL_STALL' ? 700 : 500,
                backgroundColor: severityFilter === 'CRITICAL_STALL' ? '#fef2f2' : 'var(--surface)',
                color: severityFilter === 'CRITICAL_STALL' ? '#dc2626' : 'var(--text)',
                border: 'none',
                borderLeft: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              Critical (0/10)
            </button>
          </div>

          {/* Instant Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search
              size={13}
              style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}
            />
            <input
              type="text"
              placeholder="Search coach, staff ID, coachee..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '0.35rem 0.6rem 0.35rem 1.8rem',
                fontSize: '0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
                color: 'var(--text)',
              }}
            />
          </div>

          {/* Reset button */}
          {(selectedDistrict !== 'ALL' || selectedBranch !== 'ALL' || severityFilter !== 'ALL' || searchQuery.trim()) && (
            <button
              type="button"
              className="apid-btn apid-btn-outline apid-btn-sm"
              onClick={() => {
                setSelectedDistrict('ALL');
                setSelectedBranch('ALL');
                setSeverityFilter('ALL');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem' }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 6. Main Data Display: Either Grouped by Coach OR Flat Assignment List */}
      <div className="apid-card" style={{ overflow: 'hidden' }}>
        {viewMode === 'COACH_GROUPED' ? (
          /* ========================================================================= */
          /* VIEW MODE A: GROUPED BY COACH                                             */
          /* ========================================================================= */
          <div>
            <div
              style={{
                padding: '0.85rem 1rem',
                borderBottom: '1px solid var(--border)',
                backgroundColor: 'var(--surface-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <strong style={{ fontSize: '0.88rem', color: 'var(--text)' }}>
                  Performance Coaches with Stalled Coachees ({groupedCoaches.length} Coaches)
                </strong>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.72rem', color: 'var(--muted)' }}>
                  Consolidated by coach. One-click escalation alerts the coach across all assigned coachees.
                </p>
              </div>

              {/* Page size */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Rows per page:</span>
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

            {pagedCoaches.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem' }}>
                No coaches match the selected filter criteria.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {pagedCoaches.map((gc) => {
                  const isExpanded = !!expandedCoaches[gc.coachStaffId];
                  return (
                    <div
                      key={gc.coachStaffId}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        padding: '0.85rem 1rem',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* Coach Main Summary Row */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                        }}
                      >
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}
                          onClick={() => toggleCoachExpand(gc.coachStaffId)}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 24,
                              height: 24,
                              borderRadius: '4px',
                              backgroundColor: 'var(--surface-subtle)',
                              color: 'var(--muted)',
                            }}
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <strong style={{ fontSize: '0.88rem', color: 'var(--text)' }}>{gc.coachName}</strong>
                              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>({gc.coachStaffId})</span>
                              {gc.criticalCount > 0 && (
                                <span
                                  style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    backgroundColor: '#fef2f2',
                                    color: '#dc2626',
                                    border: '1px solid #fecaca',
                                    padding: '0.1rem 0.4rem',
                                    borderRadius: '999px',
                                  }}
                                >
                                  {gc.criticalCount} Critical
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                              {gc.primaryDistrict} · {gc.primaryBranch.replace(' Branch Operations', '')}
                            </span>
                          </div>
                        </div>

                        {/* Metrics and Action */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                          <div style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '0.68rem', color: 'var(--muted)', display: 'block' }}>Assigned</span>
                            <strong style={{ fontSize: '0.82rem', color: 'var(--text)' }}>
                              {gc.totalCoachees} {gc.totalCoachees === 1 ? 'Coachee' : 'Coachees'}
                            </strong>
                          </div>

                          <div style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '0.68rem', color: 'var(--muted)', display: 'block' }}>Delivery</span>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: gc.totalCompleted === 0 ? '#dc2626' : '#d97706',
                                backgroundColor: gc.totalCompleted === 0 ? '#fef2f2' : '#fefce8',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                              }}
                            >
                              {gc.totalCompleted} / {gc.totalTarget}
                            </span>
                          </div>

                          <button
                            type="button"
                            className="apid-btn apid-btn-outline apid-btn-sm"
                            onClick={() => handleSendNudge(gc.coachees[0].assignmentId, gc.coachName)}
                            disabled={notifyingCoachId === gc.coachees[0].assignmentId}
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.3rem 0.65rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                          >
                            <Bell size={12} />
                            <span>
                              {notifyingCoachId === gc.coachees[0].assignmentId
                                ? 'Dispatching...'
                                : `Nudge Coach (${gc.totalCoachees} Coachees)`}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Expanded Sub-table of Coachees */}
                      {isExpanded && (
                        <div style={{ marginTop: '0.75rem', paddingLeft: '2.2rem' }}>
                          <table style={{ width: '100%', fontSize: '0.74rem', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left' }}>Coachee</th>
                                <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left' }}>Branch Operations</th>
                                <th style={{ padding: '0.45rem 0.6rem', textAlign: 'center' }}>Completed</th>
                                <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left' }}>Severity</th>
                                <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left' }}>Recommended Directive</th>
                              </tr>
                            </thead>
                            <tbody>
                              {gc.coachees.map((c) => (
                                <tr key={c.assignmentId} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '0.45rem 0.6rem' }}>
                                    <strong style={{ color: 'var(--text)' }}>{c.coacheeName}</strong>{' '}
                                    <span style={{ color: 'var(--muted)', fontSize: '0.68rem' }}>({c.coacheeStaffId})</span>
                                  </td>
                                  <td style={{ padding: '0.45rem 0.6rem', color: 'var(--muted)' }}>
                                    {c.department.replace(' Branch Operations', '')}
                                  </td>
                                  <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center', fontWeight: 700 }}>
                                    {c.completedSessions} / {c.targetSessions}
                                  </td>
                                  <td style={{ padding: '0.45rem 0.6rem' }}>
                                    <span
                                      style={{
                                        fontSize: '0.66rem',
                                        fontWeight: 700,
                                        color: c.completedSessions === 0 ? '#dc2626' : '#d97706',
                                      }}
                                    >
                                      {c.completedSessions === 0 ? 'Critical Stall (0/10)' : 'Behind Pacing'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.45rem 0.6rem', color: 'var(--muted)', fontSize: '0.7rem' }}>
                                    {c.recommendedAction}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls for Grouped View */}
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
                Showing {groupedCoaches.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, groupedCoaches.length)} of {groupedCoaches.length} coaches
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
                  Page {currentPage} of {totalCoachPages}
                </span>
                <button
                  type="button"
                  className="apid-btn apid-btn-outline apid-btn-sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalCoachPages, p + 1))}
                  disabled={currentPage === totalCoachPages}
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* VIEW MODE B: FLAT DETAILED ASSIGNMENTS TABLE                              */
          /* ========================================================================= */
          <div>
            <div
              style={{
                padding: '0.85rem 1rem',
                borderBottom: '1px solid var(--border)',
                backgroundColor: 'var(--surface-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <strong style={{ fontSize: '0.88rem', color: 'var(--text)' }}>
                  Detailed Coachee Remediation Pacing Roster ({filteredStalled.length} Records)
                </strong>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.72rem', color: 'var(--muted)' }}>
                  Individual assignment audit across all banking territories.
                </p>
              </div>

              {/* Page size */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Rows per page:</span>
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

            <div style={{ overflowX: 'auto' }}>
              <table className="apid-table" style={{ width: '100%', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-subtle)' }}>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left' }}>Assigned Coach</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left' }}>Coachee &amp; Branch</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Elapsed Weeks</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Delivery Progress</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left' }}>Pacing Status</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left' }}>Recommended Executive Action</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedAssignments.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                        No stalled coaching assignments match the current filter.
                      </td>
                    </tr>
                  ) : (
                    pagedAssignments.map((item) => (
                      <tr key={item.assignmentId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <strong style={{ color: 'var(--text)', display: 'block' }}>{item.coachName}</strong>
                          <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{item.coachStaffId}</span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <strong style={{ color: 'var(--text)', display: 'block' }}>{item.coacheeName}</strong>
                          <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                            {item.coacheeStaffId} · {item.department.replace(' Branch Operations', '')}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text)' }}>Week {item.elapsedWeeks}</span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              color: item.completedSessions === 0 ? '#dc2626' : '#d97706',
                              backgroundColor: item.completedSessions === 0 ? '#fef2f2' : '#fefce8',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                            }}
                          >
                            {item.completedSessions} / {item.targetSessions}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '999px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              backgroundColor: item.severity === 'CRITICAL_STALL' ? '#fef2f2' : '#fefce8',
                              color: item.severity === 'CRITICAL_STALL' ? '#b91c1c' : '#92400e',
                              border: `1px solid ${item.severity === 'CRITICAL_STALL' ? '#fecaca' : '#fef08a'}`,
                            }}
                          >
                            <AlertTriangle size={11} />
                            {item.severity === 'CRITICAL_STALL' ? 'Critical Stall (0/10)' : 'Behind Pacing'}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', maxWidth: '280px', color: 'var(--muted)', fontSize: '0.72rem' }}>
                          {item.recommendedAction}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            className="apid-btn apid-btn-outline apid-btn-sm"
                            onClick={() => handleSendNudge(item.assignmentId, item.coachName)}
                            disabled={notifyingCoachId === item.assignmentId}
                            style={{
                              fontSize: '0.7rem',
                              padding: '0.25rem 0.55rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                          >
                            <Bell size={11} />
                            <span>{notifyingCoachId === item.assignmentId ? 'Sending...' : 'Nudge Coach'}</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls for Assignment View */}
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
                Showing {filteredStalled.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, filteredStalled.length)} of {filteredStalled.length} records
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
                  Page {currentPage} of {totalAssignmentPages}
                </span>
                <button
                  type="button"
                  className="apid-btn apid-btn-outline apid-btn-sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalAssignmentPages, p + 1))}
                  disabled={currentPage === totalAssignmentPages}
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
