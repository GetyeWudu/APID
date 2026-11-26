-- A group session is a single MentoringSession whose participants come from
-- multiple different 1-on-1 relationships (not a group relationship).
-- We reuse the existing mentoring_session_targets join table to hold the
-- per-pairing projection rows that make the session visible inside each
-- trainee's individual relationship.
--
-- New column on mentoring_sessions: marks the session as a cross-pairing group session.
ALTER TABLE mentoring.mentoring_sessions
    ADD COLUMN is_group_session BOOLEAN NOT NULL DEFAULT FALSE;

-- For group sessions, target_trainee_member_id is null and is_group_session = true.
-- mentoring_session_targets rows point to the per-relationship members that should see it.
-- No schema change required beyond the flag above; existing tables handle the rest.

-- Index to fetch group sessions efficiently.
CREATE INDEX idx_mentoring_sessions_group
    ON mentoring.mentoring_sessions (is_group_session, relationship_id)
    WHERE is_group_session = TRUE;
