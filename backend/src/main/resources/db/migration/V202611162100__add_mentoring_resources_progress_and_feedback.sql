CREATE TABLE mentoring.mentoring_resources (
    id                   BIGSERIAL PRIMARY KEY,
    relationship_id      BIGINT NOT NULL REFERENCES mentoring.mentoring_relationships(id) ON DELETE RESTRICT,
    title                VARCHAR(180) NOT NULL,
    resource_type        VARCHAR(20) NOT NULL CHECK (resource_type IN ('FILE', 'LINK')),
    file_id              BIGINT REFERENCES core.stored_files(id) ON DELETE RESTRICT,
    external_url         VARCHAR(1000),
    uploaded_by_user_id  BIGINT NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_mentoring_resource_target CHECK (
        (resource_type = 'FILE' AND file_id IS NOT NULL AND external_url IS NULL)
        OR (resource_type = 'LINK' AND file_id IS NULL AND external_url IS NOT NULL)
    )
);

CREATE TABLE mentoring.mentoring_progress_notes (
    id                  BIGSERIAL PRIMARY KEY,
    relationship_id     BIGINT NOT NULL REFERENCES mentoring.mentoring_relationships(id) ON DELETE RESTRICT,
    author_user_id      BIGINT NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
    note                VARCHAR(2000) NOT NULL CHECK (LENGTH(TRIM(note)) > 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mentoring.mentoring_relationship_trainees (
    relationship_id      BIGINT NOT NULL REFERENCES mentoring.mentoring_relationships(id) ON DELETE RESTRICT,
    trainee_employee_id  BIGINT NOT NULL REFERENCES core.employees(id) ON DELETE RESTRICT,
    rating               SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    feedback             VARCHAR(2000),
    rated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (relationship_id, trainee_employee_id)
);

CREATE INDEX idx_mentoring_resources_relationship_created
    ON mentoring.mentoring_resources (relationship_id, created_at DESC);

CREATE INDEX idx_mentoring_progress_relationship_created
    ON mentoring.mentoring_progress_notes (relationship_id, created_at DESC);

CREATE INDEX idx_mentoring_feedback_rating
    ON mentoring.mentoring_relationship_trainees (rating, rated_at DESC);
