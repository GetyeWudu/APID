CREATE TABLE mentoring.mentor_applications (
    id                BIGSERIAL PRIMARY KEY,
    applicant_user_id BIGINT       NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
    status            VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('APPROVED', 'PENDING', 'DECLINED')),
    proof_file_id     BIGINT       NOT NULL REFERENCES core.stored_files(id) ON DELETE RESTRICT,
    note              TEXT,
    submitted_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mentor_applications_applicant_submitted
    ON mentoring.mentor_applications (applicant_user_id, submitted_at DESC);

CREATE INDEX idx_mentor_applications_status_submitted
    ON mentoring.mentor_applications (status, submitted_at DESC);
