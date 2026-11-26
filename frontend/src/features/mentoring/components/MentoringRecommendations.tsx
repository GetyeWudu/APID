import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Eye,
  LoaderCircle,
  Send,
  Sparkles,
  Star,
  Users,
  X,
} from 'lucide-react';
import { extractApiErrorMessage, type ApiErrorPayload } from '../../../shared/api/apiClient';
import { useToast } from '../../../shared/components/ui';
import {
  mentorDirectoryApi,
  type MentorDirectoryItem,
  type MentorRecommendation,
} from '../api/mentorDirectoryApi';
import { mentoringPairingApi, type MentoringPairing } from '../api/mentoringPairingApi';
import { MentorProfileModal } from './MentorProfileModal';
import { MentorProfilePhoto } from './MentorProfilePhoto';
import './MentoringRecommendations.css';

const LEARNING_GOAL_EXAMPLES = [
  'I want to learn how to build and connect APIs.',
  'I want to become more confident presenting my ideas.',
  'I want to grow into a technical leadership role.',
];

function getRecommendationErrorCode(error: unknown) {
  if (!axios.isAxiosError<ApiErrorPayload>(error)) return null;
  return error.response?.data?.error?.code ?? error.response?.data?.errorCode ?? null;
}

export function MentoringRecommendations({
  currentUserId,
  requests = [],
}: {
  currentUserId?: number;
  requests?: MentoringPairing[];
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [learningGoal, setLearningGoal] = useState('');
  const [submittedGoal, setSubmittedGoal] = useState('');
  const [profileRecommendation, setProfileRecommendation] = useState<MentorRecommendation | null>(null);
  const [requestRecommendation, setRequestRecommendation] = useState<MentorRecommendation | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState('');

  const recommendationMutation = useMutation({
    mutationFn: mentorDirectoryApi.recommendMentors,
  });
  const requestMutation = useMutation({
    mutationFn: mentoringPairingApi.requestMentor,
    onSuccess: async () => {
      setRequestRecommendation(null);
      setSelectedSkillId('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'requests'] }),
        queryClient.invalidateQueries({ queryKey: ['core', 'notifications'] }),
      ]);
      pushToast({
        title: 'Mentorship request sent',
        message: 'The mentor will be notified and can approve or decline your request.',
        tone: 'ok',
      });
    },
    onError: (error: unknown) => {
      const message = extractApiErrorMessage(error, 'Unable to send the mentorship request.');
      pushToast({ title: 'Request failed', message, tone: 'err' });
    },
  });

  const submitLearningGoal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const goal = learningGoal.trim();
    if (!goal) return;
    setSubmittedGoal(goal);
    requestMutation.reset();
    recommendationMutation.mutate(goal);
  };

  const recommendationErrorCode = recommendationMutation.error
    ? getRecommendationErrorCode(recommendationMutation.error)
    : null;
  const noMentorsFoundError = recommendationErrorCode === 'MENTOR_RECOMMENDATION_EMPTY_RESPONSE';
  const serviceUnavailable = recommendationErrorCode === 'MENTOR_RECOMMENDATION_SERVICE_UNAVAILABLE'
    || recommendationErrorCode === 'MENTOR_RECOMMENDATION_INVALID_RESPONSE'
    || (axios.isAxiosError(recommendationMutation.error) && !recommendationMutation.error.response);
  const errorMessage = recommendationMutation.error && !noMentorsFoundError
    ? serviceUnavailable
      ? 'AI recommendations are not available right now. Please try again later.'
      : extractApiErrorMessage(
        recommendationMutation.error,
        'Unable to get mentor recommendations. Please try again.'
      )
    : null;
  const recommendationResult = recommendationMutation.data;
  const recommendations = recommendationResult?.recommendations ?? [];
  const noMentorsFound = noMentorsFoundError
    || (recommendationMutation.isSuccess && recommendations.length === 0);
  const clearRecommendations = () => {
    setSubmittedGoal('');
    setProfileRecommendation(null);
    setRequestRecommendation(null);
    setSelectedSkillId('');
    recommendationMutation.reset();
  };

  const sendMentorRequest = (recommendation: MentorRecommendation, skillId: number) => {
    requestMutation.mutate({
      mentorUserId: recommendation.mentor.userId,
      skillId,
      message: submittedGoal,
    });
  };

  const beginRequest = (
    recommendation: MentorRecommendation,
    requestableSkills: MentorDirectoryItem['skills']
  ) => {
    if (requestableSkills.length === 1) {
      sendMentorRequest(recommendation, requestableSkills[0].id);
      return;
    }
    if (requestableSkills.length > 1) {
      setRequestRecommendation(recommendation);
      setSelectedSkillId('');
    }
  };

  const submitSelectedSkillRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requestRecommendation || !selectedSkillId) return;
    sendMentorRequest(requestRecommendation, Number(selectedSkillId));
  };

  return (
    <section className="ai-mentor-recommendations">
      <header className="ai-mentor-header">
        <div className="ai-mentor-icon"><Sparkles size={20} /></div>
        <div>
          <div className="ai-mentor-title-row">
            <h2>Find a mentor with AI</h2>
            <span className="ai-mentor-preview-badge">AI powered</span>
          </div>
          <p>Describe your learning goal and get ranked recommendations based on approved mentor profiles.</p>
        </div>
      </header>

      <form className="ai-mentor-prompt" onSubmit={submitLearningGoal}>
        <label htmlFor="mentor-learning-goal">What would you like to learn?</label>
        <textarea
          id="mentor-learning-goal"
          rows={4}
          maxLength={1500}
          value={learningGoal}
          disabled={recommendationMutation.isPending}
          onChange={(event) => {
            setLearningGoal(event.target.value);
            clearRecommendations();
          }}
          placeholder="Describe your goal, your current experience, and what kind of guidance would help you."
        />
        <div className="ai-mentor-prompt-footer">
          <span>{learningGoal.length}/1500</span>
          <button type="submit" disabled={!learningGoal.trim() || recommendationMutation.isPending}>
            {recommendationMutation.isPending
              ? <><LoaderCircle className="ai-mentor-spinner" size={16} /> Finding mentors</>
              : <>Find mentors <Sparkles size={16} /></>}
          </button>
        </div>
      </form>

      <div className="ai-mentor-examples">
        <span>Need an idea?</span>
        <div>
          {LEARNING_GOAL_EXAMPLES.map((example) => (
            <button
              type="button"
              key={example}
              disabled={recommendationMutation.isPending}
              onClick={() => { setLearningGoal(example); clearRecommendations(); }}
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <div className="ai-mentor-results" aria-live="polite">
        {recommendationMutation.isPending ? (
          <div className="ai-mentor-results-placeholder">
            <LoaderCircle className="ai-mentor-spinner" size={20} />
            <div>
              <strong>Finding mentors for your goal</strong>
              <p>Reviewing available mentors and their approved professional profiles.</p>
            </div>
          </div>
        ) : noMentorsFound ? (
          <div className="ai-mentor-results-placeholder">
            <Sparkles size={20} />
            <div>
              <strong>No mentor available for this skill</strong>
              <p>No approved mentor is currently available for this learning goal. Try a different skill or learning goal.</p>
            </div>
          </div>
        ) : errorMessage ? (
          <div className="ai-mentor-results-placeholder ai-mentor-results-error">
            <Sparkles size={20} />
            <div><strong>Recommendations could not be loaded</strong><p>{errorMessage}</p></div>
          </div>
        ) : recommendations.length > 0 ? (
          <>
            <div className="ai-mentor-results-heading">
              <div>
                <strong>Mentors recommended for your goal</strong>
                <p>Based on: “{submittedGoal}”</p>
              </div>
              <span>{recommendations.length} match{recommendations.length === 1 ? '' : 'es'}</span>
            </div>
            {recommendationResult?.overallReason && (
              <aside className="ai-mentor-overall-reason" aria-label="Overall AI recommendation reason">
                <div className="ai-mentor-overall-icon"><Sparkles size={18} /></div>
                <div>
                  <span>Why these mentors</span>
                  <p>{recommendationResult.overallReason}</p>
                </div>
              </aside>
            )}
            <div className="ai-mentor-cards">
              {recommendations.map((recommendation) => {
                const mentor = recommendation.mentor;
                const mentorRequests = requests.filter((request) =>
                  request.mentorUserId === mentor.userId
                  && request.traineeUserId === currentUserId
                  && (request.status === 'PENDING' || request.status === 'ACCEPTED')
                );
                const requestableSkills = mentor.skills.filter((skill) =>
                  !mentorRequests.some((request) => request.skillId === skill.id)
                );
                const allSkillsRequested = mentor.skills.length > 0 && requestableSkills.length === 0;
                const requestState = mentorRequests.some((request) => request.status === 'PENDING')
                  ? 'Request pending'
                  : 'Already matched';
                return (
                  <article className="ai-mentor-card" key={mentor.userId}>
                    <div className="ai-mentor-card-top">
                      <MentorProfilePhoto mentor={mentor} />
                      <div className="ai-mentor-card-ranking">
                        <span className="ai-mentor-rank">Recommendation #{recommendation.rank}</span>
                        <span className="ai-mentor-rating">
                          <Star size={14} aria-hidden="true" />
                          {mentor.averageRating != null ? mentor.averageRating.toFixed(1) : 'Not rated'}
                        </span>
                      </div>
                    </div>
                    <h3>{mentor.fullName}</h3>
                    {mentor.departmentName && <p className="ai-mentor-department">{mentor.departmentName}</p>}
                    <div className="ai-mentor-reason">
                      <span><Sparkles size={13} /> Why this match</span>
                      <p>{recommendation.reason}</p>
                    </div>
                    <div className="ai-mentor-skills">
                      {mentor.skills.slice(0, 5).map((skill) => (
                        <span key={skill.id}>{skill.name}</span>
                      ))}
                    </div>
                    <div className="ai-mentor-facts">
                      {mentor.experienceYears != null && <span>{mentor.experienceYears} years’ experience</span>}
                      {mentor.sessionsPerWeek != null && <span>{mentor.sessionsPerWeek} sessions/week</span>}
                      <span><Users size={14} /> {mentor.remainingCapacity} open slot{mentor.remainingCapacity === 1 ? '' : 's'}</span>
                    </div>
                    <div className="ai-mentor-card-actions">
                      <button
                        type="button"
                        className="ai-mentor-view"
                        onClick={() => setProfileRecommendation(recommendation)}
                      >
                        <Eye size={15} /> View profile
                      </button>
                      <button
                        type="button"
                        className="ai-mentor-request"
                        disabled={
                          Boolean(allSkillsRequested)
                          || !requestableSkills.length
                          || mentor.remainingCapacity <= 0
                          || requestMutation.isPending
                          || !currentUserId
                        }
                        onClick={() => beginRequest(recommendation, requestableSkills)}
                      >
                        {allSkillsRequested
                          ? requestState
                          : mentor.remainingCapacity <= 0
                            ? 'At capacity'
                            : mentor.skills.length === 0
                              ? 'No skills available'
                              : <><Send size={14} /> Request mentorship</>}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="ai-mentor-results-placeholder">
            <Sparkles size={20} />
            <div>
              <strong>Your recommendations will appear here</strong>
              <p>Start by describing what you want to learn. We’ll compare your goal with available mentor profiles.</p>
            </div>
          </div>
        )}
      </div>

      {profileRecommendation && (
        <MentorProfileModal
          mentor={profileRecommendation.mentor}
          profileSummary={profileRecommendation.profileSummary}
          careerExperience={profileRecommendation.careerExperience}
          mentorshipExperience={profileRecommendation.mentorshipExperience}
          onClose={() => setProfileRecommendation(null)}
        />
      )}

      {requestRecommendation && (
        <div
          className="ai-mentor-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !requestMutation.isPending) {
              setRequestRecommendation(null);
            }
          }}
        >
          <section
            className="ai-mentor-request-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-mentor-request-title"
          >
            <header>
              <span><Send size={16} /> Start a mentorship request</span>
              <button
                type="button"
                className="ai-mentor-modal-close"
                aria-label="Close skill selection"
                disabled={requestMutation.isPending}
                onClick={() => setRequestRecommendation(null)}
              >
                <X size={18} />
              </button>
            </header>
            <h2 id="ai-mentor-request-title">Choose a skill</h2>
            <p>Select the area you’d like {requestRecommendation.mentor.fullName} to mentor you in.</p>
            <form onSubmit={submitSelectedSkillRequest}>
              <fieldset className="ai-mentor-skill-options">
                <legend>Available mentor skills</legend>
                {requestRecommendation.mentor.skills.map((skill) => {
                  const existing = requests.find((request) =>
                    request.mentorUserId === requestRecommendation.mentor.userId
                    && request.traineeUserId === currentUserId
                    && request.skillId === skill.id
                    && (request.status === 'PENDING' || request.status === 'ACCEPTED')
                  );
                  return (
                    <label
                      className={`ai-mentor-skill-option${existing ? ' is-unavailable' : ''}`}
                      key={skill.id}
                    >
                      <input
                        type="radio"
                        name="mentor-request-skill"
                        value={skill.id}
                        checked={selectedSkillId === String(skill.id)}
                        disabled={Boolean(existing) || requestMutation.isPending}
                        onChange={(event) => setSelectedSkillId(event.target.value)}
                      />
                      <span>
                        <strong>{skill.name}</strong>
                        {skill.category && <small>{skill.category}</small>}
                      </span>
                      {existing && (
                        <small>{existing.status === 'ACCEPTED' ? 'Mentorship active' : 'Request pending'}</small>
                      )}
                    </label>
                  );
                })}
              </fieldset>
              <div className="ai-mentor-request-modal-actions">
                <button
                  type="button"
                  className="ai-mentor-view"
                  disabled={requestMutation.isPending}
                  onClick={() => setRequestRecommendation(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ai-mentor-request"
                  disabled={!selectedSkillId || requestMutation.isPending}
                >
                  {requestMutation.isPending ? 'Sending...' : <><Send size={14} /> Send request</>}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
