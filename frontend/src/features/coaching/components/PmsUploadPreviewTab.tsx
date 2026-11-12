import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Upload,
  RotateCcw,
  Check,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import { DataSourceBadge, StatusPill, useToast } from '../../../shared/components/ui';
import {
  pmsImportApi,
  PmsBatchSummary,
  PmsConsolidatedEmployee,
  FiscalQuarterOption,
} from '../api/pmsImportApi';

export function PmsUploadPreviewTab() {
  const { hasPermission } = useAuth();
  const { pushToast } = useToast();

  const [quarters, setQuarters] = useState<FiscalQuarterOption[]>([]);
  const [perfQuarterId, setPerfQuarterId] = useState<number | null>(null);
  const [coachQuarterId, setCoachQuarterId] = useState<number | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [committing, setCommitting] = useState(false);

  const [batch, setBatch] = useState<PmsBatchSummary | null>(null);
  const [employees, setEmployees] = useState<PmsConsolidatedEmployee[]>([]);
  const [, setPage] = useState(0);
  const [, setTotalPages] = useState(0);
  const [, setTotalElements] = useState(0);
  const [filter, setFilter] = useState<'ALL' | 'MANDATORY' | 'PASSING' | 'ERROR' | 'WARNING'>('ALL');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Load available quarters
  useEffect(() => {
    pmsImportApi
      .listQuarters()
      .then((data) => {
        setQuarters(data);
        const active = data.find((q) => q.active);
        const q1 = data.find((q) => q.quarter === 1);
        if (q1) setPerfQuarterId(q1.id);
        else if (data.length > 0) setPerfQuarterId(data[0].id);

        if (active) setCoachQuarterId(active.id);
        else if (data.length > 0) setCoachQuarterId(data[0].id);
      })
      .catch((err) => {
        console.error('Failed to load quarters', err);
      });
  }, []);

  const handleUpload = async () => {
    if (!file || !perfQuarterId || !coachQuarterId) return;
    setBusy(true);
    try {
      const res = await pmsImportApi.uploadPreview(file, perfQuarterId, coachQuarterId);
      setBatch(res.batch);
      setEmployees(res.employees.content);
      setTotalPages(res.employees.totalPages);
      setTotalElements(res.employees.totalElements);
      setPage(0);
      pushToast({
        title: 'PMS Appraisal Preview Ready',
        message: `Parsed ${res.batch.totalSourceRows} rows into ${res.batch.uniqueEmployeesCount} employees.`,
        tone: 'info',
      });
    } catch (err: any) {
      pushToast({
        title: 'Upload Failed',
        message: err?.response?.data?.message || err.message || 'Error parsing file',
        tone: 'err',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    if (!batch) return;
    setCommitting(true);
    try {
      const res = await pmsImportApi.commitBatch(batch.id);
      setBatch((prev) => (prev ? { ...prev, status: 'COMMITTED' } : null));
      pushToast({
        title: 'Appraisal Batch Committed',
        message: res.message,
        tone: 'ok',
      });
    } catch (err: any) {
      pushToast({
        title: 'Commit Failed',
        message: err?.response?.data?.message || err.message || 'Error committing batch',
        tone: 'err',
      });
    } finally {
      setCommitting(false);
    }
  };

  const handleCancel = async () => {
    if (!batch) return;
    try {
      await pmsImportApi.cancelBatch(batch.id);
      setBatch(null);
      setEmployees([]);
      setFile(null);
      pushToast({
        title: 'Preview Cancelled',
        message: 'The uncommitted preview batch has been discarded.',
        tone: 'info',
      });
    } catch (err: any) {
      pushToast({
        title: 'Cancel Failed',
        message: err?.message || 'Error cancelling preview',
        tone: 'err',
      });
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    if (filter === 'ALL') return true;
    if (filter === 'MANDATORY') return emp.roundedOverallFinalRating < 3;
    if (filter === 'PASSING') return emp.roundedOverallFinalRating >= 3;
    if (filter === 'ERROR') return emp.validationStatus === 'ERROR';
    if (filter === 'WARNING') return emp.validationStatus === 'WARNING';
    return true;
  });

  return (
    <div className="boa-stack">
      <div className="apid-alert apid-alert-info">
        <strong>Directory First:</strong> Appraisal uploads do not create employees or org structure.
        Make sure Employees, Managers, and User accounts exist first under{' '}
        {hasPermission('HIERARCHY_MANAGE') ? (
          <Link to="/admin?tab=organization">System Administration → Employees &amp; Org</Link>
        ) : (
          <span>System Administration → Employees &amp; Org</span>
        )}
        .
      </div>

      <div className="apid-card">
        <div className="boa-card-header">
          <div>
            <h3 className="boa-card-title">Multi-Goal Appraisal Upload</h3>
            <p className="boa-card-subtitle">
              Groups repeated goal rows per employee, checks averaged <code>OverallFinalRating</code>, and
              flags <code>RoundedOverallFinalRating &lt; 3</code> against the employee directory.
            </p>
          </div>
          <DataSourceBadge source="live" />
        </div>

        {/* Upload Form */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
          <div className="apid-field" style={{ marginBottom: 0 }}>
            <label htmlFor="pms-file">Excel File (.xlsx)</label>
            <input
              id="pms-file"
              type="file"
              accept=".xlsx"
              className="apid-input"
              disabled={busy || committing || batch?.status === 'PREVIEW'}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          <div className="apid-field" style={{ marginBottom: 0 }}>
            <label htmlFor="perf-q">Performance Quarter</label>
            <select
              id="perf-q"
              className="apid-input"
              value={perfQuarterId ?? ''}
              disabled={busy || committing || batch?.status === 'PREVIEW'}
              onChange={(e) => setPerfQuarterId(Number(e.target.value))}
            >
              {quarters.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label} ({q.fiscalYear})
                </option>
              ))}
            </select>
          </div>

          <div className="apid-field" style={{ marginBottom: 0 }}>
            <label htmlFor="coach-q">Target Coaching Quarter</label>
            <select
              id="coach-q"
              className="apid-input"
              value={coachQuarterId ?? ''}
              disabled={busy || committing || batch?.status === 'PREVIEW'}
              onChange={(e) => setCoachQuarterId(Number(e.target.value))}
            >
              {quarters.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label} {q.active ? '★ Active' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            {!batch || batch.status !== 'PREVIEW' ? (
              <button
                type="button"
                className="apid-btn apid-btn-primary"
                disabled={busy || !file || !perfQuarterId || !coachQuarterId}
                onClick={handleUpload}
                style={{ width: '100%' }}
              >
                <Upload size={15} /> {busy ? 'Validating...' : 'Upload & Preview'}
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="apid-btn apid-btn-primary"
                  disabled={committing || batch.errorRowsCount > 0}
                  onClick={handleCommit}
                  style={{ flex: 2 }}
                >
                  <Check size={15} /> {committing ? 'Committing...' : 'Commit Batch'}
                </button>
                <button
                  type="button"
                  className="apid-btn apid-btn-secondary"
                  disabled={committing}
                  onClick={handleCancel}
                  style={{ flex: 1 }}
                >
                  <RotateCcw size={15} /> Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Summary Stat Cards */}
        {batch && (
          <div className="boa-grid-3" style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
            <div className="boa-stat-card">
              <div className="boa-stat-label">Employees Consolidated</div>
              <div className="boa-stat-value">{batch.uniqueEmployeesCount}</div>
              <div className="boa-stat-meta">
                <span>From {batch.totalSourceRows} goal rows</span>
                <StatusPill label={batch.status} tone={batch.status === 'COMMITTED' ? 'ok' : 'neutral'} />
              </div>
            </div>

            <div className="boa-stat-card">
              <div className="boa-stat-label">Mandatory (Rounded &lt; 3)</div>
              <div className="boa-stat-value" style={{ color: 'var(--boa-err)' }}>
                {batch.mandatoryBelow3Count}
              </div>
              <div className="boa-stat-meta">
                <span>Assigned to Direct Manager</span>
                <StatusPill label="ROUNDED CHECK" tone="err" />
              </div>
            </div>

            <div className="boa-stat-card">
              <div className="boa-stat-label">Passing (Rounded ≥ 3)</div>
              <div className="boa-stat-value" style={{ color: 'var(--boa-ok)' }}>
                {batch.passingCount}
              </div>
              <div className="boa-stat-meta">
                <span>No mandatory coaching</span>
                <StatusPill label="PASSED" tone="ok" icon={<CheckCircle2 size={11} />} />
              </div>
            </div>
          </div>
        )}

        {/* Filter Pills & Staged Table */}
        {batch && (
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--boa-text-muted)' }}>Filter:</span>
              <button
                type="button"
                className={`apid-pill ${filter === 'ALL' ? 'apid-pill-active' : ''}`}
                onClick={() => setFilter('ALL')}
              >
                All ({employees.length})
              </button>
              <button
                type="button"
                className={`apid-pill ${filter === 'MANDATORY' ? 'apid-pill-active' : ''}`}
                onClick={() => setFilter('MANDATORY')}
              >
                Mandatory &lt; 3 ({batch.mandatoryBelow3Count})
              </button>
              <button
                type="button"
                className={`apid-pill ${filter === 'PASSING' ? 'apid-pill-active' : ''}`}
                onClick={() => setFilter('PASSING')}
              >
                Passing ≥ 3 ({batch.passingCount})
              </button>
              {batch.errorRowsCount > 0 && (
                <button
                  type="button"
                  className={`apid-pill ${filter === 'ERROR' ? 'apid-pill-active' : ''}`}
                  onClick={() => setFilter('ERROR')}
                  style={{ color: 'var(--boa-err)' }}
                >
                  Errors ({batch.errorRowsCount})
                </button>
              )}
              {batch.warningRowsCount > 0 && (
                <button
                  type="button"
                  className={`apid-pill ${filter === 'WARNING' ? 'apid-pill-active' : ''}`}
                  onClick={() => setFilter('WARNING')}
                  style={{ color: 'var(--boa-warn)' }}
                >
                  Warnings ({batch.warningRowsCount})
                </button>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="boa-table">
                <thead>
                  <tr>
                    <th style={{ width: '30px' }}></th>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Rating (Raw / Rounded)</th>
                    <th>Goals</th>
                    <th>Planned Coach</th>
                    <th>Action</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => {
                    const isExpanded = expandedId === emp.stagingId;
                    return (
                      <>
                        <tr key={emp.stagingId} style={{ cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : emp.stagingId)}>
                          <td>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </td>
                          <td>
                            <strong>{emp.resolvedFullName || emp.employeeNumber}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--boa-text-muted)' }}>{emp.employeeNumber}</div>
                          </td>
                          <td>{emp.department || '—'}</td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{emp.overallFinalRating?.toFixed(2) ?? '—'}</span>{' '}
                            <span style={{ color: 'var(--boa-text-muted)' }}>→</span>{' '}
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                fontWeight: 700,
                                backgroundColor: emp.roundedOverallFinalRating < 3 ? 'var(--boa-err-bg, #fee2e2)' : 'var(--boa-ok-bg, #dcfce7)',
                                color: emp.roundedOverallFinalRating < 3 ? 'var(--boa-err)' : 'var(--boa-ok)',
                              }}
                            >
                              Grade {emp.roundedOverallFinalRating}
                            </span>
                          </td>
                          <td>{emp.goalCount} KPIs</td>
                          <td>
                            {emp.coachFullName ? (
                              <span>{emp.coachFullName}</span>
                            ) : (
                              <span style={{ color: 'var(--boa-warn)', fontSize: '0.8rem' }}>Pending Coach</span>
                            )}
                          </td>
                          <td>
                            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {emp.plannedAction.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td>
                            {emp.validationStatus === 'ERROR' ? (
                              <StatusPill label="ERROR" tone="err" icon={<XCircle size={11} />} />
                            ) : emp.validationStatus === 'WARNING' ? (
                              <StatusPill label="WARNING" tone="warn" icon={<AlertTriangle size={11} />} />
                            ) : (
                              <StatusPill label="VALID" tone="ok" icon={<CheckCircle2 size={11} />} />
                            )}
                          </td>
                        </tr>

                        {/* Expanded Goal Rows Drawer */}
                        {isExpanded && (
                          <tr key={`${emp.stagingId}-drawer`}>
                            <td colSpan={8} style={{ backgroundColor: 'var(--boa-bg-subtle, #f8fafc)', padding: '1rem' }}>
                              <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
                                Staged Goal Lines ({emp.goalLines.length})
                              </div>
                              <table className="boa-table" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                                <thead>
                                  <tr>
                                    <th>#</th>
                                    <th>Goal / KPI</th>
                                    <th>Target</th>
                                    <th>Actual</th>
                                    <th>Weight %</th>
                                    <th>Line Score</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {emp.goalLines.map((g) => (
                                    <tr key={g.sourceRowNumber}>
                                      <td>{g.sourceRowNumber}</td>
                                      <td>
                                        <strong>{g.goalName}</strong>
                                        {g.goalTrackingName && (
                                          <div style={{ color: 'var(--boa-text-muted)' }}>{g.goalTrackingName}</div>
                                        )}
                                      </td>
                                      <td>{g.targetValue || '—'}</td>
                                      <td>{g.actualValue || '—'}</td>
                                      <td>{g.weight?.toFixed(1) ?? '—'}%</td>
                                      <td>{g.lineScore?.toFixed(2) ?? '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>

                              {emp.warnings && emp.warnings.length > 0 && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--boa-warn)', marginTop: '0.5rem' }}>
                                  <strong>Warnings:</strong>
                                  <ul style={{ margin: '0.25rem 0', paddingLeft: '1.2rem' }}>
                                    {emp.warnings.map((w, idx) => (
                                      <li key={idx}>{w}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {emp.errors && emp.errors.length > 0 && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--boa-err)', marginTop: '0.5rem' }}>
                                  <strong>Errors:</strong>
                                  <ul style={{ margin: '0.25rem 0', paddingLeft: '1.2rem' }}>
                                    {emp.errors.map((e, idx) => (
                                      <li key={idx}>{e}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
