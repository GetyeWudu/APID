import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Loader2, ShieldAlert, Filter } from 'lucide-react';
import { pmsReportApi } from '../../api/pmsReportApi';
import { useToast } from '../../../../shared/components/ui';

interface MidQuarterInactivityAlertProps {
  quarterId: number;
  onFilterStalledOnly?: () => void;
  isStalledFilterActive?: boolean;
}

export const MidQuarterInactivityAlert: React.FC<MidQuarterInactivityAlertProps> = ({
  quarterId,
  onFilterStalledOnly,
  isStalledFilterActive = false,
}) => {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const { data: stalledItems = [], isLoading } = useQuery({
    queryKey: ['midquarter-inactivity', quarterId],
    queryFn: () => pmsReportApi.getMidQuarterInactivity(quarterId),
    staleTime: 60_000,
  });

  const notifyMutation = useMutation({
    mutationFn: () => pmsReportApi.notifyAllStalledCoaches(quarterId),
    onSuccess: (data) => {
      pushToast({
        title: 'Mid-Quarter Nudges Dispatched',
        message: `Successfully notified ${data.notificationsDispatched} coaches to initiate sessions immediately.`,
        tone: 'ok',
      });
      queryClient.invalidateQueries({ queryKey: ['midquarter-inactivity'] });
    },
    onError: (err) => {
      console.error('Failed to dispatch mid-quarter notifications', err);
      pushToast({
        title: 'Dispatch Failed',
        message: 'Could not dispatch notifications to stalled coaches.',
        tone: 'err',
      });
    },
  });

  if (isLoading || stalledItems.length === 0) return null;

  const criticalStallCount = stalledItems.filter((i) => i.severity === 'CRITICAL_STALL').length;
  const elapsedWeeks = stalledItems[0]?.elapsedWeeks || 8;

  return (
    <div
      style={{
        padding: '1rem 1.25rem',
        borderRadius: '12px',
        backgroundColor: '#fef2f2',
        border: '1.5px solid #fecaca',
        marginBottom: '1rem',
        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
      className="dark:bg-red-950/25 dark:border-red-900/50"
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#dc2626',
              flexShrink: 0,
              marginTop: '0.1rem',
            }}
          >
            <ShieldAlert size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#991b1b' }} className="dark:text-red-400">
                Mid-Quarter Coaching Rhythm Inactivity Alert
              </h4>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '0.1rem 0.5rem',
                  borderRadius: '999px',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  border: '1px solid #fca5a5',
                }}
              >
                Week {elapsedWeeks} Gate Check
              </span>
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#7f1d1d', lineHeight: 1.45 }} className="dark:text-red-300">
              <strong>{criticalStallCount} Coaches</strong> have completed <strong>0 of 10 mandatory sessions</strong> past the mid-quarter checkpoint. Standard Bank of Abyssinia governance policy mandates immediate executive escalation.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {onFilterStalledOnly && (
            <button
              type="button"
              onClick={onFilterStalledOnly}
              className="apid-btn apid-btn-outline apid-btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
                borderColor: isStalledFilterActive ? '#b91c1c' : '#f87171',
                backgroundColor: isStalledFilterActive ? '#b91c1c' : '#ffffff',
                color: isStalledFilterActive ? '#ffffff' : '#991b1b',
                cursor: 'pointer',
              }}
            >
              <Filter size={13} />
              <span>{isStalledFilterActive ? 'Showing Stalled (Active)' : `Filter Stalled (${criticalStallCount})`}</span>
            </button>
          )}

          <button
            type="button"
            disabled={notifyMutation.isPending}
            onClick={() => notifyMutation.mutate()}
            className="apid-btn apid-btn-primary apid-btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.4rem 0.85rem',
              borderRadius: '8px',
              backgroundColor: '#dc2626',
              borderColor: '#b91c1c',
              color: '#ffffff',
              cursor: notifyMutation.isPending ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
            }}
            title="Dispatch high-priority automated in-app and email notices to all coaches who have not started sessions"
          >
            {notifyMutation.isPending ? (
              <Loader2 size={13} className="spin" />
            ) : (
              <Send size={13} />
            )}
            <span>{notifyMutation.isPending ? 'Dispatching...' : 'Dispatch Mid-Quarter Nudges'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
