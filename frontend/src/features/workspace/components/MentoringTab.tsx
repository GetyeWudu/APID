import { useState, type FormEvent } from 'react';
import { Award, BookOpen, CheckCircle2, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataSourceBadge, EmptyState, StatusPill, useToast } from '../../../shared/components/ui';
import type { PreviewWorkspaceData } from '../../../shared/mocks/boaPreviewFixtures';
import type { SkillItem } from '../../admin/skills/types/skills.types';
import { workspacePreviewAdapter } from '../api/workspaceDashboardApi';
import { IsolatedChatPanel, type ChatMessageItem } from './IsolatedChatPanel';

export function MentoringTab({
  workspace,
  activeSkills,
  chatMessages,
  onAppendChat,
  section = 'all',
}: {
  workspace: PreviewWorkspaceData;
  activeSkills: SkillItem[];
  chatMessages: ChatMessageItem[];
  onAppendChat: (body: string) => void;
  section?: 'all' | 'trainee' | 'trainer' | 'directory';
}) {
  const { pushToast } = useToast();
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applySkill, setApplySkill] = useState(
    activeSkills[0]?.name ?? 'Leadership & Performance Coaching'
  );
  const [applyEvidence, setApplyEvidence] = useState('');
  const [handledIncoming, setHandledIncoming] = useState<Record<string, 'ACCEPTED' | 'DECLINED'>>({});

  const handleApplySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!applyEvidence.trim()) return;
    const res = await workspacePreviewAdapter.simulateAction(
      `Trainer certification application (${applySkill})`
    );
    pushToast({
      title: 'Application Submitted to HR (Preview)',
      message: res.message,
      tone: 'ok',
    });
    setShowApplyModal(false);
    setApplyEvidence('');
  };

  const handleIncomingAction = async (id: string, decision: 'ACCEPTED' | 'DECLINED') => {
    const res = await workspacePreviewAdapter.simulateAction(`Trainer decision ${decision} (${id})`);
    setHandledIncoming((prev) => ({ ...prev, [id]: decision }));
    pushToast({ title: `Trainee Request ${decision} (Preview)`, message: res.message, tone: 'info' });
  };

  const showTrainee = section === 'all' || section === 'trainee';
  const showTrainer = section === 'all' || section === 'trainer';
  const showDirectory = section === 'all' || section === 'directory';
  const showChat = section === 'all' || section === 'trainee';

  return (
    <div className="boa-stack">
      {(showTrainee || showTrainer) && (
        <div
          className={showTrainee && showTrainer ? 'boa-grid-2' : 'boa-stack'}
          style={{ marginBottom: 0 }}
        >
          {/* Trainee progress */}
          {showTrainee && (
            <div className="apid-card">
          <div className="boa-card-header">
            <div>
              <h3 className="boa-card-title">My Mentoring Progress (Trainee)</h3>
              <p className="boa-card-subtitle">{workspace.mentoringAsTrainee.skillName}</p>
            </div>
            <DataSourceBadge source="preview" />
          </div>

          {!workspace.hasTraineeRelationship ? (
            <EmptyState
              title="No Active Mentoring Match"
              description="Browse certified Bank of Abyssinia Trainers below or submit an HR-assisted skill request."
            />
          ) : (
            <div className="boa-stack">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <StatusPill label={`Trainer: ${workspace.mentoringAsTrainee.trainerName}`} tone="info" />
                <span className="tabular-nums" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                  {workspace.mentoringAsTrainee.sessionsCompleted} /{' '}
                  {workspace.mentoringAsTrainee.sessionsPlanned} Sessions
                </span>
              </div>
              <div className="boa-progress-track">
                <div
                  className="boa-progress-fill"
                  style={{
                    width: `${Math.round(
                      (workspace.mentoringAsTrainee.sessionsCompleted /
                        workspace.mentoringAsTrainee.sessionsPlanned) *
                        100
                    )}%`,
                  }}
                />
              </div>
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.7rem',
                  background: 'var(--surface-subtle)',
                  fontSize: '0.84rem',
                }}
              >
                <BookOpen size={14} style={{ verticalAlign: 'text-bottom', marginRight: '0.35rem' }} />
                {workspace.mentoringAsTrainee.milestoneNote}
              </div>
            </div>
            )}
          </div>
          )}

          {/* Apply / Trainer Role */}
          {showTrainer && (
            <div className="apid-card">
          <div className="boa-card-header">
            <div>
              <h3 className="boa-card-title">Trainer Certification &amp; Mentorship</h3>
              <p className="boa-card-subtitle">
                Share domain expertise with colleagues across Bank of Abyssinia.
              </p>
            </div>
            <DataSourceBadge source="preview" />
          </div>

          {!workspace.isApprovedTrainer ? (
            <EmptyState
              title="Become a Certified Internal Trainer"
              description="Employees with deep domain expertise can apply for HR trainer certification."
              icon={<Award size={28} />}
              action={
                <button
                  type="button"
                  className="apid-btn apid-btn-primary apid-btn-sm"
                  onClick={() => setShowApplyModal(true)}
                >
                  <UserPlus size={14} /> Apply as Trainer
                </button>
              }
            />
          ) : (
            <div className="boa-stack">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <StatusPill label="CERTIFIED TRAINER" tone="ok" />
                <span className="tabular-nums" style={{ fontSize: '0.82rem' }}>
                  Capacity: {workspace.mentoringAsTrainer.activeTrainees}/
                  {workspace.mentoringAsTrainer.maxTrainees}
                </span>
              </div>
              {workspace.mentoringAsTrainer.incomingRequests.map((req) => {
                const handled = handledIncoming[req.id];
                return (
                  <div
                    key={req.id}
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
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                        {req.traineeName} · <StatusPill label={req.skill} tone="neutral" />
                      </div>
                      <div className="boa-muted" style={{ fontSize: '0.79rem' }}>
                        {req.note}
                      </div>
                    </div>
                    {handled ? (
                      <StatusPill
                        label={handled}
                        tone={handled === 'ACCEPTED' ? 'ok' : 'neutral'}
                        icon={<CheckCircle2 size={12} />}
                      />
                    ) : (
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          type="button"
                          className="apid-btn apid-btn-primary apid-btn-sm"
                          onClick={() => void handleIncomingAction(req.id, 'ACCEPTED')}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="apid-btn apid-btn-outline apid-btn-sm"
                          onClick={() => void handleIncomingAction(req.id, 'DECLINED')}
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>
          )}
        </div>
      )}

      {/* Certified Trainer Browse Directory */}
      {showDirectory && (
        <div className="apid-card">
          <div className="boa-card-header">
            <div>
              <h3 className="boa-card-title">Certified Trainer Directory</h3>
              <p className="boa-card-subtitle">Browse active users assigned the Mentor role.</p>
            </div>
          </div>
          <EmptyState
            title="No Mentor Data Available"
            description="Sample trainer profiles are not shown here."
            action={
              <Link to="/mentoring?view=directory" className="apid-btn apid-btn-primary apid-btn-sm">
                Open Directory
              </Link>
            }
          />
        </div>
      )}

      {showChat && (
        <IsolatedChatPanel
          contextTitle="Mentoring Channel (Trainee ↔ Trainer)"
          contextKey="mentoring"
          messages={chatMessages}
          onSendMessage={onAppendChat}
        />
      )}

      {showApplyModal && (
        <div
          className="apid-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Apply for Trainer Certification"
        >
          <div className="apid-card apid-modal">
            <h3 style={{ marginTop: 0 }}>Apply for Internal Trainer Certification (Preview)</h3>
            <form onSubmit={handleApplySubmit} className="apid-form">
              <div className="apid-field">
                <label htmlFor="tr-app-skill">Primary Skill Area</label>
                <select
                  id="tr-app-skill"
                  className="apid-input"
                  value={applySkill}
                  onChange={(e) => setApplySkill(e.target.value)}
                >
                  {(activeSkills.length > 0
                    ? activeSkills.map((s) => s.name)
                    : ['Leadership & Performance Coaching', 'Credit Risk & Loan Assessment']
                  ).map((sk) => (
                    <option key={sk} value={sk}>
                      {sk}
                    </option>
                  ))}
                </select>
              </div>
              <div className="apid-field">
                <label htmlFor="tr-app-evidence">Certification / Experience Summary</label>
                <textarea
                  id="tr-app-evidence"
                  className="apid-input"
                  rows={3}
                  required
                  value={applyEvidence}
                  onChange={(e) => setApplyEvidence(e.target.value)}
                  placeholder="Describe relevant credentials, banking domain track record, and uploaded certificate..."
                />
              </div>
              <div className="apid-modal-actions">
                <button
                  type="button"
                  className="apid-btn apid-btn-outline"
                  onClick={() => setShowApplyModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="apid-btn apid-btn-primary">
                  Submit to HR Review (Preview)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

