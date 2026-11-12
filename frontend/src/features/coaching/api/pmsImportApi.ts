import { apiClient } from '../../../shared/api/apiClient';

export interface PmsBatchSummary {
  id: number;
  fileName: string;
  fileSha256Short: string;
  performanceQuarterLabel: string | null;
  coachingQuarterLabel: string | null;
  pmsYear: string;
  pmsQuarter: number;
  status: 'PREVIEW' | 'COMMITTED' | 'EXPIRED' | 'CANCELLED' | 'FAILED';
  totalSourceRows: number;
  uniqueEmployeesCount: number;
  mandatoryBelow3Count: number;
  passingCount: number;
  errorRowsCount: number;
  warningRowsCount: number;
  expiresAt: string;
  committedAt: string | null;
  createdAt: string;
}

export interface PmsGoalLineItem {
  sourceRowNumber: number;
  goalName: string;
  goalTrackingName: string | null;
  targetValue: string | null;
  actualValue: string | null;
  goalScore: number | null;
  weight: number | null;
  lineScore: number | null;
}

export interface PmsConsolidatedEmployee {
  stagingId: number;
  employeeNumber: string;
  resolvedFullName: string | null;
  department: string | null;
  coachFullName: string | null;
  overallFinalRating: number | null;
  roundedOverallFinalRating: number;
  goalCount: number;
  evaluationStatus: string | null;
  validationStatus: 'VALID' | 'WARNING' | 'ERROR';
  plannedAction:
    | 'CREATE_ASSIGNMENT'
    | 'CONTINUE_ASSIGNMENT'
    | 'CLEAR_PRIOR_ASSIGNMENT'
    | 'PENDING_COACH'
    | 'NO_ACTION'
    | 'BLOCKED';
  hasCoacheePortalAccount: boolean;
  hasCoachPortalAccount: boolean;
  errors: string[] | null;
  warnings: string[] | null;
  goalLines: PmsGoalLineItem[];
}

export interface PmsBatchPreviewResponse {
  batch: PmsBatchSummary;
  employees: {
    content: PmsConsolidatedEmployee[];
    totalElements: number;
    totalPages: number;
    size: number;
    number: number;
  };
}

export interface PmsCommitResult {
  batchId: number;
  performanceRecordsCreated: number;
  assignmentsCreated: number;
  assignmentsContinued: number;
  assignmentsCleared: number;
  pendingCoachAssignments: number;
  message: string;
}

export interface FiscalQuarterOption {
  id: number;
  fiscalYear: string;
  quarter: number;
  label: string;
  active: boolean;
  locked: boolean;
}

export const pmsImportApi = {
  async listQuarters(): Promise<FiscalQuarterOption[]> {
    const res = await apiClient.get<{ success: boolean; data: FiscalQuarterOption[] }>('/core/fiscal-quarters');
    return res.data.data;
  },

  async uploadPreview(
    file: File,
    performanceFiscalQuarterId: number,
    coachingFiscalQuarterId: number
  ): Promise<PmsBatchPreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('performanceFiscalQuarterId', String(performanceFiscalQuarterId));
    formData.append('coachingFiscalQuarterId', String(coachingFiscalQuarterId));

    const res = await apiClient.post<{ success: boolean; data: PmsBatchPreviewResponse }>(
      '/coaching/pms-imports/preview',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return res.data.data;
  },

  async getPreview(
    batchId: number,
    page = 0,
    size = 20,
    filter = 'ALL'
  ): Promise<PmsBatchPreviewResponse> {
    const res = await apiClient.get<{ success: boolean; data: PmsBatchPreviewResponse }>(
      `/coaching/pms-imports/${batchId}/preview`,
      {
        params: { page, size, filter },
      }
    );
    return res.data.data;
  },

  async commitBatch(batchId: number): Promise<PmsCommitResult> {
    const res = await apiClient.post<{ success: boolean; data: PmsCommitResult }>(
      `/coaching/pms-imports/${batchId}/commit`
    );
    return res.data.data;
  },

  async cancelBatch(batchId: number): Promise<void> {
    await apiClient.delete(`/coaching/pms-imports/${batchId}`);
  },

  async getHistory(page = 0, size = 10): Promise<{ content: PmsBatchSummary[]; totalElements: number }> {
    const res = await apiClient.get<{ success: boolean; data: { content: PmsBatchSummary[]; totalElements: number } }>(
      '/coaching/pms-imports/history',
      { params: { page, size } }
    );
    return res.data.data;
  },
};

