import type { PreviewNotificationItem } from '../components/ui/NotificationBellPopover';

/**
 * Strictly synthetic preview fixtures for unimplemented Phase 4-11 modules.
 * Never blended with live PostgreSQL metrics and never triggers backend HTTP writes.
 */

export const PREVIEW_NOTIFICATIONS: PreviewNotificationItem[] = [
  {
    id: 'notif-pms-1',
    title: 'Q1 Multi-Goal Appraisal Batch Ready',
    body: 'Sample data: 12 employees consolidated from 36 goal rows; 4 have RoundedOverallFinalRating < 3.',
    timeAgo: '18m ago',
    module: 'COACHING',
    targetRoute: '/coaching/pms',
    read: false,
  },
  {
    id: 'notif-hr-1',
    title: 'Trainer Certificate Pending HR Review',
    body: 'Sample applicant BOA-9031 uploaded Financial Modeling credentials.',
    timeAgo: '1h ago',
    module: 'MENTORING',
    targetRoute: '/mentoring/hr',
    read: false,
  },
  {
    id: 'notif-ws-1',
    title: 'Upcoming Coaching Session Reminder',
    body: 'Coaching session "Branch SLA & Deposit Growth" starts tomorrow at 09:30 EAT.',
    timeAgo: '3h ago',
    module: 'COACHING',
    targetRoute: '/workspace',
    read: true,
  },
];

export const PREVIEW_SYSTEM_CONFIG = {
  activeFiscalYear: 'FY 2026/27',
  activeQuarter: 'Q1',
  quarterStartDate: '2026-07-01',
  quarterEndDate: '2026-09-30',
  mandatoryCutoffRounded: '3',
  missedSessionAlertThreshold: 2,
  inactivityReminderDays: 14,
  maxFileUploadMb: 25,
};

export interface PreviewPmsAssignment {
  id: string;
  employeeCode: string;
  employeeName: string;
  directorate: string;
  department: string;
  performanceQuarter: string;
  coachingQuarter: string;
  pathway: 'PERFORMANCE_MANDATORY' | 'SKILL_DEVELOPMENT';
  status: 'ACTIVE' | 'PENDING_COACH_ASSIGNMENT' | 'AT_RISK' | 'CLEARED';
  unroundedRating: number;
  roundedRating: number;
  coachName: string | null;
  sessionsCompleted: number;
  sessionsTotal: number;
  overdueReports: number;
  coachHistory: Array<{ date: string; fromCoach: string; toCoach: string; reason: string }>;
}

export interface PreviewSkillDevRequest {
  id: string;
  requesterManager: string;
  directorate: string;
  scope: 'INDIVIDUAL' | 'GROUP';
  participantCount: number;
  skillFocus: string;
  targetQuarter: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'RETURNED' | 'REJECTED';
  reviewReason?: string;
}

