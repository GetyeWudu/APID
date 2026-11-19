import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, LoaderCircle, Send, Sparkles, Star, Users } from 'lucide-react';
import { extractApiErrorMessage } from '../../../shared/api/apiClient';
import { useToast } from '../../../shared/components/ui';
import { mentorDirectoryApi, type MentorRecommendation } from '../api/mentorDirectoryApi';
import { mentoringPairingApi, type MentoringPairing } from '../api/mentoringPairingApi';
import './MentoringRecommendations.css';

const LEARNING_GOAL_EXAMPLES = [
  'I want to learn how to build and connect APIs.',
  'I want to become more confident presenting my ideas.',
  'I want to grow into a technical leadership role.',
];

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

  const recommendationMutation = useMutation({
    mutationFn: mentorDirectoryApi.recommendMentors,
  });
  const requestMutation = useMutation({
    mutationFn: mentoringPairingApi.requestMentor,
    onSuccess: async () => {
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

  const errorMessage = recommendationMutation.error
    ? extractApiErrorMessage(recommendationMutation.error, 'Unable to get mentor recommendations. Please try again.')
    : null;
  const recommendations = recommendationMutation.data ?? [];
  const clearRecommendations = () => {
    setSubmittedGoal('');
    recommendationMutation.reset();
  };
  const requestMentor = (recommendation: MentorRecommendation) => {
    requestMutation.mutate({
      mentorUserId: recommendation.mentor.userId,
      skillId: recommendation.skillId ?? undefined,
      message: submittedGoal,
    });
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
              : <>Find mentors <ArrowRight size={16} /></>}
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
          <div>
            <div className="ai-mentor-results-placeholder">
              <LoaderCircle className="ai-mentor-spinner" size={20} />
              <div>
                <strong>Finding mentors for your goal</strong>
                <p>Reviewing available mentors and their approved professional profiles.</p>
              </div>
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
            <div className="ai-mentor-cards">
              {recommendations.map((recommendation) => {
                const mentor = recommendation.mentor;
                const existingRequest = requests.find((request) =>
                  request.mentorUserId === mentor.userId
                  && request.traineeUserId === currentUserId
                  && request.skillId === recommendation.skillId
                  && (request.status === 'PENDING' || request.status === 'ACCEPTED')
                );
                return (
                  <article className="ai-mentor-card" key={mentor.userId}>
                    <div className="ai-mentor-card-top">
                      <span className="ai-mentor-rank">#{recommendation.rank} recommendation</span>
                      {mentor.averageRating > 0 && (
                        <span className="ai-mentor-rating"><Star size={14} /> {mentor.averageRating.toFixed(1)}</span>
                      )}
                    </div>
                    <h3>{mentor.fullName}</h3>
                    {mentor.departmentName && <p className="ai-mentor-department">{mentor.departmentName}</p>}
                    <p className="ai-mentor-reason">{recommendation.reason}</p>
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
                    <button
                      type="button"
                      className="ai-mentor-request"
                      disabled={Boolean(existingRequest) || requestMutation.isPending || !currentUserId}
                      onClick={() => requestMentor(recommendation)}
                    >
                      {existingRequest?.status === 'ACCEPTED'
                        ? 'Already matched'
                        : existingRequest?.status === 'PENDING'
                          ? 'Request pending'
                          : <><Send size={14} /> Request mentorship</>}
                    </button>
                  </article>
                );
              })}
            </div>
          </>
        ) : recommendationMutation.isSuccess ? (
          <div className="ai-mentor-results-placeholder">
            <Sparkles size={20} />
            <div><strong>No suitable mentors found</strong><p>Try adding more detail about the skills or guidance you need.</p></div>
          </div>
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
    </section>
  );
}
