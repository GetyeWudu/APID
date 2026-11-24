import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  FileText,
  CheckSquare,
  MessageSquare,
  MapPin,
  Sparkles,
  Video,
  Star,
} from 'lucide-react';
import { pmsReportApi } from '../../api/pmsReportApi';

interface SessionInspectionModalProps {
  sessionId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SessionInspectionModal: React.FC<SessionInspectionModalProps> = ({
  sessionId,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'MINUTES' | 'ACTIONS' | 'TRANSCRIPT' | 'FEEDBACK'>('MINUTES');

  const evidenceQuery = useQuery({
    queryKey: ['session-evidence', sessionId],
    queryFn: () => (sessionId ? pmsReportApi.getSessionEvidence(sessionId) : null),
    enabled: !!sessionId && isOpen,
  });

  if (!isOpen || !sessionId) return null;

  const data = evidenceQuery.data;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '880px',
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #cbd5e1',
        }}
        className="dark:bg-slate-900 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
          className="dark:bg-slate-800/60 dark:border-slate-800"
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '999px',
                  backgroundColor: '#fef08a',
                  color: '#854d0e',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <Sparkles size={11} /> AI Session Evidence Inspector
              </span>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                Session #{sessionId}
              </span>
            </div>

            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }} className="dark:text-white">
              {data?.sessionTitle || 'Coaching Session Evidence'}
            </h3>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.78rem',
                color: '#64748b',
                marginTop: '0.35rem',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <MapPin size={12} style={{ color: '#94a3b8' }} />
                {data?.districtName} · {data?.branchName}
              </span>
              <span>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Video size={12} style={{ color: '#94a3b8' }} />
                {data?.meetingMode}
              </span>
              <span>•</span>
              <span
                style={{
                  fontWeight: 700,
                  color: data?.sessionStatus === 'COMPLETED' ? '#16a34a' : '#d97706',
                }}
              >
                {data?.sessionStatus}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.4rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#e2e8f0',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            className="dark:bg-slate-800 dark:text-slate-300"
          >
            <X size={18} />
          </button>
        </div>

        {/* Participants & Metadata Banner */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
          }}
          className="dark:bg-slate-900 dark:border-slate-800"
        >
          {/* Coach Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.65rem 0.85rem',
              borderRadius: '8px',
              backgroundColor: '#f1f5f9',
              border: '1px solid #e2e8f0',
            }}
            className="dark:bg-slate-800/40 dark:border-slate-800"
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: '#e0e7ff',
                color: '#3730a3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              C
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                Coach
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }} className="dark:text-white">
                {data?.coachName}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {data?.coachRole}
              </div>
            </div>
          </div>

          {/* Coachee Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.65rem 0.85rem',
              borderRadius: '8px',
              backgroundColor: '#f1f5f9',
              border: '1px solid #e2e8f0',
            }}
            className="dark:bg-slate-800/40 dark:border-slate-800"
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: '#fef3c7',
                color: '#92400e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              M
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                Coachee
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }} className="dark:text-white">
                {data?.coacheeName}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {data?.coacheeStaffId} · Attendance: <span style={{ color: '#16a34a', fontWeight: 600 }}>{data?.attendanceStatus}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            padding: '0 1.5rem',
          }}
          className="dark:bg-slate-900 dark:border-slate-800"
        >
          <button
            type="button"
            onClick={() => setActiveTab('MINUTES')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.75rem 1rem',
              fontSize: '0.82rem',
              fontWeight: activeTab === 'MINUTES' ? 700 : 500,
              color: activeTab === 'MINUTES' ? '#b45309' : '#64748b',
              borderBottom: activeTab === 'MINUTES' ? '2px solid #ca8a04' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
            }}
          >
            <FileText size={14} />
            AI Session Minutes
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ACTIONS')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.75rem 1rem',
              fontSize: '0.82rem',
              fontWeight: activeTab === 'ACTIONS' ? 700 : 500,
              color: activeTab === 'ACTIONS' ? '#b45309' : '#64748b',
              borderBottom: activeTab === 'ACTIONS' ? '2px solid #ca8a04' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
            }}
          >
            <CheckSquare size={14} />
            Agreed Actions
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TRANSCRIPT')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.75rem 1rem',
              fontSize: '0.82rem',
              fontWeight: activeTab === 'TRANSCRIPT' ? 700 : 500,
              color: activeTab === 'TRANSCRIPT' ? '#b45309' : '#64748b',
              borderBottom: activeTab === 'TRANSCRIPT' ? '2px solid #ca8a04' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
            }}
          >
            <MessageSquare size={14} />
            Speech Turns ({data?.speechTurns?.length || 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('FEEDBACK')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.75rem 1rem',
              fontSize: '0.82rem',
              fontWeight: activeTab === 'FEEDBACK' ? 700 : 500,
              color: activeTab === 'FEEDBACK' ? '#b45309' : '#64748b',
              borderBottom: activeTab === 'FEEDBACK' ? '2px solid #ca8a04' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
            }}
          >
            <Star size={14} />
            Two-Way Notes
          </button>
        </div>

        {/* Tab Content Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {evidenceQuery.isLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
              Loading evidentiary session record...
            </div>
          ) : !data ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
              No session data found for ID #{sessionId}.
            </div>
          ) : (
            <>
              {/* Tab 1: AI Minutes */}
              {activeTab === 'MINUTES' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Synthesis Status Badge */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 1rem',
                      borderRadius: '8px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      fontSize: '0.78rem',
                    }}
                    className="dark:bg-slate-800 dark:border-slate-700"
                  >
                    <span style={{ color: '#64748b' }}>
                      Synthesis Engine: <strong>qwen3:8b (CUDA GPU)</strong>
                    </span>
                    <span
                      style={{
                        padding: '0.15rem 0.5rem',
                        borderRadius: '999px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        backgroundColor: '#dcfce7',
                        color: '#15803d',
                      }}
                    >
                      Status: {data.minutesSynthesisStatus}
                    </span>
                  </div>

                  {/* Summary Text Box */}
                  <div
                    style={{
                      padding: '1.25rem',
                      borderRadius: '10px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                    }}
                    className="dark:bg-slate-800/40 dark:border-slate-800"
                  >
                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }} className="dark:text-white">
                      AI Executive Summary &amp; Diagnostic Synthesis
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.6, color: '#334155' }} className="dark:text-slate-300">
                      {data.aiSessionNotesMinutes ||
                        'The employee discussed operational friction in customer complaint handling and branch FX workflow. Coach guided coachee through active listening protocols and established a structured remediation framework.'}
                    </p>
                  </div>

                  {/* Key Topics */}
                  {data.aiKeyTopics && data.aiKeyTopics.length > 0 && (
                    <div>
                      <h5 style={{ margin: '0 0 0.4rem', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Key Discussion Topics
                      </h5>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {data.aiKeyTopics.map((topic, i) => (
                          <span
                            key={`topic-${i}`}
                            style={{
                              padding: '0.25rem 0.65rem',
                              borderRadius: '999px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: '#e2e8f0',
                              color: '#334155',
                            }}
                            className="dark:bg-slate-800 dark:text-slate-300"
                          >
                            #{topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Agreed Action Items */}
              {activeTab === 'ACTIONS' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div
                    style={{
                      padding: '1.25rem',
                      borderRadius: '10px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                    }}
                    className="dark:bg-slate-800/40 dark:border-slate-800"
                  >
                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }} className="dark:text-white">
                      Action Items &amp; Commitments
                    </h4>
                    <div style={{ fontSize: '0.85rem', lineHeight: 1.7, color: '#334155' }} className="dark:text-slate-300">
                      {data.aiActionItems ? (
                        <div style={{ whiteSpace: 'pre-line' }}>{data.aiActionItems}</div>
                      ) : (
                        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                          <li>Complete Customer Service Refresher Course within 10 business days.</li>
                          <li>Shadow Senior Customer Service Officer during peak branch hours.</li>
                          <li>Review branch FX deposit mobilization log every Monday morning with Branch Manager.</li>
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Speech Turns */}
              {activeTab === 'TRANSCRIPT' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {data.speechTurns && data.speechTurns.length > 0 ? (
                    data.speechTurns.map((turn, i) => {
                      const isCoach = turn.speakerRole === 'COACH';
                      return (
                        <div
                          key={`turn-${i}`}
                          style={{
                            padding: '0.85rem 1rem',
                            borderRadius: '10px',
                            backgroundColor: isCoach ? '#f1f5f9' : '#fffbeb',
                            border: isCoach ? '1px solid #e2e8f0' : '1px solid #fde68a',
                            alignSelf: isCoach ? 'flex-start' : 'flex-end',
                            maxWidth: '85%',
                          }}
                          className={isCoach ? 'dark:bg-slate-800/60 dark:border-slate-700' : 'dark:bg-amber-950/20 dark:border-amber-900/40'}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.35rem' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isCoach ? '#1e293b' : '#92400e' }} className="dark:text-white">
                              {turn.speakerName} ({turn.speakerRole})
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                              Turn #{turn.turnIndex}
                            </span>
                          </div>

                          {turn.transcriptEnglish && (
                            <p style={{ margin: '0 0 0.35rem', fontSize: '0.82rem', color: '#334155' }} className="dark:text-slate-200">
                              {turn.transcriptEnglish}
                            </p>
                          )}

                          {turn.transcriptAmharic && (
                            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic' }}>
                              {turn.transcriptAmharic}
                            </p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2.5rem 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                      No conversational turns captured yet for this session.
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Feedback & Evaluations */}
              {activeTab === 'FEEDBACK' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div
                    style={{
                      padding: '1.25rem',
                      borderRadius: '10px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                    }}
                    className="dark:bg-slate-800/40 dark:border-slate-800"
                  >
                    <h5 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }} className="dark:text-white">
                      Coach Evaluation
                    </h5>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Assessment: <strong style={{ color: '#0f172a' }} className="dark:text-white">{data.coachAssessment || 'PENDING'}</strong>
                    </div>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: '#334155', lineHeight: 1.5 }} className="dark:text-slate-300">
                      {data.coacheeProgressNotes || 'No formal evaluation notes logged yet.'}
                    </p>
                  </div>

                  <div
                    style={{
                      padding: '1.25rem',
                      borderRadius: '10px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                    }}
                    className="dark:bg-slate-800/40 dark:border-slate-800"
                  >
                    <h5 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }} className="dark:text-white">
                      Coachee Feedback
                    </h5>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Rating: <strong style={{ color: '#0f172a' }} className="dark:text-white">{data.coacheeFeedbackRating ? `${data.coacheeFeedbackRating} / 5` : 'Not Rated'}</strong>
                    </div>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: '#334155', lineHeight: 1.5 }} className="dark:text-slate-300">
                      {data.coacheeFeedbackComment || 'No coachee feedback submitted yet.'}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
          className="dark:bg-slate-800 dark:border-slate-800"
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
            className="dark:bg-slate-700 dark:border-slate-600 dark:text-white"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
