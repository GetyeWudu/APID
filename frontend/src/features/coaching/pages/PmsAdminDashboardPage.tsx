import { useMemo } from 'react';
import { Sliders, Award, Building, LayoutDashboard } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import {
  EmptyState,
  PageHeader,
  PermissionGate,
} from '../../../shared/components/ui';
import { PMS_MODULE_PERMISSIONS } from '../../../shared/auth/workspaceResolver';
import { PmsAssignmentsTab } from '../components/PmsAssignmentsTab';
import { CoachQualityTab } from '../components/CoachQualityTab';
import { RegionalMatrixTab } from '../components/RegionalMatrixTab';
import { PmsUploadPreviewTab } from '../components/PmsUploadPreviewTab';
import { SkillDevApprovalTab } from '../components/SkillDevApprovalTab';
import { CoachingRulesTab } from '../components/CoachingRulesTab';
import { PmsReferralsTab } from '../components/PmsReferralsTab';

type PmsTabKey = 'overview' | 'quality' | 'matrix' | 'referrals' | 'uploads' | 'approvals' | 'policies';

interface PmsTabMeta {
  key: PmsTabKey;
  label: string;
  anyPermissions: string[];
}

const PMS_TABS: PmsTabMeta[] = [
  {
    key: 'overview',
    label: 'Coaching Overview',
    anyPermissions: [
      'COACHING_ASSIGNMENT_VIEW_ALL',
      'COACHING_COACH_REPLACE',
      'COACHING_INITIATIVE_CREATE',
      'COACHING_REPORT_VIEW_ALL',
    ],
  },
  {
    key: 'quality',
    label: 'Coach Quality & CSAT',
    anyPermissions: [
      'COACHING_ASSIGNMENT_VIEW_ALL',
      'COACHING_COACH_REPLACE',
      'COACHING_INITIATIVE_CREATE',
      'COACHING_REPORT_VIEW_ALL',
    ],
  },
  {
    key: 'matrix',
    label: 'Regional & Branch Matrix',
    anyPermissions: [
      'COACHING_ASSIGNMENT_VIEW_ALL',
      'COACHING_COACH_REPLACE',
      'COACHING_INITIATIVE_CREATE',
      'COACHING_REPORT_VIEW_ALL',
    ],
  },
  {
    key: 'referrals',
    label: 'Persistent Referrals (< 3.0)',
    anyPermissions: [
      'COACHING_ASSIGNMENT_VIEW_ALL',
      'COACHING_COACH_REPLACE',
      'COACHING_MANAGE',
      'ADMIN_PORTAL_ACCESS',
      'PMS_ADMIN_ACCESS',
    ],
  },
  {
    key: 'uploads',
    label: 'Appraisal Upload',
    anyPermissions: ['PMS_REPORT_UPLOAD'],
  },
  {
    key: 'approvals',
    label: 'Skill Requests',
    anyPermissions: ['COACHING_REQUEST_APPROVE'],
  },
  {
    key: 'policies',
    label: 'Coaching Rules & Policies',
    anyPermissions: [
      'COACHING_ASSIGNMENT_VIEW_ALL',
      'COACHING_INITIATIVE_CREATE',
      'ADMIN_PORTAL_ACCESS',
      'PMS_ADMIN_ACCESS',
    ],
  },
];

