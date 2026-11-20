ALTER TABLE mentoring.mentoring_resources
    ADD COLUMN session_id BIGINT
        REFERENCES mentoring.mentoring_sessions(id) ON DELETE CASCADE;

CREATE INDEX idx_mentoring_resources_session_created
    ON mentoring.mentoring_resources (session_id, created_at DESC)
    WHERE session_id IS NOT NULL;
