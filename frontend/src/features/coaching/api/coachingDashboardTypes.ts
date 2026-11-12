import type {
  PreviewPmsAssignment,
  PreviewSkillDevRequest,
} from '../../../shared/mocks/boaPreviewFixtures';

export interface PmsDashboardFilters {
  performanceQuarter: string;
  coachingQuarter: string;
  directorate: string;
}

export interface PmsOverviewSnapshot {
  evaluatedEmployees: number;
  directorateCounts: Array<{ directorate: string; mandatory: number; skillDev: number; overdue: number }>;
  ratingSeries: number[];
  assignments: PreviewPmsAssignment[];
  requests: PreviewSkillDevRequest[];
}

export interface SimulatedMutationResult<T> {
  simulated: true;
  message: string;
  data: T;
}

export interface CoachingDashboardApi {
  readonly mode: 'preview';
  getOverview(filters: PmsDashboardFilters): Promise<PmsOverviewSnapshot>;
  simulateReplaceCoach(
    assignmentId: string,
    newCoachName: string,
    reason: string
  ): Promise<SimulatedMutationResult<{ assignmentId: string; newCoachName: string; reason: string }>>;
  simulateDecisionRequest(
    requestId: string,
    decision: 'APPROVED' | 'RETURNED' | 'REJECTED',
    reason: string
  ): Promise<SimulatedMutationResult<{ requestId: string; decision: 'APPROVED' | 'RETURNED' | 'REJECTED'; reason: string }>>;
  simulateExcelPreview(
    fileName: string
  ): Promise<
    SimulatedMutationResult<{
      fileName: string;
      sha256Short: string;
      sourceGoalRows: number;
      uniqueEmployees: number;
      mandatoryBelow3Count: number;
      passingRoundedCount: number;
    }>
  >;
}

