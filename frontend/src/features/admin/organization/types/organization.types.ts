import type { PageResponse, UserStatus } from '../../users/types/users.types';

export type EmploymentStatus = 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE' | 'TERMINATED';
export type OrgImportBatchStatus = 'PREVIEWED' | 'COMMITTED' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
export type OrgImportRowStatus = 'VALID' | 'WARNING' | 'ERROR';
export type OrgImportPlannedAction = 'CREATE' | 'UPDATE' | 'ERROR';

export interface DepartmentItem {
  id: number;
  code: string | null;
  name: string;
  parentDepartmentId: number | null;
  parentDepartmentName: string | null;
  headEmployeeId: number | null;
  headEmployeeName: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentPayload {
  code?: string;
  name: string;
  parentDepartmentId?: number | null;
  headEmployeeId?: number | null;
}

export interface UpdateDepartmentPayload extends CreateDepartmentPayload {
  active: boolean;
}

export interface EmployeeItem {
  id: number;
  userId: number | null;
  username: string | null;
  employeeNumber: string;
  fullName: string;
  email: string | null;
  gender: string | null;
  departmentId: number | null;
  departmentName: string | null;
  parentDepartmentName: string | null;
  job: string | null;
  position: string | null;
  managerId: number | null;
  managerEmployeeNumber: string | null;
  managerFullName: string | null;
  employmentStatus: EmploymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeePayload {
  userId?: number | null;
  employeeNumber: string;
  fullName: string;
  email?: string;
  gender?: string;
  departmentId?: number | null;
  job?: string;
  position?: string;
  managerId?: number | null;
  employmentStatus?: EmploymentStatus;
}

export interface UpdateEmployeePayload extends CreateEmployeePayload {
  employmentStatus: EmploymentStatus;
}

export interface OrgImportRowItem {
  id: number;
  rowNumber: number;
  employeeNumber: string | null;
  fullName: string | null;
  email: string | null;
  gender: string | null;
  parentDepartment: string | null;
  department: string | null;
  departmentCode: string | null;
  job: string | null;
  position: string | null;
  managerEmployeeNumber: string | null;
  employmentStatus: string | null;
  sourceRowNumbers: number[];
  plannedAction: OrgImportPlannedAction;
  rowStatus: OrgImportRowStatus;
  errors: string[];
  warnings: string[];
}

export interface OrgImportBatchPreview {
  batchId: number;
  fileName: string;
  fileFormat: 'CSV' | 'XLSX';
  detectedSchema: 'HIERARCHY_STANDARD' | 'PMS_APPRAISAL_EXTRACT';
  status: OrgImportBatchStatus;
  expired: boolean;
  managerColumnDetected: boolean;
  columnPresence: Record<string, boolean>;
  totalSourceRows: number;
  uniqueEmployees: number;
  duplicateRowsCollapsed: number;
  employeesToCreate: number;
  employeesToUpdate: number;
  departmentsToCreate: number;
  managersToLink: number;
  errorRows: number;
  warningRows: number;
  employeesCreated: number;
  employeesUpdated: number;
  departmentsCreated: number;
  managersLinked: number;
  summaryWarnings: string[];
  createdAt: string;
  expiresAt: string;
  committedAt: string | null;
  rows: PageResponse<OrgImportRowItem>;
}

export interface OrgImportCommitResult {
  batchId: number;
  status: OrgImportBatchStatus;
  fileFormat: 'CSV' | 'XLSX';
  detectedSchema: 'HIERARCHY_STANDARD' | 'PMS_APPRAISAL_EXTRACT';
  managerColumnDetected: boolean;
  totalSourceRows: number;
  uniqueEmployees: number;
  duplicateRowsCollapsed: number;
  employeesCreated: number;
  employeesUpdated: number;
  departmentsCreated: number;
  managersLinked: number;
  summaryWarnings: string[];
  committedAt: string;
}

export interface UserAccountSummary {
  id: number;
  username: string;
  status: UserStatus;
}

export type EmployeePage = PageResponse<EmployeeItem>;
