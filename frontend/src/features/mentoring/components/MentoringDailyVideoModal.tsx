import React from 'react';
import { MentoringSession, mentoringPairingApi } from '../api/mentoringPairingApi';
import { LiveKitVideoModal } from '../../../shared/components/video/LiveKitVideoModal';

export interface MentoringDailyVideoModalProps {
  session: MentoringSession | null;
  isOpen: boolean;
  onClose: () => void;
  relationshipId?: number;
  traineeName?: string;
  mentorName?: string;
}

export const MentoringDailyVideoModal: React.FC<MentoringDailyVideoModalProps> = ({
  session,
  isOpen,
  onClose,
  relationshipId,
}) => {
  const effectiveRelId = relationshipId || session?.relationshipId;

  if (!session || !effectiveRelId) return null;

  return (
    <LiveKitVideoModal
      isOpen={isOpen}
      onClose={onClose}
      title={session.title}
      participantCount={2}
      fetchToken={() => mentoringPairingApi.getJoinToken(effectiveRelId, session.id)}
      moduleContext="MENTORING"
    />
  );
};

// Also export alias as LiveKitMentoringVideoModal
export const LiveKitMentoringVideoModal = MentoringDailyVideoModal;
