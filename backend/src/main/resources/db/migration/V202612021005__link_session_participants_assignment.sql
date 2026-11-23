-- Migration: V202612021000__link_session_participants_assignment.sql
-- Description: Link session_participants directly to coaching_assignments to enable independent multi-coachee session counting

ALTER TABLE coaching.session_participants
ADD COLUMN IF NOT EXISTS assignment_id BIGINT
REFERENCES coaching.coaching_assignments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_session_participants_assignment
ON coaching.session_participants(assignment_id);
