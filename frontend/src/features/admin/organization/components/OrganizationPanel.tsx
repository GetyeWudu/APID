import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { AxiosError } from 'axios';
import { useAuth } from '../../../../app/AuthContext';
import type { ApiErrorPayload } from '../../../../shared/api/apiClient';
import { organizationApi } from '../api/organizationApi';
import type {
  DepartmentItem,
  EmployeeItem,
  EmployeePage,
  EmploymentStatus,
  OrgImportCommitResult,
} from '../types/organization.types';
import { EmployeeSearchSelect } from './EmployeeSearchSelect';
import { EmployeeTeamModal } from './EmployeeTeamModal';
import { LinkUserModal } from './LinkUserModal';
import { OrgImportWizardModal } from './OrgImportWizardModal';

type SubView = 'employees' | 'departments';

const SAMPLE_HIERARCHY_CSV = [
  'EmployeeNumber,FullName,Email,Gender,ParentDepartment,Department,Job,Position,ManagerEmployeeNumber',
  '00010001,Abebe Bikila,abebe.bikila@bankofabyssinia.com,Male,Executive Office,Office of the Chief Executive,Executive Leadership,Chief Executive Officer,',
  '00010003,Bekele Tesfaye,bekele.tesfaye@bankofabyssinia.com,Male,Retail & Branch Banking,Retail Banking Directorate,Retail Executive,VP Retail & Branch Banking,00010001',
  '00010005,Lidia Girma,lidia.girma.005@bankofabyssinia.com,Female,Retail & Branch Banking,Bole Branch Operations,Branch Banking Officer,Senior Customer Service Officer,00010004',
].join('\n');

function triggerCsvDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function OrganizationPanel() {
  const { hasPermission } = useAuth();
  const canManageEmployeeAccounts =
    hasPermission('HIERARCHY_MANAGE') && hasPermission('USER_MANAGE');
  const [subView, setSubView] = useState<SubView>('employees');
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [employeePage, setEmployeePage] = useState<EmployeePage | null>(null);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState<EmploymentStatus | ''>('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Employee modal state
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeItem | null>(null);
  const [empNumber, setEmpNumber] = useState('');
  const [empFullName, setEmpFullName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empGender, setEmpGender] = useState('');
  const [empDeptId, setEmpDeptId] = useState<number | null>(null);
  const [empJob, setEmpJob] = useState('');
  const [empPosition, setEmpPosition] = useState('');
  const [empManagerId, setEmpManagerId] = useState<number | null>(null);
  const [empManagerLabel, setEmpManagerLabel] = useState<string | null>(null);
  const [empStatus, setEmpStatus] = useState<EmploymentStatus>('ACTIVE');

  // Department modal state
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentItem | null>(null);
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptParentId, setDeptParentId] = useState<number | null>(null);
  const [deptHeadId, setDeptHeadId] = useState<number | null>(null);
  const [deptHeadLabel, setDeptHeadLabel] = useState<string | null>(null);
  const [deptActive, setDeptActive] = useState(true);

  // Sub-modals
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [teamEmployee, setTeamEmployee] = useState<EmployeeItem | null>(null);
  const [linkUserEmployee, setLinkUserEmployee] = useState<EmployeeItem | null>(null);

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
      const res = await organizationApi.searchEmployees({
        search: search.trim() || undefined,
        departmentId: departmentFilter,
        status: statusFilter,
        page,
        size: 15,
      });
      setEmployeePage(res);
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setBanner({ type: 'err', text: ax.response?.data?.message || 'Failed to load employees' });
    } finally {
      setLoading(false);
    }
  }, [search, departmentFilter, statusFilter, page]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const refreshAll = async (okMessage?: string) => {
    if (okMessage) {
      setBanner({ type: 'ok', text: okMessage });
    }
    await Promise.all([loadEmployees(), loadDepartments()]);
  };

  const openCreateEmployee = () => {
    setEditingEmployee(null);
    setEmpNumber('');
    setEmpFullName('');
    setEmpEmail('');
    setEmpGender('');
    setEmpDeptId(null);
    setEmpJob('');
    setEmpPosition('');
    setEmpManagerId(null);
    setEmpManagerLabel(null);
    setEmpStatus('ACTIVE');
    setBanner(null);
    setShowEmpModal(true);
  };

  const openEditEmployee = (emp: EmployeeItem) => {
    setEditingEmployee(emp);
    setEmpNumber(emp.employeeNumber);
    setEmpFullName(emp.fullName);
    setEmpEmail(emp.email ?? '');
    setEmpGender(emp.gender ?? '');
    setEmpDeptId(emp.departmentId);
    setEmpJob(emp.job ?? '');
    setEmpPosition(emp.position ?? '');
    setEmpManagerId(emp.managerId);
    setEmpManagerLabel(
      emp.managerFullName ? `${emp.managerFullName} (${emp.managerEmployeeNumber})` : null
    );
    setEmpStatus(emp.employmentStatus);
    setBanner(null);
    setShowEmpModal(true);
  };

  const handleSaveEmployee = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setBanner(null);
    try {
      const payload = {
        employeeNumber: empNumber.trim(),
        fullName: empFullName.trim(),
        email: empEmail.trim() || undefined,
        gender: empGender.trim() || undefined,
        departmentId: empDeptId,
        job: empJob.trim() || undefined,
        position: empPosition.trim() || undefined,
        managerId: empManagerId,
        employmentStatus: empStatus,
      };
      if (editingEmployee) {
        await organizationApi.updateEmployee(editingEmployee.id, payload);
        await refreshAll(`Employee "${payload.fullName}" updated.`);
      } else {
        await organizationApi.createEmployee(payload);
        await refreshAll(`Employee "${payload.fullName}" created.`);
      }
      setShowEmpModal(false);
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setBanner({ type: 'err', text: ax.response?.data?.message || 'Failed to save employee' });
    } finally {
      setSaving(false);
    }
  };

  const openCreateDept = () => {
    setEditingDept(null);
    setDeptCode('');
    setDeptName('');
    setDeptParentId(null);
    setDeptHeadId(null);
    setDeptHeadLabel(null);
    setDeptActive(true);
    setBanner(null);
    setShowDeptModal(true);
  };

  const openEditDept = (dept: DepartmentItem) => {
    setEditingDept(dept);
    setDeptCode(dept.code ?? '');
    setDeptName(dept.name);
    setDeptParentId(dept.parentDepartmentId);
    setDeptHeadId(dept.headEmployeeId);
    setDeptHeadLabel(dept.headEmployeeName);
    setDeptActive(dept.active);
    setBanner(null);
    setShowDeptModal(true);
  };

  const handleSaveDepartment = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setBanner(null);
    try {
      const payload = {
        code: deptCode.trim() || undefined,
        name: deptName.trim(),
        parentDepartmentId: deptParentId,
        headEmployeeId: deptHeadId,
        active: deptActive,
      };
      if (editingDept) {
        await organizationApi.updateDepartment(editingDept.id, payload);
        await refreshAll(`Department "${payload.name}" updated.`);
      } else {
        await organizationApi.createDepartment(payload);
        await refreshAll(`Department "${payload.name}" created.`);
      }
      setShowDeptModal(false);
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setBanner({ type: 'err', text: ax.response?.data?.message || 'Failed to save department' });
    } finally {
      setSaving(false);
    }
  };

  const handleImportCommitted = async (result: OrgImportCommitResult) => {
    await refreshAll(
      `Import Batch #${result.batchId} (${result.fileFormat}) committed: ${result.employeesCreated} created, ${result.employeesUpdated} updated, ${result.departmentsCreated} departments created, ${result.managersLinked} managers linked (${result.duplicateRowsCollapsed} duplicate goal rows collapsed).`
    );
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

        <div className="apid-actions-cell">
          {subView === 'employees' ? (
            <>
              <button
                type="button"
                className="apid-btn apid-btn-outline"
                onClick={() => triggerCsvDownload('boa-hierarchy-sample.csv', SAMPLE_HIERARCHY_CSV)}
              >
                Sample CSV
              </button>
              <button
                type="button"
                className="apid-btn apid-btn-outline"
                onClick={() => {
                  setBanner(null);
                  setShowImportWizard(true);
                }}
              >
                Import CSV / Excel
              </button>
              <button type="button" className="apid-btn apid-btn-primary" onClick={openCreateEmployee}>
                + Add Employee
              </button>
            </>
          ) : (
            <button type="button" className="apid-btn apid-btn-primary" onClick={openCreateDept}>
              + Add Department
            </button>
          )}
        </div>
      </div>

      {banner && (
        <div className={`apid-alert ${banner.type === 'ok' ? 'apid-alert-ok' : 'apid-alert-err'}`}>
          {banner.text}
        </div>
      )}

      {subView === 'employees' ? (
        <>
          <div className="apid-toolbar-left" style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              className="apid-input"
              placeholder="Search emp #, name, email, position..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
            <select
              className="apid-input"
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value ? Number(e.target.value) : '');
                setPage(0);
              }}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.parentDepartmentName ? `${d.parentDepartmentName} / ${d.name}` : d.name}
                </option>
              ))}
            </select>
            <select
              className="apid-input"
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
          </div>

          <div className="apid-table-wrap">
            <table className="apid-table">
              <thead>
                <tr>
                  <th>Emp #</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Position / Job</th>
                  <th>Direct Manager</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7}>Loading employees...</td>
                  </tr>
                ) : !employeePage || employeePage.content.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No employee profiles found.</td>
                  </tr>
                ) : (
                  employeePage.content.map((emp) => (
                    <tr key={emp.id}>
                      <td>{emp.employeeNumber}</td>
                      <td>
                        <strong>{emp.fullName}</strong>
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                          {emp.email || 'No email'}
                          {emp.username ? ` • @${emp.username}` : ' • Unlinked'}
                        </div>
                      </td>
                      <td>
                        {emp.departmentName || '—'}
                        {emp.parentDepartmentName && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            {emp.parentDepartmentName}
                          </div>
                        )}
                      </td>
                      <td>{emp.position || emp.job || '—'}</td>
                      <td>{emp.managerFullName ? `${emp.managerFullName} (${emp.managerEmployeeNumber})` : '—'}</td>
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
                      <td className="apid-actions-cell">
                        <button type="button" className="apid-btn apid-btn-sm" onClick={() => openEditEmployee(emp)}>
                          Edit
                        </button>
                        <button type="button" className="apid-btn apid-btn-sm" onClick={() => setTeamEmployee(emp)}>
                          Team
                        </button>
                        {canManageEmployeeAccounts && (
                          <button
                            type="button"
                            className={`apid-btn apid-btn-sm${emp.userId ? ' apid-btn-danger' : ''}`}
                            onClick={() => setLinkUserEmployee(emp)}
                          >
                            {emp.userId ? 'Revoke Link' : 'Link User'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {employeePage && employeePage.totalPages > 1 && (
            <div className="apid-pagination">
              <button
                type="button"
                className="apid-btn apid-btn-outline apid-btn-sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </button>
              <span>
                Page {employeePage.number + 1} of {employeePage.totalPages} ({employeePage.totalElements} employees)
              </span>
              <button
                type="button"
                className="apid-btn apid-btn-outline apid-btn-sm"
                disabled={page + 1 >= employeePage.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="apid-table-wrap">
          <table className="apid-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Department</th>
                <th>Parent Directorate / Dept</th>
                <th>Head Employee</th>
                <th>Status</th>
                <th>Actions</th>
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
                    <td>{dept.code || '—'}</td>
                    <td>
                      <strong>{dept.name}</strong>
                    </td>
                    <td>{dept.parentDepartmentName || 'Root'}</td>
                    <td>{dept.headEmployeeName || '—'}</td>
                    <td>
                      <span className={`apid-status ${dept.active ? 'apid-status-active' : 'apid-status-disabled'}`}>
                        {dept.active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="apid-actions-cell">
                      <button type="button" className="apid-btn apid-btn-sm" onClick={() => openEditDept(dept)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showEmpModal && (
        <div className="apid-modal-backdrop">
          <div className="apid-modal apid-card" style={{ maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>{editingEmployee ? 'Edit Employee Profile' : 'Add Employee Profile'}</h3>
            <form className="apid-form" onSubmit={handleSaveEmployee}>
              <div className="apid-field">
                <label htmlFor="emp-number">Employee Number</label>
                <input
                  id="emp-number"
                  className="apid-input"
                  value={empNumber}
                  onChange={(e) => setEmpNumber(e.target.value)}
                  maxLength={60}
                  required
                />
              </div>
              <div className="apid-field">
                <label htmlFor="emp-fullname">Full Name</label>
                <input
                  id="emp-fullname"
                  className="apid-input"
                  value={empFullName}
                  onChange={(e) => setEmpFullName(e.target.value)}
                  maxLength={200}
                  required
                />
              </div>
              <div className="apid-field">
                <label htmlFor="emp-email">Work Email</label>
                <input
                  id="emp-email"
                  type="email"
                  className="apid-input"
                  value={empEmail}
                  onChange={(e) => setEmpEmail(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="apid-field">
                <label htmlFor="emp-gender">Gender</label>
                <select
                  id="emp-gender"
                  className="apid-input"
                  value={empGender}
                  onChange={(e) => setEmpGender(e.target.value)}
                >
                  <option value="">Unspecified</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div className="apid-field">
                <label htmlFor="emp-dept">Department</label>
                <select
                  id="emp-dept"
                  className="apid-input"
                  value={empDeptId ?? ''}
                  onChange={(e) => setEmpDeptId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">None</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.parentDepartmentName ? `${d.parentDepartmentName} / ${d.name}` : d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="apid-field">
                <label htmlFor="emp-job">Job</label>
                <input
                  id="emp-job"
                  className="apid-input"
                  value={empJob}
                  onChange={(e) => setEmpJob(e.target.value)}
                  maxLength={150}
                />
              </div>
              <div className="apid-field">
                <label htmlFor="emp-position">Position</label>
                <input
                  id="emp-position"
                  className="apid-input"
                  value={empPosition}
                  onChange={(e) => setEmpPosition(e.target.value)}
                  maxLength={150}
                />
              </div>
              <div className="apid-field">
                <label htmlFor="emp-manager">Direct Manager</label>
                <EmployeeSearchSelect
                  id="emp-manager"
                  value={empManagerId}
                  selectedLabel={empManagerLabel}
                  excludeId={editingEmployee?.id ?? null}
                  noneLabel="No Manager (Top Level)"
                  onChange={(nextId, item) => {
                    setEmpManagerId(nextId);
                    setEmpManagerLabel(item ? `${item.fullName} (${item.employeeNumber})` : null);
                  }}
                />
              </div>
              <div className="apid-field">
                <label htmlFor="emp-status">Employment Status</label>
                <select
                  id="emp-status"
                  className="apid-input"
                  value={empStatus}
                  onChange={(e) => setEmpStatus(e.target.value as EmploymentStatus)}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="ON_LEAVE">ON_LEAVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="TERMINATED">TERMINATED</option>
                </select>
              </div>

              <div className="apid-modal-actions">
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  disabled={saving}
                  onClick={() => setShowEmpModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="apid-btn apid-btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingEmployee ? 'Save Changes' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeptModal && (
        <div className="apid-modal-backdrop">
          <div className="apid-modal apid-card">
            <h3>{editingDept ? 'Edit Department' : 'Add Department'}</h3>
            <form className="apid-form" onSubmit={handleSaveDepartment}>
              <div className="apid-field">
                <label htmlFor="dept-code">Code (optional)</label>
                <input
                  id="dept-code"
                  className="apid-input"
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value)}
                  maxLength={60}
                />
              </div>
              <div className="apid-field">
                <label htmlFor="dept-name">Department Name</label>
                <input
                  id="dept-name"
                  className="apid-input"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  maxLength={150}
                  required
                />
              </div>
              <div className="apid-field">
                <label htmlFor="dept-parent">Parent Department</label>
                <select
                  id="dept-parent"
                  className="apid-input"
                  value={deptParentId ?? ''}
                  onChange={(e) => setDeptParentId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">None (Root Directorate / Dept)</option>
                  {departments
                    .filter((d) => !editingDept || d.id !== editingDept.id)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="apid-field">
                <label htmlFor="dept-head">Department Head</label>
                <EmployeeSearchSelect
                  id="dept-head"
                  value={deptHeadId}
                  selectedLabel={deptHeadLabel}
                  noneLabel="Unassigned"
                  onChange={(nextId, item) => {
                    setDeptHeadId(nextId);
                    setDeptHeadLabel(item ? `${item.fullName} (${item.employeeNumber})` : null);
                  }}
                />
              </div>
              {editingDept && (
                <label className="apid-checkbox-row">
                  <input
                    type="checkbox"
                    checked={deptActive}
                    onChange={(e) => setDeptActive(e.target.checked)}
                  />
                  <span>Active department</span>
                </label>
              )}
              <div className="apid-modal-actions">
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  disabled={saving}
                  onClick={() => setShowDeptModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="apid-btn apid-btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingDept ? 'Save Changes' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportWizard && (
        <OrgImportWizardModal
          onClose={() => setShowImportWizard(false)}
          onCommitted={handleImportCommitted}
          onDownloadStandardSample={() => triggerCsvDownload('boa-hierarchy-sample.csv', SAMPLE_HIERARCHY_CSV)}
        />
      )}

      {teamEmployee && (
        <EmployeeTeamModal
          employee={teamEmployee}
          onClose={() => setTeamEmployee(null)}
          onUpdated={refreshAll}
        />
      )}

      {linkUserEmployee && (
        <LinkUserModal
          employee={linkUserEmployee}
          onClose={() => setLinkUserEmployee(null)}
          onUpdated={refreshAll}
        />
      )}
    </div>
  );
}
