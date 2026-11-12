import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { Calendar, CheckCircle2, Lock, Plus, RotateCcw, Save } from 'lucide-react';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatusPill,
  useToast,
} from '../../../shared/components/ui';
import {
  coreConfigApi,
  type FiscalQuarterItem,
  type SystemConfigItem,
} from './api/coreConfigApi';

const CONFIG_FRIENDLY_LABELS: Record<string, { label: string; helper?: string }> = {
  'coaching.mandatory_cutoff_rounded': {
    label: 'Mandatory Coaching Cutoff (Rounded Grade)',
    helper:
      'Mandatory coaching applies when RoundedOverallFinalRating < cutoff (1–5; default 3 covers Grades 1 & 2).',
  },
  'coaching.missed_session_alert_threshold': {
    label: 'Missed-Session Alert Threshold',
    helper: 'Number of missed sessions before an HR/supervisor alert is triggered (1–30).',
  },
  'coaching.inactivity_reminder_days': {
    label: 'Coaching Inactivity Reminder (Days)',
    helper: 'Days without coaching activity before sending a reminder notification (1–365).',
  },
  'mentoring.default_max_trainees_per_trainer': {
    label: 'Default Max Trainees per Trainer',
    helper: 'Internal mentoring baseline trainee capacity per certified trainer (1–50).',
  },
  'files.max_upload_mb': {
    label: 'Max File Upload Size (MB)',
    helper: 'Maximum upload file size for certificates, PMS sheets, and evidence (1–100 MB).',
  },
};

function extractApiError(err: unknown, fallback: string): string {
  const ax = err as AxiosError<ApiErrorPayload>;
  const data = ax.response?.data;
  if (data?.fieldErrors) {
    const firstField = Object.values(data.fieldErrors)[0];
    if (firstField) return firstField;
  }
  return data?.message || fallback;
}

