import { apiClient, type ApiResponse } from '../../../../shared/api/apiClient';
import type {
  CreateDepartmentPayload,
  CreateEmployeePayload,
  DepartmentItem,
  EmployeeItem,
  EmployeePage,
  EmploymentStatus,
  OrgImportBatchPreview,
  OrgImportCommitResult,
  OrgImportRowStatus,
  UpdateDepartmentPayload,
  UpdateEmployeePayload,
  CreateEmployeeUserPayload,
  CreateEmployeeUserResult,
} from '../types/organization.types';

export const organizationApi = {
  async listDepartments(activeOnly = false): Promise<DepartmentItem[]> {
    const res = await apiClient.get<ApiResponse<DepartmentItem[]>>('/core/departments', {
      params: { activeOnly },
    });
    return res.data.data;
  },

  async createDepartment(payload: CreateDepartmentPayload): Promise<DepartmentItem> {
    const res = await apiClient.post<ApiResponse<DepartmentItem>>('/core/admin/departments', payload);
    return res.data.data;
  },

  async updateDepartment(id: number, payload: UpdateDepartmentPayload): Promise<DepartmentItem> {
    const res = await apiClient.put<ApiResponse<DepartmentItem>>(`/core/admin/departments/${id}`, payload);
    return res.data.data;
  },

  async searchEmployees(params: {
    search?: string;
    departmentId?: number | '';
    status?: EmploymentStatus | '';
    managerId?: number | '';
    page?: number;
    size?: number;
  }): Promise<EmployeePage> {
    const res = await apiClient.get<ApiResponse<EmployeePage>>('/core/employees', {
      params: {
        search: params.search || undefined,
        departmentId: params.departmentId === '' ? undefined : params.departmentId,
        status: params.status || undefined,
        managerId: params.managerId === '' ? undefined : params.managerId,
        page: params.page ?? 0,
        size: params.size ?? 15,
      },
    });
    return res.data.data;
  },

  async getDirectManager(employeeId: number): Promise<EmployeeItem | null> {
    const res = await apiClient.get<ApiResponse<EmployeeItem | null>>(`/core/employees/${employeeId}/manager`);
    return res.data.data;
  },

  async getDirectReports(employeeId: number): Promise<EmployeeItem[]> {
    const res = await apiClient.get<ApiResponse<EmployeeItem[]>>(`/core/employees/${employeeId}/direct-reports`);
    return res.data.data;
  },

  async createEmployee(payload: CreateEmployeePayload): Promise<EmployeeItem> {
    const res = await apiClient.post<ApiResponse<EmployeeItem>>('/core/admin/employees', payload);
    return res.data.data;
  },

  async updateEmployee(id: number, payload: UpdateEmployeePayload): Promise<EmployeeItem> {
    const res = await apiClient.put<ApiResponse<EmployeeItem>>(`/core/admin/employees/${id}`, payload);
    return res.data.data;
  },

  async createAndLinkEmployeeUser(
    employeeId: number,
    payload: CreateEmployeeUserPayload
  ): Promise<CreateEmployeeUserResult> {
    const res = await apiClient.post<ApiResponse<CreateEmployeeUserResult>>(
      `/core/admin/employees/${employeeId}/create-and-link-user`,
      payload
    );
    return res.data.data;
  },

  async revokeEmployeeUserLink(employeeId: number): Promise<EmployeeItem> {
    const res = await apiClient.delete<ApiResponse<EmployeeItem>>(
      `/core/admin/employees/${employeeId}/revoke-user-link`
    );
    return res.data.data;
  },

  async previewImport(file: File, page = 0, size = 20): Promise<OrgImportBatchPreview> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<ApiResponse<OrgImportBatchPreview>>(
      '/core/admin/employees/import/preview',
      formData,
      {
        params: { page, size },
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return res.data.data;
  },

  async getImportBatch(
    batchId: number,
    page = 0,
    size = 20,
    rowStatus?: OrgImportRowStatus | ''
  ): Promise<OrgImportBatchPreview> {
    const res = await apiClient.get<ApiResponse<OrgImportBatchPreview>>(
      `/core/admin/employees/import/batches/${batchId}`,
      {
        params: {
          page,
          size,
          rowStatus: rowStatus || undefined,
        },
      }
    );
    return res.data.data;
  },

  async commitImportBatch(batchId: number): Promise<OrgImportCommitResult> {
    const res = await apiClient.post<ApiResponse<OrgImportCommitResult>>(
      `/core/admin/employees/import/batches/${batchId}/commit`
    );
    return res.data.data;
  },

  async cancelImportBatch(batchId: number): Promise<void> {
    await apiClient.delete(`/core/admin/employees/import/batches/${batchId}`);
  },
};