export const PREVIEW_PMS_ASSIGNMENTS: PreviewPmsAssignment[] = [
  {
    id: 'PA-101',
    employeeCode: 'BOA-9014',
    employeeName: 'Binyam Tadesse',
    directorate: 'Retail & Branch Banking',
    department: 'Bole Branch Operations',
    performanceQuarter: 'FY26/27 Q1',
    coachingQuarter: 'FY26/27 Q2',
    pathway: 'PERFORMANCE_MANDATORY',
    status: 'ACTIVE',
    unroundedRating: 2.2325,
    roundedRating: 2,
    coachName: 'Solomon Bekele',
    sessionsCompleted: 2,
    sessionsTotal: 4,
    overdueReports: 0,
    coachHistory: [
      {
        date: '2026-10-03',
        fromCoach: 'Unassigned',
        toCoach: 'Solomon Bekele',
        reason: 'Auto-assigned direct manager on Q1 appraisal upload',
      },
    ],
  },
  {
    id: 'PA-102',
    employeeCode: 'BOA-9022',
    employeeName: 'Kalkidan Alemu',
    directorate: 'Credit & Risk Management',
    department: 'Corporate Credit Appraisal',
    performanceQuarter: 'FY26/27 Q1',
    coachingQuarter: 'FY26/27 Q2',
    pathway: 'PERFORMANCE_MANDATORY',
    status: 'AT_RISK',
    unroundedRating: 2.233,
    roundedRating: 2,
    coachName: 'Mulugeta Haile',
    sessionsCompleted: 1,
    sessionsTotal: 4,
    overdueReports: 2,
    coachHistory: [],
  },
  {
    id: 'PA-103',
    employeeCode: 'BOA-9041',
    employeeName: 'Yonas Kebede',
    directorate: 'Operations & Treasury',
    department: 'Treasury & Liquidity Management',
    performanceQuarter: 'FY26/27 Q1',
    coachingQuarter: 'FY26/27 Q2',
    pathway: 'PERFORMANCE_MANDATORY',
    status: 'PENDING_COACH_ASSIGNMENT',
    unroundedRating: 2.48,
    roundedRating: 2,
    coachName: null,
    sessionsCompleted: 0,
    sessionsTotal: 4,
    overdueReports: 0,
    coachHistory: [],
  },
  {
    id: 'PA-104',
    employeeCode: 'BOA-9058',
    employeeName: 'Daniel Worku',
    directorate: 'Technology & Digital Banking',
    department: 'Application Development & API',
    performanceQuarter: 'FY26/27 Q1',
    coachingQuarter: 'FY26/27 Q2',
    pathway: 'SKILL_DEVELOPMENT',
    status: 'ACTIVE',
    unroundedRating: 3.38,
    roundedRating: 3,
    coachName: 'Elias Tesfaye',
    sessionsCompleted: 3,
    sessionsTotal: 4,
    overdueReports: 0,
    coachHistory: [],
  },
  {
    id: 'PA-105',
    employeeCode: 'BOA-9067',
    employeeName: 'Hanna Negash',
    directorate: 'Credit & Risk Management',
    department: 'Enterprise Risk & Compliance',
    performanceQuarter: 'FY26/27 Q1',
    coachingQuarter: 'FY26/27 Q2',
    pathway: 'SKILL_DEVELOPMENT',
    status: 'CLEARED',
    unroundedRating: 3.0,
    roundedRating: 3,
    coachName: 'Fasil Desta',
    sessionsCompleted: 4,
    sessionsTotal: 4,
    overdueReports: 0,
    coachHistory: [],
  },
  {
    id: 'PA-106',
    employeeCode: 'BOA-9079',
    employeeName: 'Frehiwot Girma',
    directorate: 'Retail & Branch Banking',
    department: 'Piassa Flagship Branch',
    performanceQuarter: 'FY26/27 Q1',
    coachingQuarter: 'FY26/27 Q2',
    pathway: 'PERFORMANCE_MANDATORY',
    status: 'AT_RISK',
    unroundedRating: 1.95,
    roundedRating: 2,
    coachName: 'Girma Assefa',
    sessionsCompleted: 0,
    sessionsTotal: 4,
    overdueReports: 1,
    coachHistory: [],
  },
];

export const PREVIEW_RATING_SERIES = [
  1.45, 1.95, 2.233, 2.48, 2.75, 2.9, 2.999, 3.0, 3.001, 3.15, 3.38, 3.65, 4.15, 4.55,
  2.1, 2.85, 2.95, 3.0, 3.12, 3.9, 4.4, 4.85, 2.4, 2.98, 3.25, 4.05,
];

export const PREVIEW_SKILL_DEV_REQUESTS: PreviewSkillDevRequest[] = [
  {
    id: 'SDR-201',
    requesterManager: 'Solomon Bekele',
    directorate: 'Retail & Branch Banking',
    scope: 'GROUP',
    participantCount: 4,
    skillFocus: 'Customer Service Excellence',
    targetQuarter: 'FY26/27 Q2',
    status: 'PENDING_APPROVAL',
  },
  {
    id: 'SDR-202',
    requesterManager: 'Elias Tesfaye',
    directorate: 'Technology & Digital Banking',
    scope: 'INDIVIDUAL',
    participantCount: 1,
    skillFocus: 'Java & Spring Boot Development',
    targetQuarter: 'FY26/27 Q2',
    status: 'PENDING_APPROVAL',
  },
  {
    id: 'SDR-203',
    requesterManager: 'Mulugeta Haile',
    directorate: 'Credit & Risk Management',
    scope: 'GROUP',
    participantCount: 3,
    skillFocus: 'Credit Risk & Loan Assessment',
    targetQuarter: 'FY26/27 Q1',
    status: 'APPROVED',
  },
];

