import { apiClient } from '../../../shared/api/apiClient';

export interface AiExecutiveBriefing {
  fiscalQuarterId: number | null;
  fiscalQuarterName: string;
  generatedAt: string;
  statusHeadline: string;
  overallHealthScore: number;
  executiveSummary: string;
  vulnerabilities: string[];
  recommendedInterventions: string[];
  isCached: boolean;
}

export interface AiCopilotActionLink {
  type: 'OPEN_DOSSIER' | 'FILTER_BRANCH' | 'FILTER_DISTRICT' | 'INSPECT_SESSION';
  label: string;
  district?: string;
  branch?: string;
  assignmentId?: number;
  sessionId?: number;
}

export interface AiCopilotResponse {
  query: string;
  answer: string;
  actionLinks: AiCopilotActionLink[];
  model: string;
  durationMs: number;
}

export const pmsAiApi = {
  getBriefing: async (quarterId?: number, force: boolean = false): Promise<AiExecutiveBriefing> => {
    const params: Record<string, any> = {};
    if (quarterId) params.quarterId = quarterId;
    if (force) params.force = true;
    const res = await apiClient.get<AiExecutiveBriefing>('/coaching/ai/briefing', { params });
    return res.data;
  },

  askCopilot: async (query: string, quarterId?: number): Promise<AiCopilotResponse> => {
    const res = await apiClient.post<AiCopilotResponse>('/coaching/ai/ask', {
      query,
      quarterId,
    });
    return res.data;
  },
};
