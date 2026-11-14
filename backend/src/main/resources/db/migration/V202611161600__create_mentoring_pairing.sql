CREATE TABLE mentoring.mentoring_requests (
    id                  BIGSERIAL PRIMARY KEY,
    mentor_user_id      BIGINT NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
    initiated_by_user_id BIGINT NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
    request_type        VARCHAR(20) NOT NULL CHECK (request_type IN ('INDIVIDUAL', 'GROUP')),
    skill_id            BIGINT REFERENCES core.skills(id) ON DELETE SET NULL,
    message             VARCHAR(1000),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mentoring.mentoring_request_recipients (
    id                  BIGSERIAL PRIMARY KEY,
    request_id          BIGINT NOT NULL REFERENCES mentoring.mentoring_requests(id) ON DELETE RESTRICT,
    recipient_user_id   BIGINT NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
    trainee_user_id     BIGINT NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
    responded_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_mentoring_request_recipient UNIQUE (request_id, recipient_user_id),
    CONSTRAINT chk_mentoring_request_response_time
        CHECK ((status = 'PENDING' AND responded_at IS NULL) OR (status <> 'PENDING' AND responded_at IS NOT NULL))
);

CREATE TABLE mentoring.mentoring_relationships (
    id                  BIGSERIAL PRIMARY KEY,
    request_id          BIGINT NOT NULL UNIQUE
                        REFERENCES mentoring.mentoring_requests(id) ON DELETE RESTRICT,
    mentor_user_id      BIGINT NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'REASSIGNED')),
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at            TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_mentoring_relationship_end_time
        CHECK ((status IN ('ACTIVE', 'PAUSED') AND ended_at IS NULL)
            OR (status IN ('COMPLETED', 'CANCELLED', 'REASSIGNED') AND ended_at IS NOT NULL))
);

CREATE TABLE mentoring.mentoring_relationship_members (
    id                          BIGSERIAL PRIMARY KEY,
    relationship_id             BIGINT NOT NULL
                                REFERENCES mentoring.mentoring_relationships(id) ON DELETE RESTRICT,
    request_recipient_id        BIGINT NOT NULL UNIQUE
                                REFERENCES mentoring.mentoring_request_recipients(id) ON DELETE RESTRICT,
    mentor_user_id              BIGINT NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
    trainee_user_id             BIGINT NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
    status                      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                                CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    joined_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at                    TIMESTAMPTZ,
    CONSTRAINT chk_mentoring_member_end_time
        CHECK ((status = 'ACTIVE' AND ended_at IS NULL) OR (status <> 'ACTIVE' AND ended_at IS NOT NULL))
);

CREATE INDEX idx_mentoring_requests_initiator_created
    ON mentoring.mentoring_requests (initiated_by_user_id, created_at DESC);

CREATE INDEX idx_mentoring_requests_mentor_created
    ON mentoring.mentoring_requests (mentor_user_id, created_at DESC);

CREATE INDEX idx_mentoring_request_recipients_recipient_status
    ON mentoring.mentoring_request_recipients (recipient_user_id, status, created_at DESC);

CREATE INDEX idx_mentoring_request_recipients_trainee
    ON mentoring.mentoring_request_recipients (trainee_user_id, status);

CREATE INDEX idx_mentoring_relationships_mentor_status
    ON mentoring.mentoring_relationships (mentor_user_id, status);

CREATE INDEX idx_mentoring_relationship_members_mentor_status
    ON mentoring.mentoring_relationship_members (mentor_user_id, status);

CREATE INDEX idx_mentoring_relationship_members_trainee_status
    ON mentoring.mentoring_relationship_members (trainee_user_id, status);

CREATE UNIQUE INDEX uq_active_mentoring_pair
    ON mentoring.mentoring_relationship_members (mentor_user_id, trainee_user_id)
    WHERE status = 'ACTIVE';

