import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Users, Award } from 'lucide-react';
import { skillCoachingRequestApi, type SkillCoachingRequestItem } from '../api/skillCoachingRequestApi';
import { DataSourceBadge, EmptyState, LoadingSkeleton, StatusPill } from '../../../shared/components/ui';

export function SkillCoachingRequestsList() {
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  const myRequestsQuery = useQuery({
    queryKey: ['coaching', 'my-skill-requests'],
    queryFn: skillCoachingRequestApi.getMyRequests,
  });

  if (myRequestsQuery.isLoading) {
    return <LoadingSkeleton rows={4} height={32} />;
  }

  const allRequests: SkillCoachingRequestItem[] = Array.isArray(myRequestsQuery.data)
    ? myRequestsQuery.data
    : [];

  const pendingCount = allRequests.filter((r) => r.status === 'PENDING_PMS_APPROVAL').length;
  const approvedCount = allRequests.filter((r) => r.status === 'APPROVED').length;
  const rejectedCount = allRequests.filter((r) => r.status === 'REJECTED').length;

  const filteredRequests = allRequests.filter((r) => {
    if (filter === 'PENDING') return r.status === 'PENDING_PMS_APPROVAL';
    if (filter === 'APPROVED') return r.status === 'APPROVED';
    if (filter === 'REJECTED') return r.status === 'REJECTED';
    return true;
  });

  const renderStatus = (status: SkillCoachingRequestItem['status']) => {
    switch (status) {
      case 'APPROVED':
        return <StatusPill label="APPROVED" tone="ok" />;
      case 'REJECTED':
        return <StatusPill label="REJECTED" tone="err" />;
      case 'PENDING_PMS_APPROVAL':
      default:
        return <StatusPill label="PENDING PMS APPROVAL" tone="warn" />;
    }
  };

  return (
    <div className="apid-card" data-testid="my-skill-requests-card" style={{ marginTop: '1.25rem' }}>
      <div className="boa-card-header">
        <div>
          <h3 className="boa-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Award size={18} style={{ color: 'var(--brand-gold, #ca8a04)' }} />
            My Skill-Development Coaching Requests
          </h3>
          <p className="boa-card-subtitle">
            Formal coaching requests submitted to PMS Admin for skill growth initiatives.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <DataSourceBadge source="live" />
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid var(--border-color, #e2e8f0)', padding: '0 0.5rem 0.5rem 0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`apid-btn apid-btn-sm ${filter === 'ALL' ? 'apid-btn-primary' : 'apid-btn-outline'}`}
          onClick={() => setFilter('ALL')}
        >
          All Requests ({allRequests.length})
        </button>
        <button
          type="button"
          className={`apid-btn apid-btn-sm ${filter === 'PENDING' ? 'apid-btn-primary' : 'apid-btn-outline'}`}
          onClick={() => setFilter('PENDING')}
        >
          Pending ({pendingCount})
        </button>
        <button
          type="button"
          className={`apid-btn apid-btn-sm ${filter === 'APPROVED' ? 'apid-btn-primary' : 'apid-btn-outline'}`}
          onClick={() => setFilter('APPROVED')}
        >
          Approved ({approvedCount})
        </button>
        <button
          type="button"
          className={`apid-btn apid-btn-sm ${filter === 'REJECTED' ? 'apid-btn-primary' : 'apid-btn-outline'}`}
          onClick={() => setFilter('REJECTED')}
        >
          Rejected ({rejectedCount})
        </button>
      </div>

      {filteredRequests.length === 0 ? (
        <EmptyState
          title={
            filter === 'ALL'
              ? 'No Requests Submitted'
              : `No ${filter.toLowerCase()} Requests`
          }
          description={
            filter === 'ALL'
              ? "You have not submitted any skill-development coaching requests yet. Click 'Request Skill Coaching' above to initiate one."
              : `No requests with status "${filter}".`
          }
          icon={<Clock size={28} />}
        />
      ) : (
        <div className="apid-table-wrap">
          <table className="apid-table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Skill Title &amp; Justification</th>
                <th>Target Staff</th>
                <th>Assigned Coach</th>
                <th>Quarter</th>
                <th>Status &amp; PMS Feedback</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((r) => (
                <tr key={r.id}>
                  <td className="tabular-nums">
                    <strong>REQ-{r.id}</strong>
                  </td>
                  <td style={{ maxWidth: 320 }}>
                    <div style={{ fontWeight: 600, color: 'var(--brand-navy, #0f172a)' }}>{r.skillTitle}</div>
                    <div
                      className="boa-muted"
                      style={{
                        fontSize: '0.78rem',
                        marginTop: '0.2rem',
                        lineHeight: 1.35,
                      }}
                      title={r.businessJustification}
                    >
                      {r.businessJustification}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span className="tabular-nums" style={{ fontWeight: 600, fontSize: '0.78rem' }}>
                        <Users size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                        {r.targets.length} Staff:
                      </span>
                      {r.targets.map((t) => (
                        <div
                          key={t.id}
                          style={{
                            padding: '0.2rem 0.4rem',
                            backgroundColor: 'rgba(0,0,0,0.03)',
                            borderRadius: 4,
                            fontSize: '0.8rem',
                          }}
                        >
                          <strong>{t.employeeFullName}</strong>{' '}
                          <span className="boa-muted">({t.employeeNumber})</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{r.proposedCoachFullName}</div>
                    <div className="boa-muted" style={{ fontSize: '0.74rem' }}>
                      {r.proposedCoachEmployeeNumber}
                    </div>
                  </td>
                  <td>
                    <StatusPill label={r.coachingQuarterLabel} tone="info" />
                  </td>
                  <td>
                    <div>{renderStatus(r.status)}</div>
                    {r.reviewNotes && (
                      <div
                        style={{
                          fontSize: '0.76rem',
                          marginTop: '0.35rem',
                          borderLeft: r.status === 'APPROVED' ? '2px solid #22c55e' : '2px solid #ef4444',
                          paddingLeft: '0.45rem',
                          backgroundColor: r.status === 'APPROVED' ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                          padding: '0.25rem 0.45rem',
                          borderRadius: '0 4px 4px 0',
                        }}
                      >
                        <strong>PMS Feedback:</strong> {r.reviewNotes}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
