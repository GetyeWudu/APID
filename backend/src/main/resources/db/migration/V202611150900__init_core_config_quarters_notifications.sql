-- Phase 4: Fiscal Quarters, Typed System Configuration, In-App Notifications & Durable Outbox

CREATE TABLE core.fiscal_quarters (
    id          BIGSERIAL PRIMARY KEY,
    fiscal_year VARCHAR(20) NOT NULL,
    quarter     SMALLINT    NOT NULL CHECK (quarter BETWEEN 1 AND 4),
    label       VARCHAR(50) NOT NULL,
    start_date  DATE        NOT NULL,
    end_date    DATE        NOT NULL,
    active      BOOLEAN     NOT NULL DEFAULT FALSE,
    locked      BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_fiscal_quarters_dates CHECK (end_date > start_date)
);

CREATE UNIQUE INDEX uq_fiscal_quarters_year_quarter
    ON core.fiscal_quarters (LOWER(fiscal_year), quarter);

CREATE UNIQUE INDEX uq_fiscal_quarters_single_active
    ON core.fiscal_quarters (active)
    WHERE active = TRUE;

CREATE INDEX idx_fiscal_quarters_dates
    ON core.fiscal_quarters (start_date, end_date);

-- Baseline FY 2026/27 operational calendar per SRS Section 4.1 (Q2 Oct-Dec active for Nov 2026 baseline)
INSERT INTO core.fiscal_quarters (fiscal_year, quarter, label, start_date, end_date, active, locked) VALUES
    ('2026/27', 1, 'FY 2026/27 · Q1', DATE '2026-06-01', DATE '2026-09-30', FALSE, FALSE),
    ('2026/27', 2, 'FY 2026/27 · Q2', DATE '2026-10-01', DATE '2026-12-31', TRUE,  FALSE),
    ('2026/27', 3, 'FY 2026/27 · Q3', DATE '2027-01-01', DATE '2027-03-31', FALSE, FALSE),
    ('2026/27', 4, 'FY 2026/27 · Q4', DATE '2027-04-01', DATE '2027-05-31', FALSE, FALSE)
ON CONFLICT DO NOTHING;

CREATE TABLE core.system_configs (
    config_key         VARCHAR(100) PRIMARY KEY,
    config_value       VARCHAR(500) NOT NULL,
    value_type         VARCHAR(20)  NOT NULL CHECK (value_type IN ('INTEGER', 'DECIMAL', 'BOOLEAN', 'STRING')),
    description        VARCHAR(500),
    is_public          BOOLEAN      NOT NULL DEFAULT FALSE,
    updated_by_user_id BIGINT       REFERENCES core.users(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO core.system_configs (config_key, config_value, value_type, description, is_public) VALUES
    ('coaching.mandatory_cutoff_rounded', '3', 'INTEGER',
     'Mandatory Performance Coaching triggers when RoundedOverallFinalRating < this cutoff (Grades 1 and 2)', TRUE),
    ('coaching.missed_session_alert_threshold', '2', 'INTEGER',
     'Missed coaching sessions threshold before flagging an assignment At Risk', TRUE),
    ('coaching.inactivity_reminder_days', '14', 'INTEGER',
     'Days without coaching activity before sending reminder notifications', TRUE),
    ('mentoring.default_max_trainees_per_trainer', '3', 'INTEGER',
     'Default maximum concurrent trainees allowed per certified trainer', FALSE),
    ('files.max_upload_mb', '25', 'INTEGER',
     'Maximum allowed uploaded file size in megabytes', TRUE)
ON CONFLICT (config_key) DO NOTHING;

CREATE TABLE core.notifications (
    id                BIGSERIAL PRIMARY KEY,
    recipient_user_id BIGINT        NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    module            VARCHAR(30)   NOT NULL CHECK (module IN ('SYSTEM', 'COACHING', 'MENTORING')),
    event_type        VARCHAR(60)   NOT NULL,
    title             VARCHAR(200)  NOT NULL,
    message           VARCHAR(1000) NOT NULL,
    deep_link         VARCHAR(300),
    is_read           BOOLEAN       NOT NULL DEFAULT FALSE,
    read_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_notifications_read_consistency CHECK (read_at IS NULL OR is_read = TRUE)
);

CREATE INDEX idx_notifications_recipient_unread
    ON core.notifications (recipient_user_id, is_read, created_at DESC);

CREATE TABLE core.notification_outbox (
    id                BIGSERIAL PRIMARY KEY,
    notification_id   BIGINT      REFERENCES core.notifications(id) ON DELETE CASCADE,
    recipient_user_id BIGINT      NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    channel           VARCHAR(30) NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL')),
    event_type        VARCHAR(60) NOT NULL,
    payload_json      JSONB       NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')),
    attempt_count     INTEGER     NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    next_attempt_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error        VARCHAR(500),
    processed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_outbox_pending
    ON core.notification_outbox (status, next_attempt_at)
    WHERE status = 'PENDING';

