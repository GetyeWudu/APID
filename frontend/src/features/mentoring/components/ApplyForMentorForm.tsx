import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ErrorState, LoadingSkeleton, StatusPill, useToast } from '../../../shared/components/ui';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import type { SkillItem } from '../../admin/skills/types/skills.types';
import { mentorApplicationApi } from '../api/mentorApplicationApi';

export function ApplyForMentorForm({
  activeSkills,
  currentUserId,
}: {
  activeSkills: SkillItem[];
  currentUserId: number;
}) {
  const { pushToast } = useToast();
  const applicationsQuery = useQuery({
    queryKey: ['mentoring', 'applications', 'mine', currentUserId],
    queryFn: mentorApplicationApi.listMine,
  });
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');
  const [note, setNote] = useState('');
  const [expertiseSummary, setExpertiseSummary] = useState('');
  const [availabilityNotes, setAvailabilityNotes] = useState('');
  const [maxConcurrentTrainees, setMaxConcurrentTrainees] = useState('3');
  const [supportingEvidence, setSupportingEvidence] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (skillIds.length === 0 && !customSkill.trim()) {
      pushToast({
        title: 'Skill required',
        message: 'Choose one or more catalog skills or enter a custom skill to continue.',
        tone: 'info',
      });
      return;
    }

    if (supportingEvidence.length === 0) {
      pushToast({
        title: 'Supporting evidence required',
        message: 'Upload at least one certificate or other supporting document.',
        tone: 'err',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await mentorApplicationApi.submit({
        supportingEvidence,
        catalogSkillIds: skillIds.map(Number),
        customSkill: customSkill.trim() || undefined,
        note: note.trim() || undefined,
        expertiseSummary: expertiseSummary.trim() || undefined,
        availabilityNotes: availabilityNotes.trim() || undefined,
        maxConcurrentTrainees: maxConcurrentTrainees ? Number(maxConcurrentTrainees) : undefined,
      });
      await applicationsQuery.refetch();
      pushToast({
        title: 'Application sent',
        message: 'Your mentor application is pending review.',
        tone: 'ok',
      });
      setSkillIds([]);
      setCustomSkill('');
      setNote('');
      setExpertiseSummary('');
      setAvailabilityNotes('');
      setMaxConcurrentTrainees('3');
      setSupportingEvidence([]);
      form.reset();
    } catch (error: unknown) {
      const message = axios.isAxiosError<ApiErrorPayload>(error)
        ? error.response?.data?.message ?? error.message
        : error instanceof Error
          ? error.message
          : 'Unable to send your mentor application.';
      pushToast({
        title: 'Application failed',
        message,
        tone: 'err',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (applicationsQuery.isLoading) {
    return <LoadingSkeleton rows={4} height={28} />;
  }
  if (applicationsQuery.isError) {
    return (
      <ErrorState
        message="Unable to check your mentor application status."
        onRetry={() => void applicationsQuery.refetch()}
      />
    );
  }

  const existingApplication = applicationsQuery.data?.find(
    (application) => application.applicationType === 'INITIAL'
  );
  if (existingApplication) {
    const statusTone = existingApplication.status === 'APPROVED'
      ? 'ok'
      : existingApplication.status === 'DECLINED' ? 'err' : 'warn';
    return (
      <div className="apid-card">
        <div className="boa-card-header">
          <div>
            <h3 className="boa-card-title">Mentor Application Submitted</h3>
            <p className="boa-card-subtitle">
              You can submit one initial mentor application. Additional skills can be requested from your mentor profile after approval.
            </p>
          </div>
          <StatusPill label={existingApplication.status} tone={statusTone} />
        </div>
        <p>Skills: {existingApplication.skillName || '—'}</p>
        {existingApplication.reviewReason && (
          <p className="boa-muted">HR review: {existingApplication.reviewReason}</p>
        )}
        {existingApplication.status === 'APPROVED' && (
          <Link to="/mentoring?view=trainer-profile" className="apid-btn apid-btn-primary apid-btn-sm">
            Manage mentor profile
          </Link>
        )}
        {existingApplication.status === 'PENDING' && (
          <p className="boa-muted">Your application is awaiting HR review.</p>
        )}
        {existingApplication.status === 'DECLINED' && (
          <p className="boa-muted">This one-time application has been reviewed and cannot be resubmitted.</p>
        )}
      </div>
    );
  }

  return (
    <div className="apid-card">
      <div className="boa-card-header">
        <div>
          <h3 className="boa-card-title">Apply for Mentor</h3>
          <p className="boa-card-subtitle">
            Submit one application with all the skills you want to mentor and attach supporting evidence.
          </p>
        </div>
      </div>
      <form className="apid-form" onSubmit={handleSubmit}>
        <div className="apid-field">
          <label htmlFor="mentor-application-skill">Catalog skills (optional)</label>
          <select
            id="mentor-application-skill"
            className="apid-input"
            multiple
            value={skillIds}
            onChange={(event) => setSkillIds(
              Array.from(event.target.selectedOptions, (option) => option.value)
            )}
            disabled={isSubmitting || activeSkills.length === 0}
          >
            {activeSkills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
              </option>
            ))}
          </select>
          <span className="boa-muted" style={{ fontSize: '0.78rem' }}>
            Select multiple skills with Ctrl/Command-click, and optionally add a custom skill.
          </span>
        </div>

        <div className="apid-field">
          <label htmlFor="mentor-application-expertise">Experience and mentoring approach</label>
          <textarea
            id="mentor-application-expertise"
            className="apid-input"
            rows={4}
            maxLength={2000}
            value={expertiseSummary}
            onChange={(event) => setExpertiseSummary(event.target.value)}
            placeholder="Describe your experience, expertise, and how you would teach this skill."
            disabled={isSubmitting}
          />
        </div>

        <div className="apid-field">
          <label htmlFor="mentor-application-availability">Weekly availability</label>
          <textarea
            id="mentor-application-availability"
            className="apid-input"
            rows={2}
            maxLength={1000}
            value={availabilityNotes}
            onChange={(event) => setAvailabilityNotes(event.target.value)}
            placeholder="For example: Tuesday and Thursday afternoons."
            disabled={isSubmitting}
          />
        </div>

        <div className="apid-field">
          <label htmlFor="mentor-application-capacity">Maximum concurrent trainees</label>
          <input
            id="mentor-application-capacity"
            type="number"
            className="apid-input"
            min={1}
            max={100}
            value={maxConcurrentTrainees}
            onChange={(event) => setMaxConcurrentTrainees(event.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <div className="apid-field">
          <label htmlFor="mentor-application-custom-skill">Custom skill (optional)</label>
          <input
            id="mentor-application-custom-skill"
            type="text"
            className="apid-input"
            value={customSkill}
            onChange={(event) => setCustomSkill(event.target.value)}
            placeholder="Enter a skill not found in the catalog"
            maxLength={150}
            disabled={isSubmitting}
          />
        </div>

        <div className="apid-field">
          <label htmlFor="mentor-application-proof">Supporting evidence</label>
          <input
            id="mentor-application-proof"
            type="file"
            className="apid-input"
            accept=".pdf,.docx,.png,.jpg,.jpeg"
            multiple
            required
            disabled={isSubmitting}
            onChange={(event) => setSupportingEvidence(Array.from(event.target.files ?? []))}
          />
          <span className="boa-muted" style={{ fontSize: '0.78rem' }}>
            Select one or more PDF, DOCX, PNG, JPG, or JPEG files; maximum 10 MB each.
          </span>
        </div>

        <div className="apid-field">
          <label htmlFor="mentor-application-note">Note (optional)</label>
          <textarea
            id="mentor-application-note"
            className="apid-input"
            rows={4}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add any details you would like to share."
            disabled={isSubmitting}
          />
        </div>
        <button type="submit" className="apid-btn apid-btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Sending...' : 'Send application'}
        </button>
      </form>
    </div>
  );
}
