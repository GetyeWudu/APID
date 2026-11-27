import { useRef, useState } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Search, Sparkles, X, Star, Users, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import { EmptyState, StatusPill, useToast } from '../../../shared/components/ui';
import type { MentoringMatchRequest } from '../api/mentoringMatchApi';
import { mentoringMatchApi } from '../api/mentoringMatchApi';
import type { TrainerRosterItem } from '../api/mentoringTrainerApi';
import { mentorDirectoryApi, type MentorRecommendation } from '../api/mentorDirectoryApi';
import {
  filterByOrganizationLocation,
  OrganizationLocationFilter,
} from './OrganizationLocationFilter';
import './HrMatchingTab.css';

function formatRequestDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function MatchRequestDetails({
  request,
  matchedTrainerName,
}: {
  request: MentoringMatchRequest;
  matchedTrainerName?: string | null;
}) {
  const location = request.organizationPath?.map((item) => item.name).join(' / ')
    || request.departmentName
    || 'Location not provided';

  return (
    <dl className="hr-match-detail-grid">
      <div className="hr-match-detail">
        <dt>Request received</dt>
        <dd>{formatRequestDate(request.createdAt)}</dd>
      </div>
      <div className="hr-match-detail">
        <dt>Branch / location</dt>
        <dd>{location}</dd>
      </div>
      <div className="hr-match-detail">
        <dt>Requested skill</dt>
        <dd>{request.skillName}</dd>
      </div>
      {matchedTrainerName !== undefined && (
        <div className="hr-match-detail hr-match-detail--mentor">
          <dt>Matched mentor</dt>
          <dd>{matchedTrainerName || 'Mentor name unavailable'}</dd>
        </div>
      )}
    </dl>
  );
}

function getEligibleTrainers(request: MentoringMatchRequest, trainers: TrainerRosterItem[]) {
  return trainers.filter((trainer) =>
    trainer.userId !== null &&
    trainer.status === 'ACTIVE' &&
    trainer.acceptingNewPairings !== false &&
    trainer.employmentStatus === 'ACTIVE' &&
    trainer.skills.some((skill) =>
      skill.id === request.skillId
      && (skill.status === undefined ? trainer.status === 'ACTIVE' : skill.status === 'ACTIVE')
    )
  );
}

type MatchRequestTab = 'all' | 'requested' | 'completed' | 'no-available-mentor';