export function PmsAdminDashboardPage() {
  const { hasAnyPermission } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const visibleTabs = useMemo(
    () => PMS_TABS.filter((t) => hasAnyPermission(t.anyPermissions)),
    [hasAnyPermission]
  );

  const requestedTab = searchParams.get('tab') as PmsTabKey | null;
  const activeTab = visibleTabs.find((t) => t.key === requestedTab)?.key ?? visibleTabs[0]?.key ?? null;

  if (!hasAnyPermission(PMS_MODULE_PERMISSIONS) || !activeTab) {
    return (
      <div className="apid-card">
        <EmptyState
          title="No PMS Coaching Access"
          description="Your account does not have permission to view PMS Coaching."
        />
      </div>
    );
  }

  const activeTabMeta = visibleTabs.find((t) => t.key === activeTab) ?? visibleTabs[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <PageHeader
        title={activeTabMeta.label}
        subtitle={
          activeTab === 'policies'
            ? 'Configure minimum sessions, early video call access windows, and reschedule limits for the entire bank.'
            : activeTab === 'quality'
            ? 'Coachee post-session evaluations, top-rated coach recognition, and proactive mid-quarter remediation pacing.'
            : activeTab === 'matrix'
            ? 'Scalable hierarchical performance comparison across 200+ districts, branch execution pacing, and primary competency deficits.'
            : 'Executive oversight, AI briefing, KPI distribution, and verified coaching remediation assignments roster.'
        }
        source={activeTab === 'policies' ? 'live' : 'preview'}
      />

      {/* Horizontal Tabs Switcher */}
      <div
        className="apid-card"
        style={{
          padding: '0.4rem',
          background: 'var(--surface-subtle, #f8fafc)',
          border: '1px solid var(--border, #e2e8f0)',
          borderRadius: '10px',
          display: 'flex',
          gap: '0.4rem',
          flexWrap: 'wrap',
        }}
      >
        {visibleTabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                const search = tab.key === 'overview' ? '' : `?tab=${tab.key}`;
                navigate(`/coaching/pms${search}`);
              }}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: isActive ? 700 : 500,
                border: 'none',
                background: isActive ? '#ffffff' : 'transparent',
                color: isActive ? 'var(--brand-gold, #ca8a04)' : 'var(--text-secondary, #475569)',
                boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.key === 'overview' && <LayoutDashboard size={14} />}
              {tab.key === 'quality' && <Award size={14} />}
              {tab.key === 'matrix' && <Building size={14} />}
              {tab.key === 'policies' && <Sliders size={14} />}
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'quality' ? (
        <PermissionGate
          anyPermissions={[
            'COACHING_ASSIGNMENT_VIEW_ALL',
            'COACHING_COACH_REPLACE',
            'COACHING_INITIATIVE_CREATE',
            'COACHING_REPORT_VIEW_ALL',
          ]}
        >
          <CoachQualityTab />
        </PermissionGate>
      ) : activeTab === 'matrix' ? (
        <PermissionGate
          anyPermissions={[
            'COACHING_ASSIGNMENT_VIEW_ALL',
            'COACHING_COACH_REPLACE',
            'COACHING_INITIATIVE_CREATE',
            'COACHING_REPORT_VIEW_ALL',
          ]}
        >
          <RegionalMatrixTab />
        </PermissionGate>
      ) : activeTab === 'referrals' ? (
        <PermissionGate
          anyPermissions={[
            'COACHING_ASSIGNMENT_VIEW_ALL',
            'COACHING_COACH_REPLACE',
            'COACHING_MANAGE',
            'ADMIN_PORTAL_ACCESS',
            'PMS_ADMIN_ACCESS',
          ]}
        >
          <PmsReferralsTab />
        </PermissionGate>
      ) : activeTab === 'policies' ? (
        <PermissionGate
          anyPermissions={[
            'COACHING_ASSIGNMENT_VIEW_ALL',
            'COACHING_INITIATIVE_CREATE',
            'ADMIN_PORTAL_ACCESS',
            'PMS_ADMIN_ACCESS',
          ]}
        >
          <CoachingRulesTab />
        </PermissionGate>
      ) : activeTab === 'uploads' ? (
        <PermissionGate permission="PMS_REPORT_UPLOAD">
          <PmsUploadPreviewTab />
        </PermissionGate>
      ) : activeTab === 'approvals' ? (
        <PermissionGate permission="COACHING_REQUEST_APPROVE">
          <SkillDevApprovalTab />
        </PermissionGate>
      ) : (
        <PermissionGate
          anyPermissions={[
            'COACHING_ASSIGNMENT_VIEW_ALL',
            'COACHING_COACH_REPLACE',
            'COACHING_INITIATIVE_CREATE',
            'COACHING_REPORT_VIEW_ALL',
          ]}
        >
          <PmsAssignmentsTab />
        </PermissionGate>
      )}
    </div>
  );
}

