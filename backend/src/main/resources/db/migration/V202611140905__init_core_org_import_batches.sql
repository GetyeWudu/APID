-- Core Phase 3 Hardening: Persistent Organization Import Preview & Commit Batches

CREATE TABLE core.org_import_batches (
    id                       BIGSERIAL PRIMARY KEY,
    uploaded_by_user_id      BIGINT       NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
    file_name                VARCHAR(255) NOT NULL,
    file_hash                VARCHAR(64)  NOT NULL,
    file_format              VARCHAR(20)  NOT NULL,
    detected_schema          VARCHAR(40)  NOT NULL,
    column_presence_json     JSONB        NOT NULL DEFAULT '{}'::jsonb,
    status                   VARCHAR(30)  NOT NULL DEFAULT 'PREVIEWED',
    total_source_rows        INT          NOT NULL DEFAULT 0,
    unique_employees         INT          NOT NULL DEFAULT 0,
    duplicate_rows_collapsed INT          NOT NULL DEFAULT 0,
    employees_to_create      INT          NOT NULL DEFAULT 0,
    employees_to_update      INT          NOT NULL DEFAULT 0,
    departments_to_create    INT          NOT NULL DEFAULT 0,
    managers_to_link         INT          NOT NULL DEFAULT 0,
    error_rows               INT          NOT NULL DEFAULT 0,
    warning_rows             INT          NOT NULL DEFAULT 0,
    employees_created        INT          NOT NULL DEFAULT 0,
    employees_updated        INT          NOT NULL DEFAULT 0,
    departments_created      INT          NOT NULL DEFAULT 0,
    managers_linked          INT          NOT NULL DEFAULT 0,
    summary_warnings_json    JSONB        NOT NULL DEFAULT '[]'::jsonb,
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at               TIMESTAMPTZ  NOT NULL,
    committed_at             TIMESTAMPTZ,
    CONSTRAINT chk_org_import_batch_status
        CHECK (status IN ('PREVIEWED', 'COMMITTED', 'FAILED', 'EXPIRED', 'CANCELLED')),
    CONSTRAINT chk_org_import_batch_format
        CHECK (file_format IN ('CSV', 'XLSX'))
);

CREATE INDEX idx_org_import_batches_uploader_created
    ON core.org_import_batches (uploaded_by_user_id, created_at DESC);

CREATE INDEX idx_org_import_batches_status_expires
    ON core.org_import_batches (status, expires_at);

CREATE TABLE core.org_import_batch_rows (
    id                  BIGSERIAL PRIMARY KEY,
    batch_id            BIGINT      NOT NULL REFERENCES core.org_import_batches(id) ON DELETE CASCADE,
    row_number          INT         NOT NULL,
    employee_number     VARCHAR(60),
    planned_action      VARCHAR(20) NOT NULL,
    row_status          VARCHAR(20) NOT NULL,
    normalized_data     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    validation_errors   JSONB       NOT NULL DEFAULT '[]'::jsonb,
    validation_warnings JSONB       NOT NULL DEFAULT '[]'::jsonb,
    CONSTRAINT chk_org_import_row_action
        CHECK (planned_action IN ('CREATE', 'UPDATE', 'ERROR')),
    CONSTRAINT chk_org_import_row_status
        CHECK (row_status IN ('VALID', 'WARNING', 'ERROR'))
);

CREATE INDEX idx_org_import_batch_rows_batch_order
    ON core.org_import_batch_rows (batch_id, id);

CREATE INDEX idx_org_import_batch_rows_batch_status
    ON core.org_import_batch_rows (batch_id, row_status, id);

