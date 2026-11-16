import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, MessageSquare, Search, Users } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import { EMPLOYEE_WORKSPACE_PERMISSIONS } from '../../../shared/auth/workspaceResolver';
import {
  AvatarBadge,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  StatusPill,
} from '../../../shared/components/ui';
import { mentoringPairingApi, type MentoringRelationshipPair } from '../api/mentoringPairingApi';
import { MentoringPairChatPanel } from '../components/MentoringPairChatPanel';
import { MentoringResourcesPanel } from '../components/MentoringCollaborationTools';
import { MentoringChatHub } from '../components/MentoringChatHub';
import './MentoringCollaborationPage.css';

type CollaborationMode = 'chat' | 'resources';

interface PairingOption {
  relationshipId: number;
  requestType: MentoringRelationshipPair['requestType'];
  relationshipStatus: MentoringRelationshipPair['relationshipStatus'];
  memberStatus: MentoringRelationshipPair['memberStatus'];
  currentUserRole: MentoringRelationshipPair['currentUserRole'];
  mentorName: string;
  traineeNames: string[];
  skillName: string | null;
}

function getPairingOptions(relationships: MentoringRelationshipPair[]): PairingOption[] {
  const pairings = new Map<number, PairingOption>();

  relationships.forEach((relationship) => {
    const existing = pairings.get(relationship.relationshipId);
    if (existing) {
      if (!existing.traineeNames.includes(relationship.traineeName)) {
        existing.traineeNames.push(relationship.traineeName);
      }
      return;
    }

    pairings.set(relationship.relationshipId, {
      relationshipId: relationship.relationshipId,
      requestType: relationship.requestType,
      relationshipStatus: relationship.relationshipStatus,
      memberStatus: relationship.memberStatus,
      currentUserRole: relationship.currentUserRole,
      mentorName: relationship.mentorName,
      traineeNames: [relationship.traineeName],
      skillName: relationship.skillName,
    });
  });

  return [...pairings.values()];
}

