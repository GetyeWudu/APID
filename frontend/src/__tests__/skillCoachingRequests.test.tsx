import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RequestSkillCoachingModal } from '../features/coaching/components/RequestSkillCoachingModal';
import { SkillDevApprovalTab } from '../features/coaching/components/SkillDevApprovalTab';
import { skillCoachingRequestApi } from '../features/coaching/api/skillCoachingRequestApi';
import { organizationApi } from '../features/admin/organization/api/organizationApi';
import type { EmployeeItem } from '../features/admin/organization/types/organization.types';

vi.mock('../features/coaching/api/skillCoachingRequestApi', () => ({
  skillCoachingRequestApi: {
    createRequest: vi.fn(),
    getMyRequests: vi.fn(),
    getPendingRequests: vi.fn(),
    getAllRequests: vi.fn(),
    approveRequest: vi.fn(),
    rejectRequest: vi.fn(),
  },
}));

vi.mock('../features/admin/organization/api/organizationApi', () => ({
  organizationApi: {
    searchEmployees: vi.fn(),
  },
}));

vi.mock('../shared/components/ui', async () => {
  const actual = await vi.importActual('../shared/components/ui');
  return {
    ...actual,
    useToast: () => ({ pushToast: vi.fn() }),
    PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

describe('Phase 5.3: Skill-Development Coaching Requests & Approvals', () => {
  let queryClient: QueryClient;

  const mockCurrentEmployee: EmployeeItem = {
    id: 101,
    employeeNumber: 'BOA-MGR-01',
    fullName: 'Solomon Bekele',
    email: 'solomon@abyssinianbank.com',
    gender: 'MALE',
    job: 'Branch Operations Manager',
    position: 'Branch Operations Manager',
    employmentStatus: 'ACTIVE',
    departmentId: 1,
    departmentName: 'Retail & Branch Banking',
    parentDepartmentName: null,
    managerId: null,
    managerEmployeeNumber: null,
    managerFullName: null,
    userId: 101,
    username: 'solomon',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const mockDirectReports = [
    {
      id: 201,
      employeeNumber: 'BOA-9014',
      fullName: 'Binyam Tadesse',
      departmentName: 'Retail Banking',
      jobTitle: 'Senior Teller',
    },
    {
      id: 202,
      employeeNumber: 'BOA-9022',
      fullName: 'Kalkidan Alemu',
      departmentName: 'Retail Banking',
      jobTitle: 'Customer Service Officer',
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
    vi.mocked(organizationApi.searchEmployees).mockResolvedValue({
      content: [mockCurrentEmployee],
      number: 0,
      size: 15,
      totalElements: 1,
      totalPages: 1,
    });
  });

  it('RequestSkillCoachingModal validates selection and submits multi-employee request', async () => {
    vi.mocked(skillCoachingRequestApi.createRequest).mockResolvedValue({
      id: 1,
      requesterEmployeeId: 101,
      requesterFullName: 'Solomon Bekele',
      requesterEmployeeNumber: 'BOA-MGR-01',
      requesterDepartment: 'Retail Banking',
      proposedCoachEmployeeId: 101,
      proposedCoachFullName: 'Solomon Bekele',
      proposedCoachEmployeeNumber: 'BOA-MGR-01',
      coachingFiscalQuarterId: 2,
      coachingQuarterLabel: 'FY26/27 Q2',
      skillTitle: 'Letter of Credit Verification',
      businessJustification: 'Critical operational improvement needed',
      status: 'PENDING_PMS_APPROVAL',
      reviewedByUserId: null,
      reviewedByUsername: null,
      reviewNotes: null,
      reviewedAt: null,
      createdAt: '2026-11-13T10:00:00Z',
      targets: [
        {
          id: 1,
          employeeId: 201,
          employeeFullName: 'Binyam Tadesse',
          employeeNumber: 'BOA-9014',
          department: 'Retail Banking',
          position: 'Senior Teller',
          createdAssignmentId: null,
        },
      ],
    });

    const onClose = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <RequestSkillCoachingModal
          isOpen={true}
          onClose={onClose}
          directReports={mockDirectReports}
          currentEmployee={mockCurrentEmployee}
          activeQuarterId={2}
          activeQuarterLabel="FY26/27 Q2"
        />
      </QueryClientProvider>
    );

    // Initial modal render check
    expect(screen.getByText(/Request Skill-Development Coaching/i)).toBeInTheDocument();
    expect(screen.getByText('Binyam Tadesse')).toBeInTheDocument();
    expect(screen.getByText('Kalkidan Alemu')).toBeInTheDocument();

    // Select Binyam Tadesse
    const binyamCheckbox = screen.getByLabelText(/Binyam Tadesse/i);
    fireEvent.click(binyamCheckbox);

    // Fill form
    const titleInput = screen.getByPlaceholderText(/e\.g\. Trade Finance Compliance/i);
    fireEvent.change(titleInput, { target: { value: 'Letter of Credit Verification' } });

    const justificationInput = screen.getByPlaceholderText(/Explain the capability gap/i);
    fireEvent.change(justificationInput, { target: { value: 'Critical operational improvement needed' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Submit Request/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(skillCoachingRequestApi.createRequest).toHaveBeenCalledWith({
        targetEmployeeIds: [201],
        proposedCoachEmployeeId: 101,
        coachingFiscalQuarterId: 2,
        skillTitle: 'Letter of Credit Verification',
        businessJustification: 'Critical operational improvement needed',
      });
    });
  });

  it('SkillDevApprovalTab renders pending requests and handles PMS Admin Approval with coach assignment', async () => {
    const mockPendingReq = {
      id: 42,
      requesterEmployeeId: 101,
      requesterFullName: 'Solomon Bekele',
      requesterEmployeeNumber: 'BOA-MGR-01',
      requesterDepartment: 'Retail Banking',
      proposedCoachEmployeeId: 101,
      proposedCoachFullName: 'Solomon Bekele',
      proposedCoachEmployeeNumber: 'BOA-MGR-01',
      coachingFiscalQuarterId: 2,
      coachingQuarterLabel: 'FY26/27 Q2',
      skillTitle: 'Trade Finance Compliance',
      businessJustification: 'Targeting audit compliance deficiencies',
      status: 'PENDING_PMS_APPROVAL' as const,
      reviewedByUserId: null,
      reviewedByUsername: null,
      reviewNotes: null,
      reviewedAt: null,
      createdAt: '2026-11-13T10:00:00Z',
      targets: [
        {
          id: 10,
          employeeId: 201,
          employeeFullName: 'Binyam Tadesse',
          employeeNumber: 'BOA-9014',
          department: 'Retail Banking',
          position: 'Senior Teller',
          createdAssignmentId: null,
        },
        {
          id: 11,
          employeeId: 202,
          employeeFullName: 'Kalkidan Alemu',
          employeeNumber: 'BOA-9022',
          department: 'Retail Banking',
          position: 'CSO',
          createdAssignmentId: null,
        },
      ],
    };

    vi.mocked(skillCoachingRequestApi.getPendingRequests).mockResolvedValue([mockPendingReq]);
    vi.mocked(skillCoachingRequestApi.getAllRequests).mockResolvedValue([mockPendingReq]);

    vi.mocked(organizationApi.searchEmployees).mockResolvedValue({
      content: [mockCurrentEmployee],
      number: 0,
      size: 15,
      totalElements: 1,
      totalPages: 1,
    });

    vi.mocked(skillCoachingRequestApi.approveRequest).mockResolvedValue({
      id: 42,
      requesterEmployeeId: 101,
      requesterFullName: 'Solomon Bekele',
      requesterEmployeeNumber: 'BOA-MGR-01',
      requesterDepartment: 'Retail Banking',
      proposedCoachEmployeeId: 101,
      proposedCoachFullName: 'Solomon Bekele',
      proposedCoachEmployeeNumber: 'BOA-MGR-01',
      coachingFiscalQuarterId: 2,
      coachingQuarterLabel: 'FY26/27 Q2',
      skillTitle: 'Trade Finance Compliance',
      businessJustification: 'Targeting audit compliance deficiencies',
      status: 'APPROVED',
      reviewedByUserId: 1,
      reviewedByUsername: 'admin',
      reviewNotes: 'Approved by PMS Admin',
      reviewedAt: '2026-11-13T10:30:00Z',
      createdAt: '2026-11-13T10:00:00Z',
      targets: [],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SkillDevApprovalTab />
      </QueryClientProvider>
    );

    // Verify row rendered
    await waitFor(() => {
      expect(screen.getByText('REQ-42')).toBeInTheDocument();
      expect(screen.getAllByText('Solomon Bekele').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Trade Finance Compliance/i)).toBeInTheDocument();
      expect(screen.getByText(/2 Employees:/i)).toBeInTheDocument();
    });

    // Click Approve
    const approveBtn = screen.getByRole('button', { name: /^Approve$/i });
    fireEvent.click(approveBtn);

    // Verify modal appeared
    expect(screen.getByText(/Approve Skill Coaching Request · REQ-42/i)).toBeInTheDocument();

    // Confirm approval
    const confirmBtn = screen.getByRole('button', { name: /Confirm & Auto-Assign/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(skillCoachingRequestApi.approveRequest).toHaveBeenCalledWith(42, {
        overrideCoachEmployeeId: undefined,
        reviewNotes: undefined,
      });
    });
  });

  it('SkillDevApprovalTab enforces mandatory rejection reason', async () => {
    const mockRejectedReq = {
      id: 43,
      requesterEmployeeId: 101,
      requesterFullName: 'Solomon Bekele',
      requesterEmployeeNumber: 'BOA-MGR-01',
      requesterDepartment: 'Retail Banking',
      proposedCoachEmployeeId: 101,
      proposedCoachFullName: 'Solomon Bekele',
      proposedCoachEmployeeNumber: 'BOA-MGR-01',
      coachingFiscalQuarterId: 2,
      coachingQuarterLabel: 'FY26/27 Q2',
      skillTitle: 'Core Banking Resilience',
      businessJustification: 'Staff needs training',
      status: 'PENDING_PMS_APPROVAL' as const,
      reviewedByUserId: null,
      reviewedByUsername: null,
      reviewNotes: null,
      reviewedAt: null,
      createdAt: '2026-11-13T10:00:00Z',
      targets: [],
    };

    vi.mocked(skillCoachingRequestApi.getPendingRequests).mockResolvedValue([mockRejectedReq]);
    vi.mocked(skillCoachingRequestApi.getAllRequests).mockResolvedValue([mockRejectedReq]);

    render(
      <QueryClientProvider client={queryClient}>
        <SkillDevApprovalTab />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('REQ-43')).toBeInTheDocument();
    });

    const rejectBtn = screen.getByRole('button', { name: /^Reject$/i });
    fireEvent.click(rejectBtn);

    expect(screen.getByText(/Reject Skill Coaching Request · REQ-43/i)).toBeInTheDocument();

    // Attempt to submit rejection without entering a reason
    const confirmRejectBtn = screen.getByRole('button', { name: /Confirm Rejection/i });
    fireEvent.click(confirmRejectBtn);

    // Ensure rejection API was NOT called without reason
    expect(skillCoachingRequestApi.rejectRequest).not.toHaveBeenCalled();

    // Now fill mandatory reason
    const reasonTextarea = screen.getByPlaceholderText(/Provide mandatory feedback/i);
    fireEvent.change(reasonTextarea, {
      target: { value: 'Deferred until next fiscal cycle due to department training budget.' },
    });

    fireEvent.click(confirmRejectBtn);

    await waitFor(() => {
      expect(skillCoachingRequestApi.rejectRequest).toHaveBeenCalledWith(43, {
        reviewNotes: 'Deferred until next fiscal cycle due to department training budget.',
      });
    });
  });
});
