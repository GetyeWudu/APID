import axios from 'axios';
import { apiClient, type ApiResponse } from '../../../shared/api/apiClient';
import {
  PREVIEW_CERTIFIED_TRAINERS,
  PREVIEW_WORKSPACE_DATA,
  type PreviewCertifiedTrainer,
  type PreviewWorkspaceData,
} from '../../../shared/mocks/boaPreviewFixtures';
import type { EmployeeItem } from '../../admin/organization/types/organization.types';
import { skillsApi } from '../../admin/skills/api/skillsApi';
import type { SkillItem } from '../../admin/skills/types/skills.types';

export interface WorkspaceLiveIdentity {
  linkedEmployee: EmployeeItem | null;
  directReports: EmployeeItem[];
  activeSkills: SkillItem[];
}

export const workspaceLiveApi = {
  async loadMyIdentity(): Promise<WorkspaceLiveIdentity> {
    let linkedEmployee: EmployeeItem | null = null;
    try {
      const meRes = await apiClient.get<ApiResponse<EmployeeItem>>('/core/employees/me');
      linkedEmployee = meRes.data.data;
    } catch (err) {
      if (!axios.isAxiosError(err) || err.response?.status !== 404) {
        // Non-404 errors still fall back cleanly on profile header
      }
      linkedEmployee = null;
    }

    let directReports: EmployeeItem[] = [];
    if (linkedEmployee) {
      try {
        const drRes = await apiClient.get<ApiResponse<EmployeeItem[]>>('/core/employees/me/direct-reports');
        directReports = drRes.data.data;
      } catch {
        directReports = [];
      }
    }

    let activeSkills: SkillItem[] = [];
    try {
      activeSkills = await skillsApi.listActive();
    } catch {
      activeSkills = [];
    }

    return { linkedEmployee, directReports, activeSkills };
  },
};

export const workspacePreviewAdapter = {
  async getParticipationPreview(): Promise<{
    workspace: PreviewWorkspaceData;
    availableTrainers: PreviewCertifiedTrainer[];
  }> {
    return {
      workspace: {
        ...PREVIEW_WORKSPACE_DATA,
        coachSessions: [...PREVIEW_WORKSPACE_DATA.coachSessions],
        chatCoachingMessages: [...PREVIEW_WORKSPACE_DATA.chatCoachingMessages],
        chatMentoringMessages: [...PREVIEW_WORKSPACE_DATA.chatMentoringMessages],
      },
      availableTrainers: PREVIEW_CERTIFIED_TRAINERS.filter(
        (t) => t.employmentStatus === 'ACTIVE' && t.trainerAuthStatus === 'ACTIVE'
      ),
    };
  },

  async simulateAction(actionLabel: string): Promise<{ simulated: true; message: string }> {
    return {
      simulated: true,
      message: `"${actionLabel}" saved in preview session only.`,
    };
  },
};

