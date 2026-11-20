CREATE TABLE mentoring.mentoring_session_ratings (
    id              BIGSERIAL PRIMARY KEY,
    session_id      BIGINT NOT NULL
                    REFERENCES mentoring.mentoring_sessions(id) ON DELETE RESTRICT,
    mentee_user_id  BIGINT NOT NULL
                    REFERENCES core.users(id) ON DELETE RESTRICT,
    rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    rated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_mentoring_session_rating_per_mentee
        UNIQUE (session_id, mentee_user_id)
);
