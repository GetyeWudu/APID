import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Send,
  Sparkles,
  ArrowRight,
  Eye,
  FileSearch,
  Building,
  MapPin,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { pmsAiApi, type AiCopilotActionLink } from '../../api/pmsAiApi';
import { useToast } from '../../../../shared/components/ui';
import { getAccessToken, performSingleFlightRefresh } from '../../../../shared/api/apiClient';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  actionLinks?: AiCopilotActionLink[];
  timestamp: string;
  durationMs?: number;
}

interface AskApidCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  quarterId?: number;
  onOpenDossier?: (assignmentId: number) => void;
  onFilterBranch?: (district: string, branch: string) => void;
  onFilterDistrict?: (district: string) => void;
  onInspectSession?: (sessionId: number) => void;
}

export interface PromptCategory {
  category: string;
  prompts: string[];
}

export const CATEGORIZED_PROMPTS: PromptCategory[] = [
  {
    category: 'District Bottlenecks & Critical Gaps',
    prompts: [
      'Which coaches are responsible for critical coachees in Adama?',
      'What are the primary skill gaps across Central District?',
      'Which branches have critical coachees with 0 sessions?',
      'Show all coachees in Critical Tier (< 2.0) bank-wide',
      'Compare critical risk concentration between Central and Adama districts',
      'Which branches in Hawassa District require urgent coaching intervention?',
      'What are the dominant performance deficiencies in Bahir Dar District?',
      'List all branches where 100% of enrolled staff are in Critical Tier',
    ],
  },
  {
    category: 'Individual Coachee & Coach Inquiries',
    prompts: [
      "Summarize Martha Bogale's current coaching status and gaps",
      "Summarize Eden Negash's baseline rating, gap, and assigned coach",
      "Summarize Worku Wolde's current coaching load and coachee progress",
      "What is Fikir Alemu's coaching roster in Adama Boset Branch?",
      "Summarize Helen Wondimu's coachee assignments and session completion",
      "Which coachees are assigned to Fitsum Regassa in Arada Branch?",
      "Summarize Blen Sahle's critical coachees in Adama Main Branch",
      "Show performance profile and remediation trajectory for Worku Bikila",
      "Summarize Seifu Mideksa's assigned staff and session progress",
      "Summarize Kalkidan Gudina's coaching status at Africa Avenue",
    ],
  },
  {
    category: 'Remediation Velocity & Session Targets',
    prompts: [
      'What is our bank-wide session completion rate for Q2?',
      'How many total approved sessions are planned versus completed?',
      'Which districts have completed zero coaching sessions to date?',
      'How many critical-tier coachees have not yet commenced session 1?',
      'What is the average session delivery velocity across retail branches?',
      'Which coaches have stalled sessions exceeding the 14-day threshold?',
      'What is the projected timeline to reach the 362-session bank-wide target?',
    ],
  },
  {
    category: 'Executive Governance & Staff Directory',
    prompts: [
      "Summarize Solomon Tekle's role and coaching status",
      'Are executive management members enrolled in quarterly PMS remediation?',
      'What is the threshold score for mandatory coaching enrollment?',
      'Why are some staff categorized in Moderate Tier versus Critical Tier?',
      'What percentage of monitored bank staff require remedial coaching?',
      'What are the strategic remediation priorities for Q2 FY 2026/27?',
      'Which competency represents the largest bank-wide skill deficit?',
    ],
  },
];

export const ALL_SUGGESTED_PROMPTS = CATEGORIZED_PROMPTS.flatMap((c) => c.prompts);

const STARTER_PROMPTS = [
  'Which coaches are responsible for critical coachees in Adama?',
  'What are the primary skill gaps across Central District?',
  'Which branches have critical coachees with 0 sessions?',
  "Summarize Martha Bogale's current coaching status and gaps",
  "Summarize Solomon Tekle's role and coaching status",
  'What is our bank-wide session completion rate for Q2?',
];

/**
 * Parses markdown inline formatting like **bold** into clean React elements
 * Guaranteed to eliminate any stray asterisks (*) or (**)
 */
