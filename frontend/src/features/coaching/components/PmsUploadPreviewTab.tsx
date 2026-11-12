import { useState } from 'react';
import { CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import { DataSourceBadge, StatusPill, useToast } from '../../../shared/components/ui';
import { coachingPreviewAdapter } from '../api/coachingDashboardApi';

export function PmsUploadPreviewTab() {
  const { hasPermission } = useAuth();
  const { pushToast } = useToast();
  const [selectedFile, setSelectedFile] = useState('BOA_Sample_36Rows_PMS_Appraisal.xlsx');
  const [simResult, setSimResult] = useState<{
    fileName: string;
    sha256Short: string;
    sourceGoalRows: number;
    uniqueEmployees: number;
    mandatoryBelow3Count: number;
    passingRoundedCount: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const runPreview = async () => {
    setBusy(true);
    try {
      const res = await coachingPreviewAdapter.simulateExcelPreview(selectedFile);
      setSimResult(res.data);
      pushToast({
        title: 'PMS Excel Parse Preview',
        message: res.message,
        tone: 'info',
      });
    } finally {
      setBusy(false);
    }
  };

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
          <DataSourceBadge source="preview" />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="apid-field" style={{ flex: 1, minWidth: 240, marginBottom: 0 }}>
            <label htmlFor="pms-sim-file">Sample Excel Batch Name</label>
            <input
              id="pms-sim-file"
              type="text"
              className="apid-input"
              value={selectedFile}
              onChange={(e) => setSelectedFile(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="apid-btn apid-btn-primary"
            disabled={busy || !selectedFile.trim()}
            onClick={() => void runPreview()}
          >
            <FileSpreadsheet size={15} /> {busy ? 'Validating...' : 'Validate Sample File'}
          </button>
        </div>

        {simResult && (
          <div className="boa-grid-3" style={{ marginTop: '1rem', marginBottom: 0 }}>
            <div className="boa-stat-card">
              <div className="boa-stat-label">Employees Consolidated</div>
              <div className="boa-stat-value">{simResult.uniqueEmployees}</div>
              <div className="boa-stat-meta">
                <span>From {simResult.sourceGoalRows} goal rows</span>
                <StatusPill label={simResult.sha256Short} tone="neutral" />
              </div>
            </div>
            <div className="boa-stat-card">
              <div className="boa-stat-label">Mandatory (Rounded &lt; 3)</div>
              <div className="boa-stat-value">{simResult.mandatoryBelow3Count}</div>
              <div className="boa-stat-meta">
                <span>Assigned to Direct Manager</span>
                <StatusPill label="ROUNDED CHECK" tone="err" />
              </div>
            </div>
            <div className="boa-stat-card">
              <div className="boa-stat-label">Passing (Rounded ≥ 3)</div>
              <div className="boa-stat-value">{simResult.passingRoundedCount}</div>
              <div className="boa-stat-meta">
                <span>No mandatory coaching / Eligible for Skill-Dev</span>
                <StatusPill label="PASSED" tone="ok" icon={<CheckCircle2 size={11} />} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
