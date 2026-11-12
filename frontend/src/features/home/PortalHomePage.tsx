import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  Calendar,
  ClipboardCheck,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import {
  ADMIN_MODULE_PERMISSIONS,
  EMPLOYEE_WORKSPACE_PERMISSIONS,
  HR_MODULE_PERMISSIONS,
  PMS_MODULE_PERMISSIONS,
  resolveAuthorizedModules,
  type PortalModuleKey,
} from '../../shared/auth/workspaceResolver';
import { AvatarBadge, EmptyState, LoadingSkeleton, StatusPill } from '../../shared/components/ui';
import { coreConfigApi } from '../admin/config/api/coreConfigApi';
import { workspaceLiveApi } from '../workspace/api/workspaceDashboardApi';

function moduleIcon(key: PortalModuleKey) {
  if (key === 'coaching') return <ClipboardCheck size={22} />;
  if (key === 'mentoring') return <Award size={22} />;
  return <ShieldCheck size={22} />;
}

export function PortalHomePage() {
  const { user, hasPermission, hasAnyPermission } = useAuth();

  const authorizedModules = useMemo(
    () => (user ? resolveAuthorizedModules(user.permissions) : []),
    [user]
  );

  const canLoadIdentity = hasAnyPermission(EMPLOYEE_WORKSPACE_PERMISSIONS);

  const identityQuery = useQuery({
    queryKey: ['workspace', 'identity', user?.id],
    queryFn: workspaceLiveApi.loadMyIdentity,
    enabled: Boolean(user && canLoadIdentity),
  });

  const activeConfigQuery = useQuery({
    queryKey: ['core', 'active-config'],
    queryFn: coreConfigApi.getActiveConfig,
    enabled: Boolean(user && !user.mustChangePassword),
  });

  if (!user || authorizedModules.length === 0) {
    return (
      <div className="apid-card" data-testid="no-authorized-modules">
        <EmptyState
          title="No Authorized Modules"
          description="Your account is signed in, but currently has no portal modules assigned. Contact your Bank of Abyssinia System Administrator."
        />
      </div>
    );
  }

  const linkedEmployee = identityQuery.data?.linkedEmployee ?? null;
  const directReports = identityQuery.data?.directReports ?? [];
  const activeSkillsCount = identityQuery.data?.activeSkills.length ?? 0;
  const activeQuarter = activeConfigQuery.data?.activeQuarter;
  const publicConfig = activeConfigQuery.data?.publicConfig;

  const hasEmployeeAccess = hasAnyPermission(EMPLOYEE_WORKSPACE_PERMISSIONS);
  const hasPmsAdmin = hasAnyPermission(PMS_MODULE_PERMISSIONS);
  const hasHrAdmin = hasAnyPermission(HR_MODULE_PERMISSIONS);
  const hasSysAdmin = hasAnyPermission(ADMIN_MODULE_PERMISSIONS);

  const getModuleFeatures = (key: PortalModuleKey): string[] => {
    if (key === 'coaching') {
      const items: string[] = [];
      if (hasEmployeeAccess) {
        items.push('My Coach & Action Plan', 'Sessions & Schedule');
        if (directReports.length > 0 || hasPermission('COACHING_REQUEST_SUBMIT')) {
          items.push(
            directReports.length > 0
              ? `People I Coach (${directReports.length})`
              : 'Team Skill Coaching'
          );
        }
      }
      if (hasPmsAdmin) {
        items.push('PMS Upload & Eligibility', 'Coach Assignments');
      }
      return items;
    }

    if (key === 'mentoring') {
      const items: string[] = [];
      if (hasEmployeeAccess) {
        items.push('My Mentor & Progress', 'Trainer Directory', 'Become a Trainer');
      }
      if (hasHrAdmin) {
        items.push('Trainer Applications', 'Match Queue & Roster');
      }
      return items;
    }

    const adminItems: string[] = [];
    if (hasPermission('USER_MANAGE')) adminItems.push('Users & Access');
    if (hasPermission('HIERARCHY_MANAGE')) adminItems.push('Employees & Org');
    if (hasPermission('ROLE_PERMISSION_MANAGE')) adminItems.push('Roles & Permissions');
    if (hasPermission('SKILL_MANAGE')) adminItems.push('Skills');
    if (hasPermission('AUDIT_LOG_VIEW')) adminItems.push('Activity Log');
    if (hasPermission('SYSTEM_CONFIG_MANAGE')) adminItems.push('Quarter Settings');
    return adminItems;
  };

  return (
    <div className="boa-portal-home">
      {/* Executive Welcome & Identity Context */}
      <section className="boa-home-hero apid-card">
        <div className="boa-home-hero-main">
          <AvatarBadge name={linkedEmployee?.fullName ?? user.username} size={52} />
          <div>
            <div className="boa-home-kicker">Abyssinia Personal Intelligence &amp; Development</div>
            <h1 className="boa-home-title">
              Welcome back, {linkedEmployee?.fullName ?? user.username}
            </h1>
            {canLoadIdentity && identityQuery.isLoading ? (
              <div style={{ marginTop: '0.4rem', maxWidth: 320 }}>
                <LoadingSkeleton rows={1} height={16} />
              </div>
            ) : linkedEmployee ? (
              <div className="boa-home-meta">
                <span>
                  Emp #{linkedEmployee.employeeNumber} · {linkedEmployee.position || linkedEmployee.job || 'Staff Member'}
                </span>
                <span>
                  <Building2 size={13} style={{ verticalAlign: 'text-bottom', marginRight: '0.25rem' }} />
                  {linkedEmployee.departmentName || 'Unassigned Department'}
                  {linkedEmployee.managerFullName ? ` · Manager: ${linkedEmployee.managerFullName}` : ''}
                </span>
              </div>
            ) : (
              <div className="boa-home-meta">
                <span>Account: {user.username} · Roles: {user.roles.join(', ') || 'None'}</span>
              </div>
            )}
          </div>
        </div>

        <div className="boa-home-hero-badges">
          {activeQuarter && (
            <StatusPill
              label={`${activeQuarter.label} (${activeQuarter.startDate} – ${activeQuarter.endDate})`}
              tone="info"
              icon={<Calendar size={12} />}
            />
          )}
          {directReports.length > 0 && (
            <StatusPill
              label={`${directReports.length} Direct Reports`}
              tone="ok"
              icon={<Users size={12} />}
            />
          )}
          {activeSkillsCount > 0 && (
            <StatusPill label={`${activeSkillsCount} Active Skills`} tone="neutral" />
          )}
        </div>
      </section>

      {/* Friendly warning if employee account has no HR record linked yet */}
      {canLoadIdentity && !identityQuery.isLoading && !identityQuery.isError && !linkedEmployee && (
        <div
          className="apid-card"
          data-testid="home-unlinked-notice"
          style={{
            borderColor: '#fcd34d',
            background: '#fffbeb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <ShieldAlert size={20} color="#b45309" />
            <div>
              <strong style={{ fontSize: '0.9rem' }}>Employee Profile Not Linked Yet</strong>
              <p style={{ fontSize: '0.82rem', marginTop: '0.1rem' }}>
                Your user account is active, but has not been linked to an HR employee record under Employees &amp; Org.
              </p>
            </div>
          </div>
          {hasPermission('HIERARCHY_MANAGE') && (
            <Link to="/admin?tab=organization" className="apid-btn apid-btn-primary apid-btn-sm">
              Link Profile in Employees &amp; Org
            </Link>
          )}
        </div>
      )}

      {/* Authorized Module Cards Grid */}
      <section aria-label="Available Portal Modules">
        <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Choose a Module</h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: 'var(--muted)' }}>
              Open a module to access your personal workspace, team responsibilities, and any administrative tools assigned to your role.
            </p>
          </div>
        </div>

        <div className="boa-module-grid">
          {authorizedModules.map((mod) => {
            const features = getModuleFeatures(mod.key);
            const hasAdminSide =
              (mod.key === 'coaching' && hasPmsAdmin) ||
              (mod.key === 'mentoring' && hasHrAdmin) ||
              (mod.key === 'admin' && hasSysAdmin);

            return (
              <Link
                key={mod.key}
                to={mod.route}
                className={`boa-module-card apid-card boa-module-card--${mod.key}`}
                data-testid={`module-card-${mod.key}`}
              >
                <div className="boa-module-card-top">
                  <div className={`boa-module-icon boa-module-icon--${mod.key}`}>
                    {moduleIcon(mod.key)}
                  </div>
                  {hasAdminSide && (
                    <StatusPill
                      label={mod.key === 'admin' ? 'Admin Only' : 'Includes Admin Tools'}
                      tone={mod.key === 'admin' ? 'warn' : 'info'}
                    />
                  )}
                </div>

                <div>
                  <h3 className="boa-module-title">{mod.title}</h3>
                  <p className="boa-module-tagline">{mod.tagline}</p>
                </div>

                <div className="boa-module-chips">
                  {features.map((feat) => (
                    <span key={feat} className="boa-module-chip">
                      {feat}
                    </span>
                  ))}
                </div>

                <div className="boa-module-cta">
                  <span>Open {mod.shortLabel}</span>
                  <ArrowRight size={16} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* About APID Policy Summary */}
      <section className="boa-grid-2" aria-label="About APID">
        <div className="apid-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.45rem' }}>
            <BookOpen size={17} color="var(--brand)" />
            <h3 className="boa-card-title">How Performance Coaching Works</h3>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--muted)', lineHeight: 1.55 }}>
            Appraisal results are reviewed each cycle. Staff scoring below{' '}
            <strong>Rounded Grade {publicConfig?.mandatoryCutoffRounded ?? 3}</strong> receive a mandatory coaching
            plan with their reporting supervisor or assigned coach, while managers can submit skill-development coaching requests at any time.
          </p>
        </div>

        <div className="apid-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.45rem' }}>
            <Award size={17} color="var(--brand)" />
            <h3 className="boa-card-title">How Mentoring &amp; Trainers Work</h3>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--muted)', lineHeight: 1.55 }}>
            Employees can request skill mentoring from certified internal trainers or apply to become a Certified Trainer.
            HR reviews trainer applications and matches trainees while respecting trainer capacity limits.
          </p>
        </div>
      </section>
    </div>
  );
}

