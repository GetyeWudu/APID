import { useState, type FormEvent } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import './MentoringRecommendations.css';

const LEARNING_GOAL_EXAMPLES = [
  'I want to learn how to build and connect APIs.',
  'I want to become more confident presenting my ideas.',
  'I want to grow into a technical leadership role.',
];

export function MentoringRecommendations() {
  const [learningGoal, setLearningGoal] = useState('');
  const [submittedGoal, setSubmittedGoal] = useState('');

  const submitLearningGoal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const goal = learningGoal.trim();
    if (goal) setSubmittedGoal(goal);
  };

  return (
    <section className="ai-mentor-recommendations">
      <header className="ai-mentor-header">
        <div className="ai-mentor-icon"><Sparkles size={20} /></div>
        <div>
          <div className="ai-mentor-title-row">
            <h2>Find a mentor with AI</h2>
            <span className="ai-mentor-preview-badge">Coming soon</span>
          </div>
          <p>Tell us what you want to learn. We’ll use your goal to recommend mentors who can help.</p>
        </div>
      </header>

      <form className="ai-mentor-prompt" onSubmit={submitLearningGoal}>
        <label htmlFor="mentor-learning-goal">What would you like to learn?</label>
        <textarea
          id="mentor-learning-goal"
          rows={4}
          maxLength={1500}
          value={learningGoal}
          onChange={(event) => setLearningGoal(event.target.value)}
          placeholder="Describe your goal, your current experience, and what kind of guidance would help you."
        />
        <div className="ai-mentor-prompt-footer">
          <span>{learningGoal.length}/1500</span>
          <button type="submit" disabled={!learningGoal.trim()}>
            Prepare recommendations <ArrowRight size={16} />
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
              onClick={() => {
                setLearningGoal(example);
                setSubmittedGoal('');
              }}
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <div className="ai-mentor-results-placeholder" aria-live="polite">
        <Sparkles size={20} />
        {submittedGoal ? (
          <div>
            <strong>Your learning goal is ready</strong>
            <p>AI mentor recommendations will appear here when the recommendation service is connected.</p>
          </div>
        ) : (
          <div>
            <strong>Your recommendations will appear here</strong>
            <p>Start by describing what you want to learn. This is a UI preview; AI matching is not connected yet.</p>
          </div>
        )}
      </div>
    </section>
  );
}
