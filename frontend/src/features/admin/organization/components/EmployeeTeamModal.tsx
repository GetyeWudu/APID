import { useEffect, useState, type FormEvent } from 'react';
import type { AxiosError } from 'axios';
import type { ApiErrorPayload } from '../../../../shared/api/apiClient';
import { organizationApi } from '../api/organizationApi';
import type { EmployeeItem } from '../types/organization.types';
import { EmployeeSearchSelect } from './EmployeeSearchSelect';

interface EmployeeTeamModalProps {
  employee: EmployeeItem;
  onClose: () => void;
  onUpdated: (message: string) => Promise<void> | void;
}

export function EmployeeTeamModal({ employee, onClose, onUpdated }: EmployeeTeamModalProps) {
  const [manager, setManager] = useState<EmployeeItem | null>(null);
  const [directReports, setDirectReports] = useState<EmployeeItem[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<number | null>(employee.managerId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      organizationApi.getDirectManager(employee.id),
      organizationApi.getDirectReports(employee.id),
    ])
      .then(([mgr, reports]) => {
        if (!active) return;
        setManager(mgr);
        setDirectReports(reports);
      })
      .catch(() => {
        if (active) setErrorMsg('Failed to load reporting team details');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [employee.id]);

  const handleReassign = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      await organizationApi.updateEmployee(employee.id, {
        employeeNumber: employee.employeeNumber,
        fullName: employee.fullName,
        email: employee.email ?? undefined,
        gender: employee.gender ?? undefined,
        departmentId: employee.departmentId,
        job: employee.job ?? undefined,
        position: employee.position ?? undefined,
        managerId: selectedManagerId,
        employmentStatus: employee.employmentStatus,
      });
      await onUpdated(`Updated reporting manager for "${employee.fullName}".`);
      onClose();
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setErrorMsg(ax.response?.data?.message || 'Failed to reassign direct manager');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="apid-modal-backdrop">
      <div className="apid-modal apid-card" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3>Reporting Hierarchy — {employee.fullName} ({employee.employeeNumber})</h3>
        {errorMsg && <div className="apid-alert apid-alert-err">{errorMsg}</div>}

        {loading ? (
          <p className="apid-subtitle">Loading reporting chain...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg)' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Current Direct Manager</div>
              <strong>
                {manager ? `${manager.fullName} (${manager.employeeNumber}) — ${manager.position || manager.job || 'Manager'}` : 'None (Top Level)'}
              </strong>
            </div>

            <form className="apid-form" onSubmit={handleReassign}>
              <div className="apid-field">
                <label htmlFor="reassign-mgr-select">Reassign Direct Manager (Cycle-Guarded)</label>
                <EmployeeSearchSelect
                  id="reassign-mgr-select"
                  value={selectedManagerId}
                  selectedLabel={
                    employee.managerFullName
                      ? `${employee.managerFullName} (${employee.managerEmployeeNumber})`
                      : null
                  }
                  excludeId={employee.id}
                  noneLabel="No Manager (Top Level)"
                  onChange={(nextId) => setSelectedManagerId(nextId)}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                {selectedManagerId != null && (
                  <button
                    type="button"
                    className="apid-btn apid-btn-outline apid-btn-sm"
                    disabled={saving}
                    onClick={() => setSelectedManagerId(null)}
                  >
                    Clear Manager
                  </button>
                )}
                <button type="submit" className="apid-btn apid-btn-primary apid-btn-sm" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Manager Change'}
                </button>
              </div>
            </form>

            <div>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.92rem' }}>
                Direct Reports ({directReports.length})
              </h4>
              {directReports.length === 0 ? (
                <p className="apid-subtitle" style={{ marginBottom: 0 }}>No employees report directly to this profile.</p>
              ) : (
                <div className="apid-table-wrap">
                  <table className="apid-table">
                    <thead>
                      <tr>
                        <th>Emp #</th>
                        <th>Name</th>
                        <th>Position</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {directReports.map((rep) => (
                        <tr key={rep.id}>
                          <td>{rep.employeeNumber}</td>
                          <td>{rep.fullName}</td>
                          <td>{rep.position || rep.job || '—'}</td>
                          <td>{rep.employmentStatus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="apid-modal-actions" style={{ marginTop: '1rem' }}>
          <button type="button" className="apid-btn apid-btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

