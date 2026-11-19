import { apiClient, type ApiResponse } from '../../../shared/api/apiClient';

export interface SubmitMentorApplicationPayload {
  proofDocument?: File;
  supportingEvidence?: File[];
  supportingEvidenceContexts?: string[];
  catalogSkillId?: number;
  catalogSkillIds?: number[];
  customSkill?: string;
  note?: string;
  experienceYears?: number;
  mentoringApproach?: string;
  sessionsPerWeek?: number;
  expertiseSummary?: string;
  availabilityNotes?: string;
  maxConcurrentTrainees?: number;
}

export interface SubmittedMentorApplication {
  id: number;
  applicationType: 'INITIAL' | 'SKILL_ADDITION' | 'PROFILE_UPDATE';
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  catalogSkillId: number | null;
  catalogSkillIds: number[];
  customSkill: string | null;
  submittedAt: string;
}

export interface MentorApplication {
  id: number;
  applicantUsername: string;
  applicationType: 'INITIAL' | 'SKILL_ADDITION' | 'PROFILE_UPDATE';
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  skillName: string;
  skillNames: string[];
  catalogSkillIds: number[];
  customSkill: string | null;
  proofFileId: number | null;
  proofFileName: string | null;
  evidenceFiles: Array<{ fileId: number; fileName: string; context?: string }>;
  note: string | null;
  expertiseSummary: string | null;
  availabilityNotes: string | null;
  experienceYears?: number | null;
  mentoringApproach?: string | null;
  sessionsPerWeek?: number | null;
  maxConcurrentTrainees: number | null;
  submittedAt: string;
  reviewedByUsername: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
}

export interface MentorApplicationDocumentSummary {
  applicationId: number;
  fileId: number;
  fileName: string;
  summary: string;
  sourceTruncated: boolean;
}

function buildApplicationFormData(payload: SubmitMentorApplicationPayload) {
  const formData = new FormData();
  if (payload.supportingEvidence?.length) {
    payload.supportingEvidence.forEach((file) => formData.append('supportingEvidence', file));
  }
  payload.supportingEvidenceContexts?.forEach((context) => {
    formData.append('supportingEvidenceContext', context);
  });
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
  if (payload.experienceYears !== undefined) {
    formData.append('experienceYears', String(payload.experienceYears));
  }
  if (payload.mentoringApproach) {
    formData.append('mentoringApproach', payload.mentoringApproach);
  }
  if (payload.sessionsPerWeek !== undefined) {
    formData.append('sessionsPerWeek', String(payload.sessionsPerWeek));
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
  return formData;
}

export interface ReviewMentorApplicationPayload {
  decision: 'APPROVED' | 'DECLINED';
  reason?: string;
}

export const mentorApplicationApi = {
  async listMine(): Promise<MentorApplication[]> {
    const response = await apiClient.get<ApiResponse<MentorApplication[]>>(
      '/mentoring/applications/mine'
    );
    return response.data.data;
  },

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

  async summarizeDocument(applicationId: number, fileId: number): Promise<MentorApplicationDocumentSummary> {
    const response = await apiClient.post<ApiResponse<MentorApplicationDocumentSummary>>(
      `/mentoring/applications/${applicationId}/evidence/${fileId}/summary`
    );
    return response.data.data;
  },

  async submit(payload: SubmitMentorApplicationPayload): Promise<SubmittedMentorApplication> {
    const response = await apiClient.post<ApiResponse<SubmittedMentorApplication>>(
      '/mentoring/applications',
      buildApplicationFormData(payload),
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data;
  },

  async requestSkillAddition(
    payload: Pick<SubmitMentorApplicationPayload, 'supportingEvidence' | 'catalogSkillIds' | 'customSkill' | 'note'>
  ): Promise<SubmittedMentorApplication> {
    const response = await apiClient.post<ApiResponse<SubmittedMentorApplication>>(
      '/mentoring/applications/skill-additions',
      buildApplicationFormData(payload),
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data;
  },

  async requestProfileUpdate(input: {
    profileDetails: string;
    changeNote?: string;
    availabilityNotes: string;
    experienceYears: number | null;
    mentoringApproach: string;
    sessionsPerWeek: number | null;
    catalogSkillIds: number[];
    customSkill?: string;
    supportingEvidenceContexts: string[];
    supportingEvidence?: File[];
  }): Promise<SubmittedMentorApplication> {
    const formData = new FormData();
    const { supportingEvidence = [], ...request } = input;
    formData.append(
      'request',
      new Blob([JSON.stringify(request)], { type: 'application/json' })
    );
    supportingEvidence.forEach((file) => formData.append('supportingEvidence', file));
    const response = await apiClient.post<ApiResponse<SubmittedMentorApplication>>(
      '/mentoring/applications/profile-updates',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data;
  },
};
