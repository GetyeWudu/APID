import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star, Users, CheckCircle2, Loader2, Trophy } from 'lucide-react';
import { pmsReportApi } from '../../api/pmsReportApi';

interface TopRatedCoachesCardProps {
  quarterId: number;
  onFilterCoach?: (coachName: string) => void;
}

export const TopRatedCoachesCard: React.FC<TopRatedCoachesCardProps> = ({
  quarterId,
  onFilterCoach,
}) => {
  const { data: coaches = [], isLoading } = useQuery({
    queryKey: ['top-rated-coaches', quarterId],
    queryFn: () => pmsReportApi.getTopCoaches(quarterId),
    staleTime: 5_000,
  });

  const ratedCoaches = coaches.filter(
    (c) => c.averageRating !== null && c.averageRating > 0 && c.totalRatings > 0
  );

  const getBadgeStyle = (badge: string) => {
    switch (badge) {
      case 'MASTER COACH':
        return { bg: '#fef3c7', text: '#92400e', border: '#fcd34d', label: 'Master Coach' };
      case 'EXCELLENCE':
        return { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0', label: 'Excellence' };
      case 'COMMENDED':
        return { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe', label: 'Commended' };
      default:
        return { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0', label: 'Developing' };
    }
  };

  const getRankBadgeStyle = (idx: number) => {
    switch (idx) {
      case 0:
        return { bg: '#f59e0b', text: '#ffffff' }; // Gold
      case 1:
        return { bg: '#64748b', text: '#ffffff' }; // Silver
      case 2:
        return { bg: '#d97706', text: '#ffffff' }; // Bronze
      default:
        return { bg: 'var(--surface-subtle)', text: 'var(--muted)' };
    }
  };

  return (
    <div className="apid-card p-4" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              backgroundColor: 'rgba(202, 138, 4, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#b45309',
            }}
          >
            <Trophy size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)' }}>
              Top-Rated Performance Coaches
            </h4>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
              Ranked by Coachee Post-Session Satisfaction &amp; Evaluation Ratings
            </span>
          </div>
        </div>

        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', background: 'var(--surface-subtle)', padding: '0.2rem 0.55rem', borderRadius: '999px', border: '1px solid var(--border)' }}>
          FY 2026/27 · Q2 Leaderboard
        </span>
      </div>

      {isLoading ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>
          <Loader2 size={16} className="spin" style={{ display: 'inline-block', marginRight: '0.4rem' }} />
          Calculating coach ratings and coachee feedback...
        </div>
      ) : ratedCoaches.length === 0 ? (
        <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.78rem', background: 'var(--surface-subtle)', borderRadius: '8px' }}>
          No rated sessions logged yet this quarter. Coachee evaluations will populate here as sessions conclude.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {ratedCoaches.slice(0, 6).map((c, idx) => {
            const badge = getBadgeStyle(c.excellenceBadge);
            const rankBadge = getRankBadgeStyle(idx);
            const hasRating = c.averageRating !== null && c.averageRating > 0;

            return (
              <div
                key={c.coachEmployeeId}
                style={{
                  padding: '0.85rem',
                  borderRadius: '10px',
                  border: idx === 0 && hasRating ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                  backgroundColor: 'var(--surface)',
                  boxShadow: 'var(--shadow-card)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  transition: 'all 0.15s ease',
                  cursor: onFilterCoach ? 'pointer' : 'default',
                }}
                onClick={() => onFilterCoach && onFilterCoach(c.coachName)}
                title={onFilterCoach ? `Filter coachees assigned to ${c.coachName}` : undefined}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 20,
                          height: 20,
                          borderRadius: '999px',
                          backgroundColor: rankBadge.bg,
                          color: rankBadge.text,
                          fontSize: '0.7rem',
                          fontWeight: 800,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--text)' }}>
                        {c.coachName}
                      </strong>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                      {c.coachStaffId} · {c.department.replace(' Branch Operations', '')}
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '999px',
                      backgroundColor: badge.bg,
                      color: badge.text,
                      border: `1px solid ${badge.border}`,
                    }}
                  >
                    {badge.label}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.4rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Star
                      size={14}
                      style={{
                        color: hasRating ? '#f59e0b' : '#94a3b8',
                        fill: hasRating ? '#f59e0b' : 'none',
                      }}
                    />
                    <strong style={{ fontSize: '0.85rem', color: hasRating ? '#b45309' : 'var(--muted)' }}>
                      {hasRating ? c.averageRating!.toFixed(2) : '—'}
                    </strong>
                    <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>
                      ({c.totalRatings} {c.totalRatings === 1 ? 'rating' : 'ratings'})
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'var(--muted)', fontSize: '0.72rem' }}>
                    <span title="Completed Sessions">
                      <CheckCircle2 size={12} style={{ display: 'inline', marginRight: '0.2rem', color: 'var(--ok, #10b981)' }} />
                      {c.completedSessions}
                    </span>
                    <span title="Assigned Coachees">
                      <Users size={12} style={{ display: 'inline', marginRight: '0.2rem' }} />
                      {c.activeCoachees}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
