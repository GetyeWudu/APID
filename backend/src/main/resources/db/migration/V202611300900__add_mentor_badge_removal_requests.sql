CREATE TABLE mentoring.mentor_badge_removal_requests (
    id BIGSERIAL PRIMARY KEY,
    trainer_auth_id BIGINT NOT NULL REFERENCES mentoring.trainer_authorizations(id) ON DELETE RESTRICT,
    requested_by_user_id BIGINT NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
    request_reason VARCHAR(1000),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'DECLINED')),
    approval_disposition VARCHAR(30)
        CHECK (approval_disposition IS NULL OR approval_disposition IN ('KEEP_EXISTING_PAIRINGS', 'REVOKE_ALL_PAIRINGS')),
    reviewed_by_user_id BIGINT REFERENCES core.users(id) ON DELETE RESTRICT,
    reviewed_at TIMESTAMPTZ,
    decision_reason VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_badge_removal_review_fields CHECK (
        (status = 'PENDING' AND reviewed_by_user_id IS NULL AND reviewed_at IS NULL)
        OR (status <> 'PENDING' AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)
    ),
    CONSTRAINT chk_badge_removal_approval_disposition CHECK (
        status <> 'APPROVED' OR approval_disposition IS NOT NULL
    )
);

CREATE UNIQUE INDEX uq_badge_removal_pending_per_authorization
    ON mentoring.mentor_badge_removal_requests (trainer_auth_id)
    WHERE status = 'PENDING';

CREATE INDEX idx_badge_removal_requests_status_created
    ON mentoring.mentor_badge_removal_requests (status, created_at);
