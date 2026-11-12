import {
  PREVIEW_PMS_ASSIGNMENTS,
  PREVIEW_RATING_SERIES,
  PREVIEW_SKILL_DEV_REQUESTS,
} from '../../../shared/mocks/boaPreviewFixtures';
import type {
  CoachingDashboardApi,
  PmsDashboardFilters,
  PmsOverviewSnapshot,
} from './coachingDashboardTypes';

/**
 * Preview adapter for Phase 5-8 Coaching/PMS features.
 * Strictly isolated from apiClient — performs zero backend HTTP requests.
 */
export const coachingPreviewAdapter: CoachingDashboardApi = {
  mode: 'preview',

  async getOverview(filters: PmsDashboardFilters): Promise<PmsOverviewSnapshot> {
    const dirFilter = filters.directorate;
    const filteredAssignments = PREVIEW_PMS_ASSIGNMENTS.filter((a) => {
      if (dirFilter && dirFilter !== 'ALL' && a.directorate !== dirFilter) return false;
      if (filters.performanceQuarter !== 'ALL' && a.performanceQuarter !== filters.performanceQuarter) return false;
      if (filters.coachingQuarter !== 'ALL' && a.coachingQuarter !== filters.coachingQuarter) return false;
      return true;
    });

    const filteredRequests = PREVIEW_SKILL_DEV_REQUESTS.filter(
      (r) => !dirFilter || dirFilter === 'ALL' || r.directorate === dirFilter
    );

    const directorates = [
      { directorate: 'Retail & Branch Banking', mandatory: 11, skillDev: 4, overdue: 2 },
      { directorate: 'Technology & Digital Banking', mandatory: 6, skillDev: 5, overdue: 1 },
      { directorate: 'Credit & Risk Management', mandatory: 8, skillDev: 3, overdue: 1 },
      { directorate: 'Operations & Treasury', mandatory: 5, skillDev: 2, overdue: 1 },
      { directorate: 'HR & Corporate Services', mandatory: 2, skillDev: 2, overdue: 0 },
    ].filter((d) => !dirFilter || dirFilter === 'ALL' || d.directorate === dirFilter);

    return {
      evaluatedEmployees: dirFilter === 'ALL' ? PREVIEW_RATING_SERIES.length : Math.max(4, filteredAssignments.length * 3),
      directorateCounts: directorates,
      ratingSeries: PREVIEW_RATING_SERIES,
      assignments: filteredAssignments,
      requests: filteredRequests,
    };
  },

  async simulateReplaceCoach(assignmentId, newCoachName, reason) {
    return {
      simulated: true,
      message: `Updated Coach to "${newCoachName}" for ${assignmentId} (preview session only).`,
      data: { assignmentId, newCoachName, reason },
    };
  },

  async simulateDecisionRequest(requestId, decision, reason) {
    return {
      simulated: true,
      message: `Request ${requestId} marked ${decision} (preview session only).`,
      data: { requestId, decision, reason },
    };
  },

  async simulateExcelPreview(fileName) {
    return {
      simulated: true,
      message: `Validated multi-goal rows for "${fileName}" locally in preview session.`,
      data: {
        fileName,
        sha256Short: 'preview-sha256-9a4e1c',
        sourceGoalRows: 36,
        uniqueEmployees: 12,
        mandatoryBelow3Count: 4,
        passingRoundedCount: 8,
      },
    };
  },
};

