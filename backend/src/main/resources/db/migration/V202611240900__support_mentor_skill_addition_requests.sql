ALTER TABLE mentoring.mentor_applications
    ADD COLUMN application_type VARCHAR(30) NOT NULL DEFAULT 'INITIAL'
        CHECK (application_type IN ('INITIAL', 'SKILL_ADDITION'));

CREATE INDEX idx_mentor_applications_applicant_type_submitted
    ON mentoring.mentor_applications (applicant_user_id, application_type, submitted_at DESC);
