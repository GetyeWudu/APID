CREATE TABLE mentoring.mentoring_sessions (
    id                  BIGSERIAL PRIMARY KEY,
    relationship_id     BIGINT NOT NULL
                        REFERENCES mentoring.mentoring_relationships(id) ON DELETE RESTRICT,
    title               VARCHAR(180) NOT NULL,
    agenda              VARCHAR(2000),
    scheduled_start     TIMESTAMPTZ NOT NULL,
    scheduled_end       TIMESTAMPTZ NOT NULL,
    delivery_mode       VARCHAR(20) NOT NULL
                        CHECK (delivery_mode IN ('ONLINE', 'IN_PERSON', 'HYBRID')),
    meeting_url         VARCHAR(1000),
    status              VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED'
                        CHECK (status IN ('SCHEDULED', 'COMPLETED', 'MISSED', 'CANCELLED', 'RESCHEDULED')),
    notes               VARCHAR(4000),
    created_by_user_id  BIGINT NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_mentoring_session_time CHECK (scheduled_end > scheduled_start)
);

CREATE INDEX idx_mentoring_sessions_relationship_start
    ON mentoring.mentoring_sessions (relationship_id, scheduled_start DESC);

CREATE TABLE mentoring.mentoring_messages (
    id                  BIGSERIAL PRIMARY KEY,
    relationship_id     BIGINT NOT NULL
                        REFERENCES mentoring.mentoring_relationships(id) ON DELETE RESTRICT,
    sender_user_id      BIGINT NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
    body                VARCHAR(4000) NOT NULL CHECK (LENGTH(TRIM(body)) > 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mentoring_messages_relationship_created
    ON mentoring.mentoring_messages (relationship_id, created_at DESC, id DESC);
