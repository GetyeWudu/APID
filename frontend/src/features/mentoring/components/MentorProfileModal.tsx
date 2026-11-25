import {
  Award,
  BriefcaseBusiness,
  GraduationCap,
  Star,
  Users,
  X,
} from 'lucide-react';
import type { MentorExperience, MentorDirectoryItem } from '../api/mentorDirectoryApi';
import './MentorProfileModal.css';

function experienceDetails(entry: MentorExperience) {
  return [entry.organization, entry.years].filter(Boolean).join(' · ');
}

export function MentorProfileModal({
  mentor,
  profileSummary,
  careerExperience = [],
  mentorshipExperience = [],
  loading = false,
  error,
  onClose,
}: {
  mentor: MentorDirectoryItem;
  profileSummary?: string | null;
  careerExperience?: MentorExperience[];
  mentorshipExperience?: MentorExperience[];
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
}) {
  const profileBio = mentor.bio?.trim();
  const profileApproach = mentor.mentoringApproach?.trim();
  const savedProfileSummary = profileSummary?.trim();

  return (
    <div
      className="ai-mentor-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="ai-mentor-profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-mentor-profile-title"
      >
        <header className="ai-mentor-profile-header">
          <div>
            <span>Mentor profile</span>
            <h2 id="ai-mentor-profile-title">{mentor.fullName}</h2>
            {mentor.departmentName && <p>{mentor.departmentName}</p>}
          </div>
          <button
            type="button"
            className="ai-mentor-modal-close"
            aria-label="Close mentor profile"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="ai-mentor-profile-content">
          {error && <p className="ai-mentor-profile-error" role="alert">{error}</p>}
          <div className="ai-mentor-profile-facts">
            <div><BriefcaseBusiness size={16} /><span>Career experience</span>
              <strong>{mentor.experienceYears == null
                ? 'Not provided'
                : `${mentor.experienceYears} year${mentor.experienceYears === 1 ? '' : 's'}`}</strong>
            </div>
            <div><Users size={16} /><span>Mentoring capacity</span>
              <strong>{mentor.remainingCapacity} open slot{mentor.remainingCapacity === 1 ? '' : 's'}</strong>
            </div>
            <div><Star size={16} /><span>Average rating</span>
              <strong>{mentor.averageRating != null && mentor.averageRating > 0
                ? mentor.averageRating.toFixed(1)
                : 'Not rated yet'}</strong>
            </div>
            <div><Users size={16} /><span>Sessions per week</span>
              <strong>{mentor.sessionsPerWeek ?? 'Not provided'}</strong>
            </div>
          </div>
          <section className="ai-mentor-profile-section">
            <h3>Skills</h3>
            <div className="ai-mentor-profile-skills">
              {mentor.skills.length
                ? mentor.skills.map((skill) => <span key={skill.id}>{skill.name}</span>)
                : <p>No skills linked.</p>}
            </div>
          </section>
          {profileBio && (
            <section className="ai-mentor-profile-section">
              <h3>About</h3>
              <p>{profileBio}</p>
            </section>
          )}
          {profileApproach && (
            <section className="ai-mentor-profile-section">
              <h3>Mentoring approach</h3>
              <p>{profileApproach}</p>
            </section>
          )}
          {savedProfileSummary && (
            <section className="ai-mentor-profile-section">
              <h3>AI-powered profile summary</h3>
              <p>{savedProfileSummary}</p>
            </section>
          )}
          <section className="ai-mentor-profile-section">
            <h3><GraduationCap size={16} /> Education</h3>
            {mentor.education?.length ? mentor.education.map((education, index) => (
              <article className="ai-mentor-profile-record" key={`education-${index}`}>
                <strong>{education.educationLevel || 'Education'}</strong>
                <span>{[
                  education.fieldOfStudy,
                  education.institution,
                ].filter(Boolean).join(' · ') || 'Additional details not provided'}</span>
              </article>
            )) : <p>No education details provided.</p>}
          </section>
          <section className="ai-mentor-profile-section">
            <h3><Award size={16} /> Professional certificates</h3>
            {mentor.professionalCertificates?.length
              ? mentor.professionalCertificates.map((certificate, index) => (
                <article className="ai-mentor-profile-record" key={`certificate-${index}`}>
                  <strong>{certificate.title || 'Certificate'}</strong>
                  {certificate.skills?.length
                    ? <span>Related skills: {certificate.skills.join(', ')}</span>
                    : null}
                </article>
              ))
              : <p>No professional certificates provided.</p>}
          </section>
          <section className="ai-mentor-profile-section">
            <h3>Career experience</h3>
            {loading
              ? <p role="status">Loading career history...</p>
              : careerExperience.length
                ? careerExperience.map((entry, index) => (
                  <article className="ai-mentor-profile-record" key={`career-${index}`}>
                    <strong>{entry.role || 'Professional experience'}</strong>
                    {experienceDetails(entry) && <span>{experienceDetails(entry)}</span>}
                  </article>
                ))
                : <p>No detailed career history is available.</p>}
          </section>
          <section className="ai-mentor-profile-section">
            <h3>Mentorship experience</h3>
            {loading
              ? <p role="status">Loading mentorship history...</p>
              : mentorshipExperience.length
                ? mentorshipExperience.map((entry, index) => (
                  <article className="ai-mentor-profile-record" key={`mentorship-${index}`}>
                    <strong>{entry.role || 'Mentorship experience'}</strong>
                    {experienceDetails(entry) && <span>{experienceDetails(entry)}</span>}
                  </article>
                ))
                : <p>No detailed mentorship history is available.</p>}
          </section>
        </div>
        <footer className="ai-mentor-profile-footer">
          <button type="button" className="ai-mentor-view" onClick={onClose}>
            Close profile
          </button>
        </footer>
      </section>
    </div>
  );
}