export interface PreviewTrainerApplication {
  id: string;
  applicantCode: string;
  applicantName: string;
  department: string;
  employmentStatus: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';
  claimedSkills: string[];
  certificateFileName: string;
  yearsExperience: number;
  submittedAt: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  reviewReason?: string;
}

export interface PreviewCertifiedTrainer {
  id: string;
  employeeCode: string;
  fullName: string;
  department: string;
  employmentStatus: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';
  trainerAuthStatus: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  approvedSkills: string[];
  activeTrainees: number;
  maxTrainees: number;
  avgRating: number;
}

export interface PreviewMentoringRequest {
  id: string;
  traineeCode: string;
  traineeName: string;
  department: string;
  requestedSkill: string;
  channel: 'DIRECT_BROWSE' | 'HR_ASSISTED' | 'AUTO_RECOMMENDED';
  status: 'AWAITING_HR_MATCH' | 'MATCHED' | 'PENDING_TRAINER';
  preferredSchedule: string;
}

export const PREVIEW_TRAINER_APPLICATIONS: PreviewTrainerApplication[] = [
  {
    id: 'APP-301',
    applicantCode: 'BOA-9031',
    applicantName: 'Dawit Mekonnen',
    department: 'Application Development & API',
    employmentStatus: 'ACTIVE',
    claimedSkills: ['Java & Spring Boot Development', 'Data Analytics & Power BI'],
    certificateFileName: 'spring-security-architecture-cert.pdf',
    yearsExperience: 9,
    submittedAt: '2026-11-08',
    status: 'PENDING_REVIEW',
  },
  {
    id: 'APP-302',
    applicantCode: 'BOA-9054',
    applicantName: 'Rahel Tsegaye',
    department: 'Corporate Credit Appraisal',
    employmentStatus: 'ACTIVE',
    claimedSkills: ['Credit Risk & Loan Assessment', 'Advanced Excel & Financial Modeling'],
    certificateFileName: 'credit-risk-charter-2025.pdf',
    yearsExperience: 7,
    submittedAt: '2026-11-10',
    status: 'PENDING_REVIEW',
  },
];

export const PREVIEW_CERTIFIED_TRAINERS: PreviewCertifiedTrainer[] = [
  {
    id: 'TRN-401',
    employeeCode: 'BOA-9010',
    fullName: 'Tewodros Hailu',
    department: 'Corporate Credit Appraisal',
    employmentStatus: 'ACTIVE',
    trainerAuthStatus: 'ACTIVE',
    approvedSkills: ['Credit Risk & Loan Assessment', 'Advanced Excel & Financial Modeling'],
    activeTrainees: 2,
    maxTrainees: 3,
    avgRating: 4.8,
  },
  {
    id: 'TRN-402',
    employeeCode: 'BOA-9029',
    fullName: 'Yohannes Desta',
    department: 'Application Development & API',
    employmentStatus: 'ACTIVE',
    trainerAuthStatus: 'ACTIVE',
    approvedSkills: ['Java & Spring Boot Development'],
    activeTrainees: 3,
    maxTrainees: 3,
    avgRating: 4.9,
  },
  {
    id: 'TRN-403',
    employeeCode: 'BOA-9082',
    fullName: 'Mekdes Alemu',
    department: 'Bole Branch Operations',
    employmentStatus: 'ON_LEAVE',
    trainerAuthStatus: 'SUSPENDED',
    approvedSkills: ['Leadership & Performance Coaching', 'Customer Service Excellence'],
    activeTrainees: 1,
    maxTrainees: 3,
    avgRating: 4.5,
  },
  {
    id: 'TRN-404',
    employeeCode: 'BOA-9091',
    fullName: 'Kifle Berhanu',
    department: 'Treasury & Liquidity Management',
    employmentStatus: 'TERMINATED',
    trainerAuthStatus: 'ACTIVE',
    approvedSkills: ['Data Analytics & Power BI'],
    activeTrainees: 0,
    maxTrainees: 2,
    avgRating: 4.4,
  },
];

