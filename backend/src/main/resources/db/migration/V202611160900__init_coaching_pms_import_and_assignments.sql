-- Phase 5 Step 1: Coaching PMS Appraisal Import, Multi-Goal Staging, Performance Records & Mandatory Assignments

CREATE TABLE IF NOT EXISTS coaching.pms_report_batches (
    id                             BIGSERIAL PRIMARY KEY,
    stored_file_id                 BIGINT       NOT NULL REFERENCES core.stored_files(id),
    file_name                      VARCHAR(255) NOT NULL,
    file_sha256                    VARCHAR(64)  NOT NULL,
    performance_fiscal_quarter_id  BIGINT       NOT NULL REFERENCES core.fiscal_quarters(id),
    coaching_fiscal_quarter_id     BIGINT       NOT NULL REFERENCES core.fiscal_quarters(id),
    pms_year                       VARCHAR(10)  NOT NULL,
    pms_quarter                    SMALLINT     NOT NULL CHECK (pms_quarter BETWEEN 1 AND 4),
    document_name                  VARCHAR(255),
    mandatory_cutoff_rounded       SMALLINT     NOT NULL DEFAULT 3,
    status                         VARCHAR(20)  NOT NULL DEFAULT 'PREVIEW'
                                   CHECK (status IN ('PREVIEW', 'COMMITTED', 'EXPIRED', 'CANCELLED', 'FAILED')),
    total_source_rows              INT          NOT NULL DEFAULT 0,
    unique_employees_count         INT          NOT NULL DEFAULT 0,
    mandatory_below3_count         INT          NOT NULL DEFAULT 0,
    passing_count                  INT          NOT NULL DEFAULT 0,
    error_rows_count               INT          NOT NULL DEFAULT 0,
    warning_rows_count             INT          NOT NULL DEFAULT 0,
    uploaded_by_user_id            BIGINT       NOT NULL REFERENCES core.users(id),
    committed_by_user_id           BIGINT       REFERENCES core.users(id),
    expires_at                     TIMESTAMPTZ  NOT NULL,
    committed_at                   TIMESTAMPTZ,
    created_at                     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_pms_batches_committed_sha256
    ON coaching.pms_report_batches (file_sha256)
    WHERE status = 'COMMITTED';

CREATE UNIQUE INDEX uq_pms_batches_committed_perf_quarter
    ON coaching.pms_report_batches (performance_fiscal_quarter_id)
    WHERE status = 'COMMITTED';

CREATE INDEX idx_pms_batches_status_created
    ON coaching.pms_report_batches (status, created_at DESC);

-- Staging table for consolidated employee preview rows
CREATE TABLE IF NOT EXISTS coaching.pms_import_employee_staging (
    id                             BIGSERIAL PRIMARY KEY,
    batch_id                       BIGINT       NOT NULL REFERENCES coaching.pms_report_batches(id) ON DELETE CASCADE,
    source_row_number              INT          NOT NULL,
    employee_number                VARCHAR(60)  NOT NULL,
    pms_full_name                  VARCHAR(200),
    pms_email                      VARCHAR(200),
    pms_department                 VARCHAR(200),
    pms_job                        VARCHAR(200),
    pms_position                   VARCHAR(200),
    resolved_employee_id           BIGINT       REFERENCES core.employees(id),
    resolved_manager_employee_id   BIGINT       REFERENCES core.employees(id),
    has_coachee_portal_account     BOOLEAN      NOT NULL DEFAULT FALSE,
    has_coach_portal_account       BOOLEAN      NOT NULL DEFAULT FALSE,
    evaluation_status              VARCHAR(50),
    overall_final_rating           NUMERIC(8,4),
    rounded_overall_final_rating   SMALLINT     NOT NULL,
    goal_count                     INT          NOT NULL DEFAULT 1,
    validation_status              VARCHAR(20)  NOT NULL
                                   CHECK (validation_status IN ('VALID', 'WARNING', 'ERROR')),
    planned_action                 VARCHAR(30)  NOT NULL
                                   CHECK (planned_action IN ('CREATE_ASSIGNMENT', 'CONTINUE_ASSIGNMENT', 'CLEAR_PRIOR_ASSIGNMENT', 'PENDING_COACH', 'NO_ACTION', 'BLOCKED')),
    errors_json                    JSONB,
    warnings_json                  JSONB,
    created_at                     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pms_emp_staging_batch_status
    ON coaching.pms_import_employee_staging (batch_id, validation_status);

CREATE INDEX idx_pms_emp_staging_batch_id
    ON coaching.pms_import_employee_staging (batch_id, id ASC);

-- Staging table for individual goal rows under each employee staging row
CREATE TABLE IF NOT EXISTS coaching.pms_import_goal_staging (
    id                    BIGSERIAL PRIMARY KEY,
    employee_staging_id   BIGINT       REFERENCES coaching.pms_import_employee_staging(id) ON DELETE CASCADE,
    source_row_number     INT          NOT NULL,
    goal_name             VARCHAR(255) NOT NULL,
    goal_tracking_name    VARCHAR(255),
    target_value          VARCHAR(100),
    actual_value          VARCHAR(100),
    goal_score            NUMERIC(8,4),
    weight                NUMERIC(6,2),
    line_score            NUMERIC(8,4)
);

CREATE INDEX idx_pms_goal_staging_emp
    ON coaching.pms_import_goal_staging (employee_staging_id);

-- Committed official performance records (1 row per employee per performance quarter)
CREATE TABLE IF NOT EXISTS coaching.pms_performance_records (
    id                             BIGSERIAL PRIMARY KEY,
    batch_id                       BIGINT       NOT NULL REFERENCES coaching.pms_report_batches(id),
    employee_id                    BIGINT       NOT NULL REFERENCES core.employees(id),
    performance_fiscal_quarter_id  BIGINT       NOT NULL REFERENCES core.fiscal_quarters(id),
    pms_year                       VARCHAR(10)  NOT NULL,
    pms_quarter                    SMALLINT     NOT NULL CHECK (pms_quarter BETWEEN 1 AND 4),
    evaluation_status              VARCHAR(50),
    overall_final_rating           NUMERIC(8,4) NOT NULL,
    rounded_overall_final_rating   SMALLINT     NOT NULL,
    mandatory_coaching_triggered   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at                     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pms_perf_records_emp_quarter UNIQUE (employee_id, performance_fiscal_quarter_id)
);

CREATE INDEX idx_pms_perf_records_batch
    ON coaching.pms_performance_records (batch_id);

-- Committed official goal breakdown lines
CREATE TABLE IF NOT EXISTS coaching.pms_goal_lines (
    id                    BIGSERIAL PRIMARY KEY,
    performance_record_id BIGINT       NOT NULL REFERENCES coaching.pms_performance_records(id) ON DELETE CASCADE,
    source_row_number     INT          NOT NULL,
    goal_name             VARCHAR(255) NOT NULL,
    goal_tracking_name    VARCHAR(255),
    target_value          VARCHAR(100),
    actual_value          VARCHAR(100),
    goal_score            NUMERIC(8,4),
    weight                NUMERIC(6,2),
    line_score            NUMERIC(8,4)
);

CREATE INDEX idx_pms_goal_lines_record
    ON coaching.pms_goal_lines (performance_record_id);

-- Coaching assignments (Pathway A: Mandatory PMS, Pathway B: Self Development)
CREATE TABLE IF NOT EXISTS coaching.coaching_assignments (
    id                             BIGSERIAL PRIMARY KEY,
    pathway                        VARCHAR(30)  NOT NULL
                                   CHECK (pathway IN ('MANDATORY_PMS', 'SELF_DEVELOPMENT')),
    coachee_employee_id            BIGINT       NOT NULL REFERENCES core.employees(id),
    coach_employee_id              BIGINT       REFERENCES core.employees(id),
    performance_record_id          BIGINT       REFERENCES coaching.pms_performance_records(id),
    performance_fiscal_quarter_id  BIGINT       NOT NULL REFERENCES core.fiscal_quarters(id),
    coaching_fiscal_quarter_id     BIGINT       NOT NULL REFERENCES core.fiscal_quarters(id),
    previous_assignment_id         BIGINT       REFERENCES coaching.coaching_assignments(id),
    status                         VARCHAR(30)  NOT NULL DEFAULT 'ACTIVE'
                                   CHECK (status IN ('PENDING_COACH_ASSIGNMENT', 'ACTIVE', 'COMPLETED', 'CLOSED')),
    closure_reason                 VARCHAR(30)
                                   CHECK (closure_reason IN ('CLEARED_BY_PMS', 'CONTINUED_NEXT_QUARTER', 'SUCCESSFULLY_COMPLETED', 'ADMINISTRATIVE_CLOSURE')),
    at_risk                        BOOLEAN      NOT NULL DEFAULT FALSE,
    missed_sessions_count          INT          NOT NULL DEFAULT 0,
    last_activity_at               TIMESTAMPTZ,
    closed_at                      TIMESTAMPTZ,
    created_at                     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at                     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_coaching_assignment_pathway CHECK (
        (pathway = 'MANDATORY_PMS' AND performance_record_id IS NOT NULL)
        OR
        (pathway = 'SELF_DEVELOPMENT' AND performance_record_id IS NULL)
    )
);

CREATE UNIQUE INDEX uq_coaching_assignments_active_mandatory
    ON coaching.coaching_assignments (coachee_employee_id, coaching_fiscal_quarter_id)
    WHERE pathway = 'MANDATORY_PMS' AND status IN ('PENDING_COACH_ASSIGNMENT', 'ACTIVE');

CREATE INDEX idx_coaching_assignments_coach
    ON coaching.coaching_assignments (coach_employee_id, status);

CREATE INDEX idx_coaching_assignments_coachee
    ON coaching.coaching_assignments (coachee_employee_id, status);

-- Coaching participants tracking (one active Coach and one active Coachee per assignment)
CREATE TABLE IF NOT EXISTS coaching.coaching_participants (
    id             BIGSERIAL PRIMARY KEY,
    assignment_id  BIGINT      NOT NULL REFERENCES coaching.coaching_assignments(id) ON DELETE CASCADE,
    employee_id    BIGINT      NOT NULL REFERENCES core.employees(id),
    role           VARCHAR(20) NOT NULL CHECK (role IN ('COACH', 'COACHEE', 'OBSERVER')),
    active         BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_active_assignment_coach
    ON coaching.coaching_participants (assignment_id)
    WHERE active = TRUE AND role = 'COACH';

CREATE UNIQUE INDEX uq_active_assignment_coachee
    ON coaching.coaching_participants (assignment_id)
    WHERE active = TRUE AND role = 'COACHEE';

CREATE INDEX idx_coaching_participants_emp
    ON coaching.coaching_participants (employee_id, role, active);

-- Coach replacement and assignment audit trail
CREATE TABLE IF NOT EXISTS coaching.coach_replacement_history (
    id                          BIGSERIAL PRIMARY KEY,
    assignment_id               BIGINT       NOT NULL REFERENCES coaching.coaching_assignments(id) ON DELETE CASCADE,
    previous_coach_employee_id  BIGINT       REFERENCES core.employees(id),
    new_coach_employee_id       BIGINT       NOT NULL REFERENCES core.employees(id),
    reason                      VARCHAR(500) NOT NULL,
    changed_by_user_id          BIGINT       NOT NULL REFERENCES core.users(id),
    changed_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coach_replacement_assignment
    ON coaching.coach_replacement_history (assignment_id, changed_at DESC);
