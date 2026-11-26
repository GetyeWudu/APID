CREATE TABLE IF NOT EXISTS mentoring.mentoring_session_attendees (
    session_id  BIGINT NOT NULL
                REFERENCES mentoring.mentoring_sessions(id) ON DELETE CASCADE,
    member_id   BIGINT NOT NULL
                REFERENCES mentoring.mentoring_relationship_members(id) ON DELETE CASCADE,
    PRIMARY KEY (session_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_mentoring_session_attendees_member
    ON mentoring.mentoring_session_attendees (member_id);
