import { apiClient, type ApiResponse } from '../../../shared/api/apiClient';

export interface SubmitMentorApplicationPayload {
  proofDocument?: File;
  supportingEvidence?: File[];
  catalogSkillId?: number;
  catalogSkillIds?: number[];
  customSkill?: string;
  note?: string;
  expertiseSummary?: string;
  availabilityNotes?: string;
  maxConcurrentTrainees?: number;
}

export interface SubmittedMentorApplication {
  id: number;
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  catalogSkillId: number | null;
  catalogSkillIds: number[];
  customSkill: string | null;
  submittedAt: string;
}

export interface MentorApplication {
  id: number;
  applicantUsername: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  skillName: string;
  skillNames: string[];
  proofFileId: number;
  proofFileName: string;
  evidenceFiles: Array<{ fileId: number; fileName: string }>;
  note: string | null;
  expertiseSummary: string | null;
  availabilityNotes: string | null;
  maxConcurrentTrainees: number | null;
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

  async downloadProofDocument(fileId: number): Promise<Blob> {
    const response = await apiClient.get<Blob>(`/core/files/${fileId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  async submit(payload: SubmitMentorApplicationPayload): Promise<SubmittedMentorApplication> {
    const formData = new FormData();
    if (payload.supportingEvidence?.length) {
      payload.supportingEvidence.forEach((file) => formData.append('supportingEvidence', file));
    }
    if (payload.proofDocument) {
      formData.append('proofDocument', payload.proofDocument);
    }
    if (payload.catalogSkillId !== undefined) {
      formData.append('catalogSkillId', String(payload.catalogSkillId));
    }
    payload.catalogSkillIds?.forEach((skillId) => {
      formData.append('catalogSkillIds', String(skillId));
    });
    if (payload.customSkill) {
      formData.append('customSkill', payload.customSkill);
    }
    if (payload.note) {
      formData.append('note', payload.note);
    }
    if (payload.expertiseSummary) {
      formData.append('expertiseSummary', payload.expertiseSummary);
    }
    if (payload.availabilityNotes) {
      formData.append('availabilityNotes', payload.availabilityNotes);
    }
    if (payload.maxConcurrentTrainees !== undefined) {
      formData.append('maxConcurrentTrainees', String(payload.maxConcurrentTrainees));
    }

    const response = await apiClient.post<ApiResponse<SubmittedMentorApplication>>(
      '/mentoring/applications',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data;
  },
};
