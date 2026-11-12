import { useState, type FormEvent } from 'react';
import type { AxiosError } from 'axios';
import type { ApiErrorPayload } from '../../../../shared/api/apiClient';
import { organizationApi } from '../api/organizationApi';
import type {
  OrgImportBatchPreview,
  OrgImportCommitResult,
  OrgImportRowStatus,
} from '../types/organization.types';

interface OrgImportWizardModalProps {
  onClose: () => void;
  onCommitted: (result: OrgImportCommitResult) => Promise<void> | void;
  onDownloadStandardSample: () => void;
}

export function OrgImportWizardModal({
  onClose,
  onCommitted,
  onDownloadStandardSample,
}: OrgImportWizardModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<OrgImportBatchPreview | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrgImportRowStatus | ''>('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePreview = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await organizationApi.previewImport(selectedFile, 0, 15);
      setPreview(res);
      setPage(0);
      setStatusFilter('');
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setErrorMsg(ax.response?.data?.message || 'Failed to parse and preview import file');
    } finally {
      setLoading(false);
    }
  };

  const loadPreviewPage = async (batchId: number, nextPage: number, nextStatus: OrgImportRowStatus | '') => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await organizationApi.getImportBatch(batchId, nextPage, 15, nextStatus);
      setPreview(res);
      setPage(nextPage);
      setStatusFilter(nextStatus);
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setErrorMsg(ax.response?.data?.message || 'Failed to load preview page');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const committed = await organizationApi.commitImportBatch(preview.batchId);
      await onCommitted(committed);
      onClose();
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setErrorMsg(ax.response?.data?.message || 'Failed to commit import batch');
    } finally {
      setLoading(false);
    }
  };

  const handleResetToUpload = async () => {
    if (preview && preview.status === 'PREVIEWED') {
      try {
        await organizationApi.cancelImportBatch(preview.batchId);
      } catch {
        // Ignore cleanup failure when resetting wizard
      }
    }
    setPreview(null);
    setSelectedFile(null);
    setErrorMsg(null);
  };

  const handleClose = async () => {
    if (preview && preview.status === 'PREVIEWED') {
      try {
        await organizationApi.cancelImportBatch(preview.batchId);
      } catch {
        // Ignore cancel failures on close
      }
    }
    onClose();
  };

  return (
    <div className="apid-modal-backdrop">
      <div
        className="apid-modal apid-card"
        style={{ maxWidth: preview ? '920px' : '600px', maxHeight: '92vh', overflowY: 'auto' }}
      >
        <h3>Import Employees & Organizational Hierarchy (CSV / Excel)</h3>

        {errorMsg && <div className="apid-alert apid-alert-err">{errorMsg}</div>}

        {!preview ? (
          <form className="apid-form" onSubmit={handlePreview}>
            <p className="apid-subtitle" style={{ marginBottom: 0 }}>
              Upload the <strong>Employees &amp; Hierarchy Directory (.csv / .xlsx)</strong> with{' '}
              <code>EmployeeNumber, FullName, Email, ParentDepartment, Department, Job, Position, ManagerEmployeeNumber</code>.
              PMS appraisal reports are uploaded separately under PMS Coaching.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="apid-btn apid-btn-outline apid-btn-sm" onClick={onDownloadStandardSample}>
                Download Hierarchy Sample CSV
              </button>
            </div>
            <div className="apid-field">
              <label htmlFor="org-import-file">Select CSV or Excel File (.csv, .xlsx)</label>
              <input
                id="org-import-file"
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                required
              />
            </div>
            <div className="apid-alert" style={{ background: 'var(--bg)', border: '1px solid var(--border)', marginBottom: 0 }}>
              <strong>Policy:</strong> Step 1 parses and validates your file first without modifying the database.
              Missing columns or blank optional cells preserve existing values. No login accounts are created here.
            </div>
            <div className="apid-modal-actions">
              <button type="button" className="apid-btn apid-btn-outline" disabled={loading} onClick={handleClose}>
                Cancel
              </button>
              <button type="submit" className="apid-btn apid-btn-primary" disabled={loading || !selectedFile}>
                {loading ? 'Parsing & Validating...' : 'Upload & Validate'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
                padding: '0.65rem 0.85rem',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                background: 'var(--bg)',
                fontSize: '0.85rem',
              }}
            >
              <div>
                <strong>{preview.fileName}</strong> • Format: <code>{preview.fileFormat}</code> • Schema:{' '}
                <code>Standard Org Hierarchy</code>
              </div>
              <div>
                Manager Column:{' '}
                <span className={`apid-status ${preview.managerColumnDetected ? 'apid-status-active' : 'apid-status-templock'}`}>
                  {preview.managerColumnDetected ? 'Detected' : 'Not Detected'}
                </span>
              </div>
            </div>

            {!preview.managerColumnDetected && (
              <div className="apid-alert apid-alert-ok" style={{ marginBottom: 0 }}>
                No <code>ManagerEmployeeNumber</code> column detected — existing direct manager assignments will be preserved.
              </div>
            )}

            {preview.summaryWarnings.length > 0 && (
              <div className="apid-alert" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', marginBottom: 0 }}>
                <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                  {preview.summaryWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '0.5rem',
              }}
            >
              {[
                { label: 'Source Rows', value: preview.totalSourceRows },
                { label: 'To Create', value: preview.employeesToCreate },
                { label: 'To Update', value: preview.employeesToUpdate },
                { label: 'Collapsed Rows', value: preview.duplicateRowsCollapsed },
                { label: 'New Depts', value: preview.departmentsToCreate },
                { label: 'Managers Linked', value: preview.managersToLink },
                { label: 'Warnings', value: preview.warningRows, color: preview.warningRows > 0 ? 'var(--brand)' : undefined },
                { label: 'Errors', value: preview.errorRows, color: preview.errorRows > 0 ? 'var(--err)' : 'var(--ok)' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0.55rem 0.7rem',
                    background: 'var(--surface)',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{stat.label}</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: stat.color || 'var(--text)' }}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="apid-toolbar" style={{ marginBottom: 0 }}>
              <div className="apid-toolbar-left">
                {(['', 'ERROR', 'WARNING', 'VALID'] as const).map((st) => (
                  <button
                    key={st || 'ALL'}
                    type="button"
                    className={`apid-tab ${statusFilter === st ? 'active' : ''}`}
                    onClick={() => loadPreviewPage(preview.batchId, 0, st)}
                    disabled={loading}
                  >
                    {st === '' ? 'All Rows' : st}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                Batch #{preview.batchId} • Expires {new Date(preview.expiresAt).toLocaleTimeString()}
              </span>
            </div>

            <div className="apid-table-wrap">
              <table className="apid-table">
                <thead>
                  <tr>
                    <th>Row(s)</th>
                    <th>Emp #</th>
                    <th>Full Name</th>
                    <th>Department</th>
                    <th>Position</th>
                    <th>Manager #</th>
                    <th>Action / Status</th>
                    <th>Validation Messages</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.content.length === 0 ? (
                    <tr>
                      <td colSpan={8}>No rows match this filter.</td>
                    </tr>
                  ) : (
                    preview.rows.content.map((row) => (
                      <tr key={row.id}>
                        <td>{row.sourceRowNumbers.join(', ')}</td>
                        <td>{row.employeeNumber || '—'}</td>
                        <td>{row.fullName || '—'}</td>
                        <td>
                          {row.department || row.parentDepartment || '—'}
                          {row.parentDepartment && row.department && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{row.parentDepartment}</div>
                          )}
                        </td>
                        <td>{row.position || row.job || '—'}</td>
                        <td>{row.managerEmployeeNumber || '—'}</td>
                        <td>
                          <span
                            className={`apid-status ${
                              row.rowStatus === 'ERROR'
                                ? 'apid-status-disabled'
                                : row.rowStatus === 'WARNING'
                                  ? 'apid-status-templock'
                                  : 'apid-status-active'
                            }`}
                          >
                            {row.plannedAction} ({row.rowStatus})
                          </span>
                        </td>
                        <td style={{ fontSize: '0.78rem' }}>
                          {row.errors.map((err, i) => (
                            <div key={`e-${i}`} style={{ color: 'var(--err)' }}>
                              • {err}
                            </div>
                          ))}
                          {row.warnings.map((w, i) => (
                            <div key={`w-${i}`} style={{ color: 'var(--brand)' }}>
                              • {w}
                            </div>
                          ))}
                          {row.errors.length === 0 && row.warnings.length === 0 && 'OK'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {preview.rows.totalPages > 1 && (
              <div className="apid-pagination" style={{ marginTop: 0 }}>
                <button
                  type="button"
                  className="apid-btn apid-btn-outline apid-btn-sm"
                  disabled={loading || page === 0}
                  onClick={() => loadPreviewPage(preview.batchId, page - 1, statusFilter)}
                >
                  Prev
                </button>
                <span>
                  Page {preview.rows.number + 1} of {preview.rows.totalPages} ({preview.rows.totalElements} rows)
                </span>
                <button
                  type="button"
                  className="apid-btn apid-btn-outline apid-btn-sm"
                  disabled={loading || page + 1 >= preview.rows.totalPages}
                  onClick={() => loadPreviewPage(preview.batchId, page + 1, statusFilter)}
                >
                  Next
                </button>
              </div>
            )}

            <div className="apid-modal-actions">
              <button
                type="button"
                className="apid-btn apid-btn-outline"
                disabled={loading}
                onClick={handleResetToUpload}
              >
                Upload Different File
              </button>
              <button type="button" className="apid-btn apid-btn-outline" disabled={loading} onClick={handleClose}>
                Cancel
              </button>
              <button
                type="button"
                className="apid-btn apid-btn-primary"
                disabled={loading || preview.errorRows > 0 || preview.expired}
                onClick={handleCommit}
              >
                {loading
                  ? 'Committing...'
                  : preview.errorRows > 0
                    ? `Fix ${preview.errorRows} Error(s) Before Commit`
                    : 'Step 2: Confirm & Commit Import'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

