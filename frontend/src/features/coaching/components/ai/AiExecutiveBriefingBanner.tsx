import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Bot,
} from 'lucide-react';
import { pmsAiApi } from '../../api/pmsAiApi';
import { useToast } from '../../../../shared/components/ui';

interface AiExecutiveBriefingBannerProps {
  quarterId?: number;
  onOpenCopilot?: () => void;
}

export const AiExecutiveBriefingBanner: React.FC<AiExecutiveBriefingBannerProps> = ({
  quarterId,
  onOpenCopilot,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const briefingQuery = useQuery({
    queryKey: ['pms-ai-briefing', quarterId],
    queryFn: () => pmsAiApi.getBriefing(quarterId, false),
    staleTime: 5 * 60_000,
  });

  const regenerateMutation = useMutation({
    mutationFn: () => pmsAiApi.getBriefing(quarterId, true),
    onSuccess: (data) => {
      queryClient.setQueryData(['pms-ai-briefing', quarterId], data);
      pushToast({
        title: 'Briefing Regenerated',
        message: 'Ollama qwen3:8b synthesized fresh executive insights from live database metrics.',
        tone: 'ok',
      });
    },
    onError: (err: any) => {
      pushToast({
        title: 'Regeneration Error',
        message: err?.message || 'Failed to generate AI briefing.',
        tone: 'err',
      });
    },
  });

  const data = briefingQuery.data;

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
        marginBottom: '1rem',
      }}
      className="dark:bg-slate-900 dark:border-slate-800"
    >
      {/* Top Banner Header */}
      <div
        style={{
          padding: '0.85rem 1.25rem',
          background: 'linear-gradient(90deg, rgba(202, 138, 4, 0.1) 0%, rgba(15, 23, 42, 0.03) 100%)',
          borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
        className="dark:border-slate-800"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              padding: '0.4rem',
              borderRadius: '8px',
              backgroundColor: '#ca8a04',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={16} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: '#b45309',
                }}
              >
                AI Executive Intelligence Briefing
              </span>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                • Powered by qwen3:8b (CUDA GPU)
              </span>
              {data?.generatedAt && (
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                  ({data.generatedAt})
                </span>
              )}
            </div>
            <h4
              style={{
                margin: '0.15rem 0 0',
                fontSize: '0.92rem',
                fontWeight: 700,
                color: '#0f172a',
              }}
              className="dark:text-white"
            >
              {data?.statusHeadline || 'Synthesizing Organizational Remediation Health...'}
            </h4>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {onOpenCopilot && (
            <button
              type="button"
              onClick={onOpenCopilot}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#0f172a',
                backgroundColor: '#fef08a',
                border: '1px solid #fde047',
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <Bot size={13} style={{ color: '#b45309' }} />
              <span>Ask APID Copilot</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => regenerateMutation.mutate()}
            disabled={regenerateMutation.isPending || briefingQuery.isFetching}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#475569',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              padding: '0.35rem 0.65rem',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
            className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
            title="Regenerate briefing from fresh metrics"
          >
            <RefreshCw
              size={12}
              className={regenerateMutation.isPending || briefingQuery.isFetching ? 'spin' : ''}
            />
            <span>{regenerateMutation.isPending ? 'Synthesizing...' : 'Regenerate'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              padding: '0.35rem',
              borderRadius: '6px',
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
            }}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div style={{ padding: '1.25rem' }}>
          {briefingQuery.isLoading ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>
              <div className="spin" style={{ display: 'inline-block', marginBottom: '0.5rem' }}>
                <Sparkles size={20} style={{ color: '#ca8a04' }} />
              </div>
              <div>Ollama qwen3:8b is evaluating organizational pacing and district metrics...</div>
            </div>
          ) : data ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Executive Summary Body */}
              <div
                style={{
                  fontSize: '0.84rem',
                  lineHeight: 1.6,
                  color: '#334155',
                  backgroundColor: '#f8fafc',
                  padding: '0.9rem 1.1rem',
                  borderRadius: '8px',
                  border: '1px solid #f1f5f9',
                }}
                className="dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-300"
              >
                {data.executiveSummary}
              </div>

              {/* 2-Column Split: Vulnerabilities & Recommendations */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1rem',
                }}
              >
                {/* Left: Operational Vulnerabilities */}
                <div
                  style={{
                    backgroundColor: '#fff1f2',
                    border: '1px solid #fecdd3',
                    borderRadius: '8px',
                    padding: '0.9rem 1rem',
                  }}
                  className="dark:bg-red-950/20 dark:border-red-900/40"
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#9f1239',
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                    }}
                    className="dark:text-red-300"
                  >
                    <AlertTriangle size={13} />
                    <span>Identified Risk Factors</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', lineHeight: 1.5, color: '#881337' }} className="dark:text-red-200">
                    {data.vulnerabilities.map((v, i) => (
                      <li key={`vuln-${i}`} style={{ marginBottom: '0.35rem' }}>
                        {v}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Right: Recommended Interventions */}
                <div
                  style={{
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    padding: '0.9rem 1rem',
                  }}
                  className="dark:bg-emerald-950/20 dark:border-emerald-900/40"
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#166534',
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                    }}
                    className="dark:text-emerald-300"
                  >
                    <CheckCircle2 size={13} />
                    <span>Prescribed Management Actions</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', lineHeight: 1.5, color: '#14532d' }} className="dark:text-emerald-200">
                    {data.recommendedInterventions.map((rec, i) => (
                      <li key={`rec-${i}`} style={{ marginBottom: '0.35rem' }}>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
