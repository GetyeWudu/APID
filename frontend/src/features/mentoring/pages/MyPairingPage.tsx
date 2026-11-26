import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  GraduationCap,
  HeartHandshake,
  UsersRound,
  Users,
  CheckSquare,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import { EMPLOYEE_WORKSPACE_PERMISSIONS } from '../../../shared/auth/workspaceResolver';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  StatusPill,
  useToast,
} from '../../../shared/components/ui';
import { extractApiErrorMessage } from '../../../shared/api/apiClient';
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [filter, setFilter] = useState<PairingFilter>('ALL');
  const [selectedForGroup, setSelectedForGroup] = useState<Set<number>>(new Set());

  const relationshipsQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'relationships', user?.id],
    queryFn: mentoringPairingApi.listMyRelationships,
    enabled: hasAnyPermission(EMPLOYEE_WORKSPACE_PERMISSIONS),
  });

  const createGroupMutation = useMutation({
    mutationFn: (sourceRelationshipIds: number[]) =>
      mentoringPairingApi.createGroupPairing(sourceRelationshipIds),
    onSuccess: (data) => {
      pushToast({
        title: 'Group Cohort Created',
        message: `A new group mentoring cohort with ${data.members.length} trainees has been created.`,
        tone: 'ok',
      });
      setSelectedForGroup(new Set());
      void queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'relationships'] });
      navigate(`/mentoring/pairing/${data.relationshipId}`);
    },
    onError: (err: unknown) => {
      pushToast({
        title: 'Group Creation Failed',
        message: extractApiErrorMessage(err, 'Could not create the group cohort.'),
        tone: 'err',
      });
    },
  });

  const disbandGroupMutation = useMutation({
    mutationFn: (groupRelationshipId: number) =>
      mentoringPairingApi.disbandGroupPairing(groupRelationshipId),
    onSuccess: () => {
      pushToast({
        title: 'Group Disbanded',
        message: 'The group has been disbanded and original 1-on-1 pairings have been restored.',
        tone: 'ok',
      });
      void queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'relationships'] });
    },
    onError: (err: unknown) => {
      pushToast({
        title: 'Disband Failed',
        message: extractApiErrorMessage(err, 'Could not disband this group.'),
        tone: 'err',
      });
    },
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

  const rawRelationships = relationshipsQuery.data ?? [];
  // Group rows by relationshipId so a group cohort is counted and displayed as one pairing
  const groupedByRelId = new Map<
    number,
    { primary: (typeof rawRelationships)[number]; members: typeof rawRelationships }
  >();
  rawRelationships.forEach((item) => {
    const existing = groupedByRelId.get(item.relationshipId);
    if (existing) {
      existing.members.push(item);
    } else {
      groupedByRelId.set(item.relationshipId, { primary: item, members: [item] });
    }
  });
  const relationships = Array.from(groupedByRelId.values());

  const mentorCount = relationships.filter((entry) => entry.primary.currentUserRole === 'MENTOR').length;
  const traineeCount = relationships.filter((entry) => entry.primary.currentUserRole === 'TRAINEE').length;
  const activeCount = relationships.filter(
    (entry) =>
      entry.primary.relationshipStatus === 'ACTIVE' &&
      entry.members.some((m) => m.memberStatus === 'ACTIVE')
  ).length;
  const visibleRelationships =
    filter === 'ALL'
      ? relationships
      : relationships.filter((entry) => entry.primary.currentUserRole === filter);

  // Only INDIVIDUAL + ACTIVE mentor relationships are eligible for grouping
  const groupEligible = relationships.filter(
    (entry) =>
      entry.primary.currentUserRole === 'MENTOR' &&
      entry.primary.relationshipStatus === 'ACTIVE' &&
      entry.primary.memberStatus === 'ACTIVE' &&
      entry.primary.requestType === 'INDIVIDUAL'
  );
  const showGroupCheckboxes = filter === 'MENTOR' && groupEligible.length >= 2;

  const toggleGroupSelect = (relationshipId: number) => {
    setSelectedForGroup((prev) => {
      const next = new Set(prev);
      if (next.has(relationshipId)) {
        next.delete(relationshipId);
      } else {
        next.add(relationshipId);
      }
      return next;
    });
  };

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
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div role="group" aria-label="Filter pairings" style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              {filters.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`apid-btn apid-btn-sm ${filter === option.value ? 'apid-btn-primary' : 'apid-btn-outline'}`}
                  aria-pressed={filter === option.value}
                  onClick={() => {
                    setFilter(option.value);
                    setSelectedForGroup(new Set());
                  }}
                >
                  {option.label} <span style={{ opacity: 0.8 }}>({option.count})</span>
                </button>
              ))}
            </div>
            {showGroupCheckboxes && selectedForGroup.size >= 2 && (
              <button
                type="button"
                className="apid-btn apid-btn-primary apid-btn-sm"
                disabled={createGroupMutation.isPending}
                onClick={() => createGroupMutation.mutate(Array.from(selectedForGroup))}
              >
                <Users size={14} />
                {createGroupMutation.isPending
                  ? 'Creating Cohort…'
                  : `Create Group Cohort (${selectedForGroup.size})`}
              </button>
            )}
            {showGroupCheckboxes && selectedForGroup.size < 2 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <CheckSquare size={13} /> Select 2+ individual pairings to group
              </span>
            )}
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
            {visibleRelationships.map(({ primary: item, members }) => {
              const isMentor = item.currentUserRole === 'MENTOR';
              const isGroup = item.requestType === 'GROUP';
              const traineeNames = members.map((m) => m.traineeName).join(', ');
              const counterpartName = isGroup
                ? isMentor
                  ? `Group Cohort (${members.length} trainees): ${traineeNames}`
                  : `${item.mentorName} (Group Cohort)`
                : isMentor
                  ? item.traineeName
                  : item.mentorName;
              const displayStatus =
                item.relationshipStatus === 'ACTIVE'
                  ? isGroup
                    ? members.some((m) => m.memberStatus === 'ACTIVE')
                      ? 'ACTIVE'
                      : item.memberStatus
                    : item.memberStatus
                  : item.relationshipStatus;
              const isGroupEligible =
                isMentor &&
                item.requestType === 'INDIVIDUAL' &&
                item.relationshipStatus === 'ACTIVE' &&
                item.memberStatus === 'ACTIVE';
              const isChecked = selectedForGroup.has(item.relationshipId);
              return (
                <article key={item.relationshipId} className="mentoring-pairing-row">
                  <div className="mentoring-pairing-row__main">
                    {showGroupCheckboxes && isGroupEligible && (
                      <input
                        type="checkbox"
                        aria-label={`Select ${counterpartName} for group cohort`}
                        checked={isChecked}
                        onChange={() => toggleGroupSelect(item.relationshipId)}
                        style={{ width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer' }}
                      />
                    )}
                    <span className="mentoring-dashboard__icon" aria-hidden="true">
                      {isGroup ? <Users size={20} /> : isMentor ? <GraduationCap size={20} /> : <HeartHandshake size={20} />}
                    </span>
                    <div className="mentoring-pairing-row__details">
                      <h3 style={{ margin: 0, overflowWrap: 'anywhere' }}>{counterpartName}</h3>
                      <p className="mentoring-pairing-row__meta">
                        {isMentor ? 'You are the mentor' : 'Your mentor'} · {isGroup ? 'Group pairing' : 'One-to-one'}
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
                    {item.currentUserRole === 'MENTOR' && item.requestType === 'GROUP' && item.relationshipStatus === 'ACTIVE' && (
                      <button
                        type="button"
                        className="apid-btn apid-btn-outline apid-btn-sm"
                        style={{ color: 'var(--color-err, #dc2626)', borderColor: 'var(--color-err, #dc2626)' }}
                        disabled={disbandGroupMutation.isPending}
                        onClick={() => {
                          if (window.confirm('Disband this group? All original 1-on-1 pairings will be restored.')) {
                            disbandGroupMutation.mutate(item.relationshipId);
                          }
                        }}
                      >
                        Disband Group
                      </button>
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
