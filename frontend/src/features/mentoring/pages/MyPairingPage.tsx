import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  GraduationCap,
  HeartHandshake,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import { EMPLOYEE_WORKSPACE_PERMISSIONS } from '../../../shared/auth/workspaceResolver';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  StatusPill,
} from '../../../shared/components/ui';
import { mentoringPairingApi } from '../api/mentoringPairingApi';

type PairingFilter = 'ALL' | 'MENTOR' | 'TRAINEE';

function formatDate(value: string | null) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function statusTone(status: string) {
  if (status === 'ACTIVE') return 'ok';
  if (status === 'PAUSED') return 'warn';
  return 'neutral';
}

export function MyPairingPage() {
  const { user, hasAnyPermission } = useAuth();
  const [filter, setFilter] = useState<PairingFilter>('ALL');
  const relationshipsQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'relationships', user?.id],
    queryFn: mentoringPairingApi.listMyRelationships,
    enabled: hasAnyPermission(EMPLOYEE_WORKSPACE_PERMISSIONS),
  });

  if (relationshipsQuery.isLoading) {
    return <LoadingSkeleton rows={6} height={28} />;
  }

  if (relationshipsQuery.isError) {
    return (
      <ErrorState
        message="Unable to load your mentoring pairings."
        onRetry={() => void relationshipsQuery.refetch()}
      />
    );
  }

  const relationships = relationshipsQuery.data ?? [];
  const mentorCount = relationships.filter((item) => item.currentUserRole === 'MENTOR').length;
  const traineeCount = relationships.filter((item) => item.currentUserRole === 'TRAINEE').length;
  const activeCount = relationships.filter(
    (item) => item.relationshipStatus === 'ACTIVE' && item.memberStatus === 'ACTIVE'
  ).length;
  const visibleRelationships =
    filter === 'ALL'
      ? relationships
      : relationships.filter((item) => item.currentUserRole === filter);

  const filters: { value: PairingFilter; label: string; count: number }[] = [
    { value: 'ALL', label: 'All pairings', count: relationships.length },
    { value: 'MENTOR', label: 'As mentor', count: mentorCount },
    { value: 'TRAINEE', label: 'As trainee', count: traineeCount },
  ];

  return (
    <div className="boa-stack">
      <PageHeader
        title="My Pairing"
        subtitle="All of your mentoring relationships, whether you are the mentor or the trainee."
        source="live"
      />

      <section
        aria-label="Pairing summary"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '0.85rem',
        }}
      >
        {[
          { label: 'Total pairings', value: relationships.length, icon: <HeartHandshake size={19} /> },
          { label: 'As mentor', value: mentorCount, icon: <ArrowUpRight size={19} /> },
          { label: 'As trainee', value: traineeCount, icon: <ArrowDownRight size={19} /> },
          { label: 'Active', value: activeCount, icon: <UsersRound size={19} /> },
        ].map((stat) => (
          <div
            key={stat.label}
            className="apid-card"
            style={{ padding: '1rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                display: 'grid',
                placeItems: 'center',
                color: 'var(--primary)',
                background: 'var(--primary-soft, rgba(22, 101, 52, 0.1))',
                flexShrink: 0,
              }}
            >
              {stat.icon}
            </span>
            <div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, lineHeight: 1.15 }}>{stat.value}</div>
              <div className="boa-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="apid-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h2 className="boa-card-title">Your relationships</h2>
            <p className="boa-card-subtitle">Pairings are loaded from your mentoring relationship records.</p>
          </div>
          <div role="group" aria-label="Filter pairings" style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            {filters.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`apid-btn apid-btn-sm ${filter === option.value ? 'apid-btn-primary' : 'apid-btn-outline'}`}
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
              >
                {option.label} <span style={{ opacity: 0.8 }}>({option.count})</span>
              </button>
            ))}
          </div>
        </div>

        {relationships.length === 0 ? (
          <EmptyState
            title="No Pairings Yet"
            description="When a mentorship request is approved, your relationship will appear here."
          />
        ) : visibleRelationships.length === 0 ? (
          <EmptyState
            title={`No pairings ${filter === 'MENTOR' ? 'as a mentor' : 'as a trainee'}`}
            description="Choose another filter to see your relationships in the other role."
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
              gap: '0.8rem',
            }}
          >
            {visibleRelationships.map((item) => {
              const isMentor = item.currentUserRole === 'MENTOR';
              const counterpartName = isMentor ? item.traineeName : item.mentorName;
              const displayStatus =
                item.relationshipStatus === 'ACTIVE' ? item.memberStatus : item.relationshipStatus;
              return (
                <article
                  key={item.memberId}
                  className="apid-card"
                  style={{
                    padding: '1rem',
                    border: '1px solid var(--border)',
                    boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.65rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                      <span
                        aria-hidden="true"
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 14,
                          display: 'grid',
                          placeItems: 'center',
                          color: 'var(--primary)',
                          background: 'var(--primary-soft, rgba(22, 101, 52, 0.1))',
                          flexShrink: 0,
                        }}
                      >
                        {isMentor ? <GraduationCap size={20} /> : <HeartHandshake size={20} />}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ margin: 0, overflowWrap: 'anywhere' }}>{counterpartName}</h3>
                        <p className="boa-muted" style={{ margin: '0.2rem 0 0', fontSize: '0.82rem' }}>
                          {isMentor ? 'You are the mentor' : 'Your mentor'}
                        </p>
                      </div>
                    </div>
                    <StatusPill
                      label={displayStatus}
                      tone={statusTone(displayStatus)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
                    <StatusPill
                      label={item.currentUserRole === 'MENTOR' ? 'As mentor' : 'As trainee'}
                      tone="info"
                    />
                    <StatusPill
                      label={item.requestType === 'GROUP' ? 'Class pairing' : 'One-to-one'}
                      tone="neutral"
                    />
                    {item.skillName && <StatusPill label={item.skillName} tone="neutral" />}
                  </div>

                  <div
                    className="boa-muted"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      marginTop: '0.8rem',
                      fontSize: '0.82rem',
                    }}
                  >
                    <CalendarDays size={15} />
                    <span>Started {formatDate(item.startedAt)}</span>
                  </div>
                  {item.message && (
                    <p className="boa-muted" style={{ margin: '0.7rem 0 0', fontSize: '0.84rem' }}>
                      {item.message}
                    </p>
                  )}
                  <Link
                    to={`/mentoring/pairing/${item.relationshipId}`}
                    className="apid-btn apid-btn-outline apid-btn-sm"
                    style={{ marginTop: '0.9rem' }}
                  >
                    View details <ArrowRight size={15} />
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
