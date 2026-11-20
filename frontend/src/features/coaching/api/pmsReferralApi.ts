import { apiClient } from '../../../shared/api/apiClient';

export interface QuarterScoreItem {
  quarter: string;
  score: number;
}

export interface PmsReferralCaseDto {
  id: number;
  coacheeEmployeeId: number;
  coacheeEmployeeNumber: string;
  coacheeFullName: string;
  coacheeDepartment: string;
  coacheeJobTitle: string;
  currentCoachEmployeeId: number | null;
  currentCoachFullName: string | null;
  assignmentId: number | null;
  consecutiveLowQuartersCount: number;
  latestScoresJson: string;
  coachingSessionsAttended: number;
  status: 'PENDING_ADMIN_ACTION' | 'REASSIGNED' | 'HR_ACTION_TAKEN' | 'DISMISSED';
  newCoachEmployeeId: number | null;
  newCoachFullName: string | null;
  pmsAdminUserId: number | null;
  resolutionType: string | null;
  resolutionNotes: string | null;
  escalatedAt: string;
  resolvedAt: string | null;
}

export interface ResolveReferralPayload {
  resolutionType: 'REASSIGN_COACH' | 'HR_PIP' | 'DISMISSED';
  newCoachEmployeeId?: number | null;
  notes: string;
}

export const pmsReferralApi = {
  getReferrals: async (status?: string): Promise<PmsReferralCaseDto[]> => {
    const res = await apiClient.get<{ success: boolean; data: PmsReferralCaseDto[] }>(
      '/coaching/referrals',
      { params: status ? { status } : {} }
    );
    return res.data.data;
  },

  scanReferrals: async (): Promise<{ newReferralsGenerated: number; scannedAt: string }> => {
    const res = await apiClient.post<{ success: boolean; data: { newReferralsGenerated: number; scannedAt: string } }>(
      '/coaching/referrals/scan'
    );
    return res.data.data;
  },

  resolveReferral: async (id: number, payload: ResolveReferralPayload): Promise<PmsReferralCaseDto> => {
    const res = await apiClient.post<{ success: boolean; data: PmsReferralCaseDto }>(
      `/coaching/referrals/${id}/resolve`,
      payload
    );
    return res.data.data;
  },
};