export function SystemConfigPanel() {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const adminConfigQuery = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: coreConfigApi.getAdminConfig,
  });

  const activeConfigQuery = useQuery({
    queryKey: ['core', 'active-config'],
    queryFn: coreConfigApi.getActiveConfig,
  });

  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [configError, setConfigError] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // Quarter Add / Edit modal state
  const [quarterModalMode, setQuarterModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingQuarter, setEditingQuarter] = useState<FiscalQuarterItem | null>(null);
  const [qFiscalYear, setQFiscalYear] = useState('');
  const [qNumber, setQNumber] = useState('1');
  const [qLabel, setQLabel] = useState('');
  const [qStartDate, setQStartDate] = useState('');
  const [qEndDate, setQEndDate] = useState('');
  const [qActivate, setQActivate] = useState(false);
  const [quarterModalError, setQuarterModalError] = useState<string | null>(null);
  const [savingQuarter, setSavingQuarter] = useState(false);

  // Quarter activation confirmation modal
  const [activateTarget, setActivateTarget] = useState<FiscalQuarterItem | null>(null);
  const [activating, setActivating] = useState(false);

  const serverConfigs = adminConfigQuery.data?.configs ?? [];
  const quarters = adminConfigQuery.data?.quarters ?? [];

  useEffect(() => {
    if (adminConfigQuery.data?.configs) {
      const next: Record<string, string> = {};
      for (const item of adminConfigQuery.data.configs) {
        next[item.configKey] = item.configValue;
      }
      setDraftValues(next);
    }
  }, [adminConfigQuery.data]);

  const modifiedUpdates = useMemo(() => {
    return serverConfigs
      .filter((c) => (draftValues[c.configKey] ?? '') !== c.configValue)
      .map((c) => ({
        configKey: c.configKey,
        configValue: (draftValues[c.configKey] ?? '').trim(),
      }));
  }, [serverConfigs, draftValues]);

  const invalidateConfigQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'config'] }),
      queryClient.invalidateQueries({ queryKey: ['core', 'active-config'] }),
    ]);
  };

  const handleSaveConfigs = async (e: FormEvent) => {
    e.preventDefault();
    if (modifiedUpdates.length === 0) return;

    setSavingConfig(true);
    setConfigError(null);
    try {
      await coreConfigApi.updateConfigs(modifiedUpdates);
      await invalidateConfigQueries();
      pushToast({
        title: 'System settings saved',
        message: `Updated ${modifiedUpdates.length} configuration value(s).`,
        tone: 'ok',
      });
    } catch (err) {
      setConfigError(extractApiError(err, 'Failed to update system configuration.'));
    } finally {
      setSavingConfig(false);
    }
  };

  const handleResetDrafts = () => {
    const next: Record<string, string> = {};
    for (const item of serverConfigs) {
      next[item.configKey] = item.configValue;
    }
    setDraftValues(next);
    setConfigError(null);
  };

  const openCreateQuarter = () => {
    setQuarterModalMode('create');
    setEditingQuarter(null);
    setQFiscalYear('2027/28');
    setQNumber('1');
    setQLabel('');
    setQStartDate('2027-06-01');
    setQEndDate('2027-09-30');
    setQActivate(false);
    setQuarterModalError(null);
  };

  const openEditQuarter = (q: FiscalQuarterItem) => {
    setQuarterModalMode('edit');
    setEditingQuarter(q);
    setQFiscalYear(q.fiscalYear);
    setQNumber(String(q.quarter));
    setQLabel(q.label);
    setQStartDate(q.startDate);
    setQEndDate(q.endDate);
    setQActivate(false);
    setQuarterModalError(null);
  };

  const handleSaveQuarter = async (e: FormEvent) => {
    e.preventDefault();
    setSavingQuarter(true);
    setQuarterModalError(null);
    try {
      if (quarterModalMode === 'create') {
        const created = await coreConfigApi.createQuarter({
          fiscalYear: qFiscalYear.trim(),
          quarter: Number(qNumber),
          label: qLabel.trim() || undefined,
          startDate: qStartDate,
          endDate: qEndDate,
          activate: qActivate,
        });
        pushToast({
          title: 'Fiscal quarter created',
          message: created.active
            ? `${created.label} is now the active cycle.`
            : `${created.label} added.`,
          tone: 'ok',
        });
      } else if (quarterModalMode === 'edit' && editingQuarter) {
        const updated = await coreConfigApi.updateQuarter(editingQuarter.id, {
          label: qLabel.trim(),
          startDate: qStartDate,
          endDate: qEndDate,
        });
        pushToast({
          title: 'Fiscal quarter updated',
          message: `${updated.label} saved.`,
          tone: 'ok',
        });
      }
      setQuarterModalMode(null);
      await invalidateConfigQueries();
    } catch (err) {
      setQuarterModalError(extractApiError(err, 'Failed to save fiscal quarter.'));
    } finally {
      setSavingQuarter(false);
    }
  };

  const handleConfirmActivate = async () => {
    if (!activateTarget) return;
    setActivating(true);
    try {
      const activated = await coreConfigApi.activateQuarter(activateTarget.id);
      await invalidateConfigQueries();
      pushToast({
        title: 'Active cycle switched',
        message: `Portal operational cycle is now ${activated.label}.`,
        tone: 'ok',
      });
      setActivateTarget(null);
    } catch (err) {
      pushToast({
        title: 'Activation failed',
        message: extractApiError(err, 'Unable to activate fiscal quarter.'),
        tone: 'err',
      });
    } finally {
      setActivating(false);
    }
  };

  if (adminConfigQuery.isLoading) {
    return <LoadingSkeleton rows={6} height={32} />;
  }

  if (adminConfigQuery.isError) {
    return (
      <ErrorState
        message={extractApiError(adminConfigQuery.error, 'Failed to load Quarter Settings & Configuration.')}
        onRetry={() => void adminConfigQuery.refetch()}
      />
    );
  }

  const activeQuarter = activeConfigQuery.data?.activeQuarter;
  const calendarQuarterLabel = activeConfigQuery.data?.calendarQuarterLabel;
  const calendarMismatch =
    Boolean(activeQuarter && calendarQuarterLabel && calendarQuarterLabel !== activeQuarter.label);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Active Operational Cycle Banner */}
      {activeQuarter && (
        <div
          className="apid-card"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
            background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Calendar size={20} color="var(--brand)" />
            <div>
              <div style={{ fontSize: '0.76rem', color: 'var(--muted)', fontWeight: 600 }}>
                ACTIVE OPERATIONAL CYCLE
              </div>
              <div style={{ fontSize: '1.02rem', fontWeight: 700 }}>
                {activeQuarter.label}{' '}
                <span style={{ fontSize: '0.84rem', fontWeight: 500, color: 'var(--muted)' }}>
                  ({activeQuarter.startDate} to {activeQuarter.endDate})
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusPill label="Active Cycle" tone="ok" />
            {calendarMismatch && (
              <StatusPill
                label={`Calendar Today: ${calendarQuarterLabel}`}
                tone="warn"
              />
            )}
          </div>
        </div>
      )}

      {/* System Configuration Rules */}
      <form className="apid-card" onSubmit={handleSaveConfigs}>
        <div className="boa-card-header">
          <div>
            <h3 className="boa-card-title">System Rules &amp; Thresholds</h3>
            <p className="boa-card-subtitle">
              Changes take effect immediately across the portal and are recorded in the Activity Log.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {modifiedUpdates.length > 0 && (
              <button
                type="button"
                className="apid-btn apid-btn-outline"
                disabled={savingConfig}
                onClick={handleResetDrafts}
              >
                <RotateCcw size={14} /> Reset
              </button>
            )}
            <button
              type="submit"
              className="apid-btn apid-btn-primary"
              disabled={savingConfig || modifiedUpdates.length === 0}
            >
              <Save size={14} />{' '}
              {savingConfig
                ? 'Saving...'
                : modifiedUpdates.length > 0
                  ? `Save Changes (${modifiedUpdates.length})`
                  : 'Saved'}
            </button>
          </div>
        </div>

        {configError && (
          <div className="apid-alert apid-alert-err" style={{ marginBottom: '0.85rem' }}>
            {configError}
          </div>
        )}

        <div className="apid-form-grid">
          {serverConfigs.map((cfg: SystemConfigItem) => {
            const meta = CONFIG_FRIENDLY_LABELS[cfg.configKey];
            const val = draftValues[cfg.configKey] ?? cfg.configValue;
            const changed = val !== cfg.configValue;

            return (
              <div
                key={cfg.configKey}
                className="apid-field"
                style={{
                  padding: '0.75rem',
                  borderRadius: 10,
                  border: changed ? '1px solid var(--brand)' : '1px solid var(--border)',
                  background: changed ? '#eff6ff44' : 'var(--surface-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                  <label htmlFor={`cfg-${cfg.configKey}`} style={{ fontWeight: 600 }}>
                    {meta?.label ?? cfg.configKey}
                  </label>
                  <StatusPill
                    label={cfg.publicVisible ? 'Portal Rule' : 'Admin Only'}
                    tone={cfg.publicVisible ? 'info' : 'neutral'}
                  />
                </div>

                {cfg.valueType === 'BOOLEAN' ? (
                  <select
                    id={`cfg-${cfg.configKey}`}
                    className="apid-input"
                    value={val}
                    onChange={(e) =>
                      setDraftValues((prev) => ({ ...prev, [cfg.configKey]: e.target.value }))
                    }
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    id={`cfg-${cfg.configKey}`}
                    className="apid-input tabular-nums"
                    type="text"
                    inputMode={cfg.valueType === 'INTEGER' || cfg.valueType === 'DECIMAL' ? 'numeric' : 'text'}
                    value={val}
                    onChange={(e) =>
                      setDraftValues((prev) => ({ ...prev, [cfg.configKey]: e.target.value }))
                    }
                  />
                )}

                <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                  {meta?.helper ?? cfg.description ?? cfg.configKey}
                </span>
              </div>
            );
          })}
        </div>
      </form>

      {/* Fiscal Quarters Table */}
      <div className="apid-card">
        <div className="boa-card-header">
          <div>
            <h3 className="boa-card-title">Fiscal Quarters Schedule</h3>
            <p className="boa-card-subtitle">
              BoA performance year runs Q1 (Jun–Sep), Q2 (Oct–Dec), Q3 (Jan–Mar), Q4 (Apr–May). Date ranges cannot overlap.
            </p>
          </div>
          <button type="button" className="apid-btn apid-btn-primary" onClick={openCreateQuarter}>
            <Plus size={14} /> Add Fiscal Quarter
          </button>
        </div>

        {quarters.length === 0 ? (
          <EmptyState
            title="No fiscal quarters defined"
            description="Create the first fiscal quarter to establish an operational cycle."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="apid-table">
              <thead>
                <tr>
                  <th>Fiscal Year</th>
                  <th>Quarter</th>
                  <th>Label</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quarters.map((q) => {
                  const lockedOrUsed = q.locked || q.referencedByRecords;
                  return (
                    <tr key={q.id}>
                      <td className="tabular-nums">{q.fiscalYear}</td>
                      <td className="tabular-nums">Q{q.quarter}</td>
                      <td style={{ fontWeight: 600 }}>{q.label}</td>
                      <td className="tabular-nums">{q.startDate}</td>
                      <td className="tabular-nums">{q.endDate}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {q.active ? (
                            <StatusPill label="Active" tone="ok" />
                          ) : (
                            <StatusPill label="Inactive" tone="neutral" />
                          )}
                          {lockedOrUsed && (
                            <StatusPill
                              label={q.locked ? 'Locked' : 'In Use'}
                              tone="warn"
                            />
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className="apid-btn apid-btn-outline"
                            disabled={lockedOrUsed}
                            title={
                              lockedOrUsed
                                ? 'Quarter is locked or referenced by historical records'
                                : 'Edit quarter label and dates'
                            }
                            onClick={() => openEditQuarter(q)}
                          >
                            {lockedOrUsed ? <Lock size={13} /> : null} Edit
                          </button>
                          {!q.active && (
                            <button
                              type="button"
                              className="apid-btn apid-btn-primary"
                              onClick={() => setActivateTarget(q)}
                            >
                              <CheckCircle2 size={13} /> Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Fiscal Quarter Modal */}
      {quarterModalMode && (
        <div
          className="apid-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={quarterModalMode === 'create' ? 'Add Fiscal Quarter' : 'Edit Fiscal Quarter'}
        >
          <form className="apid-card apid-modal" onSubmit={handleSaveQuarter} style={{ maxWidth: 480 }}>
            <h3 style={{ marginTop: 0 }}>
              {quarterModalMode === 'create' ? 'Add Fiscal Quarter' : `Edit ${editingQuarter?.label}`}
            </h3>

            {quarterModalError && (
              <div className="apid-alert apid-alert-err" style={{ marginBottom: '0.75rem' }}>
                {quarterModalError}
              </div>
            )}

            <div className="apid-form-grid">
              {quarterModalMode === 'create' && (
                <>
                  <div className="apid-field">
                    <label htmlFor="q-fy">Fiscal Year</label>
                    <input
                      id="q-fy"
                      className="apid-input"
                      placeholder="e.g. 2027/28"
                      value={qFiscalYear}
                      onChange={(e) => setQFiscalYear(e.target.value)}
                      required
                    />
                  </div>
                  <div className="apid-field">
                    <label htmlFor="q-num">Quarter (1–4)</label>
                    <select
                      id="q-num"
                      className="apid-input"
                      value={qNumber}
                      onChange={(e) => setQNumber(e.target.value)}
                    >
                      <option value="1">Q1</option>
                      <option value="2">Q2</option>
                      <option value="3">Q3</option>
                      <option value="4">Q4</option>
                    </select>
                  </div>
                </>
              )}

              <div className="apid-field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="q-label">
                  Display Label {quarterModalMode === 'create' ? '(optional)' : ''}
                </label>
                <input
                  id="q-label"
                  className="apid-input"
                  placeholder={`FY ${qFiscalYear || '2027/28'} · Q${qNumber}`}
                  value={qLabel}
                  onChange={(e) => setQLabel(e.target.value)}
                  required={quarterModalMode === 'edit'}
                />
              </div>

              <div className="apid-field">
                <label htmlFor="q-start">Start Date</label>
                <input
                  id="q-start"
                  type="date"
                  className="apid-input"
                  value={qStartDate}
                  onChange={(e) => setQStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="apid-field">
                <label htmlFor="q-end">End Date</label>
                <input
                  id="q-end"
                  type="date"
                  className="apid-input"
                  value={qEndDate}
                  onChange={(e) => setQEndDate(e.target.value)}
                  required
                />
              </div>

              {quarterModalMode === 'create' && (
                <label
                  style={{
                    gridColumn: '1 / -1',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={qActivate}
                    onChange={(e) => setQActivate(e.target.checked)}
                  />
                  Activate this quarter immediately after creation
                </label>
              )}
            </div>

            <div className="apid-modal-actions" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="apid-btn apid-btn-outline"
                disabled={savingQuarter}
                onClick={() => setQuarterModalMode(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="apid-btn apid-btn-primary"
                disabled={savingQuarter}
              >
                {savingQuarter
                  ? 'Saving...'
                  : quarterModalMode === 'create'
                    ? 'Create Quarter'
                    : 'Save Quarter'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Activate Fiscal Quarter Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(activateTarget)}
        title={`Activate ${activateTarget?.label ?? 'Fiscal Quarter'}?`}
        message={
          activateTarget
            ? `Switching the operational quarter to ${activateTarget.label} (${activateTarget.startDate} to ${activateTarget.endDate}) updates the active portal cycle banner immediately for all users.`
            : ''
        }
        confirmLabel="Activate Quarter"
        busy={activating}
        onCancel={() => setActivateTarget(null)}
        onConfirm={() => void handleConfirmActivate()}
      />
    </div>
  );
}

