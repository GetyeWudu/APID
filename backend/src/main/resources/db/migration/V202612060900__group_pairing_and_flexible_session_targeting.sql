-- Table: who the session targets when it is not a single individual
-- A session with no rows here AND target_trainee_member_id IS NULL targets ALL group members.
-- A session with rows here (and target_trainee_member_id IS NULL) targets only listed members.
CREATE TABLE mentoring.mentoring_session_targets (
    id                       BIGSERIAL PRIMARY KEY,
    session_id               BIGINT NOT NULL
                             REFERENCES mentoring.mentoring_sessions(id) ON DELETE CASCADE,
    relationship_member_id   BIGINT NOT NULL
                             REFERENCES mentoring.mentoring_relationship_members(id) ON DELETE RESTRICT,
    CONSTRAINT uq_session_target UNIQUE (session_id, relationship_member_id)
);

CREATE INDEX idx_mentoring_session_targets_session ON mentoring.mentoring_session_targets (session_id);

-- Track which 1-on-1 relationships were merged into which group relationship
CREATE TABLE mentoring.mentoring_group_pairing_sources (
    group_relationship_id  BIGINT NOT NULL
                           REFERENCES mentoring.mentoring_relationships(id) ON DELETE RESTRICT,
    source_relationship_id BIGINT NOT NULL
                           REFERENCES mentoring.mentoring_relationships(id) ON DELETE RESTRICT,
    merged_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_relationship_id, source_relationship_id)
);
