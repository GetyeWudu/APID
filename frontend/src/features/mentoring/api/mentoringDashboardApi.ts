import {
  PREVIEW_CERTIFIED_TRAINERS,
  PREVIEW_MENTORING_REQUESTS,
  PREVIEW_TRAINER_APPLICATIONS,
} from '../../../shared/mocks/boaPreviewFixtures';
import { skillsApi } from '../../admin/skills/api/skillsApi';
import type {
  HrMentoringOverview,
  MentoringDashboardApi,
} from './mentoringDashboardTypes';

/**
 * Hybrid preview adapter for Phase 9-11 HR Mentoring screens:
 * - Reads LIVE active skills from GET /api/v1/core/skills
 * - Simulates Phase 9-11 Trainer applications, roster, capacity & matching strictly in memory
 */
export const mentoringPreviewAdapter: MentoringDashboardApi = {
  mode: 'preview',

  async getOverview(): Promise<HrMentoringOverview> {
    let liveSkillNames: string[] = [];
    try {
      const liveSkills = await skillsApi.listActive();
      liveSkillNames = liveSkills.map((s) => s.name);
    } catch {
      liveSkillNames = [
        'Credit Risk & Loan Assessment',
        'Java & Spring Boot Development',
        'Data Analytics & Power BI',
        'Leadership & Performance Coaching',
      ];
    }

    const baseSkills = liveSkillNames.length > 0 ? liveSkillNames : [
      'Credit Risk & Loan Assessment',
      'Java & Spring Boot Development',
      'Data Analytics & Power BI',
      'Leadership & Performance Coaching',
    ];

    const skillSupplyDemand = baseSkills.slice(0, 6).map((skillName, idx) => ({
      skillName,
      openRequests: [6, 5, 4, 3, 2, 2][idx] ?? 2,
      availableTrainerSlots: [4, 2, 3, 2, 1, 2][idx] ?? 1,
    }));

    return {
      liveSkillNames,
      applications: [...PREVIEW_TRAINER_APPLICATIONS],
      trainers: [...PREVIEW_CERTIFIED_TRAINERS],
      requests: [...PREVIEW_MENTORING_REQUESTS],
      skillSupplyDemand,
      avgCompletionRating: 4.7,
      completionRatePct: 91,
    };
  },

  async simulateApplicationDecision(applicationId, decision, reason) {
    return {
      simulated: true,
      message: `Application ${applicationId} marked ${decision}${reason ? ` (${reason})` : ''} in preview session.`,
    };
  },

  async simulateDirectAppoint(employeeName, skills, maxTrainees) {
    return {
      simulated: true,
      message: `Appointed "${employeeName}" locally in preview session.`,
      trainer: {
        id: `TRN-SIM-${Date.now()}`,
        employeeCode: 'BOA-NEW',
        fullName: employeeName,
        department: 'Selected Unit',
        employmentStatus: 'ACTIVE',
        trainerAuthStatus: 'ACTIVE',
        approvedSkills: skills,
        activeTrainees: 0,
        maxTrainees,
        avgRating: 5.0,
      },
    };
  },

  async simulateTrainerStatusChange(trainerId, nextStatus, policy, reason) {
    return {
      simulated: true,
      message: `Trainer ${trainerId} updated to ${nextStatus}${policy ? ` (${policy})` : ''}${reason ? ` — ${reason}` : ''} in preview session.`,
    };
  },

  async simulateMatch(requestId, trainerId) {
    return {
      simulated: true,
      message: `Request ${requestId} matched with Trainer ${trainerId} in preview session.`,
    };
  },
};

