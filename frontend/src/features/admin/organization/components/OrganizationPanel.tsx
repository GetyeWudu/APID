import { useCallback, useEffect, useState, useMemo } from 'react';
import type { AxiosError } from 'axios';
import type { ApiErrorPayload } from '../../../../shared/api/apiClient';
import { organizationApi } from '../api/organizationApi';
import { usersApi } from '../../users/api/usersApi';
import type {
  DepartmentItem,
  EmployeeItem,
  EmployeePage,
  EmploymentStatus,
} from '../types/organization.types';
import { EmployeeTeamModal } from './EmployeeTeamModal';

type SubView = 'employees' | 'departments';
type ScopeFilter = 'ALL' | 'HEAD_OFFICE' | 'DISTRICTS' | 'BRANCHES';

export function OrganizationPanel() {
  const [subView, setSubView] = useState<SubView>('employees');
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [employeePage, setEmployeePage] = useState<EmployeePage | null>(null);

  // Smart Filters
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('ALL');
  const [districtFilter, setDistrictFilter] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<number | ''>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<EmploymentStatus | ''>('');
  const [managerDrilldown, setManagerDrilldown] = useState<{ id: number; name: string; empNo: string } | null>(null);
  const [pageSize, setPageSize] = useState<number>(15);
  const [page, setPage] = useState(0);

  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleManualSync = async () => {
    setSyncing(true);
    setBanner(null);
    try {
      const res = await usersApi.syncLdap();
      setBanner({
        type: 'ok',
        text: `Active Directory sync completed in ${res.durationMs}ms: ${res.usersScanned} accounts scanned, ${res.managersLinked} managers linked, ${res.rolesAssigned} roles reconciled.`,
      });
      await loadEmployees();
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setBanner({
        type: 'err',
        text: ax.response?.data?.message || 'Failed to synchronize with Active Directory',
      });
    } finally {
      setSyncing(false);
    }
  };

  // Read-only Profile modal state
  const [viewingEmployee, setViewingEmployee] = useState<EmployeeItem | null>(null);

  // Team hierarchy modal state
  const [teamEmployee, setTeamEmployee] = useState<EmployeeItem | null>(null);

  // Derive Organizational Units
  const districtDepts = useMemo(() => {
    return departments.filter(
      (d) => (d.code && d.code.endsWith('-DISTRICT')) || d.name.toLowerCase().includes('district')
    );
  }, [departments]);

  const districtIds = useMemo(() => new Set(districtDepts.map((d) => d.id)), [districtDepts]);

  const headOfficeDepts = useMemo(() => {
    // Departments that are not districts and not branch children of districts
    return departments.filter((d) => {
      if (districtIds.has(d.id)) return false;
      if (d.parentDepartmentId && districtIds.has(d.parentDepartmentId)) return false;
      return true;
    });
  }, [departments, districtIds]);

  const allBranchDepts = useMemo(() => {
    return departments.filter((d) => d.parentDepartmentId && districtIds.has(d.parentDepartmentId));
  }, [departments, districtIds]);

  // Dynamically populated cascading branches / divisions
  const cascadingDepts = useMemo(() => {
    if (districtFilter === 'HEAD_OFFICE') {
      return headOfficeDepts.filter((d) => d.parentDepartmentId !== null);
    }
    if (districtFilter) {
      const parentId = Number(districtFilter);
      return departments.filter((d) => d.parentDepartmentId === parentId);
    }
    return departments;
  }, [districtFilter, departments, headOfficeDepts]);

  const hasActiveFilters = Boolean(
    search ||
      scopeFilter !== 'ALL' ||
      districtFilter ||
      departmentFilter ||
      roleFilter ||
      statusFilter ||
      managerDrilldown
  );

  const loadDepartments = useCallback(async () => {
    try {
      const deptList = await organizationApi.listDepartments(false);
      setDepartments(deptList);
    } catch {
      // Errors surfaced via employee load
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      let resolvedDeptId: number | '' = departmentFilter;
      let resolvedDeptIds: number[] | undefined = undefined;

      if (!departmentFilter) {
        if (scopeFilter === 'HEAD_OFFICE' || districtFilter === 'HEAD_OFFICE') {
          resolvedDeptIds = headOfficeDepts.map((d) => d.id);
        } else if (scopeFilter === 'DISTRICTS') {
          resolvedDeptIds = districtDepts.map((d) => d.id);
        } else if (scopeFilter === 'BRANCHES') {
          resolvedDeptIds = allBranchDepts.map((d) => d.id);
        } else if (districtFilter) {
          resolvedDeptId = Number(districtFilter);
        }
      }

      const res = await organizationApi.searchEmployees({
        search: search.trim() || undefined,
        departmentId: resolvedDeptId,
        departmentIds: resolvedDeptIds,
        position: roleFilter || undefined,
        status: statusFilter,
        managerId: managerDrilldown ? managerDrilldown.id : undefined,
        page,
        size: pageSize,
      });
      setEmployeePage(res);
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setBanner({ type: 'err', text: ax.response?.data?.message || 'Failed to load employees' });
    } finally {
      setLoading(false);
    }
  }, [
    search,
    scopeFilter,
    districtFilter,
    departmentFilter,
    roleFilter,
    statusFilter,
    managerDrilldown,
    page,
    pageSize,
    headOfficeDepts,
    districtDepts,
    allBranchDepts,
  ]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const handleScopeChange = (nextScope: ScopeFilter) => {
    setScopeFilter(nextScope);
    setDepartmentFilter('');
    setPage(0);
    if (nextScope === 'HEAD_OFFICE') {
      setDistrictFilter('HEAD_OFFICE');
    } else if (nextScope === 'ALL') {
      setDistrictFilter('');
    }
  };

  const handleDistrictChange = (nextDistrict: string) => {
    setDistrictFilter(nextDistrict);
    setDepartmentFilter('');
    setPage(0);
    if (nextDistrict === 'HEAD_OFFICE') {
      setScopeFilter('HEAD_OFFICE');
    } else if (nextDistrict) {
      setScopeFilter('ALL');
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setScopeFilter('ALL');
    setDistrictFilter('');
    setDepartmentFilter('');
    setRoleFilter('');
    setStatusFilter('');
    setManagerDrilldown(null);
    setPage(0);
  };

  const handleDrilldown = (mgrId: number, mgrName: string, mgrEmpNo: string) => {
    setManagerDrilldown({ id: mgrId, name: mgrName, empNo: mgrEmpNo });
    setPage(0);
  };

  return (
    <div className="apid-card">
      <div className="apid-toolbar">
        <div className="apid-toolbar-left">
          <button
            type="button"
            className={`apid-tab ${subView === 'employees' ? 'active' : ''}`}
            onClick={() => setSubView('employees')}
          >
            Employees ({employeePage?.totalElements ?? 0})
          </button>
          <button
            type="button"
            className={`apid-tab ${subView === 'departments' ? 'active' : ''}`}
            onClick={() => setSubView('departments')}
          >
            Departments ({departments.length})
          </button>
        </div>

        <div className="apid-actions-cell" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            type="button"
            className="apid-btn apid-btn-sm apid-btn-outline"
            disabled={syncing || loading}
            onClick={handleManualSync}
            title="Trigger immediate Active Directory synchronization & manager hierarchy reconciliation"
          >
            <span>{syncing ? '⏳ Syncing AD...' : '🔄 Sync Active Directory'}</span>
          </button>
          <span
            className="boa-pill boa-pill-info"
            title="All organizational structures and user profiles are synchronized directly from Active Directory Domain Services (every 30 mins)"
          >
            AD SSoT (30m sync)
          </span>
        </div>
      </div>

      {banner && (
        <div className={`apid-alert ${banner.type === 'ok' ? 'apid-alert-ok' : 'apid-alert-err'}`}>
          {banner.text}
        </div>
      )}

      {subView === 'employees' ? (
        <>
          {/* Level 1: Scope Pills */}
          <div
            style={{
              display: 'flex',
              gap: '0.45rem',
              marginBottom: '0.85rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', marginRight: '0.2rem' }}>
              Organizational Scope:
            </span>
            <button
              type="button"
              className={`apid-btn apid-btn-sm ${scopeFilter === 'ALL' && !districtFilter ? 'apid-btn-primary' : 'apid-btn-outline'}`}
              onClick={() => handleScopeChange('ALL')}
            >
              All Employees (150)
            </button>
            <button
              type="button"
              className={`apid-btn apid-btn-sm ${scopeFilter === 'HEAD_OFFICE' ? 'apid-btn-primary' : 'apid-btn-outline'}`}
              onClick={() => handleScopeChange('HEAD_OFFICE')}
            >
              🏛️ Head Office (25)
            </button>
            <button
              type="button"
              className={`apid-btn apid-btn-sm ${scopeFilter === 'DISTRICTS' ? 'apid-btn-primary' : 'apid-btn-outline'}`}
              onClick={() => handleScopeChange('DISTRICTS')}
            >
              📍 District Directors (5)
            </button>
            <button
              type="button"
              className={`apid-btn apid-btn-sm ${scopeFilter === 'BRANCHES' ? 'apid-btn-primary' : 'apid-btn-outline'}`}
              onClick={() => handleScopeChange('BRANCHES')}
            >
              🏦 All 20 Branches (120)
            </button>
          </div>

          {/* Level 2: Smart Cascading Filters Bar */}
          <div
            className="apid-toolbar-left"
            style={{
              marginBottom: '0.85rem',
              flexWrap: 'wrap',
              gap: '0.5rem',
              alignItems: 'center',
            }}
          >
            {/* Search Input */}
            <input
              type="text"
              className="apid-input"
              style={{ minWidth: '220px', flex: '1 1 200px' }}
              placeholder="Search emp #, name, @user, email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />

            {/* Cascading District Selector */}
            <select
              className="apid-input"
              style={{ flex: '1 1 180px' }}
              value={districtFilter}
              onChange={(e) => handleDistrictChange(e.target.value)}
            >
              <option value="">All Regions & Divisions</option>
              <option value="HEAD_OFFICE">🏛️ Head Office (25 Staff)</option>
              <optgroup label="Bank of Abyssinia Districts">
                {districtDepts.map((d) => (
                  <option key={d.id} value={d.id}>
                    📍 {d.name} (25 Staff)
                  </option>
                ))}
              </optgroup>
            </select>

            {/* Cascading Branch / Department Selector */}
            <select
              className="apid-input"
              style={{ flex: '1 1 200px' }}
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value ? Number(e.target.value) : '');
                setPage(0);
              }}
            >
              <option value="">
                {districtFilter === 'HEAD_OFFICE'
                  ? 'All Head Office Divisions'
                  : districtFilter
                    ? 'All Branches in this District'
                    : 'All Branches & Departments'}
              </option>
              {cascadingDepts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            {/* Position / Role Filter */}
            <select
              className="apid-input"
              style={{ flex: '1 1 170px' }}
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All Positions & Roles</option>
              <option value="Chief Executive Officer">Chief Executive Officer (CEO)</option>
              <option value="VP Retail">VP Retail & Branch Banking</option>
              <option value="Director">Directors (Tech, Credit, Districts)</option>
              <option value="Branch Manager">Branch Managers</option>
              <option value="Customer Service Officer">Senior Customer Service Officers</option>
              <option value="Cash Teller Officer">Cash Teller Officers</option>
              <option value="Personal Banker">Personal Bankers</option>
              <option value="Software Developer">Senior Software Developers</option>
              <option value="Credit Analyst">Senior Credit Analysts</option>
            </select>

            {/* Employment Status Filter */}
            <select
              className="apid-input"
              style={{ flex: '0 1 130px' }}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as EmploymentStatus | '');
                setPage(0);
              }}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ON_LEAVE">ON_LEAVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="TERMINATED">TERMINATED</option>
            </select>

            {/* Reset Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                className="apid-btn apid-btn-outline apid-btn-sm"
                onClick={handleResetFilters}
                title="Clear all active filters"
              >
                Reset Filters ✕
              </button>
            )}
          </div>

          {/* Manager Drill-Down Banner */}
          {managerDrilldown && (
            <div
              className="apid-alert apid-alert-ok"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                padding: '0.5rem 0.85rem',
              }}
            >
              <span>
                👥 <strong>Direct Team Drilldown:</strong> Showing direct subordinates reporting to{' '}
                <strong>
                  {managerDrilldown.name} ({managerDrilldown.empNo})
                </strong>
              </span>
              <button
                type="button"
                className="apid-btn apid-btn-sm apid-btn-outline"
                style={{ background: 'white' }}
                onClick={() => {
                  setManagerDrilldown(null);
                  setPage(0);
                }}
              >
                Clear Drilldown ✕
              </button>
            </div>
          )}

          {/* Employees Table */}
          <div className="apid-table-wrap">
            <table className="apid-table">
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>Emp #</th>
                  <th>Employee Profile</th>
                  <th>Department / District</th>
                  <th>Position / Job</th>
                  <th>Direct Manager</th>
                  <th style={{ width: '80px' }}>Status</th>
                  <th style={{ width: '150px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7}>Loading employees...</td>
                  </tr>
                ) : !employeePage || employeePage.content.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No employee profiles match the selected filters.</td>
                  </tr>
                ) : (
                  employeePage.content.map((emp) => (
                    <tr key={emp.id}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {emp.employeeNumber}
                        </span>
                      </td>
                      <td>
                        <strong>{emp.fullName}</strong>
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                          {emp.email || 'No email'}
                          {emp.username ? (
                            <span style={{ color: 'var(--info)', fontWeight: 600 }}>
                              {' '}• @{emp.username}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--muted)' }}> • Unlinked</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div>{emp.departmentName || '—'}</div>
                        {emp.parentDepartmentName && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            {emp.parentDepartmentName}
                          </div>
                        )}
                      </td>
                      <td>
                        <div>{emp.position || emp.job || '—'}</div>
                        {emp.job && emp.position && emp.job !== emp.position && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            {emp.job}
                          </div>
                        )}
                      </td>
                      <td>
                        {emp.managerFullName ? (
                          <button
                            type="button"
                            className="apid-btn apid-btn-outline apid-btn-sm"
                            style={{
                              border: 'none',
                              padding: '0.15rem 0.4rem',
                              background: 'transparent',
                              color: 'var(--info)',
                              cursor: 'pointer',
                              textAlign: 'left',
                              textDecoration: 'underline',
                            }}
                            title={`Filter direct reports of ${emp.managerFullName}`}
                            onClick={() =>
                              handleDrilldown(
                                emp.managerId!,
                                emp.managerFullName!,
                                emp.managerEmployeeNumber || ''
                              )
                            }
                          >
                            {emp.managerFullName} ({emp.managerEmployeeNumber})
                          </button>
                        ) : (
                          <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                            Top Level (CEO)
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`apid-status ${
                            emp.employmentStatus === 'ACTIVE'
                              ? 'apid-status-active'
                              : emp.employmentStatus === 'ON_LEAVE'
                                ? 'apid-status-templock'
                                : 'apid-status-disabled'
                          }`}
                        >
                          {emp.employmentStatus}
                        </span>
                      </td>
                      <td className="apid-actions-cell" style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="apid-btn apid-btn-sm apid-btn-outline"
                          onClick={() => setViewingEmployee(emp)}
                          title="View read-only employee profile details"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="apid-btn apid-btn-sm"
                          onClick={() => setTeamEmployee(emp)}
                          title="View direct reports & reporting tree"
                        >
                          Team
                        </button>
                        {emp.username && (
                          <span
                            className="boa-pill boa-pill-info"
                            style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem' }}
                            title="Synchronized and authenticated from Active Directory DS"
                          >
                            AD Synced
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Level 3: Smart Pagination & Rows Per Page Controls */}
          <div
            className="apid-pagination"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginTop: '1rem',
            }}
          >
            {/* Rows Per Page Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Rows per page:</span>
              <select
                className="apid-input"
                style={{ width: 'auto', padding: '0.2rem 0.5rem', height: '32px' }}
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Prev / Page X of Y / Next */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                className="apid-btn apid-btn-outline apid-btn-sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Prev
              </button>
              <span style={{ fontSize: '0.85rem' }}>
                Page {employeePage ? employeePage.number + 1 : 1} of{' '}
                {employeePage ? Math.max(1, employeePage.totalPages) : 1} (
                {employeePage?.totalElements ?? 0} employees)
              </span>
              <button
                type="button"
                className="apid-btn apid-btn-outline apid-btn-sm"
                disabled={!employeePage || page + 1 >= employeePage.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="apid-table-wrap">
          <table className="apid-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Department</th>
                <th>Parent Directorate / Region</th>
                <th>Head Employee</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Source</th>
              </tr>
            </thead>
            <tbody>
              {departments.length === 0 ? (
                <tr>
                  <td colSpan={6}>No departments configured yet.</td>
                </tr>
              ) : (
                departments.map((dept) => (
                  <tr key={dept.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace' }}>{dept.code || '—'}</span>
                    </td>
                    <td>
                      <strong>{dept.name}</strong>
                    </td>
                    <td>{dept.parentDepartmentName || 'Corporate Directorate (Root)'}</td>
                    <td>{dept.headEmployeeName || '—'}</td>
                    <td>
                      <span className={`apid-status ${dept.active ? 'apid-status-active' : 'apid-status-disabled'}`}>
                        {dept.active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span
                        className="boa-pill boa-pill-info"
                        style={{ fontSize: '0.72rem' }}
                        title="Managed directly in Bank of Abyssinia Active Directory & Enterprise Database"
                      >
                        AD Managed
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Read-Only Employee Profile Modal */}
      {viewingEmployee && (
        <div className="apid-modal-backdrop">
          <div className="apid-modal apid-card" style={{ maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0 }}>Employee Profile</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                  Synchronized from Active Directory (Domain: <code style={{ color: 'var(--info)' }}>apid.test</code>)
                </div>
              </div>
              <span className="boa-pill boa-pill-info">AD Synced</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="apid-field">
                <label style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Employee Number</label>
                <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '1rem' }}>
                  {viewingEmployee.employeeNumber}
                </div>
              </div>

              <div className="apid-field">
                <label style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Full Legal Name</label>
                <div style={{ fontWeight: 600, fontSize: '1rem' }}>{viewingEmployee.fullName}</div>
              </div>

              <div className="apid-field">
                <label style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Corporate Work Email</label>
                <div>{viewingEmployee.email || '—'}</div>
              </div>

              <div className="apid-field">
                <label style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Active Directory Login Username</label>
                <div style={{ color: 'var(--info)', fontWeight: 600 }}>
                  {viewingEmployee.username ? `@${viewingEmployee.username}` : 'Unlinked'}
                </div>
              </div>

              <div className="apid-field">
                <label style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Department / Unit</label>
                <div>
                  <strong>{viewingEmployee.departmentName || '—'}</strong>
                  {viewingEmployee.parentDepartmentName && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                      Directorate / Region: {viewingEmployee.parentDepartmentName}
                    </div>
                  )}
                </div>
              </div>

              <div className="apid-field">
                <label style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Position / Job Title</label>
                <div>{viewingEmployee.position || viewingEmployee.job || '—'}</div>
              </div>

              <div className="apid-field">
                <label style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Direct Supervisor (Reporting Line)</label>
                <div>
                  {viewingEmployee.managerFullName ? (
                    <span>
                      {viewingEmployee.managerFullName} ({viewingEmployee.managerEmployeeNumber})
                    </span>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>Top Level Executive (Chief Executive Officer)</span>
                  )}
                </div>
              </div>

              <div className="apid-field">
                <label style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Employment Status</label>
                <div>
                  <span
                    className={`apid-status ${
                      viewingEmployee.employmentStatus === 'ACTIVE'
                        ? 'apid-status-active'
                        : viewingEmployee.employmentStatus === 'ON_LEAVE'
                          ? 'apid-status-templock'
                          : 'apid-status-disabled'
                    }`}
                  >
                    {viewingEmployee.employmentStatus}
                  </span>
                </div>
              </div>
            </div>

            <div className="apid-alert apid-alert-info" style={{ marginTop: '1.25rem', fontSize: '0.8rem' }}>
              Directory Governance: This employee profile is managed directly via Active Directory Domain Services. Any identity changes made in AD DS automatically synchronize to APID.
            </div>

            <div className="apid-modal-actions" style={{ marginTop: '1.25rem' }}>
              <button
                type="button"
                className="apid-btn apid-btn-primary"
                onClick={() => setViewingEmployee(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Reports Team Hierarchy Modal */}
      {teamEmployee && (
        <EmployeeTeamModal
          employee={teamEmployee}
          onClose={() => setTeamEmployee(null)}
          onUpdated={() => loadEmployees()}
        />
      )}
    </div>
  );
}
