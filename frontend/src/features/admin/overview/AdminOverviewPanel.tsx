import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Building2, ShieldCheck, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import {
  DataSourceBadge,
  ErrorState,
  LoadingSkeleton,
  SlideOverDrawer,
  StatCard,
  StatusPill,
  SvgHorizontalBarChart,
} from '../../../shared/components/ui';
import { auditApi } from '../audit/api/auditApi';
import type { AuditEvent } from '../audit/types/audit.types';
import { coreConfigApi } from '../config/api/coreConfigApi';
import { adminSummaryLiveApi } from './api/adminSummaryApi';

export function AdminOverviewPanel() {
  const { hasPermission, hasAnyPermission } = useAuth();
  const navigate = useNavigate();
  const [selectedAudit, setSelectedAudit] = useState<AuditEvent | null>(null);

  const canUsers = hasPermission('USER_MANAGE');
  const canOrg = hasPermission('HIERARCHY_MANAGE');
  const canRoles = hasAnyPermission(['ROLE_PERMISSION_MANAGE', 'USER_MANAGE']);
  const canSkills = hasPermission('SKILL_MANAGE');
  const canAudit = hasPermission('AUDIT_LOG_VIEW');

  const summaryQuery = useQuery({
    queryKey: ['admin', 'summary'],
    queryFn: adminSummaryLiveApi.getSummary,
  });

  const healthQuery = useQuery({
    queryKey: ['core', 'health'],
    queryFn: adminSummaryLiveApi.getHealth,
  });

  const auditStreamQuery = useQuery({
    queryKey: ['admin', 'audit-recent'],
    queryFn: () => auditApi.search({ page: 0, size: 6 }),
    enabled: canAudit,
  });

  const activeConfigQuery = useQuery({
    queryKey: ['core', 'active-config'],
    queryFn: coreConfigApi.getActiveConfig,
  });

  if (summaryQuery.isLoading) {
    return <LoadingSkeleton rows={6} height={28} />;
  }

  if (summaryQuery.isError) {
    return (
      <ErrorState
        message="Failed to load System Administration summary."
        onRetry={() => void summaryQuery.refetch()}
      />
    );
  }

  const summary = summaryQuery.data;

  const roleChartItems =
    summary?.roles?.map((r) => ({
      id: String(r.id),
      label: r.name,
      value: r.permissionCount,
      secondaryLabel: `${r.activeUserCount} active users${r.systemProtected ? ' · Protected' : ''}`,
      color: r.systemProtected ? '#0f172a' : '#c97a00',
    })) ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="apid-card">
        <div className="boa-card-header" style={{ marginBottom: '0.85rem' }}>
          <div>
            <h2 className="boa-card-title">Platform Summary</h2>
            <p className="boa-card-subtitle">
              Overview of user accounts, employee directory, roles, and activity.
            </p>
          </div>
          <DataSourceBadge source="live" />
        </div>

        <div className="boa-kpi-grid" style={{ marginBottom: 0 }}>
          {canUsers && summary?.users && (
            <StatCard
              label="User Accounts"
              value={summary.users.total}
              subtext={`${summary.users.active} active · ${summary.users.mustChangePassword} pending PW change`}
              badge={summary.users.temporarilyLocked > 0 ? `${summary.users.temporarilyLocked} locked` : 'No locks'}
              badgeTone={summary.users.temporarilyLocked > 0 ? 'warn' : 'ok'}
              icon={<Users size={16} />}
            />
          )}
          {canOrg && summary?.employees && summary?.departments && (
            <StatCard
              label="Employee Directory"
              value={summary.employees.total}
              subtext={`${summary.employees.linkedAccounts} linked · ${summary.employees.unlinkedAccounts} unlinked`}
              badge={`${summary.departments.active} active depts`}
              badgeTone="info"
              icon={<Building2 size={16} />}
            />
          )}
          {canRoles && summary?.roles && (
            <StatCard
              label="Roles & Permissions"
              value={summary.roles.length}
              subtext={`${summary.totalCatalogPermissions ?? 0} available permissions`}
              badge={canOrg && summary.employees ? `${summary.employees.activeReportingLinks} mgr links` : 'Active'}
              badgeTone="neutral"
              icon={<ShieldCheck size={16} />}
            />
          )}
          {canAudit && summary?.audit24h && (
            <StatCard
              label="Recent Activity (24h)"
              value={summary.audit24h.totalEvents}
              subtext={`${summary.audit24h.nonSuccessEvents} failed or denied events`}
              badge={summary.audit24h.nonSuccessEvents > 0 ? 'Review events' : 'All Clear'}
              badgeTone={summary.audit24h.nonSuccessEvents > 0 ? 'warn' : 'ok'}
              icon={<Activity size={16} />}
            />
          )}
          {canSkills && summary?.skills && !canUsers && (
            <StatCard
              label="Skills"
              value={summary.skills.active}
              subtext={`${summary.skills.total} total configured skills`}
              badge="Active Catalog"
              badgeTone="info"
              icon={<ShieldCheck size={16} />}
            />
          )}
        </div>
      </div>

      <div className="boa-grid-2">
        {canRoles && (
          <section className="apid-card">
            <div className="boa-card-header">
              <div>
                <h3 className="boa-card-title">Role Access Coverage</h3>
                <p className="boa-card-subtitle">
                  Permissions assigned per role ({summary?.totalCatalogPermissions ?? 0} total permissions).
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                <DataSourceBadge source="live" />
                {hasPermission('ROLE_PERMISSION_MANAGE') && (
                  <button
                    type="button"
                    className="apid-btn apid-btn-outline apid-btn-sm"
                    onClick={() => navigate('/admin?tab=roles')}
                  >
                    Manage Matrix
                  </button>
                )}
              </div>
            </div>

            <SvgHorizontalBarChart
              title="Role Permission Coverage"
              description="Number of permissions assigned per role alongside active user counts."
              items={roleChartItems}
              maxOverride={Math.max(1, summary?.totalCatalogPermissions ?? 19)}
            />
          </section>
        )}

        <section className="apid-card">
          <div className="boa-card-header">
            <div>
              <h3 className="boa-card-title">System Status &amp; Settings</h3>
              <p className="boa-card-subtitle">Service health and active quarter configuration.</p>
            </div>
            <DataSourceBadge source="live" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.86rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0.7rem', background: 'var(--surface-subtle)', borderRadius: 8 }}>
              <span>Core Backend Service</span>
              <StatusPill
                label={healthQuery.data?.status ?? (healthQuery.isError ? 'UNREACHABLE' : 'CHECKING')}
                tone={healthQuery.data?.status === 'UP' ? 'ok' : 'err'}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0.7rem', background: 'var(--surface-subtle)', borderRadius: 8 }}>
              <span>Redis Cache Monitoring</span>
              <StatusPill
                label={summary?.redisMonitoringAvailable ? 'Monitored' : 'Not monitored'}
                tone="neutral"
              />
            </div>

            <div style={{ marginTop: '0.35rem', paddingTop: '0.65rem', borderTop: '1px dashed var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: '0.84rem' }}>Fiscal Quarter &amp; Cutoffs</strong>
                <DataSourceBadge source="live" />
              </div>
              {activeConfigQuery.data && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
                  <div>Active Cycle: <strong>{activeConfigQuery.data.activeQuarter.label}</strong></div>
                  <div>Mandatory Cutoff: <strong className="tabular-nums">Rounded &lt; {activeConfigQuery.data.publicConfig.mandatoryCutoffRounded}</strong></div>
                  <div>Missed-Session Alert: <strong className="tabular-nums">{activeConfigQuery.data.publicConfig.missedSessionAlertThreshold} missed</strong></div>
                  <div>Max Upload Size: <strong className="tabular-nums">{activeConfigQuery.data.publicConfig.maxFileUploadMb} MB</strong></div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {canAudit && (
        <section className="apid-card">
          <div className="boa-card-header">
            <div>
              <h3 className="boa-card-title">Recent Activity</h3>
              <p className="boa-card-subtitle">Click any row to view full event details.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
              <DataSourceBadge source="live" />
              <button
                type="button"
                className="apid-btn apid-btn-outline apid-btn-sm"
                onClick={() => navigate('/admin?tab=audit')}
              >
                View All Activity
              </button>
            </div>
          </div>

          {auditStreamQuery.isLoading ? (
            <LoadingSkeleton rows={4} height={20} />
          ) : (
            <div className="apid-table-wrap">
              <table className="apid-table">
                <thead>
                  <tr>
                    <th>Timestamp (UTC)</th>
                    <th>Module</th>
                    <th>Action</th>
                    <th>Result</th>
                    <th>Actor</th>
                    <th>Entity</th>
                  </tr>
                </thead>
                <tbody>
                  {auditStreamQuery.data?.content.map((ev) => (
                    <tr
                      key={ev.id}
                      onClick={() => setSelectedAudit(ev)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="tabular-nums" style={{ fontSize: '0.78rem' }}>{ev.createdAt}</td>
                      <td><strong>{ev.module}</strong></td>
                      <td><code>{ev.action}</code></td>
                      <td>
                        <StatusPill
                          label={ev.result}
                          tone={ev.result === 'SUCCESS' ? 'ok' : 'err'}
                        />
                      </td>
                      <td>{ev.actorUsername || 'system'}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                        {ev.entityType ? `${ev.entityType}#${ev.entityId ?? ''}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <SlideOverDrawer
        open={selectedAudit !== null}
        title={selectedAudit ? `${selectedAudit.module} · ${selectedAudit.action}` : ''}
        subtitle={selectedAudit ? `Event #${selectedAudit.id} · ${selectedAudit.createdAt}` : undefined}
        onClose={() => setSelectedAudit(null)}
      >
        {selectedAudit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.86rem' }}>
            <div><strong>Actor:</strong> {selectedAudit.actorUsername || 'system'}</div>
            <div><strong>Result:</strong> <StatusPill label={selectedAudit.result} tone={selectedAudit.result === 'SUCCESS' ? 'ok' : 'err'} /></div>
            <div><strong>IP Address:</strong> <code className="tabular-nums">{selectedAudit.ipAddress || '—'}</code></div>
            <div><strong>Request ID:</strong> <code>{selectedAudit.requestId || '—'}</code></div>
            <div>
              <strong>Immutable Metadata Payload</strong>
              <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: '0.85rem', borderRadius: 8, overflowX: 'auto', fontSize: '0.78rem' }}>
                {JSON.stringify(selectedAudit.detailsJson ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </SlideOverDrawer>
    </div>
  );
}
