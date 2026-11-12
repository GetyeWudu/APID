import { useState, type FormEvent } from 'react';
import { PREVIEW_SYSTEM_CONFIG } from '../../../shared/mocks/boaPreviewFixtures';
import { DataSourceBadge, useToast } from '../../../shared/components/ui';
import { systemConfigPreviewAdapter, type SystemConfigPreview } from '../overview/api/adminSummaryApi';

export function SystemConfigPreviewPanel() {
  const [config, setConfig] = useState<SystemConfigPreview>({ ...PREVIEW_SYSTEM_CONFIG });
  const [lastSimNote, setLastSimNote] = useState<string | null>(null);
  const { pushToast } = useToast();

  const handleSimulateSave = async (e: FormEvent) => {
    e.preventDefault();
    const result = await systemConfigPreviewAdapter.simulateSaveConfig(config);
    setLastSimNote(result.message);
    pushToast({
      tone: 'info',
      title: 'Preview only',
      message: result.message,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="apid-alert apid-alert-warn">
        <strong>Sample Settings:</strong> Changes made here stay in browser preview only and are not saved yet.
      </div>

      {lastSimNote && <div className="apid-alert apid-alert-ok">{lastSimNote}</div>}

      <form className="apid-card apid-form" onSubmit={handleSimulateSave}>
        <div className="boa-card-header">
          <div>
            <h3 className="boa-card-title">Quarter &amp; Coaching Policy Settings</h3>
            <p className="boa-card-subtitle">Configure fiscal quarter windows and coaching session thresholds.</p>
          </div>
          <DataSourceBadge source="preview" />
        </div>

        <div className="boa-grid-2" style={{ marginBottom: 0 }}>
          <div className="apid-field">
            <label htmlFor="cfg-fy">Active Fiscal Year</label>
            <input
              id="cfg-fy"
              value={config.activeFiscalYear}
              onChange={(e) => setConfig({ ...config, activeFiscalYear: e.target.value })}
            />
          </div>
          <div className="apid-field">
            <label htmlFor="cfg-q">Active Quarter</label>
            <select
              id="cfg-q"
              value={config.activeQuarter}
              onChange={(e) => setConfig({ ...config, activeQuarter: e.target.value })}
            >
              <option value="Q1">Q1</option>
              <option value="Q2">Q2</option>
              <option value="Q3">Q3</option>
              <option value="Q4">Q4</option>
            </select>
          </div>
          <div className="apid-field">
            <label htmlFor="cfg-start">Quarter Start Date</label>
            <input
              id="cfg-start"
              type="date"
              value={config.quarterStartDate}
              onChange={(e) => setConfig({ ...config, quarterStartDate: e.target.value })}
            />
          </div>
          <div className="apid-field">
            <label htmlFor="cfg-end">Quarter End Date</label>
            <input
              id="cfg-end"
              type="date"
              value={config.quarterEndDate}
              onChange={(e) => setConfig({ ...config, quarterEndDate: e.target.value })}
            />
          </div>
          <div className="apid-field">
            <label htmlFor="cfg-cutoff">Rounded Mandatory Coaching Cutoff (&lt; 3)</label>
            <input
              id="cfg-cutoff"
              className="tabular-nums"
              value={config.mandatoryCutoffRounded}
              onChange={(e) => setConfig({ ...config, mandatoryCutoffRounded: e.target.value })}
            />
          </div>
          <div className="apid-field">
            <label htmlFor="cfg-missed">Missed Sessions Escalation Threshold</label>
            <input
              id="cfg-missed"
              type="number"
              min={1}
              max={10}
              value={config.missedSessionAlertThreshold}
              onChange={(e) => setConfig({ ...config, missedSessionAlertThreshold: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="apid-modal-actions">
          <button type="submit" className="apid-btn apid-btn-primary">
            Save Preview Settings
          </button>
        </div>
      </form>
    </div>
  );
}
