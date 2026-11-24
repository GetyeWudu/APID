import { apiClient } from '../../../shared/api/apiClient';

export interface DirectorateSummary {
  directorate: string;
  totalCoached: number;
  showingImprovement: number;
  approvedSessions: number;
  completedSessions: number;
  atRiskCount: number;
}

export interface PmsReportSummary {
  fiscalQuarterName: string;
  totalInRemediation: number;
  criticalCount: number;
  moderateCount: number;
  showingImprovementCount: number;
  masteredCount: number;
  onTrackCount: number;
  needsImprovementCount: number;
  notStartedCount: number;
  totalApprovedSessions: number;
  totalCompletedSessions: number;
  sessionDeliveryRate: number;
  attentionRequiredCount: number;
  directorateBreakdown: DirectorateSummary[];
}

export interface PmsTalentProgressItem {
  assignmentId: number;
  coacheeEmployeeId: number;
  coacheeStaffId: string;
  coacheeName: string;
  department: string;
  directorate: string;
  startingRating: number;
  ratingBand: 'CRITICAL' | 'MODERATE';
  targetWeaknessKpi: string;
  coachEmployeeId: number;
  coachName: string;
  approvedTarget: number;
  completedSessions: number;
  remainingSessions: number;
  deliveryPercentage: number;
  latestAssessment: 'NEEDS_IMPROVEMENT' | 'PROGRESSING' | 'ON_TRACK' | 'MASTERED' | null;
  progressTrajectory: 'MASTERED' | 'ON_TRACK' | 'IMPROVING' | 'NEEDS_IMPROVEMENT' | 'NOT_STARTED';
  attentionRequired: boolean;
  attentionReason: string | null;
  lastSessionDate: string | null;
  nextScheduledDate: string | null;
  totalLoggedSessions: number;
  missedSessionsCount: number;
}

export interface SessionProgressLog {
  sessionId: number;
  sequenceNumber: number;
  sessionTitle: string;
  scheduledStartTime: string;
  conductedAt: string | null;
  durationMinutes: number;
  meetingMode: 'VIRTUAL_VIDEO' | 'PHONE_CALL' | 'IN_PERSON';
  sessionStatus: string;
  coachEmployeeId: number;
  coachName: string;
  coachAssessment: 'NEEDS_IMPROVEMENT' | 'PROGRESSING' | 'ON_TRACK' | 'MASTERED' | null;
  sessionDiscussionMinutes: string | null;
  actionItemsAssigned: string | null;
  coacheeEmployeeId: number;
  coacheeName: string;
  coacheeAttendanceStatus: 'ATTENDED' | 'MISSED' | 'EXCUSED' | 'PENDING';
  coacheeProgressNotes: string | null;
  coacheeProgressSubmittedAt: string | null;
  feedbackRating: number | null;
  feedbackComment: string | null;
  feedbackSubmittedAt: string | null;
}

export interface PmsTalentDossier {
  assignmentId: number;
  coacheeEmployeeId: number;
  coacheeStaffId: string;
  coacheeName: string;
  department: string;
  directorate: string;
  jobTitle: string;
  email: string | null;
  fiscalQuarterName: string;
  startingRating: number;
  ratingBand: 'CRITICAL' | 'MODERATE';
  targetWeaknessKpi: string;
  weaknessRootCause: string;
  targetScore: string;
  actualScore: string;
  coachEmployeeId: number;
  coachStaffId: string;
  coachName: string;
  coachEmail: string | null;
  policyBaseline: number;
  approvedTarget: number;
  completedSessions: number;
  remainingSessions: number;
  deliveryPercentage: number;
  targetStatus: string;
  isExtensionApproved: boolean;
  extensionSessionsAdded: number;
  latestAssessment: 'NEEDS_IMPROVEMENT' | 'PROGRESSING' | 'ON_TRACK' | 'MASTERED' | null;
  progressTrajectory: 'MASTERED' | 'ON_TRACK' | 'IMPROVING' | 'NEEDS_IMPROVEMENT' | 'NOT_STARTED';
  attentionRequired: boolean;
  attentionReason: string | null;
  sessionLogs: SessionProgressLog[];
}

export interface BranchAnalytics {
  branchName: string;
  totalStaff: number;
  coacheesCount: number;
  criticalCount: number;
  moderateCount: number;
  targetSessions: number;
  completedSessions: number;
  completionRate: number;
  overdueCount: number;
  averageStartingScore: number;
  primarySkillGap: string;
  activeCoachesCount: number;
}

export interface DistrictAnalytics {
  districtName: string;
  totalStaff: number;
  coacheesCount: number;
  criticalCount: number;
  moderateCount: number;
  targetSessions: number;
  completedSessions: number;
  completionRate: number;
  overdueCount: number;
  averageStartingScore: number;
  primarySkillGap: string;
  branches: BranchAnalytics[];
}

