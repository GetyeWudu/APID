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
  Zap,
  TrendingUp,
  Star,
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
        items.push('Mentoring Overview', 'My Sessions', 'Find a Mentor');
        if (user.roles.some((role) => role.trim().toLowerCase() === 'mentor')) {
          items.push('My Trainees', 'Mentor Sessions');
        }
        items.push('Apply to Become a Mentor');
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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="boa-portal-home">

      {/* ═══════════════════════════════════════════════════
          1. EXECUTIVE HERO BANNER
      ═══════════════════════════════════════════════════ */}
      <section className="apid-card boa-home-hero">
        {/* Left — identity */}
        <div className="boa-home-hero-main">
          <AvatarBadge name={linkedEmployee?.fullName ?? user.username} size={64} />
          <div>
            <div className="boa-home-kicker">
              <Star size={11} style={{ color: '#C59B27', flexShrink: 0 }} />
              Bank of Abyssinia · Personal Intelligence &amp; Development
            </div>
            <h1 className="boa-home-title">
              {greeting},{' '}
              <span className="boa-home-title-accent">
                {linkedEmployee?.fullName ?? user.username}
              </span>
            </h1>

            {canLoadIdentity && identityQuery.isLoading ? (
              <div style={{ marginTop: '0.5rem', maxWidth: 340 }}>
                <LoadingSkeleton rows={1} height={16} />
              </div>
            ) : linkedEmployee ? (
              <div className="boa-home-meta-chips">
                <span className="boa-home-meta-chip">
                  <strong>Emp #{linkedEmployee.employeeNumber}</strong>
                </span>
                <span className="boa-home-meta-chip">
                  <Building2 size={12} style={{ color: '#C59B27', flexShrink: 0 }} />
                  {linkedEmployee.departmentName || 'Unassigned'}
                </span>
                {(linkedEmployee.position || linkedEmployee.job) && (
                  <span className="boa-home-meta-chip">
                    {linkedEmployee.position || linkedEmployee.job}
                  </span>
                )}
                {linkedEmployee.managerFullName && (
                  <span className="boa-home-meta-chip">
                    Reporting to: {linkedEmployee.managerFullName}
                  </span>
                )}
              </div>
            ) : (
              <div className="boa-home-meta-chips">
                <span className="boa-home-meta-chip">
                  <strong>{user.username}</strong>
                </span>
                <span className="boa-home-meta-chip">
                  {user.roles.join(', ') || 'Staff'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right — session context glass card */}
        <div className="boa-home-hero-right">
          <div className="boa-home-hero-right-header">
            <span className="boa-home-hero-right-title">Session Context</span>
            <ShieldCheck size={15} color="#C59B27" />
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
              <StatusPill label={`${activeSkillsCount} Available Skills`} tone="neutral" />
            )}
            {!activeQuarter && !directReports.length && !activeSkillsCount && (
              <StatusPill label="Workspace Active" tone="ok" icon={<Zap size={12} />} />
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          2. UNLINKED NOTICE (data-testid preserved)
      ═══════════════════════════════════════════════════ */}
      {canLoadIdentity && !identityQuery.isLoading && !identityQuery.isError && !linkedEmployee && (
        <div
          className="apid-card"
          data-testid="home-unlinked-notice"
          style={{
            borderColor: 'rgba(197, 155, 39, 0.35)',
            background: 'rgba(197, 155, 39, 0.05)',
            borderRadius: '16px',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'rgba(197, 155, 39, 0.12)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <ShieldAlert size={20} color="#C59B27" />
            </div>
            <div>
              <strong style={{ fontSize: '0.92rem', color: '#1A1C1E' }}>
                Employee Profile Not Linked Yet
              </strong>
              <p style={{ fontSize: '0.84rem', marginTop: '0.15rem', color: '#5C626A', margin: 0 }}>
                Your user account is active, but has not been linked to an HR employee record under
                Employees &amp; Org.
              </p>
            </div>
          </div>
          {hasPermission('HIERARCHY_MANAGE') && (
            <Link
              to="/admin?tab=organization"
              className="apid-btn apid-btn-primary apid-btn-sm"
              style={{
                background: 'linear-gradient(135deg, #D4AF37 0%, #C59B27 100%)',
                color: '#1A1C1E',
                fontWeight: 750,
                border: 'none',
                boxShadow: '0 2px 8px rgba(197, 155, 39, 0.25)',
              }}
            >
              Link Profile in Employees &amp; Org
            </Link>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          3. TELEMETRY METRICS ROW
      ═══════════════════════════════════════════════════ */}
      <div className="boa-home-telemetry-grid">
        <div className="boa-home-telemetry-card">
          <div className="boa-home-telemetry-icon">
            <ClipboardCheck size={20} />
          </div>
          <div>
            <div className="boa-home-telemetry-val">{authorizedModules.length}</div>
            <div className="boa-home-telemetry-label">Authorized Modules</div>
          </div>
        </div>

        {directReports.length > 0 && (
          <div className="boa-home-telemetry-card">
            <div className="boa-home-telemetry-icon">
              <Users size={20} />
            </div>
            <div>
              <div className="boa-home-telemetry-val">{directReports.length}</div>
              <div className="boa-home-telemetry-label">People I Coach</div>
            </div>
          </div>
        )}

        {activeSkillsCount > 0 && (
          <div className="boa-home-telemetry-card">
            <div className="boa-home-telemetry-icon">
              <Award size={20} />
            </div>
            <div>
              <div className="boa-home-telemetry-val">{activeSkillsCount}</div>
              <div className="boa-home-telemetry-label">Available Skills</div>
            </div>
          </div>
        )}

        {activeQuarter ? (
          <div className="boa-home-telemetry-card">
            <div className="boa-home-telemetry-icon">
              <Calendar size={20} />
            </div>
            <div>
              <div className="boa-home-telemetry-val" style={{ fontSize: '1rem' }}>
                {activeQuarter.label}
              </div>
              <div className="boa-home-telemetry-label">Active Quarter</div>
            </div>
          </div>
        ) : (
          <div className="boa-home-telemetry-card">
            <div className="boa-home-telemetry-icon">
              <TrendingUp size={20} />
            </div>
            <div>
              <div className="boa-home-telemetry-val">APID</div>
              <div className="boa-home-telemetry-label">Your Growth Portal</div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
          4. MODULE CARDS
      ═══════════════════════════════════════════════════ */}
      <section aria-label="Available Portal Modules">
        <div className="boa-home-section-header">
          <div>
            <div className="boa-home-section-kicker">Your Portal Modules</div>
            <h2 className="boa-home-section-title">Choose a Module</h2>
            <p className="boa-home-section-desc">
              Open a module to access your personal workspace, team responsibilities, and any
              administrative tools assigned to your role.
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
                <div>
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
                </div>

                <div className="boa-module-cta">
                  <span>Enter {mod.shortLabel}</span>
                  <ArrowRight size={17} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          5. GOVERNANCE / ABOUT APID BENTO
      ═══════════════════════════════════════════════════ */}
      <section className="boa-home-governance-grid" aria-label="About APID">
        {/* Coaching governance card */}
        <div className="boa-home-gov-card">
          <div>
            <div className="boa-home-gov-header">
              <div className="boa-home-gov-icon">
                <BookOpen size={20} />
              </div>
              <h3 className="boa-home-gov-title">How Performance Coaching Works</h3>
            </div>
            <p className="boa-home-gov-desc">
              Appraisal results are reviewed each cycle. Staff scoring below{' '}
              <strong>Rounded Grade {publicConfig?.mandatoryCutoffRounded ?? 3}</strong> receive a
              mandatory coaching plan with their reporting supervisor or assigned coach, while
              managers can submit skill-development coaching requests at any time.
            </p>
          </div>
          <div className="boa-home-gov-tags">
            <span className="boa-home-gov-tag">Mandatory Coaching</span>
            <span className="boa-home-gov-tag">PMS Appraisal</span>
            <span className="boa-home-gov-tag">Skill Development</span>
          </div>
        </div>

        {/* Mentoring governance card */}
        <div className="boa-home-gov-card">
          <div>
            <div className="boa-home-gov-header">
              <div
                className="boa-home-gov-icon"
                style={{
                  background: 'rgba(212, 175, 55, 0.12)',
                  borderColor: 'rgba(212, 175, 55, 0.25)',
                  color: '#D4AF37',
                }}
              >
                <Award size={20} />
              </div>
              <h3 className="boa-home-gov-title">How Mentoring Works</h3>
            </div>
            <p className="boa-home-gov-desc">
              Employees can learn from a mentor and request mentoring sessions. Approved mentors can
              also support trainees while continuing to learn from their own mentors. HR reviews
              mentor applications and matches trainees while respecting mentor capacity limits.
            </p>
          </div>
          <div className="boa-home-gov-tags">
            <span className="boa-home-gov-tag">Mentor Matching</span>
            <span className="boa-home-gov-tag">HR Governed</span>
            <span className="boa-home-gov-tag">Session Tracking</span>
          </div>
        </div>
      </section>

    </div>
  );
}