export function MentoringCollaborationPage({ mode }: { mode: CollaborationMode }) {
  const { user, hasAnyPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const isChat = mode === 'chat';
  const requestedRelationshipId = searchParams.get('relationshipId')
    ? Number(searchParams.get('relationshipId'))
    : null;

  if (isChat) {
    return (
      <div className="boa-stack mentoring-hub mentoring-hub--chat">
        <PageHeader
          title="Mentoring Chat"
          subtitle="Collaborate with your mentors, cohort class groups, and fellow trainees."
          source="live"
        />
        <MentoringChatHub
          currentUserId={user?.id}
          initialRelationshipId={requestedRelationshipId}
        />
      </div>
    );
  }

  const relationshipsQuery = useQuery({
    queryKey: ['mentoring', 'pairing', 'relationships', user?.id],
    queryFn: mentoringPairingApi.listMyRelationships,
    enabled: hasAnyPermission(EMPLOYEE_WORKSPACE_PERMISSIONS),
  });

  const pairings = useMemo(
    () => getPairingOptions(relationshipsQuery.data ?? []),
    [relationshipsQuery.data]
  );
  const selectedPairing =
    pairings.find((pairing) => pairing.relationshipId === requestedRelationshipId) ?? pairings[0];
  const filteredPairings = pairings.filter((pairing) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [
      pairing.mentorName,
      ...pairing.traineeNames,
      pairing.skillName ?? '',
      pairing.requestType,
    ].some((value) => value.toLowerCase().includes(query));
  });

  const selectPairing = (relationshipId: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('relationshipId', String(relationshipId));
    setSearchParams(nextParams);
  };

  if (relationshipsQuery.isLoading) {
    return <LoadingSkeleton rows={6} height={28} />;
  }
  if (relationshipsQuery.isError) {
    return (
      <ErrorState
        message="Unable to load your mentoring relationships."
        onRetry={() => void relationshipsQuery.refetch()}
      />
    );
  }

  const pageTitle = isChat ? 'Mentoring Chat' : 'Shared Resources';
  const pageSubtitle = isChat
    ? 'Keep conversations with your mentoring pairs in one place.'
    : 'Browse and share learning materials with your mentoring pairs.';

  return (
    <div className={`boa-stack mentoring-hub mentoring-hub--${mode}`}>
      <PageHeader title={pageTitle} subtitle={pageSubtitle} source="live" />

      {pairings.length === 0 ? (
        <section className="apid-card">
          <EmptyState
            title={isChat ? 'No mentoring conversations yet' : 'No mentoring resources yet'}
            description="Once you join a mentoring relationship, its conversation and shared materials will appear here."
            icon={isChat ? <MessageSquare size={34} /> : <BookOpen size={34} />}
            action={
              <Link to="/mentoring?view=directory" className="apid-btn apid-btn-primary apid-btn-sm">
                Find a Mentor
              </Link>
            }
          />
        </section>
      ) : (
        <div className="mentoring-hub__layout">
          <aside className="apid-card mentoring-hub__sidebar" aria-label="Mentoring relationships">
            <div className="mentoring-hub__sidebar-heading">
              <div>
                <h2 className="boa-card-title">{isChat ? 'Conversations' : 'Pair resources'}</h2>
                <p className="boa-card-subtitle">{pairings.length} mentoring relationship{pairings.length === 1 ? '' : 's'}</p>
              </div>
              <span className="mentoring-hub__count">{pairings.length}</span>
            </div>
            <label className="mentoring-hub__search">
              <Search size={16} aria-hidden="true" />
              <input
                className="apid-input"
                aria-label="Search mentoring relationships"
                placeholder="Search people or skills"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <div className="mentoring-hub__pair-list">
              {filteredPairings.length === 0 ? (
                <p className="boa-muted mentoring-hub__no-results">No relationships match your search.</p>
              ) : (
                filteredPairings.map((pairing) => {
                  const displayName =
                    pairing.currentUserRole === 'MENTOR'
                      ? pairing.traineeNames.join(', ')
                      : pairing.mentorName;
                  const isSelected = pairing.relationshipId === selectedPairing?.relationshipId;

                  return (
                    <button
                      key={pairing.relationshipId}
                      type="button"
                      className={`mentoring-hub__pair ${isSelected ? 'is-selected' : ''}`}
                      aria-current={isSelected ? 'true' : undefined}
                      onClick={() => selectPairing(pairing.relationshipId)}
                    >
                      <AvatarBadge name={displayName} size={42} />
                      <span className="mentoring-hub__pair-copy">
                        <strong>{displayName}</strong>
                        <span>
                          {pairing.requestType === 'GROUP' ? 'Group mentoring' : `You are the ${pairing.currentUserRole.toLowerCase()}`}
                        </span>
                        {pairing.skillName && <span className="mentoring-hub__skill">{pairing.skillName}</span>}
                      </span>
                      <span className="mentoring-hub__pair-status" aria-label={pairing.relationshipStatus}>
                        <span className={`mentoring-hub__status-dot is-${pairing.relationshipStatus.toLowerCase()}`} />
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <main className="mentoring-hub__main">
            {!selectedPairing ? (
              <section className="apid-card">
                <EmptyState
                  title="No relationship selected"
                  description="Choose one of your mentoring relationships to continue."
                  icon={<Users size={34} />}
                />
              </section>
            ) : isChat ? (
              <MentoringPairChatPanel relationshipId={selectedPairing.relationshipId} />
            ) : (
              <section className="apid-card mentoring-hub__resource-panel">
                <div className="mentoring-hub__resource-heading">
                  <AvatarBadge
                    name={selectedPairing.currentUserRole === 'MENTOR'
                      ? selectedPairing.traineeNames.join(', ')
                      : selectedPairing.mentorName}
                    size={46}
                  />
                  <div>
                    <h2 className="boa-card-title">
                      {selectedPairing.requestType === 'GROUP' ? 'Group mentoring resources' : 'Pair resources'}
                    </h2>
                    <p className="boa-card-subtitle">
                      Mentor: {selectedPairing.mentorName}
                      {selectedPairing.skillName ? ` · ${selectedPairing.skillName}` : ''}
                    </p>
                  </div>
                  <StatusPill
                    label={selectedPairing.relationshipStatus}
                    tone={selectedPairing.relationshipStatus === 'ACTIVE' ? 'ok' : 'neutral'}
                  />
                </div>
                <MentoringResourcesPanel
                  relationshipId={selectedPairing.relationshipId}
                  canAdd={
                    selectedPairing.relationshipStatus === 'ACTIVE' &&
                    (selectedPairing.currentUserRole === 'MENTOR' ||
                      selectedPairing.memberStatus === 'ACTIVE')
                  }
                />
              </section>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

export function MentoringChatPage() {
  return <MentoringCollaborationPage mode="chat" />;
}

export function MentoringResourcesPage() {
  return <MentoringCollaborationPage mode="resources" />;
}
