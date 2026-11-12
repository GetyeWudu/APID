import type {
  PreviewCertifiedTrainer,
  PreviewMentoringRequest,
  PreviewTrainerApplication,
} from '../../../shared/mocks/boaPreviewFixtures';

export type TrainerSuspensionPolicy =
  | 'PAUSE_EXISTING_RELATIONSHIPS'
  | 'BLOCK_NEW_SESSIONS_ONLY'
  | 'REQUIRE_HR_REASSIGNMENT';

export interface HrMentoringOverview {
  liveSkillNames: string[];
  applications: PreviewTrainerApplication[];
  trainers: PreviewCertifiedTrainer[];
  requests: PreviewMentoringRequest[];
  skillSupplyDemand: Array<{
    skillName: string;
    openRequests: number;
    availableTrainerSlots: number;
  }>;
  avgCompletionRating: number;
  completionRatePct: number;
}

export interface MentoringDashboardApi {
  readonly mode: 'preview';
  getOverview(): Promise<HrMentoringOverview>;
  simulateApplicationDecision(
    applicationId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason: string
  ): Promise<{ simulated: true; message: string }>;
  simulateDirectAppoint(
    employeeName: string,
    skills: string[],
    maxTrainees: number
  ): Promise<{ simulated: true; message: string; trainer: PreviewCertifiedTrainer }>;
  simulateTrainerStatusChange(
    trainerId: string,
    nextStatus: 'ACTIVE' | 'SUSPENDED' | 'REVOKED',
    policy: TrainerSuspensionPolicy | null,
    reason: string
  ): Promise<{ simulated: true; message: string }>;
  simulateMatch(
    requestId: string,
    trainerId: string
  ): Promise<{ simulated: true; message: string }>;
}

