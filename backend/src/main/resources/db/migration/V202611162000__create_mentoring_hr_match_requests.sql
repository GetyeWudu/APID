CREATE TABLE mentoring.mentoring_match_requests (
    id                       BIGSERIAL PRIMARY KEY,
    trainee_employee_id      BIGINT NOT NULL REFERENCES core.employees(id) ON DELETE RESTRICT,
    skill_id                 BIGINT NOT NULL REFERENCES core.skills(id) ON DELETE RESTRICT,
    message                  VARCHAR(1000),
    status                   VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                             CHECK (status IN ('OPEN', 'MATCHED', 'CANCELLED')),
    matched_trainer_user_id  BIGINT REFERENCES core.users(id) ON DELETE RESTRICT,
    matched_by_user_id       BIGINT REFERENCES core.users(id) ON DELETE RESTRICT,
    mentoring_request_id     BIGINT UNIQUE REFERENCES mentoring.mentoring_requests(id) ON DELETE RESTRICT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_mentoring_match_request_resolution CHECK (
        (status = 'OPEN' AND matched_trainer_user_id IS NULL AND matched_by_user_id IS NULL
            AND mentoring_request_id IS NULL)
        OR (status = 'MATCHED' AND matched_trainer_user_id IS NOT NULL AND matched_by_user_id IS NOT NULL
            AND mentoring_request_id IS NOT NULL)
        OR status = 'CANCELLED'
    )
);

CREATE INDEX idx_mentoring_match_requests_status_created
    ON mentoring.mentoring_match_requests (status, created_at DESC);

CREATE INDEX idx_mentoring_match_requests_employee_skill
    ON mentoring.mentoring_match_requests (trainee_employee_id, skill_id, status);
