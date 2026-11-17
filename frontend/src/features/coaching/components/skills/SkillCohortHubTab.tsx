import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Award,
  Calendar,
  Users,
  MessageCircle,
  CheckCircle2,
  UserPlus,
  BookOpen,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { MyCoacheeItem } from '../../api/coachingAssignmentApi';
import { skillCoachingRequestApi, SkillCoachingRequestItem } from '../../api/skillCoachingRequestApi';
import { CoachingSessionsTab } from '../CoachingSessionsTab';
import { CoachingChatHub } from '../chat/CoachingChatHub';
import { SkillCoachingRequestsList } from '../SkillCoachingRequestsList';
import { RequestSkillCoachingModal } from '../RequestSkillCoachingModal';
import { ManageCohortMembersModal } from './ManageCohortMembersModal';

interface SkillCohortHubTabProps {
  currentEmployee: any;
  directReports: any[];
  myCoachees: MyCoacheeItem[];
  activeQuarterId?: number;
  activeQuarterLabel?: string;
}

export type SkillSubTab = 'cohorts' | 'workshops' | 'discussions' | 'peers' | 'progress';

export const SkillCohortHubTab: React.FC<SkillCohortHubTabProps> = ({
  currentEmployee,
  directReports,
  myCoachees,
  activeQuarterId,
  activeQuarterLabel,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const subTab = (searchParams.get('sub') as SkillSubTab) || 'cohorts';
  const [isRequestModalOpen, setIsRequestModalOpen] = React.useState(false);
  const [managingCohortTarget, setManagingCohortTarget] = React.useState<SkillCoachingRequestItem | null>(null);

  // Fetch approved skill coaching requests (cohorts)
  const approvedCohortsQuery = useQuery<SkillCoachingRequestItem[]>({
    queryKey: ['my-approved-skill-requests'],
    queryFn: async () => {
      const all = await skillCoachingRequestApi.getMyRequests();
      return (all || []).filter((r: SkillCoachingRequestItem) => r.status === 'APPROVED');
    },
  });

  const cohorts = approvedCohortsQuery.data || [];

  const handleSubTabChange = (newSub: SkillSubTab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('view', 'skills');
      next.set('sub', newSub);
      return next;
    });
  };

  const navItems: { id: SkillSubTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'cohorts',
      label: 'My Skills & Cohorts',
      icon: <Award size={16} />,
      badge: cohorts.length > 0 ? cohorts.length : undefined,
    },
    {
      id: 'workshops',
      label: 'Workshops & Scheduling',
      icon: <Calendar size={16} />,
    },
    {
      id: 'discussions',
      label: 'Cohort Discussions',
      icon: <Users size={16} />,
    },
    {
      id: 'peers',
      label: 'Peer Conversations',
      icon: <MessageCircle size={16} />,
    },
    {
      id: 'progress',
      label: 'Individual Progress',
      icon: <CheckCircle2 size={16} />,
    },
  ];

  return (
    <div className="boa-stack" style={{ gap: '1.25rem' }}>
      {/* Cohort Hub Header Banner */}
      <div
        className="apid-card"
        style={{
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(202, 138, 4, 0.06) 100%)',
          border: '1px solid rgba(2, 132, 199, 0.25)',
          padding: '1.25rem 1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '12px',
                  background: 'rgba(2, 132, 199, 0.15)',
                  color: '#0284c7',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                <Sparkles size={13} /> Cohort Hub
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                {activeQuarterLabel || 'FY 2026/27 · Q2'}
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
              Skill Development &amp; Cohort Center
            </h2>
            <p className="boa-muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.86rem', maxWidth: 680 }}>
              Collaborative capability building across approved skill cohorts. Schedule group workshops, engage in cohort discussions, and connect directly with fellow cohort peers.
            </p>
          </div>

          {directReports.length > 0 && (
            <button
              type="button"
              className="apid-btn apid-btn-primary"
              onClick={() => setIsRequestModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                backgroundColor: 'var(--brand-gold, #ca8a04)',
                borderColor: 'var(--brand-gold, #ca8a04)',
                fontWeight: 700,
              }}
            >
              <UserPlus size={16} />
              <span>Nominate Staff for Skill Cohort</span>
            </button>
          )}
        </div>

        {/* Sub-navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginTop: '1.25rem',
            paddingTop: '0.85rem',
            borderTop: '1px solid rgba(2, 132, 199, 0.15)',
            overflowX: 'auto',
          }}
        >
          {navItems.map((item) => {
            const isActive = subTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSubTabChange(item.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.45rem 0.9rem',
                  borderRadius: '8px',
                  fontSize: '0.84rem',
                  fontWeight: isActive ? 700 : 500,
                  border: isActive ? '1px solid #0284c7' : '1px solid var(--border, #e2e8f0)',
                  background: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? '#0284c7' : 'var(--text-primary, #0f172a)',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge != null && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.05rem 0.45rem',
                      borderRadius: '10px',
                      background: isActive ? '#0284c7' : 'rgba(100, 116, 139, 0.15)',
                      color: isActive ? '#ffffff' : 'var(--muted, #64748b)',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ────────────────── SUB-TAB 1: MY SKILLS & COHORTS ────────────────── */}
      {subTab === 'cohorts' && (
        <div className="boa-stack" style={{ gap: '1.25rem' }}>
          {/* Active Cohorts Grid */}
          <div className="apid-card">
            <div className="boa-card-header">
              <div>
                <h3 className="boa-card-title">Approved Skill Cohorts</h3>
                <p className="boa-card-subtitle">
                  Cohort programs approved by PMS governance. Supports both 1-on-1 specialist coaching and collaborative group cohorts.
                </p>
              </div>
              <span className="boa-pill" style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', fontWeight: 600 }}>
                {cohorts.length} Active {cohorts.length === 1 ? 'Cohort' : 'Cohorts'}
              </span>
            </div>

            {cohorts.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--muted)' }}>
                <BookOpen size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  No Active Skill Cohorts
                </h4>
                <p style={{ margin: '0.35rem 0 1rem 0', fontSize: '0.84rem' }}>
                  There are currently no approved skill development cohorts. Managers can nominate staff using the button above.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '1rem',
                  marginTop: '0.5rem',
                }}
              >
                {cohorts.map((cohort) => {
                  const targetCount = cohort.targets?.length ?? 1;
                  return (
                    <div
                      key={cohort.id}
                      style={{
                        padding: '1.25rem',
                        borderRadius: '10px',
                        border: '1px solid var(--border, #e2e8f0)',
                        background: 'var(--surface, #ffffff)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <span
                            className="boa-pill"
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.12rem 0.45rem',
                              background: targetCount === 1 ? 'rgba(202, 138, 4, 0.12)' : 'rgba(2, 132, 199, 0.12)',
                              color: targetCount === 1 ? 'var(--brand-gold, #ca8a04)' : '#0284c7',
                              fontWeight: 700,
                            }}
                          >
                            {targetCount === 1 ? '1-on-1 Skill Mentoring' : `Group Cohort (${targetCount} Talents)`}
                          </span>
                          <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>
                            ID #{cohort.id}
                          </span>
                        </div>
                        <h4 style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {cohort.skillTitle}
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.4 }}>
                          {cohort.businessJustification || 'Capability enhancement program designed for operational proficiency.'}
                        </p>
                      </div>

                      {/* Coach info */}
                      <div
                        style={{
                          padding: '0.65rem 0.75rem',
                          borderRadius: '6px',
                          background: 'var(--surface-subtle, #f8fafc)',
                          fontSize: '0.8rem',
                        }}
                      >
                        <div style={{ color: 'var(--muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>
                          Designated Coach / Facilitator
                        </div>
                        <div style={{ fontWeight: 700, marginTop: '0.15rem' }}>
                          {cohort.proposedCoachFullName || 'Assigned Specialist'}
                        </div>
                      </div>

                      {/* Enrolled participants */}
                      {cohort.targets && cohort.targets.length > 0 && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                              Enrolled Members ({cohort.targets.length}):
                            </span>
                            <button
                              type="button"
                              className="apid-btn apid-btn-ghost"
                              style={{
                                padding: '0.15rem 0.45rem',
                                fontSize: '0.72rem',
                                color: '#0284c7',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                              }}
                              onClick={() => setManagingCohortTarget(cohort)}
                            >
                              <UserPlus size={12} />
                              Manage
                            </button>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {cohort.targets.map((t) => (
                              <span
                                key={t.employeeId}
                                style={{
                                  fontSize: '0.76rem',
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '6px',
                                  background: 'var(--surface-subtle, #f1f5f9)',
                                  color: 'var(--text-primary)',
                                  border: '1px solid var(--border, #e2e8f0)',
                                }}
                              >
                                {t.employeeFullName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Quick links to workshop, chat, or members */}
                      <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.5rem', borderTop: '1px solid var(--border, #f1f5f9)', paddingTop: '0.75rem' }}>
                        <button
                          type="button"
                          className="apid-btn apid-btn-outline"
                          style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.78rem' }}
                          onClick={() => handleSubTabChange('workshops')}
                        >
                          <Calendar size={13} style={{ marginRight: '0.35rem' }} />
                          Workshops
                        </button>
                        <button
                          type="button"
                          className="apid-btn apid-btn-primary"
                          style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.78rem' }}
                          onClick={() => handleSubTabChange('discussions')}
                        >
                          <Users size={13} style={{ marginRight: '0.35rem' }} />
                          Discussion
                        </button>
                        <button
                          type="button"
                          className="apid-btn apid-btn-outline"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', color: '#0284c7', borderColor: 'rgba(2, 132, 199, 0.3)' }}
                          onClick={() => setManagingCohortTarget(cohort)}
                          title="Manage cohort members (add or remove)"
                        >
                          <UserPlus size={13} style={{ marginRight: '0.35rem' }} />
                          Members
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* For Line Managers: Nomination Tracking Table */}
          {directReports.length > 0 && <SkillCoachingRequestsList />}
        </div>
      )}

      {/* ────────────────── SUB-TAB 2: WORKSHOPS & SCHEDULING ────────────────── */}
      {subTab === 'workshops' && (
        <div className="boa-stack">
          <CoachingSessionsTab
            myCoachees={myCoachees}
            currentEmployeeId={currentEmployee?.id}
            mode="SKILLS"
          />
        </div>
      )}

      {/* ────────────────── SUB-TAB 3: COHORT DISCUSSIONS ────────────────── */}
      {subTab === 'discussions' && (
        <div className="boa-stack">
          <div
            className="apid-card"
            style={{
              padding: '1rem 1.25rem',
              background: 'var(--surface, #ffffff)',
              borderRadius: '12px',
              border: '1px solid var(--border, #e2e8f0)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '8px',
                  background: 'rgba(2, 132, 199, 0.1)',
                  color: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Users size={18} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>
                  Skill Cohort Group Discussions
                </h4>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--muted, #64748b)' }}>
                  Collaborative discussion channels for approved skill cohorts. Share workshop takeaways, ask questions, and share study materials.
                </p>
              </div>
            </div>

            <CoachingChatHub
              currentEmployeeId={currentEmployee?.id}
              mode="SKILL_GROUP"
            />
          </div>
        </div>
      )}

      {/* ────────────────── SUB-TAB 4: PEER CONVERSATIONS ────────────────── */}
      {subTab === 'peers' && (
        <div className="boa-stack">
          <div
            className="apid-card"
            style={{
              padding: '1rem 1.25rem',
              background: 'var(--surface, #ffffff)',
              borderRadius: '12px',
              border: '1px solid var(--border, #e2e8f0)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '8px',
                  background: 'rgba(99, 102, 241, 0.1)',
                  color: '#6366f1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MessageCircle size={18} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>
                  Private Peer 1-on-1 Conversations
                </h4>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--muted, #64748b)' }}>
                  Direct peer-to-peer collaboration between employees sharing an approved skill cohort. Start a private chat to compare notes or practice exercises.
                </p>
              </div>
            </div>

            <CoachingChatHub
              currentEmployeeId={currentEmployee?.id}
              mode="PEER"
            />
          </div>
        </div>
      )}

      {/* ────────────────── SUB-TAB 5: INDIVIDUAL PROGRESS ────────────────── */}
      {subTab === 'progress' && (
        <div className="apid-card">
          <div className="boa-card-header">
            <div>
              <h3 className="boa-card-title">Cohort Member Progress &amp; Attendance</h3>
              <p className="boa-card-subtitle">
                Track skill competency acquisition, workshop attendance records, and practical milestones across enrolled cohorts.
              </p>
            </div>
            <span className="boa-pill" style={{ background: 'rgba(22, 163, 74, 0.12)', color: '#16a34a', fontWeight: 600 }}>
              <ShieldCheck size={14} style={{ marginRight: '0.35rem' }} /> Verified Records
            </span>
          </div>

          {cohorts.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)' }}>
              No cohort progress data available yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
              <table className="apid-table">
                <thead>
                  <tr>
                    <th>Cohort Program</th>
                    <th>Talent Name</th>
                    <th>Branch / Department</th>
                    <th>Attendance Status</th>
                    <th>Competency Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.flatMap((c) =>
                    (c.targets || []).map((target) => (
                      <tr key={`${c.id}-${target.employeeId}`}>
                        <td>
                          <strong>{c.skillTitle}</strong>
                        </td>
                        <td>{target.employeeFullName}</td>
                        <td>{target.department || 'Branch Operations'}</td>
                        <td>
                          <span
                            className="boa-pill"
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.12rem 0.5rem',
                              background: 'rgba(22, 163, 74, 0.1)',
                              color: '#16a34a',
                              fontWeight: 600,
                            }}
                          >
                            Enrolled &amp; Active
                          </span>
                        </td>
                        <td>
                          <span
                            className="boa-pill"
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.12rem 0.5rem',
                              background: 'rgba(2, 132, 199, 0.1)',
                              color: '#0284c7',
                              fontWeight: 600,
                            }}
                          >
                            In Progress
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Nomination Modal for Managers */}
      {directReports.length > 0 && activeQuarterId && (
        <RequestSkillCoachingModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          directReports={directReports}
          currentEmployee={currentEmployee}
          activeQuarterId={activeQuarterId}
          activeQuarterLabel={activeQuarterLabel || 'FY 2026/27 · Q2'}
        />
      )}

      {/* Manage Cohort Members Modal */}
      {managingCohortTarget && (
        <ManageCohortMembersModal
          isOpen={!!managingCohortTarget}
          onClose={() => setManagingCohortTarget(null)}
          cohort={cohorts.find((c) => c.id === managingCohortTarget.id) || managingCohortTarget}
          currentEmployee={currentEmployee}
        />
      )}
    </div>
  );
};
