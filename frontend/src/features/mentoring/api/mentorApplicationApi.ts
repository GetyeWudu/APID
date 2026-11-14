import { apiClient, type ApiResponse } from '../../../shared/api/apiClient';

export interface SubmitMentorApplicationPayload {
  proofDocument: File;
  catalogSkillId?: number;
  customSkill?: string;
  note?: string;
}

export interface SubmittedMentorApplication {
  id: number;
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  catalogSkillId: number | null;
  customSkill: string | null;
  submittedAt: string;
}

export interface MentorApplication {
  id: number;
  applicantUsername: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  skillName: string;
  proofFileName: string;
  note: string | null;
  submittedAt: string;
  reviewedByUsername: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
}

export interface ReviewMentorApplicationPayload {
  decision: 'APPROVED' | 'DECLINED';
  reason?: string;
}

export const mentorApplicationApi = {
  async list(): Promise<MentorApplication[]> {
    const response = await apiClient.get<ApiResponse<MentorApplication[]>>(
      '/mentoring/applications'
    );
    return response.data.data;
  },

  async review(
    applicationId: number,
    payload: ReviewMentorApplicationPayload
  ): Promise<MentorApplication> {
    const response = await apiClient.patch<ApiResponse<MentorApplication>>(
      `/mentoring/applications/${applicationId}/review`,
      payload
    );
    return response.data.data;
  },

  async submit(payload: SubmitMentorApplicationPayload): Promise<SubmittedMentorApplication> {
    const formData = new FormData();
    formData.append('proofDocument', payload.proofDocument);
    if (payload.catalogSkillId !== undefined) {
      formData.append('catalogSkillId', String(payload.catalogSkillId));
    }
    if (payload.customSkill) {
      formData.append('customSkill', payload.customSkill);
    }
    if (payload.note) {
      formData.append('note', payload.note);
    }

    const response = await apiClient.post<ApiResponse<SubmittedMentorApplication>>(
      '/mentoring/applications',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data;
  },
};
