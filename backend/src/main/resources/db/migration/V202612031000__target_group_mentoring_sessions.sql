ALTER TABLE mentoring.mentoring_sessions
    ADD COLUMN target_trainee_member_id BIGINT
        REFERENCES mentoring.mentoring_relationship_members(id) ON DELETE RESTRICT;

CREATE INDEX idx_mentoring_sessions_target_trainee
    ON mentoring.mentoring_sessions (target_trainee_member_id)
    WHERE target_trainee_member_id IS NOT NULL;