export const PREVIEW_MENTORING_REQUESTS: PreviewMentoringRequest[] = [
  {
    id: 'MR-501',
    traineeCode: 'BOA-9018',
    traineeName: 'Eden Negash',
    department: 'SME & Micro-Lending',
    requestedSkill: 'Credit Risk & Loan Assessment',
    channel: 'HR_ASSISTED',
    status: 'AWAITING_HR_MATCH',
    preferredSchedule: 'Tue/Thu 15:00 EAT',
  },
  {
    id: 'MR-502',
    traineeCode: 'BOA-9035',
    traineeName: 'Abel Tesfaye',
    department: 'Digital Channels & Apollo',
    requestedSkill: 'Data Analytics & Power BI',
    channel: 'HR_ASSISTED',
    status: 'AWAITING_HR_MATCH',
    preferredSchedule: 'Wed 10:00 EAT',
  },
];

export interface PreviewWorkspaceData {
  hasTalentAssignment: boolean;
  isAssignedCoach: boolean;
  hasTraineeRelationship: boolean;
  isApprovedTrainer: boolean;
  talentPlan: {
    coachName: string;
    pathway: 'SKILL_DEVELOPMENT' | 'PERFORMANCE_MANDATORY';
    objective: string;
    quarter: string;
    nextSessionTitle: string;
    nextSessionTime: string;
    progressPct: number;
  };
  coachSessions: Array<{
    id: string;
    talentName: string;
    topic: string;
    scheduledAt: string;
    reportSubmitted: boolean;
  }>;
  mentoringAsTrainee: {
    trainerName: string;
    skillName: string;
    milestoneNote: string;
    sessionsCompleted: number;
    sessionsPlanned: number;
  };
  mentoringAsTrainer: {
    approvedSkills: string[];
    activeTrainees: number;
    maxTrainees: number;
    incomingRequests: Array<{ id: string; traineeName: string; skill: string; note: string }>;
  };
  chatCoachingMessages: Array<{ id: string; sender: string; body: string; time: string }>;
  chatMentoringMessages: Array<{ id: string; sender: string; body: string; time: string }>;
}

export const PREVIEW_WORKSPACE_DATA: PreviewWorkspaceData = {
  hasTalentAssignment: true,
  isAssignedCoach: true,
  hasTraineeRelationship: true,
  isApprovedTrainer: false,
  talentPlan: {
    coachName: 'Elias Tesfaye',
    pathway: 'SKILL_DEVELOPMENT',
    objective: 'Advance Core Banking API Resilience & Production Observability',
    quarter: 'FY 2026/27 · Q1',
    nextSessionTitle: 'Incident Triage & Latency Profiling Lab',
    nextSessionTime: 'Thu, 14:00 EAT (Video Session)',
    progressPct: 65,
  },
  coachSessions: [
    {
      id: 'CS-01',
      talentName: 'Binyam Tadesse',
      topic: 'Q1 Deposit & SLA Recovery Checkpoint',
      scheduledAt: 'Fri, 10:00 EAT',
      reportSubmitted: false,
    },
    {
      id: 'CS-02',
      talentName: 'Frehiwot Girma',
      topic: 'Customer Escalation & Zero-Variance Practice',
      scheduledAt: 'Mon, 15:30 EAT',
      reportSubmitted: true,
    },
  ],
  mentoringAsTrainee: {
    trainerName: 'Tewodros Hailu',
    skillName: 'Credit Risk & Loan Assessment',
    milestoneNote: 'Completed Cash-Flow Sensitivity Model v1 — awaiting peer review.',
    sessionsCompleted: 3,
    sessionsPlanned: 6,
  },
  mentoringAsTrainer: {
    approvedSkills: ['Leadership & Performance Coaching'],
    activeTrainees: 1,
    maxTrainees: 3,
    incomingRequests: [
      {
        id: 'IN-01',
        traineeName: 'Lidia Girma',
        skill: 'Leadership & Performance Coaching',
        note: 'Preparing for Branch Team Lead rotation in Q2.',
      },
    ],
  },
  chatCoachingMessages: [
    {
      id: 'cm-1',
      sender: 'Coach',
      body: 'Please bring your Q1 SLA exception summary for Thursday.',
      time: '09:15',
    },
    {
      id: 'cm-2',
      sender: 'You',
      body: 'Uploaded the practice checklist — see you at 14:00.',
      time: '09:22',
    },
  ],
  chatMentoringMessages: [
    {
      id: 'mm-1',
      sender: 'Trainer',
      body: 'Shared the Credit Risk sensitivity template in Mentoring Resources.',
      time: 'Yesterday',
    },
  ],
};

