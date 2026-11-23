import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ConversationSummaryDto } from '../features/coaching/api/coachingCommunicationApi';
import { MentoringConversationListSidebar } from '../features/mentoring/components/MentoringConversationListSidebar';

const conversations: ConversationSummaryDto[] = [
  {
    id: 1,
    conversationType: 'DIRECT',
    contextType: 'MENTORING_RELATIONSHIP_DIRECT',
    title: 'Alex and Sam',
    skillId: 10,
    skillName: 'Java',
    status: 'ACTIVE',
    unreadCount: 0,
    participants: [],
    pinnedMessages: [],
  },
  {
    id: 2,
    conversationType: 'DIRECT',
    contextType: 'MENTORING_PEER_DIRECT',
    title: 'Taylor and Jordan',
    skillId: 20,
    skillName: 'Leadership',
    status: 'ACTIVE',
    unreadCount: 0,
    participants: [],
    pinnedMessages: [],
  },
];

describe('Mentoring chat skills', () => {
  it('shows each conversation skill and filters conversations by skill', () => {
    render(
      <MentoringConversationListSidebar
        conversations={conversations}
        activeConversationId={null}
        filterContext="ALL"
        onFilterChange={vi.fn()}
        onSelectConversation={vi.fn()}
        onOpenPeerModal={vi.fn()}
      />
    );

    expect(screen.getByText('Skill: Java')).toBeInTheDocument();
    expect(screen.getByText('Skill: Leadership')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Filter conversations...'), {
      target: { value: 'java' },
    });

    expect(screen.getByText('Alex and Sam')).toBeInTheDocument();
    expect(screen.queryByText('Taylor and Jordan')).not.toBeInTheDocument();
  });
});
