import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScheduleSessionModal } from '../features/coaching/components/ScheduleSessionModal';
import { EditSessionModal } from '../features/coaching/components/EditSessionModal';
import * as AuthContextModule from '../app/AuthContext';
import { MyCoacheeItem } from '../features/coaching/api/coachingAssignmentApi';

describe('Phase 2: Preparation Materials, Rescheduling & AI Controls', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const mockCoachees: MyCoacheeItem[] = [
    {
      assignmentId: 1,
      coacheeEmployeeId: 4,
      coacheeEmployeeNumber: '00010005',
      coacheeFullName: 'Lidia Girma',
      coacheeDepartment: 'Bole Branch Operations',
      coacheeJobTitle: 'Senior Customer Service Officer',
      appraisalRating: 1.85,
      atRisk: true,
      pathway: 'MANDATORY_PMS',
      status: 'ACTIVE',
      coachingQuarterLabel: '2026/27 Q2',
      performanceQuarterLabel: '2026/27 Q1',
      createdAt: '2026-11-01T00:00:00Z',
      completedSessions: 0,
      requiredTarget: 8,
    },
  ];

  it('renders Pre-Session Preparation & References and AI automation switches in ScheduleSessionModal', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 3, username: 'mekdes.alemu.004', roles: ['Employee'], permissions: [], mustChangePassword: false },
      loading: false,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      refreshProfile: vi.fn(),
      hasPermission: () => true,
      hasAnyPermission: () => true,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ScheduleSessionModal
          isOpen={true}
          onClose={vi.fn()}
          myCoachees={mockCoachees}
          mode="MANDATORY_PMS"
        />
      </QueryClientProvider>
    );

    // Verify Pre-Session Preparation section
    expect(screen.getByText(/Pre-Session Preparation & References/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Please review the branch FX compliance checklists/i)).toBeInTheDocument();

    // Verify AI Automation Controls
    expect(screen.getByText(/Session AI Automation Controls/i)).toBeInTheDocument();
    expect(screen.getByText(/Enable Local AI Auto-Summarization/i)).toBeInTheDocument();
    expect(screen.getByText(/Allow LiveKit AI Active Participant Agent/i)).toBeInTheDocument();

    // Click Add Material / URL button
    const addMatBtn = screen.getByText(/Add Material \/ URL/i);
    fireEvent.click(addMatBtn);

    // Verify Reference URL, Book, and Document toggle buttons exist
    expect(screen.getByText(/Reference URL/i)).toBeInTheDocument();
    expect(screen.getByText(/Reference Book \/ Reading/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload Document \/ File/i)).toBeInTheDocument();
  });

  it('renders all editing options (prep notes, materials, AI controls) in EditSessionModal', async () => {
    const mockSession: any = {
      id: 115,
      assignmentId: 1,
      skillRequestId: null,
      coachEmployeeId: 3,
      coachEmployeeNumber: '00010004',
      coachFullName: 'Mekdes Alemu',
      coachJobTitle: 'Branch Manager',
      coachDepartment: 'Bole Branch Operations',
      title: 'PMS Joint Coaching: Rahel Tsegaye, Azeb Fekadu',
      pathway: 'MANDATORY_PMS',
      scheduledStartTime: '2026-11-20T06:30:00Z',
      scheduledEndTime: '2026-11-20T07:15:00Z',
      durationMinutes: 45,
      meetingMode: 'ONLINE',
      meetingLocation: '',
      targetPmsGoalId: null,
      targetPmsGoalName: null,
      status: 'CONFIRMED',
      sequenceNumber: 1,
      rescheduleCount: 0,
      prepNotes: 'Review FX guidelines before meeting',
      referenceMaterials: [
        { type: 'BOOK', title: 'Commercial Banking Operations', notes: 'Chapter 4' },
        { type: 'DOCUMENT', title: 'Evaluation Report.pdf', url: '/api/v1/core/files/10/download', notes: '170 KB • PDF' }
      ],
      aiSummarizationEnabled: true,
      aiAgentEnabled: false,
      participants: [
        {
          id: 1,
          sessionId: 115,
          employeeId: 4,
          employeeNumber: '00010005',
          fullName: 'Lidia Girma',
          role: 'COACHEE',
          invitationStatus: 'PENDING',
          feedbackSubmittedAt: null,
          coacheeProgressSubmittedAt: null,
        } as any
      ],
      createdAt: '2026-11-20T05:00:00Z',
    };

    render(
      <QueryClientProvider client={queryClient}>
        <EditSessionModal
          session={mockSession}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      </QueryClientProvider>
    );

    // Verify Title & Pre-Session prep are populated
    expect(screen.getByDisplayValue(/PMS Joint Coaching: Rahel Tsegaye, Azeb Fekadu/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Review FX guidelines before meeting/i)).toBeInTheDocument();

    // Verify existing reference materials are rendered
    expect(screen.getByText('Commercial Banking Operations')).toBeInTheDocument();
    expect(screen.getByText('Evaluation Report.pdf')).toBeInTheDocument();

    // Verify AI controls
    expect(screen.getByText(/Session AI Automation Controls/i)).toBeInTheDocument();
    expect(screen.getByText(/Enable Local AI Auto-Summarization/i)).toBeInTheDocument();
    expect(screen.getByText(/Allow LiveKit AI Active Participant Agent/i)).toBeInTheDocument();
  });
});
