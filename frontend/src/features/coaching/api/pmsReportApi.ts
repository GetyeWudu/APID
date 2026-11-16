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

export const pmsReportApi = {
  getSummary: async (quarterId?: number): Promise<PmsReportSummary> => {
    const params = quarterId ? { quarterId } : {};
    const res = await apiClient.get<PmsReportSummary>('/coaching/reports/summary', { params });
    return res.data;
  },

  getTalents: async (params?: {
    quarterId?: number;
    directorate?: string;
    status?: string;
    attentionOnly?: boolean;
    search?: string;
  }): Promise<PmsTalentProgressItem[]> => {
    const res = await apiClient.get<PmsTalentProgressItem[]>('/coaching/reports/talents', { params });
    return res.data;
  },

  getTalentDossier: async (assignmentId: number): Promise<PmsTalentDossier> => {
    const res = await apiClient.get<PmsTalentDossier>(`/coaching/reports/talents/${assignmentId}/dossier`);
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
};