export interface DistrictBranchAnalytics {
  fiscalQuarterId: number | null;
  fiscalQuarterName: string;
  totalEmployeesMonitored: number;
  totalCoachingAssignments: number;
  criticalCount: number;
  moderateCount: number;
  totalTargetSessions: number;
  totalCompletedSessions: number;
  overallCompletionRate: number;
  attentionRequiredCount: number;
  districts: DistrictAnalytics[];
}

export interface ReportingFilterOptions {
  districts: string[];
  branchesByDistrict: Record<string, string[]>;
  performanceBands: string[];
  coachingLifecycles: string[];
  sessionProgressStatuses: string[];
}

export interface SessionTurnEvidence {
  turnId: number;
  turnIndex: number;
  speakerName: string;
  speakerRole: string;
  startTimeOffsetSec: number | null;
  durationSec: number | null;
  transcriptEnglish: string | null;
  transcriptAmharic: string | null;
  reconciledText: string | null;
}

export interface SessionInspectionEvidence {
  sessionId: number;
  assignmentId: number;
  sessionTitle: string;
  meetingMode: string;
  sessionStatus: string;
  conductedAt: string | null;
  durationMinutes: number;
  coachEmployeeId: number | null;
  coachName: string;
  coachRole: string;
  coacheeEmployeeId: number | null;
  coacheeName: string;
  coacheeStaffId: string;
  districtName: string;
  branchName: string;
  attendanceStatus: string;
  coachAssessment: string;
  coacheeProgressNotes: string | null;
  coacheeFeedbackRating: number | null;
  coacheeFeedbackComment: string | null;
  minutesSynthesisStatus: string;
  aiSessionNotesMinutes: string | null;
  aiActionItems: string | null;
  aiKeyTopics: string[];
  speechTurns: SessionTurnEvidence[];
}

export const pmsReportApi = {
  getSummary: async (quarterId?: number): Promise<PmsReportSummary> => {
    const params = quarterId ? { quarterId } : {};
    const res = await apiClient.get<PmsReportSummary>('/coaching/reports/summary', { params });
    return res.data;
  },

  getHierarchicalAnalytics: async (quarterId?: number): Promise<DistrictBranchAnalytics> => {
    const params = quarterId ? { quarterId } : {};
    const res = await apiClient.get<DistrictBranchAnalytics>('/coaching/reports/hierarchical-analytics', { params });
    return res.data;
  },

  getFilterOptions: async (quarterId?: number): Promise<ReportingFilterOptions> => {
    const params = quarterId ? { quarterId } : {};
    const res = await apiClient.get<ReportingFilterOptions>('/coaching/reports/filter-options', { params });
    return res.data;
  },

  getTalents: async (params?: {
    quarterId?: number;
    directorate?: string;
    district?: string;
    branch?: string;
    performanceBand?: string;
    sessionProgress?: string;
    kpiType?: string;
    status?: string;
    attentionOnly?: boolean;
    search?: string;
  }): Promise<PmsTalentProgressItem[]> => {
    const res = await apiClient.get<PmsTalentProgressItem[]>('/coaching/reports/talents', { params });
    return res.data;
  },

  getCohort: async (params?: {
    quarterId?: number;
    kpiType?: string;
    district?: string;
    branch?: string;
    performanceBand?: string;
  }): Promise<PmsTalentProgressItem[]> => {
    const res = await apiClient.get<PmsTalentProgressItem[]>('/coaching/reports/cohort', { params });
    return res.data;
  },

  getTalentDossier: async (assignmentId: number): Promise<PmsTalentDossier> => {
    const res = await apiClient.get<PmsTalentDossier>(`/coaching/reports/talents/${assignmentId}/dossier`);
    return res.data;
  },

  getSessionEvidence: async (sessionId: number): Promise<SessionInspectionEvidence> => {
    const res = await apiClient.get<SessionInspectionEvidence>(`/coaching/reports/sessions/${sessionId}/evidence`);
    return res.data;
  },

  downloadCsv: async (params?: {
    quarterId?: number;
    directorate?: string;
    status?: string;
    attentionOnly?: boolean;
  }): Promise<void> => {
    const res = await apiClient.get('/coaching/reports/export', {
      params,
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'boa-pms-coaching-performance-report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  downloadDossierPdf: async (assignmentId: number, coacheeStaffId?: string): Promise<void> => {
    const res = await apiClient.get('/coaching/pms/export/dossier/pdf', {
      params: { assignmentId },
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileId = coacheeStaffId ? coacheeStaffId.replace(/[^a-zA-Z0-9_-]/g, '_') : assignmentId;
    link.setAttribute('download', `Bank_of_Abyssinia_Talent_Dossier_${fileId}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  downloadDistrictExcel: async (quarterId: number = 2, district?: string): Promise<void> => {
    const params: Record<string, any> = { quarterId };
    if (district && district !== 'ALL') {
      params.district = district;
    }
    const res = await apiClient.get('/coaching/pms/export/district/excel', {
      params,
      responseType: 'blob',
    });
    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const distClean = district && district !== 'ALL' ? district.replace(/[^a-zA-Z0-9_-]/g, '_') : 'National_BankWide';
    link.setAttribute('download', `Bank_of_Abyssinia_PMS_Scorecard_${distClean}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

