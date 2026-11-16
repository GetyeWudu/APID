import { apiClient } from '../../../shared/api/apiClient';

export type AssignmentStatus =
  | 'PENDING_COACH_ASSIGNMENT'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'CLOSED';

export type AssignmentClosureReason =
  | 'CLEARED_BY_PMS'
  | 'CONTINUED_NEXT_QUARTER'
  | 'SUCCESSFULLY_COMPLETED'
  | 'ADMINISTRATIVE_CLOSURE';

export type AssignmentPathway = 'MANDATORY_PMS' | 'SELF_DEVELOPMENT';

export interface CoachingAssignmentItem {
  id: number;
  pathway: AssignmentPathway;
  coacheeEmployeeId: number;
  coacheeFullName: string;
  coacheeEmployeeNumber: string;
  coacheeDepartment: string | null;
  coachEmployeeId: number | null;
  coachFullName: string | null;
  coachEmployeeNumber: string | null;
  coachDepartment: string | null;
  status: AssignmentStatus;
  closureReason: AssignmentClosureReason | null;
  atRisk: boolean;
  performanceQuarterLabel: string | null;
  coachingQuarterLabel: string | null;
  overallFinalRating: number | null;
  roundedOverallFinalRating: number | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoachingParticipantItem {
  id: number;
  employeeId: number;
  employeeFullName: string;
  employeeNumber: string;
  role: 'COACH' | 'COACHEE';
  active: boolean;
  joinedAt: string;
  leftAt: string | null;
}

export interface CoachReplacementHistoryItem {
  id: number;
  fromCoachEmployeeId: number;
  fromCoachFullName: string;
  toCoachEmployeeId: number;
  toCoachFullName: string;
  reason: string;
  changedByUserId: number;
  changedByUsername: string | null;
  changedAt: string;
}

export interface PmsGoalLineItem {
  id?: number;
  sourceRowNumber: number;
  goalName: string;
  goalTrackingName: string | null;
  targetValue: string | null;
  actualValue: string | null;
  goalScore: number | null;
  weight: number | null;
  lineScore: number | null;
}

export interface CoachingAssignmentDetail {
  assignment: CoachingAssignmentItem;
  participants: CoachingParticipantItem[];
  replacementHistory: CoachReplacementHistoryItem[];
  triggeringGoals: PmsGoalLineItem[];
}

export interface AssignCoachPayload {
  coachEmployeeId: number;
  note?: string;
}

export interface ReplaceCoachPayload {
  newCoachEmployeeId: number;
  reason: string;
}

export interface CloseAssignmentPayload {
  closureReason: AssignmentClosureReason;
  notes?: string;
}

export interface MyCoachingPlan {
  assignmentId: number;
  pathway: AssignmentPathway;
  status: AssignmentStatus;
  atRisk: boolean;
  coachEmployeeId: number | null;
  coachFullName: string | null;
  coachJobTitle: string | null;
  coachDepartment: string | null;
  coachingQuarterLabel: string | null;
  performanceQuarterLabel: string | null;
  triggeringRating: number | null;
  triggeringRoundedRating: number | null;
  triggeringGoals: PmsGoalLineItem[];
  createdAt: string;
}

export interface MyCoacheeItem {
  assignmentId: number;
  coacheeEmployeeId: number;
  coacheeFullName: string;
  coacheeEmployeeNumber: string;
  coacheeDepartment: string | null;
  coacheeJobTitle: string | null;
  pathway?: AssignmentPathway;
  status: AssignmentStatus;
  atRisk: boolean;
  coachingQuarterLabel: string | null;
  performanceQuarterLabel: string | null;
  createdAt: string;
}

export interface MyCoachingWorkspace {
  employeeId: number;
  fullName: string;
  employeeNumber: string;
  activePlans: MyCoachingPlan[];
  assignedCoachees: MyCoacheeItem[];
}

export interface EmployeePerformanceGoals {
  employeeId: number;
  employeeNumber: string;
  fullName: string;
  departmentName: string | null;
  position: string | null;
  pmsYear: string | null;
  pmsQuarter: number | null;
  coachingQuarterLabel: string | null;
  overallFinalRating: number | null;
  roundedOverallFinalRating: number | null;
  mandatoryCoachingTriggered: boolean;
  goalLines: PmsGoalLineItem[];
}

export interface AssignmentListFilters {
  status?: AssignmentStatus | '';
  closureReason?: AssignmentClosureReason | '';
  atRisk?: boolean;
  coachingQuarterId?: number;
  search?: string;
  page?: number;
  size?: number;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  pageNumber: number;
  pageSize: number;
  first: boolean;
  last: boolean;
}

interface ApiResponse<T> {
  data: T;
  message?: string;
}

export const coachingAssignmentApi = {
  async listAssignments(filters: AssignmentListFilters): Promise<PageResponse<CoachingAssignmentItem>> {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.closureReason) params.set('closureReason', filters.closureReason);
    if (typeof filters.atRisk === 'boolean') params.set('atRisk', String(filters.atRisk));
    if (filters.coachingQuarterId) params.set('coachingQuarterId', String(filters.coachingQuarterId));
    if (filters.search) params.set('search', filters.search);
    if (typeof filters.page === 'number') params.set('page', String(filters.page));
    if (typeof filters.size === 'number') params.set('size', String(filters.size));

    const res = await apiClient.get<ApiResponse<PageResponse<CoachingAssignmentItem>>>(
      `/coaching/assignments?${params.toString()}`
    );
    return res.data.data;
  },

  async getAssignmentDetail(id: number): Promise<CoachingAssignmentDetail> {
    const res = await apiClient.get<ApiResponse<CoachingAssignmentDetail>>(
      `/coaching/assignments/${id}`
    );
    return res.data.data;
  },

  async assignCoach(id: number, payload: AssignCoachPayload): Promise<CoachingAssignmentDetail> {
    const res = await apiClient.post<ApiResponse<CoachingAssignmentDetail>>(
      `/coaching/assignments/${id}/assign-coach`,
      payload
    );
    return res.data.data;
  },

  async replaceCoach(id: number, payload: ReplaceCoachPayload): Promise<CoachingAssignmentDetail> {
    const res = await apiClient.post<ApiResponse<CoachingAssignmentDetail>>(
      `/coaching/assignments/${id}/replace-coach`,
      payload
    );
    return res.data.data;
  },

  async closeAssignment(id: number, payload: CloseAssignmentPayload): Promise<CoachingAssignmentDetail> {
    const res = await apiClient.post<ApiResponse<CoachingAssignmentDetail>>(
      `/coaching/assignments/${id}/close`,
      payload
    );
    return res.data.data;
  },

  async getMyCoaching(): Promise<MyCoachingWorkspace> {
    const res = await apiClient.get<ApiResponse<MyCoachingWorkspace>>('/coaching/my-coaching');
    return res.data.data;
  },

  async getMyCoachees(): Promise<MyCoacheeItem[]> {
    const res = await apiClient.get<ApiResponse<MyCoacheeItem[]>>('/coaching/my-coachees');
    return res.data.data;
  },

  async getEmployeePerformanceGoals(employeeId: number): Promise<EmployeePerformanceGoals> {
    const res = await apiClient.get<ApiResponse<EmployeePerformanceGoals>>(
      `/coaching/employees/${employeeId}/performance-goals`
    );
    return res.data.data;
  },
};
