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
import './MentoringDashboard.css';

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
    <div className="boa-stack mentoring-dashboard">
      <PageHeader
        title="My Pairing"
        subtitle="All of your mentoring relationships, whether you are the mentor or the trainee."
        source="live"
      />

      <section className="mentoring-dashboard__metrics" aria-label="Pairing summary">
        {[
          { label: 'Total pairings', value: relationships.length, icon: <HeartHandshake size={19} /> },
          { label: 'As mentor', value: mentorCount, icon: <ArrowUpRight size={19} /> },
          { label: 'As trainee', value: traineeCount, icon: <ArrowDownRight size={19} /> },
          { label: 'Active', value: activeCount, icon: <UsersRound size={19} /> },
        ].map((stat) => (
          <div className="mentoring-dashboard__metric" key={stat.label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <span className="mentoring-dashboard__icon" aria-hidden="true">{stat.icon}</span>
              <span className="mentoring-dashboard__metric-value">{stat.value}</span>
            </div>
            <div className="mentoring-dashboard__metric-label">{stat.label}</div>
          </div>
        ))}
      </section>

      <section className="mentoring-dashboard__section">
        <div className="mentoring-dashboard__section-header">
          <div>
            <h2 className="mentoring-dashboard__section-title">Your relationships</h2>
            <p className="mentoring-dashboard__section-description">A live view of your mentoring connections.</p>
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
          <div className="mentoring-pairing-list">
            {visibleRelationships.map((item) => {
              const isMentor = item.currentUserRole === 'MENTOR';
              const counterpartName = isMentor ? item.traineeName : item.mentorName;
              const displayStatus =
                item.relationshipStatus === 'ACTIVE' ? item.memberStatus : item.relationshipStatus;
              return (
                <article key={item.memberId} className="mentoring-pairing-row">
                  <div className="mentoring-pairing-row__main">
                    <span className="mentoring-dashboard__icon" aria-hidden="true">
                      {isMentor ? <GraduationCap size={20} /> : <HeartHandshake size={20} />}
                    </span>
                    <div className="mentoring-pairing-row__details">
                      <h3 style={{ margin: 0, overflowWrap: 'anywhere' }}>{counterpartName}</h3>
                      <p className="mentoring-pairing-row__meta">
                        {isMentor ? 'You are the mentor' : 'Your mentor'} · {item.requestType === 'GROUP' ? 'Class pairing' : 'One-to-one'}
                        {item.skillName ? ` · ${item.skillName}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="mentoring-pairing-row__meta" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CalendarDays size={15} />
                    <span>Started {formatDate(item.startedAt)}</span>
                  </div>
                  <div className="mentoring-pairing-row__actions">
                    <StatusPill label={displayStatus} tone={statusTone(displayStatus)} />
                    <Link
                      to={`/mentoring/pairing/${item.relationshipId}`}
                      className="apid-btn apid-btn-outline apid-btn-sm"
                    >
                      View details <ArrowRight size={15} />
                    </Link>
                    {item.currentUserRole === 'MENTOR' && item.relationshipStatus === 'ACTIVE' && (
                      <Link
                        to={`/mentoring?view=trainer-sessions&relationshipId=${item.relationshipId}`}
                        className="apid-btn apid-btn-primary apid-btn-sm"
                      >
                        <CalendarDays size={14} /> Schedule Session
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
