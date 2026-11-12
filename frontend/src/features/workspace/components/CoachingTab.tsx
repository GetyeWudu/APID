import { useState, type FormEvent } from 'react';
import { ClipboardCheck, FileText, Plus, Video } from 'lucide-react';
import {
  DataSourceBadge,
  EmptyState,
  PermissionGate,
  StatusPill,
  useToast,
} from '../../../shared/components/ui';
import type { PreviewWorkspaceData } from '../../../shared/mocks/boaPreviewFixtures';
import type { EmployeeItem } from '../../admin/organization/types/organization.types';
import type { SkillItem } from '../../admin/skills/types/skills.types';
import { workspacePreviewAdapter } from '../api/workspaceDashboardApi';
import { IsolatedChatPanel, type ChatMessageItem } from './IsolatedChatPanel';
import { SessionJoinPreviewModal } from './SessionJoinPreviewModal';

export function CoachingTab({
  workspace,
  directReports,
  activeSkills,
  chatMessages,
  onAppendChat,
}: {
  workspace: PreviewWorkspaceData;
  directReports: EmployeeItem[];
  activeSkills: SkillItem[];
  chatMessages: ChatMessageItem[];
  onAppendChat: (body: string) => void;
}) {
  const { pushToast } = useToast();
  const [joinSession, setJoinSession] = useState<{ title: string; time: string } | null>(null);
  const [submittedReports, setSubmittedReports] = useState<Record<string, boolean>>({});
  const [reportSessionId, setReportSessionId] = useState<string | null>(null);
  const [reportSummary, setReportSummary] = useState('');

  // Manager Skill-Dev submission modal
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqSkill, setReqSkill] = useState(activeSkills[0]?.name ?? 'Credit Risk & Loan Assessment');
  const [reqTargetName, setReqTargetName] = useState(
    directReports[0]?.fullName ?? 'Selected Direct Report'
  );
  const [reqJustification, setReqJustification] = useState('');

  const handleReportSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reportSessionId || !reportSummary.trim()) return;
    const res = await workspacePreviewAdapter.simulateAction(`Coach report ${reportSessionId}`);
    setSubmittedReports((prev) => ({ ...prev, [reportSessionId]: true }));
    pushToast({ title: 'Session Report Submitted (Preview)', message: res.message, tone: 'ok' });
    setReportSessionId(null);
    setReportSummary('');
  };

  const handleRequestSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reqJustification.trim()) return;
    const res = await workspacePreviewAdapter.simulateAction(
      `Skill-Dev request for ${reqTargetName}`
    );
    pushToast({
      title: 'Skill-Development Request Sent (Preview)',
      message: res.message,
      tone: 'ok',
    });
    setShowRequestModal(false);
    setReqJustification('');
  };

  return (
    <div className="boa-stack">
      <div className="boa-grid-2" style={{ marginBottom: 0 }}>
        {/* Talent Coaching View */}
        <div className="apid-card">
          <div className="boa-card-header">
            <div>
              <h3 className="boa-card-title">My Active Coaching Plan (Talent)</h3>
              <p className="boa-card-subtitle">{workspace.talentPlan.quarter}</p>
            </div>
            <DataSourceBadge source="preview" />
          </div>

          {!workspace.hasTalentAssignment ? (
            <EmptyState
              title="No Active Coaching Assignment"
              description="You do not have an active performance or skill-development coaching plan this quarter."
            />
          ) : (
            <div className="boa-stack">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <StatusPill label={workspace.talentPlan.pathway} tone="info" />
                <span className="tabular-nums" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                  {workspace.talentPlan.progressPct}% Complete
                </span>
              </div>
              <div className="boa-progress-track">
                <div
                  className="boa-progress-fill"
                  style={{ width: `${workspace.talentPlan.progressPct}%` }}
                />
              </div>
              <div style={{ fontWeight: 700 }}>{workspace.talentPlan.objective}</div>
              <div className="boa-muted" style={{ fontSize: '0.83rem' }}>
                Assigned Coach: <strong>{workspace.talentPlan.coachName}</strong>
              </div>
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.75rem',
                  background: 'var(--surface-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {workspace.talentPlan.nextSessionTitle}
                  </div>
                  <div className="boa-muted" style={{ fontSize: '0.78rem' }}>
                    {workspace.talentPlan.nextSessionTime}
                  </div>
                </div>
                <button
                  type="button"
                  className="apid-btn apid-btn-primary apid-btn-sm"
                  onClick={() =>
                    setJoinSession({
                      title: workspace.talentPlan.nextSessionTitle,
                      time: workspace.talentPlan.nextSessionTime,
                    })
                  }
                >
                  <Video size={14} /> Join Preview Room
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Manager / Coach View */}
        <div className="apid-card">
          <div className="boa-card-header">
            <div>
              <h3 className="boa-card-title">Manager &amp; Coach View</h3>
              <p className="boa-card-subtitle">
                Direct reports: <strong>{directReports.length}</strong>
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <DataSourceBadge source="preview" />
              <PermissionGate permission="COACHING_REQUEST_SUBMIT">
                <button
                  type="button"
                  className="apid-btn apid-btn-primary apid-btn-sm"
                  onClick={() => setShowRequestModal(true)}
                >
                  <Plus size={13} /> Request Skill Coaching
                </button>
              </PermissionGate>
            </div>
          </div>

          {!workspace.isAssignedCoach ? (
            <EmptyState
              title="No Coachee Sessions Assigned"
              description="Direct reports assigned to you for coaching will appear here once coaching cycles begin."
            />
          ) : (
            <div className="boa-stack">
              {workspace.coachSessions.map((s) => {
                const done = submittedReports[s.id] ?? s.reportSubmitted;
                return (
                  <div
                    key={s.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '0.7rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                        {s.talentName} · <span className="boa-muted">{s.scheduledAt}</span>
                      </div>
                      <div className="boa-muted" style={{ fontSize: '0.8rem' }}>
                        {s.topic}
                      </div>
                    </div>
                    {done ? (
                      <StatusPill
                        label="REPORT SUBMITTED"
                        tone="ok"
                        icon={<ClipboardCheck size={12} />}
                      />
                    ) : (
                      <button
                        type="button"
                        className="apid-btn apid-btn-outline apid-btn-sm"
                        onClick={() => {
                          setReportSessionId(s.id);
                          setReportSummary('');
                        }}
                      >
                        <FileText size={13} /> Log Report
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <IsolatedChatPanel
        contextTitle="Coaching Channel (Talent ↔ Coach)"
        contextKey="coaching"
        messages={chatMessages}
        onSendMessage={onAppendChat}
      />

      <SessionJoinPreviewModal
        open={Boolean(joinSession)}
        sessionTitle={joinSession?.title ?? ''}
        scheduledTime={joinSession?.time ?? ''}
        onClose={() => setJoinSession(null)}
      />

      {reportSessionId && (
        <div
          className="apid-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Submit Coach Session Report"
        >
          <div className="apid-card apid-modal">
            <h3 style={{ marginTop: 0 }}>Log Coaching Session Report (Preview)</h3>
            <form onSubmit={handleReportSubmit} className="apid-form">
              <div className="apid-field">
                <label htmlFor="ws-report-summary">Observed Outcomes &amp; Next Actions</label>
                <textarea
                  id="ws-report-summary"
                  className="apid-input"
                  rows={3}
                  required
                  value={reportSummary}
                  onChange={(e) => setReportSummary(e.target.value)}
                  placeholder="Summarize coaching discussion and talent readiness..."
                />
              </div>
              <div className="apid-modal-actions">
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  onClick={() => setReportSessionId(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="apid-btn apid-btn-primary">
                  Submit Report (Preview)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRequestModal && (
        <div
          className="apid-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Submit Skill-Development Coaching Request"
        >
          <div className="apid-card apid-modal">
            <h3 style={{ marginTop: 0 }}>Request Skill-Development Coaching</h3>
            <p className="boa-muted" style={{ fontSize: '0.82rem' }}>
              Available for direct reports with a rating of 3 or above. Direct reports:{' '}
              <strong>{directReports.length}</strong>.
            </p>
            <form onSubmit={handleRequestSubmit} className="apid-form">
              <div className="apid-field">
                <label htmlFor="sd-target">Direct Report</label>
                {directReports.length > 0 ? (
                  <select
                    id="sd-target"
                    className="apid-input"
                    value={reqTargetName}
                    onChange={(e) => setReqTargetName(e.target.value)}
                  >
                    {directReports.map((dr) => (
                      <option key={dr.id} value={dr.fullName}>
                        {dr.fullName} ({dr.employeeNumber})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="sd-target"
                    type="text"
                    className="apid-input"
                    value={reqTargetName}
                    onChange={(e) => setReqTargetName(e.target.value)}
                  />
                )}
              </div>
              <div className="apid-field">
                <label htmlFor="sd-skill">Target Skill</label>
                <select
                  id="sd-skill"
                  className="apid-input"
                  value={reqSkill}
                  onChange={(e) => setReqSkill(e.target.value)}
                >
                  {(activeSkills.length > 0
                    ? activeSkills.map((s) => s.name)
                    : ['Credit Risk & Loan Assessment', 'Leadership & Performance Coaching']
                  ).map((sk) => (
                    <option key={sk} value={sk}>
                      {sk}
                    </option>
                  ))}
                </select>
              </div>
              <div className="apid-field">
                <label htmlFor="sd-just">Business Justification</label>
                <textarea
                  id="sd-just"
                  className="apid-input"
                  rows={3}
                  required
                  value={reqJustification}
                  onChange={(e) => setReqJustification(e.target.value)}
                  placeholder="Describe expected capability growth..."
                />
              </div>
              <div className="apid-modal-actions">
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  onClick={() => setShowRequestModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="apid-btn apid-btn-primary">
                  Submit to PMS Review (Preview)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