const renderInlineMarkdown = (text: string): React.ReactNode => {
  // Strip unmatched or trailing asterisks (e.g. :** -> :, **: -> :, lone *)
  const normalized = text
    .replace(/\*+:$/, ':')
    .replace(/:\*+$/, ':')
    .replace(/(^|\s)\*(?!\*)/g, '$1')
    .replace(/(?<!\*)\*($|\s)/g, '$1');

  // Split on balanced **bold** markers
  const parts = normalized.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldContent = part.slice(2, -2).replace(/\*/g, '').trim();
      return (
        <strong key={i} style={{ fontWeight: 600, color: '#111827' }}>
          {boldContent}
        </strong>
      );
    }
    // Clean any residual asterisks from the plain part
    const cleanPart = part.replace(/\*/g, '');
    return cleanPart;
  });
};

/**
 * Executive Word-Processor Message Renderer
 * Formats data like a professional corporate report:
 * - Clear section headings (clean bold text, 0 asterisks)
 * - Distinct coach subheadings
 * - Nested, indented coachee & staff records with clean decimals (1.45 instead of 1.4500)
 * - Structured callouts for Executive Takeaways
 */
const CleanAiMessage: React.FC<{ text: string }> = ({ text }) => {
  const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const elements: React.ReactNode[] = [];
  let currentCoachees: string[] = [];
  let currentBullets: string[] = [];

  const flushCoacheeList = (key: string) => {
    if (currentCoachees.length > 0) {
      elements.push(
        <ul
          key={`coachee-ul-${key}`}
          style={{
            margin: '0.2rem 0 0.75rem',
            paddingLeft: '1.5rem',
            listStyleType: 'disc',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            color: '#334155',
            fontSize: '0.84rem',
            lineHeight: 1.55,
          }}
        >
          {currentCoachees.map((item, idx) => (
            <li key={idx} style={{ paddingLeft: '0.2rem' }}>
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
      currentCoachees = [];
    }
  };

  const flushGeneralBullets = (key: string) => {
    if (currentBullets.length > 0) {
      elements.push(
        <ul
          key={`gen-ul-${key}`}
          style={{
            margin: '0.3rem 0 0.7rem',
            paddingLeft: '1.4rem',
            listStyleType: 'disc',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            color: '#1f2937',
            fontSize: '0.85rem',
            lineHeight: 1.6,
          }}
        >
          {currentBullets.map((item, idx) => (
            <li key={idx} style={{ paddingLeft: '0.2rem' }}>
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
      currentBullets = [];
    }
  };

  rawLines.forEach((rawLine, idx) => {
    const line = rawLine.trim();

    // 1. Executive Takeaway line
    if (/^[*•-]?\s*(?:\*\*)?Executive Takeaway\b/i.test(line)) {
      flushCoacheeList(`takeaway-flush-c-${idx}`);
      flushGeneralBullets(`takeaway-flush-g-${idx}`);
      const content = line
        .replace(/^[*•-]?\s*(?:\*\*)?Executive Takeaway\b(?:\*\*)?:?\s*/i, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .trim();

      elements.push(
        <div
          key={`takeaway-${idx}`}
          style={{
            marginTop: '1.1rem',
            padding: '0.75rem 1rem',
            borderLeft: '3px solid #0f172a',
            backgroundColor: '#f8fafc',
            borderRadius: '0 4px 4px 0',
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#0f172a',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '0.3rem',
            }}
          >
            Executive Takeaway
          </div>
          <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.6 }}>
            {renderInlineMarkdown(content)}
          </div>
        </div>
      );
      return;
    }

    // 2. Section Heading (e.g. "*Primary Skill Gap Across Central District:**", "Primary Skill Gap:")
    const strippedHeading = line.replace(/^[*•-\s]+/, '').replace(/[*:\s]+$/, '').trim();
    const isHeadingCandidate =
      (line.endsWith(':') || line.endsWith('**') || line.endsWith(':**') || (line.startsWith('**') && line.endsWith('**'))) &&
      !/^Coach\b/i.test(strippedHeading) &&
      !/^Coachee\b/i.test(strippedHeading) &&
      !/^(?:Primary Gap|Sessions|Baseline Rating|Staff Profile|Employment Status|Position)\b/i.test(strippedHeading) &&
      !strippedHeading.includes('— Rating:') &&
      !strippedHeading.includes('| Rating:');

    if (isHeadingCandidate && strippedHeading.length > 0) {
      flushCoacheeList(`sec-flush-c-${idx}`);
      flushGeneralBullets(`sec-flush-g-${idx}`);
      elements.push(
        <div
          key={`heading-${idx}`}
          style={{
            fontSize: '0.9rem',
            fontWeight: 700,
            color: '#0f172a',
            marginTop: idx > 0 ? '1rem' : '0.2rem',
            marginBottom: '0.35rem',
          }}
        >
          {strippedHeading}
        </div>
      );
      return;
    }

    // 3. Coach Header (e.g. "*Coach: Worku Wolde", "Coach: Worku Wolde", "**Coach:** Worku Wolde")
    if (/^[*•-]?\s*(?:\*\*)?Coach\b/i.test(line)) {
      flushCoacheeList(`coach-flush-c-${idx}`);
      flushGeneralBullets(`coach-flush-g-${idx}`);
      const coachClean = line
        .replace(/^[*•-\s]+/, '')
        .replace(/\*/g, '')
        .trim();

      elements.push(
        <div
          key={`coach-${idx}`}
          style={{
            fontSize: '0.86rem',
            fontWeight: 600,
            color: '#0f172a',
            marginTop: '0.85rem',
            marginBottom: '0.25rem',
          }}
        >
          {coachClean}
        </div>
      );
      return;
    }

    // 4. Coachee item or nested profile item
    const isCoacheeOrDetail =
      /^[*•-]?\s*(?:\*\*)?Coachee\b/i.test(line) ||
      /^[*•-]?\s*(?:\*\*)?(?:Sessions|Primary Gap|Baseline Rating|Staff Profile|Employment Status|Position & Department|Coaching & Remediation Status)\b/i.test(line) ||
      (/Rating:\s*\d/i.test(line) && !line.endsWith(':'));

    if (isCoacheeOrDetail) {
      flushGeneralBullets(`coachee-flush-g-${idx}`);
      let coacheeClean = line
        .replace(/^[*•-\s]+/, '')
        .replace(/^(?:\*\*)?Coachee\b(?:\*\*)?:\s*/i, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .trim();

      // Clean up 4-decimal rating: 1.4500 -> 1.45
      coacheeClean = coacheeClean.replace(/(\d+\.\d{2})00/g, '$1');
      coacheeClean = coacheeClean.replace(/\s*\|\s*Rating:\s*/i, ' — Rating: ');
      coacheeClean = coacheeClean
        .replace(/\(CRITICAL\)/gi, '(Critical)')
        .replace(/\(MODERATE\)/gi, '(Moderate)');

      currentCoachees.push(coacheeClean);
      return;
    }

    // 5. General Bullet
    if (/^[*•-]/.test(line)) {
      flushCoacheeList(`bullet-flush-c-${idx}`);
      const cleanBullet = line.replace(/^[*•-\s]+/, '').replace(/\*/g, '').trim();
      currentBullets.push(cleanBullet);
      return;
    }

    // 6. Normal paragraph
    flushCoacheeList(`p-flush-c-${idx}`);
    flushGeneralBullets(`p-flush-g-${idx}`);
    elements.push(
      <p
        key={`p-${idx}`}
        style={{
          margin: '0.4rem 0',
          fontSize: '0.85rem',
          lineHeight: 1.6,
          color: '#1f2937',
        }}
      >
        {renderInlineMarkdown(line)}
      </p>
    );
  });

  flushCoacheeList('final-c');
  flushGeneralBullets('final-g');

  return <div style={{ display: 'flex', flexDirection: 'column' }}>{elements}</div>;
};

export const AskApidCopilotDrawer: React.FC<AskApidCopilotDrawerProps> = ({
  isOpen,
  onClose,
  quarterId,
  onOpenDossier,
  onFilterBranch,
  onFilterDistrict,
  onInspectSession,
}) => {
  const [query, setQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPromptsMenu, setShowPromptsMenu] = useState(false);
  const [selectedPromptCategory, setSelectedPromptCategory] = useState<string>('All');
  const [promptSearchQuery, setPromptSearchQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'I am your APID Coaching Decision Copilot. Ask me any question regarding monitored staff, remediation progress, coach assignments, or district bottlenecks.',
      timestamp: 'Just now',
    },
  ]);

  const visiblePrompts = useMemo(() => {
    let pool = ALL_SUGGESTED_PROMPTS;
    if (selectedPromptCategory !== 'All') {
      const cat = CATEGORIZED_PROMPTS.find((c) => c.category === selectedPromptCategory);
      pool = cat ? cat.prompts : ALL_SUGGESTED_PROMPTS;
    }
    if (!promptSearchQuery.trim()) return pool;
    const qLower = promptSearchQuery.toLowerCase();
    return pool.filter((p) => p.toLowerCase().includes(qLower));
  }, [selectedPromptCategory, promptSearchQuery]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { pushToast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (textToSubmit?: string) => {
    const q = (textToSubmit || query).trim();
    if (!q || isGenerating) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuery('');
    setShowPromptsMenu(false);
    setIsGenerating(true);

    const aiMessageId = `ai-${Date.now()}`;
    let streamedText = '';
    let actionLinks: AiCopilotActionLink[] = [];
    let durationMs: number | undefined;

    // Create placeholder assistant message immediately for real-time streaming
    const placeholderMsg: ChatMessage = {
      id: aiMessageId,
      role: 'assistant',
      text: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, placeholderMsg]);

    try {
      let token = getAccessToken();
      if (!token) {
        try {
          const refreshed = await performSingleFlightRefresh<{ accessToken: string }>(true);
          token = refreshed?.accessToken || null;
        } catch {
          // continue with in-memory token or cookie
        }
      }

      let response = await fetch('/api/v1/coaching/ai/ask/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ query: q, quarterId: quarterId || 2 }),
      });

      if (response.status === 401) {
        try {
          const refreshed = await performSingleFlightRefresh<{ accessToken: string }>(false);
          if (refreshed?.accessToken) {
            token = refreshed.accessToken;
            response = await fetch('/api/v1/coaching/ai/ask/stream', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              credentials: 'include',
              body: JSON.stringify({ query: q, quarterId: quarterId || 2 }),
            });
          }
        } catch {
          // ignore retry failure, will fallback below
        }
      }

      if (!response.ok || !response.body) {
        // Fallback to standard askCopilot call
        const resp = await pmsAiApi.askCopilot(q, quarterId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMessageId
              ? { ...m, text: resp.answer, actionLinks: resp.actionLinks, durationMs: resp.durationMs }
              : m
          )
        );
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const dataStr = line.replace(/^data:\s*/, '').trim();
            if (!dataStr) continue;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === 'meta') {
                actionLinks = parsed.actionLinks || [];
                setMessages((prev) =>
                  prev.map((m) => (m.id === aiMessageId ? { ...m, actionLinks } : m))
                );
              } else if (parsed.type === 'chunk' && parsed.text) {
                streamedText += parsed.text;
                setMessages((prev) =>
                  prev.map((m) => (m.id === aiMessageId ? { ...m, text: streamedText } : m))
                );
              } else if (parsed.type === 'done') {
                durationMs = parsed.durationMs;
                setMessages((prev) =>
                  prev.map((m) => (m.id === aiMessageId ? { ...m, durationMs } : m))
                );
              }
            } catch (ignored) {}
          }
        }
      }
    } catch (err: any) {
      try {
        const resp = await pmsAiApi.askCopilot(q, quarterId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMessageId
              ? { ...m, text: resp.answer, actionLinks: resp.actionLinks, durationMs: resp.durationMs }
              : m
          )
        );
      } catch (fallbackErr: any) {
        pushToast({
          title: 'Query Failed',
          message: fallbackErr?.message || 'Failed to reach AI inference service.',
          tone: 'err',
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMessageId
              ? { ...m, text: 'Unable to connect to the inference service. Please check network connectivity or try again.' }
              : m
          )
        );
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleActionClick = (link: AiCopilotActionLink) => {
    if (link.type === 'OPEN_DOSSIER' && link.assignmentId && onOpenDossier) {
      onOpenDossier(link.assignmentId);
      onClose();
    } else if (link.type === 'FILTER_BRANCH' && link.district && link.branch && onFilterBranch) {
      onFilterBranch(link.district, link.branch);
      onClose();
    } else if (link.type === 'FILTER_DISTRICT' && link.district && onFilterDistrict) {
      onFilterDistrict(link.district);
      onClose();
    } else if (link.type === 'INSPECT_SESSION' && link.sessionId && onInspectSession) {
      onInspectSession(link.sessionId);
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(2px)',
        zIndex: 1400,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '580px',
          height: '100%',
          backgroundColor: '#ffffff',
          boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid #e5e7eb',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '0.98rem',
                  fontWeight: 600,
                  color: '#111827',
                }}
              >
                Coaching Decision Copilot
              </h2>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 500,
                  padding: '0.1rem 0.4rem',
                  borderRadius: '4px',
                  backgroundColor: '#f3f4f6',
                  color: '#4b5563',
                }}
              >
                qwen3:8b
              </span>
            </div>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.74rem', color: '#6b7280' }}>
              Bank of Abyssinia Performance Management Intelligence
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.35rem',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              color: '#4b5563',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Message Stream */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            backgroundColor: '#ffffff',
          }}
        >
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  width: '100%',
                }}
              >
                {/* Speaker Label */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    marginBottom: '0.3rem',
                    fontSize: '0.72rem',
                    color: '#6b7280',
                  }}
                >
                  {isUser ? (
                    <span style={{ fontWeight: 600, color: '#374151' }}>You</span>
                  ) : (
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>APID Intelligence</span>
                  )}
                  {m.durationMs ? <span>({(m.durationMs / 1000).toFixed(1)}s)</span> : null}
                  <span>· {m.timestamp}</span>
                </div>

                {/* Bubble Container: Soft Professional Neutral for User, Flowing Document for AI */}
                <div
                  style={{
                    maxWidth: isUser ? '85%' : '100%',
                    padding: isUser ? '0.65rem 0.95rem' : '0.2rem 0',
                    borderRadius: isUser ? '16px 16px 4px 16px' : '0',
                    backgroundColor: isUser ? '#f1f5f9' : 'transparent',
                    border: isUser ? '1px solid #e2e8f0' : 'none',
                    boxShadow: isUser ? '0 1px 2px rgba(0, 0, 0, 0.03)' : 'none',
                    color: isUser ? '#0f172a' : '#1f2937',
                    fontSize: '0.86rem',
                    lineHeight: 1.6,
                  }}
                >
                  {isUser ? (
                    <div style={{ whiteSpace: 'pre-wrap', fontWeight: 500, color: '#0f172a' }}>{m.text}</div>
                  ) : (
                    <CleanAiMessage text={m.text} />
                  )}

                  {/* Clean, Subtle Action Links */}
                  {m.actionLinks && m.actionLinks.length > 0 && (
                    <div
                      style={{
                        marginTop: '0.85rem',
                        paddingTop: '0.6rem',
                        borderTop: '1px solid #f3f4f6',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                      }}
                    >
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Actions:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {m.actionLinks.map((link, lIdx) => (
                          <button
                            key={`link-${lIdx}`}
                            type="button"
                            onClick={() => handleActionClick(link)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.3rem 0.6rem',
                              borderRadius: '6px',
                              backgroundColor: '#f9fafb',
                              border: '1px solid #e5e7eb',
                              color: '#374151',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {link.type === 'OPEN_DOSSIER' && <Eye size={12} />}
                            {link.type === 'FILTER_BRANCH' && <Building size={12} />}
                            {link.type === 'FILTER_DISTRICT' && <MapPin size={12} />}
                            {link.type === 'INSPECT_SESSION' && <FileSearch size={12} />}
                            <span>{link.label}</span>
                            <ArrowRight size={11} style={{ opacity: 0.6 }} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Clean Suggested Questions (Initial Empty State) */}
          {messages.length === 1 && !isGenerating && (
            <div
              style={{
                marginTop: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Suggested questions:
                </span>
                <button
                  type="button"
                  onClick={() => setShowPromptsMenu(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0f172a',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Browse all 32+ →
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {STARTER_PROMPTS.map((promptText, pIdx) => (
                  <button
                    key={`starter-${pIdx}`}
                    type="button"
                    onClick={() => handleSubmit(promptText)}
                    style={{
                      textAlign: 'left',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '6px',
                      backgroundColor: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      color: '#374151',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      lineHeight: 1.4,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {promptText}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isGenerating && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                color: '#6b7280',
                padding: '0.4rem 0',
              }}
            >
              <div className="spin">
                <Sparkles size={14} style={{ color: '#0f172a' }} />
              </div>
              <span>Analyzing PMS data...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Collapsible Suggested Prompts Tray for Ongoing Chat (32+ Questions) */}
        {showPromptsMenu && (
          <div
            style={{
              padding: '0.75rem 1.25rem',
              backgroundColor: '#f9fafb',
              borderTop: '1px solid #e5e7eb',
              maxHeight: '260px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.1rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Suggested Questions ({visiblePrompts.length} of {ALL_SUGGESTED_PROMPTS.length})
              </span>
              <button
                type="button"
                onClick={() => setShowPromptsMenu(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', padding: 0 }}
              >
                <X size={13} />
              </button>
            </div>

            {/* Prompt Search Filter */}
            <input
              type="text"
              value={promptSearchQuery}
              onChange={(e) => setPromptSearchQuery(e.target.value)}
              placeholder="Filter suggested questions..."
              style={{
                width: '100%',
                padding: '0.4rem 0.65rem',
                fontSize: '0.78rem',
                backgroundColor: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                outline: 'none',
                color: '#111827',
              }}
            />

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', margin: '0.1rem 0' }}>
              <button
                type="button"
                onClick={() => setSelectedPromptCategory('All')}
                style={{
                  fontSize: '0.7rem',
                  fontWeight: selectedPromptCategory === 'All' ? 600 : 500,
                  padding: '0.2rem 0.5rem',
                  borderRadius: '12px',
                  backgroundColor: selectedPromptCategory === 'All' ? '#0f172a' : '#ffffff',
                  color: selectedPromptCategory === 'All' ? '#ffffff' : '#4b5563',
                  border: '1px solid #e5e7eb',
                  cursor: 'pointer',
                }}
              >
                All (32)
              </button>
              {CATEGORIZED_PROMPTS.map((cat, cIdx) => {
                const isSelected = selectedPromptCategory === cat.category;
                const shortLabel = cat.category.split(' ')[0];
                return (
                  <button
                    key={`cat-${cIdx}`}
                    type="button"
                    onClick={() => setSelectedPromptCategory(cat.category)}
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: isSelected ? 600 : 500,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '12px',
                      backgroundColor: isSelected ? '#0f172a' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#4b5563',
                      border: '1px solid #e5e7eb',
                      cursor: 'pointer',
                    }}
                  >
                    {shortLabel} ({cat.prompts.length})
                  </button>
                );
              })}
            </div>

            {/* List of Prompts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.1rem' }}>
              {visiblePrompts.map((p, idx) => (
                <button
                  key={`menu-p-${idx}`}
                  type="button"
                  onClick={() => handleSubmit(p)}
                  style={{
                    textAlign: 'left',
                    fontSize: '0.78rem',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    color: '#374151',
                    cursor: 'pointer',
                    lineHeight: 1.4,
                    transition: 'all 0.1s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                >
                  {p}
                </button>
              ))}
              {visiblePrompts.length === 0 && (
                <div style={{ fontSize: '0.78rem', color: '#6b7280', padding: '0.5rem', textAlign: 'center' }}>
                  No suggested questions match your filter.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Input Footer */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid #e5e7eb',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ marginBottom: '0.35rem' }}>
            <button
              type="button"
              onClick={() => setShowPromptsMenu((prev) => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.72rem',
                fontWeight: 500,
                color: '#4b5563',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <span>{showPromptsMenu ? 'Hide suggestions' : 'Browse suggestions'}</span>
              {showPromptsMenu ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about coaches, staff, or performance..."
              disabled={isGenerating}
              style={{
                flex: 1,
                padding: '0.55rem 0.85rem',
                fontSize: '0.84rem',
                backgroundColor: '#f9fafb',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                outline: 'none',
                color: '#111827',
              }}
            />

            <button
              type="submit"
              disabled={!query.trim() || isGenerating}
              style={{
                padding: '0.55rem 0.85rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: !query.trim() || isGenerating ? '#e5e7eb' : '#0f172a',
                color: '#ffffff',
                cursor: !query.trim() || isGenerating ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s ease',
              }}
              title="Send"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
