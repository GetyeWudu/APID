import React from 'react';
import { CoachingSessionItem, coachingSessionApi } from '../api/coachingSessionApi';
import { LiveKitVideoModal } from '../../../shared/components/video/LiveKitVideoModal';

export interface DailyVideoModalProps {
  session: CoachingSessionItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DailyVideoModal: React.FC<DailyVideoModalProps> = ({
  session,
  isOpen,
  onClose,
}) => {
  if (!session) return null;

  return (
    <LiveKitVideoModal
      isOpen={isOpen}
      onClose={onClose}
      title={session.title}
      participantCount={session.participants?.length || 2}
      fetchToken={() => coachingSessionApi.getJoinToken(session.id)}
      moduleContext="COACHING"
      aiSummarizationEnabled={session.aiSummarizationEnabled !== false}
    />
  );
};

// Also export alias as LiveKitCoachingVideoModal
export const LiveKitCoachingVideoModal = DailyVideoModal;