export function HrMatchingTab({
  requests,
  trainers,
}: {
  requests: MentoringMatchRequest[];
  trainers: TrainerRosterItem[];
}) {
  const [selectedTrainers, setSelectedTrainers] = useState<Record<number, string>>({});
  const [capacityOverrides, setCapacityOverrides] = useState<Record<number, boolean>>({});
  const [overrideReasons, setOverrideReasons] = useState<Record<number, string>>({});

  // AI Recommendation state
  const [aiRecs, setAiRecs] = useState<Record<number, MentorRecommendation[]>>({});
  const [aiOpen, setAiOpen] = useState<Record<number, boolean>>({});
  const [aiLoading, setAiLoading] = useState<number | null>(null);
  const [aiError, setAiError] = useState<Record<number, string>>({});

  const [selectedReassignmentTrainers, setSelectedReassignmentTrainers] = useState<Record<number, string>>({});
  const [locationFilter, setLocationFilter] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [activeRequestTab, setActiveRequestTab] = useState<MatchRequestTab>('all');
  const requestTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [reassignmentReasons, setReassignmentReasons] = useState<Record<number, string>>({});
  const [reassignmentCapacityOverrides, setReassignmentCapacityOverrides] = useState<Record<number, boolean>>({});
  const [reassignmentOverrideReasons, setReassignmentOverrideReasons] = useState<Record<number, string>>({});
  const [reassignmentSkillOverrideReasons, setReassignmentSkillOverrideReasons] = useState<Record<number, string>>({});
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const fetchAiRecs = async (requestId: number, skillId: number) => {
    setAiLoading(requestId);
    setAiError((prev) => { const n = { ...prev }; delete n[requestId]; return n; });
    try {
      const result = await mentorDirectoryApi.recommendExactSkillMentorsForHr(requestId);
      const exactSkillRecommendations = result.recommendations.filter((recommendation) =>
        recommendation.skillId === skillId
        && recommendation.mentor.skills.some((skill) => skill.id === skillId)
      );
      setAiRecs((prev) => ({ ...prev, [requestId]: exactSkillRecommendations }));
      setAiOpen((prev) => ({ ...prev, [requestId]: true }));
    } catch (err) {
      const msg = axios.isAxiosError<ApiErrorPayload>(err)
        ? (err.response?.data?.message ?? err.message)
        : 'AI recommendation failed.';
      setAiError((prev) => ({ ...prev, [requestId]: msg }));
    } finally {
      setAiLoading(null);
    }
  };

  const reassignmentQueue = useQuery({
    queryKey: ['mentoring', 'hr-reassignment-queue'],
    queryFn: mentoringMatchApi.listReassignmentQueue,
  });
  const matchMutation = useMutation({
    mutationFn: (input: {
      requestId: number;
      trainerUserId: number;
      overrideCapacity?: boolean;
      overrideReason?: string;
    }) => mentoringMatchApi.match(input.requestId, input),
    onSuccess: async (request) => {
      setAiRecs((previous) => {
        const next = { ...previous };
        delete next[request.id];
        return next;
      });
      setAiOpen((previous) => {
        const next = { ...previous };
        delete next[request.id];
        return next;
      });
      setAiError((previous) => {
        const next = { ...previous };
        delete next[request.id];
        return next;
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'hr-match-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'hr-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'trainers'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'relationships'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'requests'] }),
      ]);
      pushToast({
        title: 'Trainee matched',
        message: `${request.traineeName} is now paired with an authorized mentor.`,
        tone: 'ok',
      });
    },
    onError: (error: unknown) => {
      const message = axios.isAxiosError<ApiErrorPayload>(error)
        ? error.response?.data?.message ?? error.message
        : error instanceof Error ? error.message : 'Unable to match the trainee.';
      pushToast({ title: 'Matching failed', message, tone: 'err' });
    },
  });
  const reassignMutation = useMutation({
    mutationFn: (input: {
      relationshipId: number;
      trainerUserId: number;
      reason: string;
      overrideCapacity?: boolean;
      overrideReason?: string;
      skillOverrideReason?: string;
    }) => mentoringMatchApi.reassign(input.relationshipId, input),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'hr-reassignment-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'hr-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'trainers'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'relationships'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'requests'] }),
      ]);
      pushToast({
        title: 'Relationship reassigned',
        message: `${result.reassignedTrainees} trainee(s) were matched with ${result.trainerName}.`,
        tone: 'ok',
      });
    },
    onError: (error: unknown) => {
      const message = axios.isAxiosError<ApiErrorPayload>(error)
        ? error.response?.data?.message ?? error.message
        : error instanceof Error ? error.message : 'Unable to reassign the relationship.';
      pushToast({ title: 'Reassignment failed', message, tone: 'err' });
    },
  });

  const normalizedNameSearch = nameSearch.trim().toLocaleLowerCase();
  const locationRequests = requests.filter((request) => request.status !== 'CANCELLED');
  const matchingRequests = filterByOrganizationLocation(
    locationRequests.filter((request) =>
      request.traineeName.toLocaleLowerCase().includes(normalizedNameSearch)
    ),
    locationFilter
  );
  const requestedRequests = matchingRequests.filter((request) => request.status === 'OPEN');
  const completedMatches = matchingRequests.filter((request) => request.status === 'MATCHED');
  const noAvailableMentorRequests = requestedRequests.filter((request) =>
    !getEligibleTrainers(request, trainers).some((trainer) =>
      trainer.activeTrainees + trainer.pendingTrainees < trainer.maxConcurrentTrainees
    )
  );
  const matchRequestTabs: Array<{ id: MatchRequestTab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: matchingRequests.length },
    { id: 'requested', label: 'Requested', count: requestedRequests.length },
    { id: 'completed', label: 'Completed', count: completedMatches.length },
    { id: 'no-available-mentor', label: 'No available mentor', count: noAvailableMentorRequests.length },
  ];
  const displayedRequests = activeRequestTab === 'all'
    ? matchingRequests
    : activeRequestTab === 'requested'
      ? requestedRequests
      : activeRequestTab === 'completed'
        ? completedMatches
        : noAvailableMentorRequests;
  const openRequests = displayedRequests.filter((request) => request.status === 'OPEN');
  const completedRequests = displayedRequests.filter((request) => request.status === 'MATCHED');

  return (
    <div className="boa-stack">
      <div className="apid-card">
        <div className="boa-card-header">
          <div>
            <h3 className="boa-card-title">Trainee–Trainer Match Requests</h3>
            <p className="boa-card-subtitle">
              Requests and trainer capacity are live. Matching creates an active mentoring relationship and notifies both participants.
            </p>
          </div>
        </div>
        <div className="hr-match-tabs" role="tablist" aria-label="Match request status">
          {matchRequestTabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={(element) => { requestTabRefs.current[index] = element; }}
              id={`hr-match-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeRequestTab === tab.id}
              aria-controls="hr-match-results"
              tabIndex={activeRequestTab === tab.id ? 0 : -1}
              className="hr-match-tab"
              onClick={() => setActiveRequestTab(tab.id)}
              onKeyDown={(event) => {
                let nextIndex = index;
                if (event.key === 'ArrowRight') nextIndex = (index + 1) % matchRequestTabs.length;
                else if (event.key === 'ArrowLeft') {
                  nextIndex = (index - 1 + matchRequestTabs.length) % matchRequestTabs.length;
                } else if (event.key === 'Home') nextIndex = 0;
                else if (event.key === 'End') nextIndex = matchRequestTabs.length - 1;
                else return;

                event.preventDefault();
                setActiveRequestTab(matchRequestTabs[nextIndex].id);
                requestTabRefs.current[nextIndex]?.focus();
              }}
            >
              <span>{tab.label}</span>
              <span className="hr-match-tab__count">{tab.count}</span>
            </button>
          ))}
        </div>
        <div className="hr-match-filters">
          <label className="hr-match-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              className="apid-input"
              aria-label="Search requests by trainee name"
              placeholder="Search trainee name"
              value={nameSearch}
              onChange={(event) => setNameSearch(event.target.value)}
            />
          </label>
          {locationRequests.length > 0 && (
            <OrganizationLocationFilter
              paths={locationRequests.map((request) => request.organizationPath ?? [])}
              value={locationFilter}
              onChange={setLocationFilter}
            />
          )}
        </div>
        <div
          className="hr-match-list"
          id="hr-match-results"
          role="tabpanel"
          aria-labelledby={`hr-match-tab-${activeRequestTab}`}
          tabIndex={0}
        >
          {openRequests.length === 0 && completedRequests.length === 0 ? (
            <EmptyState
              title={activeRequestTab === 'requested'
                ? 'No requested matches'
                : activeRequestTab === 'completed'
                  ? 'No completed matches'
                  : activeRequestTab === 'no-available-mentor'
                    ? 'No requests without an available mentor'
                    : 'No match requests found'}
              description={normalizedNameSearch || locationFilter
                ? 'Try changing the trainee name or location filters.'
                : activeRequestTab === 'completed'
                  ? 'Completed matches will appear here.'
                  : activeRequestTab === 'no-available-mentor'
                    ? 'Requests with no active mentor available for the requested skill will appear here.'
                    : 'Trainee match requests will appear here.'}
            />
          ) : openRequests.length > 0 ? (
            <div className="hr-match-cards">
            {openRequests.map((request) => {
              const eligible = getEligibleTrainers(request, trainers);
              const selectedTrainer = eligible.find(
                (trainer) => String(trainer.userId) === selectedTrainers[request.id]
              );
              const selectedTrainerAtCapacity = selectedTrainer !== undefined
                && selectedTrainer.activeTrainees + selectedTrainer.pendingTrainees
                  >= selectedTrainer.maxConcurrentTrainees;
              const recs = aiRecs[request.id] ?? [];
              const isAiOpen = aiOpen[request.id] ?? false;
              const isAiLoading = aiLoading === request.id;
              const aiErr = aiError[request.id];

              return (
                <div key={request.id} className="hr-match-card">
                  <div className="hr-match-card__header">
                    <div className="hr-match-card__trainee">
                      <span className="hr-match-card__name">{request.traineeName}</span>
                      <span className="hr-match-card__meta">
                        Employee #{request.traineeEmployeeNumber}
                      </span>
                    </div>
                    <div className="hr-match-card__badges">
                      <StatusPill label="Open request" tone="info" />
                    </div>
                  </div>

                  <MatchRequestDetails request={request} />

                  {request.message && (
                    <div className="hr-match-card__message">
                      <span className="hr-match-card__message-label">Request note:</span>
                      {request.message}
                    </div>
                  )}

                  {/* Matching controls */}
                  <div className="hr-match-card__controls">
                    {eligible.length === 0 ? (
                      <span className="boa-muted" style={{ fontSize: '0.82rem' }}>
                        No active trainer with matching skill and capacity
                      </span>
                    ) : (
                      <div className="hr-match-card__select-row">
                        <select
                          className="apid-input hr-match-card__select"
                          aria-label={`Trainer for ${request.traineeName}`}
                          value={selectedTrainers[request.id] ?? ''}
                          onChange={(event) => setSelectedTrainers((previous) => ({
                            ...previous,
                            [request.id]: event.target.value,
                          }))}
                        >
                          <option value="">Select active trainer</option>
                          {eligible.map((trainer) => (
                            <option key={trainer.userId ?? trainer.id} value={trainer.userId ?? ''}>
                              {trainer.fullName} · {trainer.activeTrainees + trainer.pendingTrainees}/{trainer.maxConcurrentTrainees}
                            </option>
                          ))}
                        </select>

                        {/* AI Suggest button */}
                        <button
                          type="button"
                          className={`apid-btn hr-ai-suggest-btn${isAiOpen ? ' hr-ai-suggest-btn--active' : ''}`}
                          onClick={() => {
                            if (isAiOpen) {
                              setAiOpen((prev) => ({ ...prev, [request.id]: false }));
                            } else {
                              void fetchAiRecs(request.id, request.skillId);
                            }
                          }}
                          disabled={isAiLoading}
                          title="Get AI mentor suggestions"
                        >
                          {isAiLoading ? (
                            <span className="hr-ai-spinner" />
                          ) : (
                            <Sparkles size={14} />
                          )}
                          AI Suggest
                          {isAiOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>

                        <button
                          type="button"
                          className="apid-btn apid-btn-primary apid-btn-sm"
                          disabled={!selectedTrainers[request.id] || matchMutation.isPending}
                          onClick={() => matchMutation.mutate({
                            requestId: request.id,
                            trainerUserId: Number(selectedTrainers[request.id]),
                            overrideCapacity: capacityOverrides[request.id] ?? false,
                            overrideReason: overrideReasons[request.id],
                          })}
                        >
                          <Link2 size={13} /> Match
                        </button>
                      </div>
                    )}

                    {/* Capacity override */}
                    {selectedTrainerAtCapacity && (
                      <div className="boa-stack" style={{ gap: '0.35rem', marginTop: '0.5rem' }}>
                        <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.8rem' }}>
                          <input
                            type="checkbox"
                            checked={capacityOverrides[request.id] ?? false}
                            onChange={(event) => setCapacityOverrides((previous) => ({
                              ...previous,
                              [request.id]: event.target.checked,
                            }))}
                          />
                          HR override capacity
                        </label>
                        {capacityOverrides[request.id] && (
                          <input
                            className="apid-input"
                            aria-label={`Capacity override reason for ${request.traineeName}`}
                            maxLength={1000}
                            placeholder="Required reason for override"
                            value={overrideReasons[request.id] ?? ''}
                            onChange={(event) => setOverrideReasons((previous) => ({
                              ...previous,
                              [request.id]: event.target.value,
                            }))}
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── AI Recommendations Panel ── */}
                  {(isAiOpen || isAiLoading || aiErr) && (
                    <div className="hr-ai-panel">
                      <div className="hr-ai-panel__header">
                        <span className="hr-ai-panel__title">
                          <Sparkles size={14} />
                          AI suggestions for &ldquo;{request.skillName ?? 'mentoring'}&rdquo;
                        </span>
                        <button
                          type="button"
                          className="hr-ai-panel__close"
                          aria-label="Close AI suggestions"
                          onClick={() => setAiOpen((prev) => ({ ...prev, [request.id]: false }))}
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {isAiLoading && (
                        <div className="hr-ai-panel__loading">
                          <span className="hr-ai-spinner hr-ai-spinner--lg" />
                          Analysing mentors…
                        </div>
                      )}

                      {aiErr && !isAiLoading && (
                        <div className="hr-ai-panel__error">{aiErr}</div>
                      )}

                      {!isAiLoading && !aiErr && recs.length === 0 && (
                        <p className="hr-ai-panel__empty">No AI recommendations returned. Try again or select manually.</p>
                      )}

                      {!isAiLoading && recs.length > 0 && (
                        <div className="hr-ai-recs">
                          {recs.map((rec) => {
                            const isSelected = selectedTrainers[request.id] === String(rec.mentor.userId);
                            const rating = rec.mentor.averageRating;
                            return (
                              <div
                                key={rec.mentor.userId}
                                className={`hr-ai-rec${isSelected ? ' hr-ai-rec--selected' : ''}`}
                              >
                                <div className="hr-ai-rec__rank">
                                  #{rec.rank}
                                </div>
                                <div className="hr-ai-rec__body">
                                  <div className="hr-ai-rec__top">
                                    <span className="hr-ai-rec__name">{rec.mentor.fullName}</span>
                                    <span
                                      className="hr-ai-rec__stars"
                                      role="img"
                                      aria-label={rating === null
                                        ? 'No mentor rating yet'
                                        : `Average mentor rating ${rating.toFixed(1)} out of 5`}
                                    >
                                      {Array.from({ length: 5 }, (_, i) => (
                                        <span className="hr-ai-rec__star" key={i}>
                                          <Star size={11} fill="none" />
                                          {rating !== null && rating > i && (
                                            <Star
                                              className="hr-ai-rec__star-fill"
                                              size={11}
                                              fill="currentColor"
                                              style={{
                                                clipPath: `inset(0 ${100 - Math.min(1, rating - i) * 100}% 0 0)`,
                                              }}
                                            />
                                          )}
                                        </span>
                                      ))}
                                    </span>
                                    <span className="hr-ai-rec__rating">
                                      {rating === null ? 'Not rated' : rating.toFixed(1)}
                                    </span>
                                  </div>
                                  <p className="hr-ai-rec__reason">{rec.reason}</p>
                                  <div className="hr-ai-rec__meta">
                                    {rec.skillName && (
                                      <span className="hr-ai-rec__badge">
                                        <Zap size={10} /> {rec.skillName}
                                      </span>
                                    )}
                                    {rec.mentor.departmentName && (
                                      <span className="hr-ai-rec__badge hr-ai-rec__badge--dept">
                                        {rec.mentor.departmentName}
                                      </span>
                                    )}
                                    <span className="hr-ai-rec__capacity">
                                      <Users size={11} />
                                      {rec.mentor.remainingCapacity} slot{rec.mentor.remainingCapacity !== 1 ? 's' : ''} open
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className={`apid-btn apid-btn-sm hr-ai-rec__select${isSelected ? ' hr-ai-rec__select--chosen' : ''}`}
                                  onClick={() => {
                                    setSelectedTrainers((prev) => ({
                                      ...prev,
                                      [request.id]: String(rec.mentor.userId),
                                    }));
                                  }}
                                >
                                  {isSelected ? '✓ Selected' : 'Select'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          ) : null}
          {completedRequests.length > 0 && (
          <section className="hr-completed-matches">
            <div className="hr-completed-matches__heading">
              <div>
                <h4>Completed matches</h4>
                <p>Request details and the mentor assigned to each trainee.</p>
              </div>
              <span>{completedRequests.length} matched</span>
            </div>
            {completedRequests.map((request) => (
              <article key={request.id} className="hr-completed-match-card">
                <div className="hr-match-card__header">
                  <div className="hr-match-card__trainee">
                    <span className="hr-match-card__name">{request.traineeName}</span>
                    <span className="hr-match-card__meta">
                      Employee #{request.traineeEmployeeNumber}
                    </span>
                  </div>
                  <StatusPill label="Matched" tone="ok" />
                </div>
                <MatchRequestDetails
                  request={request}
                  matchedTrainerName={request.matchedTrainerName}
                />
                {request.mentoringRelationshipId && (
                  <div className="hr-completed-match-card__footer">
                    <Link
                      to={`/mentoring/pairing/${request.mentoringRelationshipId}`}
                      className="apid-btn apid-btn-outline apid-btn-sm"
                    >
                      <Link2 size={14} /> View relationship
                    </Link>
                  </div>
                )}
              </article>
            ))}
          </section>
          )}
        </div>
      </div>

      <section className="apid-card">
        <div className="boa-card-header">
          <div>
            <h3 className="boa-card-title">Paused relationships requiring reassignment</h3>
            <p className="boa-card-subtitle">
              Reassignment preserves the original relationship history and creates a new active relationship for its trainees.
            </p>
          </div>
        </div>
        {reassignmentQueue.isLoading ? (
          <p className="boa-muted">Loading paused relationships…</p>
        ) : reassignmentQueue.isError ? (
          <p role="alert" className="boa-muted">Unable to load the reassignment queue.</p>
        ) : reassignmentQueue.data?.length === 0 ? (
          <EmptyState title="No paused relationships" description="Paused relationships with active trainees will appear here." />
        ) : (
          <div className="boa-stack">
            {reassignmentQueue.data?.map((relationship) => {
              const eligible = trainers.filter((trainer) =>
                trainer.userId !== null &&
                trainer.userId !== relationship.formerTrainerUserId &&
                trainer.status === 'ACTIVE' &&
                trainer.acceptingNewPairings !== false &&
                trainer.employmentStatus === 'ACTIVE' &&
                (relationship.skillId === null || !trainer.skills.some((skill) =>
                  skill.id === relationship.skillId
                  && skill.status !== undefined
                  && skill.status !== 'ACTIVE'
                ))
              );
              const selectedTrainer = eligible.find(
                (trainer) => String(trainer.userId) === selectedReassignmentTrainers[relationship.relationshipId]
              );
              const selectedTrainerHasSkill = selectedTrainer !== undefined
                && (relationship.skillId === null
                  || selectedTrainer.skills.some((skill) => skill.id === relationship.skillId));
              const selectedTrainerNeedsSkillOverride = selectedTrainer !== undefined && !selectedTrainerHasSkill;
              const selectedTrainerAtCapacity = selectedTrainer !== undefined
                && selectedTrainer.activeTrainees + selectedTrainer.pendingTrainees + relationship.trainees.length
                  > selectedTrainer.maxConcurrentTrainees;
              return (
                <article
                  key={relationship.relationshipId}
                  className="apid-card mentoring-reassignment-card"
                >
                  <div className="boa-card-header">
                    <div className="mentoring-reassignment-summary">
                      <strong>{relationship.skillName ?? 'General mentoring'} · Former trainer: {relationship.formerTrainerName}</strong>
                      <p className="boa-card-subtitle">
                        {relationship.trainees.length} active trainee(s) · Started {new Date(relationship.startedAt).toLocaleDateString()}
                      </p>
                      <div className="boa-muted">
                        Trainees: {relationship.trainees.map((trainee) => trainee.name).join(', ')}
                      </div>
                    </div>
                    <Link
                      to={`/mentoring/pairing/${relationship.relationshipId}`}
                      className="apid-btn apid-btn-outline apid-btn-sm"
                    >
                      View history
                    </Link>
                  </div>
                  {eligible.length === 0 ? (
                    <span className="boa-muted">
                      No other active, employed trainer is available. Authorize a replacement trainer before reassignment.
                    </span>
                  ) : (
                    <div className="mentoring-reassignment-form">
                      <label className="mentoring-reassignment-field">
                        <span>Replacement mentor</span>
                        <select
                          className="apid-input"
                          aria-label={`Replacement trainer for relationship ${relationship.relationshipId}`}
                          value={selectedReassignmentTrainers[relationship.relationshipId] ?? ''}
                          onChange={(event) => setSelectedReassignmentTrainers((previous) => ({
                            ...previous,
                            [relationship.relationshipId]: event.target.value,
                          }))}
                        >
                          <option value="">Select replacement trainer</option>
                          {eligible.map((trainer) => (
                            <option key={trainer.userId ?? trainer.id} value={trainer.userId ?? ''}>
                              {trainer.fullName}
                              {relationship.skillId !== null && !trainer.skills.some((skill) => skill.id === relationship.skillId)
                                ? ' · Skill mismatch (HR override)'
                                : ''}
                              {` · ${trainer.activeTrainees + trainer.pendingTrainees}/${trainer.maxConcurrentTrainees}`}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="mentoring-reassignment-field">
                        <span>Reassignment reason</span>
                        <textarea
                          className="apid-input"
                          aria-label={`Reassignment reason for relationship ${relationship.relationshipId}`}
                          maxLength={1000}
                          required
                          rows={3}
                          value={reassignmentReasons[relationship.relationshipId] ?? ''}
                          onChange={(event) => setReassignmentReasons((previous) => ({
                            ...previous,
                            [relationship.relationshipId]: event.target.value,
                          }))}
                        />
                      </label>
                      {selectedTrainerNeedsSkillOverride && (
                        <div className="mentoring-reassignment-override">
                          <strong>Skill mismatch - HR override required</strong>
                          <p>
                            This mentor is not authorized for {relationship.skillName}. Enter a reason to continue.
                          </p>
                          <label className="mentoring-reassignment-field">
                            <span>Skill override reason</span>
                            <textarea
                              className="apid-input"
                              aria-label={`Skill override reason for relationship ${relationship.relationshipId}`}
                              maxLength={1000}
                              placeholder="Explain why this skill mismatch is acceptable"
                              required
                              rows={3}
                              value={reassignmentSkillOverrideReasons[relationship.relationshipId] ?? ''}
                              onChange={(event) => setReassignmentSkillOverrideReasons((previous) => ({
                                ...previous,
                                [relationship.relationshipId]: event.target.value,
                              }))}
                            />
                          </label>
                        </div>
                      )}
                      {selectedTrainerAtCapacity && (
                        <div className="mentoring-reassignment-override">
                          <label className="mentoring-reassignment-checkbox">
                            <input
                              type="checkbox"
                              checked={reassignmentCapacityOverrides[relationship.relationshipId] ?? false}
                              onChange={(event) => setReassignmentCapacityOverrides((previous) => ({
                                ...previous,
                                [relationship.relationshipId]: event.target.checked,
                              }))}
                            />
                            HR override capacity
                          </label>
                          {reassignmentCapacityOverrides[relationship.relationshipId] && (
                            <label className="mentoring-reassignment-field">
                              <span>Capacity override reason</span>
                              <input
                                className="apid-input"
                                aria-label={`Capacity override reason for relationship ${relationship.relationshipId}`}
                                maxLength={1000}
                                placeholder="Explain why the capacity limit should be exceeded"
                                value={reassignmentOverrideReasons[relationship.relationshipId] ?? ''}
                                onChange={(event) => setReassignmentOverrideReasons((previous) => ({
                                  ...previous,
                                  [relationship.relationshipId]: event.target.value,
                                }))}
                              />
                            </label>
                          )}
                        </div>
                      )}
                      <div className="mentoring-reassignment-actions">
                        <button
                          type="button"
                          className="apid-btn apid-btn-primary"
                          disabled={
                            !selectedReassignmentTrainers[relationship.relationshipId] ||
                            !reassignmentReasons[relationship.relationshipId]?.trim() ||
                            (selectedTrainerNeedsSkillOverride
                              && !reassignmentSkillOverrideReasons[relationship.relationshipId]?.trim()) ||
                            (selectedTrainerAtCapacity
                              && (reassignmentCapacityOverrides[relationship.relationshipId] ?? false)
                              && !reassignmentOverrideReasons[relationship.relationshipId]?.trim()) ||
                            (selectedTrainerAtCapacity
                              && !(reassignmentCapacityOverrides[relationship.relationshipId] ?? false)) ||
                            reassignMutation.isPending
                          }
                          onClick={() => reassignMutation.mutate({
                            relationshipId: relationship.relationshipId,
                            trainerUserId: Number(selectedReassignmentTrainers[relationship.relationshipId]),
                            reason: (reassignmentReasons[relationship.relationshipId] ?? '').trim(),
                            overrideCapacity: reassignmentCapacityOverrides[relationship.relationshipId] ?? false,
                            overrideReason: reassignmentOverrideReasons[relationship.relationshipId],
                            skillOverrideReason: reassignmentSkillOverrideReasons[relationship.relationshipId],
                          })}
                        >
                          <Link2 size={14} /> Reassign
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
