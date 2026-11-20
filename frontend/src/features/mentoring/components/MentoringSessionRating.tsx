import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { useAuth } from '../../../app/AuthContext';
import { extractApiErrorMessage } from '../../../shared/api/apiClient';
import { ErrorState, useToast } from '../../../shared/components/ui';
import { mentoringPairingApi } from '../api/mentoringPairingApi';

interface MentoringSessionRatingProps {
  relationshipId: number;
  sessionId: number;
  isMentee: boolean;
  isCompleted: boolean;
}

export function MentoringSessionRating({
  relationshipId,
  sessionId,
  isMentee,
  isCompleted,
}: MentoringSessionRatingProps) {
  const [selectedRating, setSelectedRating] = useState(0);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const ratingQueryKey = ['mentoring', 'session-rating', user?.id, relationshipId, sessionId];
  const ratingQuery = useQuery({
    queryKey: ratingQueryKey,
    queryFn: () => mentoringPairingApi.getMySessionRating(relationshipId, sessionId),
    enabled: isMentee && isCompleted && user != null,
  });
  const ratingMutation = useMutation({
    mutationFn: () =>
      mentoringPairingApi.submitSessionRating(relationshipId, sessionId, selectedRating),
    onSuccess: (rating) => {
      queryClient.setQueryData(
        ratingQueryKey,
        rating
      );
      pushToast({
        title: 'Rating submitted',
        message: 'Your individual rating is private and is not shared with your mentor.',
        tone: 'ok',
      });
    },
    onError: (error: unknown) => pushToast({
      title: 'Unable to submit rating',
      message: extractApiErrorMessage(error, 'Please try again.'),
      tone: 'err',
    }),
  });

  if (!isMentee || !isCompleted) return null;
  if (ratingQuery.isLoading) {
    return <p className="boa-muted" role="status">Loading your private session rating...</p>;
  }
  if (ratingQuery.isError) {
    return (
      <ErrorState
        message={extractApiErrorMessage(ratingQuery.error, 'Unable to load your session rating.')}
        onRetry={() => void ratingQuery.refetch()}
      />
    );
  }

  if (ratingQuery.data) {
    return (
      <section className="apid-card" aria-label="Your private session rating">
        <strong>Your rating: {ratingQuery.data.rating}/5</strong>
        <p className="boa-muted" style={{ margin: '0.35rem 0 0' }}>
          Your individual rating is private. Mentors only see an average after five unique sessions have ratings.
        </p>
      </section>
    );
  }

  return (
    <section className="apid-card boa-stack" aria-labelledby={`session-rating-title-${sessionId}`}>
      <div>
        <h3 id={`session-rating-title-${sessionId}`} style={{ margin: 0 }}>Rate this session</h3>
        <p className="boa-muted" style={{ margin: '0.3rem 0 0' }}>
          Your individual rating is private. A mentor only sees an average after five unique sessions have ratings.
        </p>
      </div>
      <div role="group" aria-label="Rate this session from 1 to 5" style={{ display: 'flex', gap: '0.4rem' }}>
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            className="apid-btn apid-btn-sm"
            aria-label={`${rating} out of 5`}
            aria-pressed={selectedRating === rating}
            onClick={() => setSelectedRating(rating)}
          >
            <Star size={16} fill={selectedRating >= rating ? 'currentColor' : 'none'} />
            {rating}
          </button>
        ))}
      </div>
      <div>
        <button
          type="button"
          className="apid-btn apid-btn-primary apid-btn-sm"
          disabled={selectedRating === 0 || ratingMutation.isPending}
          onClick={() => ratingMutation.mutate()}
        >
          {ratingMutation.isPending ? 'Submitting...' : 'Submit rating'}
        </button>
      </div>
    </section>
  );
}
