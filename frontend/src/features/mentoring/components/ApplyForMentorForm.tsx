import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { useToast } from '../../../shared/components/ui';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';
import type { SkillItem } from '../../admin/skills/types/skills.types';
import { mentorApplicationApi } from '../api/mentorApplicationApi';

export function ApplyForMentorForm({ activeSkills }: { activeSkills: SkillItem[] }) {
  const { pushToast } = useToast();
  const [skillId, setSkillId] = useState('');
  const [customSkill, setCustomSkill] = useState('');
  const [note, setNote] = useState('');
  const [proofDocument, setProofDocument] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!skillId && !customSkill.trim()) {
      pushToast({
        title: 'Skill required',
        message: 'Choose a catalog skill or enter a custom skill to continue.',
        tone: 'info',
      });
      return;
    }

    if (!proofDocument) {
      pushToast({
        title: 'Proof document required',
        message: 'Upload a proof document to send your application.',
        tone: 'err',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await mentorApplicationApi.submit({
        proofDocument,
        catalogSkillId: skillId ? Number(skillId) : undefined,
        customSkill: customSkill.trim() || undefined,
        note: note.trim() || undefined,
      });
      pushToast({
        title: 'Application sent',
        message: 'Your mentor application is pending review.',
        tone: 'ok',
      });
      setSkillId('');
      setCustomSkill('');
      setNote('');
      setProofDocument(null);
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

  return (
    <div className="apid-card">
      <div className="boa-card-header">
        <div>
          <h3 className="boa-card-title">Apply for Mentor</h3>
          <p className="boa-card-subtitle">
            Select a skill to mentor and upload a document as proof of your experience.
          </p>
        </div>
      </div>
      <form className="apid-form" onSubmit={handleSubmit}>
        <div className="apid-field">
          <label htmlFor="mentor-application-skill">Catalog skill (optional)</label>
          <select
            id="mentor-application-skill"
            className="apid-input"
            value={skillId}
            onChange={(event) => setSkillId(event.target.value)}
            disabled={isSubmitting || activeSkills.length === 0}
          >
            <option value="">
              {activeSkills.length === 0 ? 'No active skills available' : 'Select a catalog skill'}
            </option>
            {activeSkills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
              </option>
            ))}
          </select>
          <span className="boa-muted" style={{ fontSize: '0.78rem' }}>
            Enter a custom skill, choose a catalog skill, or provide both.
          </span>
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
          <label htmlFor="mentor-application-proof">Proof document</label>
          <input
            id="mentor-application-proof"
            type="file"
            className="apid-input"
            accept=".pdf,.docx,.png,.jpg,.jpeg"
            required
            disabled={isSubmitting}
            onChange={(event) => setProofDocument(event.target.files?.[0] ?? null)}
          />
          <span className="boa-muted" style={{ fontSize: '0.78rem' }}>
            PDF, DOCX, PNG, JPG, or JPEG; maximum file size 10 MB.
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
