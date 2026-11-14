-- V202611210900__coaching_target_governance_and_series.sql
-- Implements Flexible Coaching Target Governance, Recurring Schedule Series, and Audit Trail

-- 1. Coaching Policy Versions
CREATE TABLE IF NOT EXISTS coaching.policy_versions (
    id                                  BIGSERIAL PRIMARY KEY,
    version_tag                         VARCHAR(50) NOT NULL,
    policy_name                         VARCHAR(120) NOT NULL,
    pathway                             VARCHAR(30) NOT NULL 
                                        CHECK (pathway IN ('MANDATORY_PMS', 'SELF_DEVELOPMENT')),
    min_appraisal_rating                NUMERIC(4,2),
    max_appraisal_rating                NUMERIC(4,2),
    baseline_sessions                   INT NOT NULL CHECK (baseline_sessions > 0),
    min_allowed_sessions                INT NOT NULL CHECK (min_allowed_sessions > 0),
    max_allowed_sessions                INT NOT NULL CHECK (max_allowed_sessions >= min_allowed_sessions),
    default_cadence                     VARCHAR(30) NOT NULL DEFAULT 'WEEKLY' 
                                        CHECK (default_cadence IN ('WEEKLY', 'BIWEEKLY', 'TWICE_WEEKLY', 'CUSTOM')),
    coach_adjustment_allowed            BOOLEAN NOT NULL DEFAULT TRUE,
    requires_pms_approval_outside_range BOOLEAN NOT NULL DEFAULT TRUE,
    allow_extensions                    BOOLEAN NOT NULL DEFAULT TRUE,
    allow_early_completion              BOOLEAN NOT NULL DEFAULT TRUE,
    is_active                           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policy_versions_active 
    ON coaching.policy_versions (pathway, is_active);

-- Seed Initial Bank of Abyssinia Policy Standards
INSERT INTO coaching.policy_versions (
    version_tag, policy_name, pathway, min_appraisal_rating, max_appraisal_rating,
    baseline_sessions, min_allowed_sessions, max_allowed_sessions, default_cadence,
    coach_adjustment_allowed, requires_pms_approval_outside_range, allow_extensions, allow_early_completion, is_active
) VALUES
('v2026.Q2.1', 'Critical Remediation Policy (Rating < 2.0)', 'MANDATORY_PMS', 0.00, 1.99, 10, 8, 12, 'WEEKLY', TRUE, TRUE, TRUE, TRUE, TRUE),
('v2026.Q2.1', 'Moderate Remediation Policy (Rating 2.0 - 2.99)', 'MANDATORY_PMS', 2.00, 2.99, 6, 4, 8, 'BIWEEKLY', TRUE, TRUE, TRUE, TRUE, TRUE),
('v2026.Q2.1', 'Self-Development Skill Cohort Policy', 'SELF_DEVELOPMENT', 3.00, 5.00, 4, 2, 6, 'BIWEEKLY', TRUE, FALSE, TRUE, TRUE, TRUE)
ON CONFLICT DO NOTHING;

-- 2. Coaching Session Targets (The binding commitment per assignment/cohort)
CREATE TABLE IF NOT EXISTS coaching.session_targets (
    id                                  BIGSERIAL PRIMARY KEY,
    assignment_id                       BIGINT REFERENCES coaching.coaching_assignments(id) ON DELETE CASCADE,
    skill_request_id                    BIGINT REFERENCES coaching.skill_coaching_requests(id) ON DELETE CASCADE,
    policy_version_id                   BIGINT REFERENCES coaching.policy_versions(id) ON DELETE RESTRICT,
    policy_baseline                     INT NOT NULL CHECK (policy_baseline > 0),
    approved_target                     INT NOT NULL CHECK (approved_target > 0),
    status                              VARCHAR(30) NOT NULL DEFAULT 'APPROVED'
                                        CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'EXTENDED', 'COMPLETED_EARLY', 'CLOSED')),
    justification_notes                 TEXT,
    approved_by_user_id                 BIGINT REFERENCES core.users(id),
    approved_at                         TIMESTAMPTZ,
    early_completion_reason             TEXT,
    early_completed_at                  TIMESTAMPTZ,
    created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_target_parent CHECK (
        (assignment_id IS NOT NULL AND skill_request_id IS NULL) OR 
        (assignment_id IS NULL AND skill_request_id IS NOT NULL)
    ),
    CONSTRAINT uq_target_assignment UNIQUE (assignment_id),
    CONSTRAINT uq_target_skill_request UNIQUE (skill_request_id)
);

CREATE INDEX IF NOT EXISTS idx_session_targets_assignment ON coaching.session_targets(assignment_id);
CREATE INDEX IF NOT EXISTS idx_session_targets_skill_req ON coaching.session_targets(skill_request_id);

-- 3. Coaching Target Adjustments & Extensions Audit Trail
CREATE TABLE IF NOT EXISTS coaching.target_adjustments (
    id                                  BIGSERIAL PRIMARY KEY,
    session_target_id                   BIGINT NOT NULL REFERENCES coaching.session_targets(id) ON DELETE CASCADE,
    adjustment_type                     VARCHAR(30) NOT NULL 
                                        CHECK (adjustment_type IN ('INITIAL_PROPOSAL', 'EXTENSION_REQUEST', 'EARLY_COMPLETION_REQUEST')),
    requested_by_employee_id            BIGINT NOT NULL REFERENCES core.employees(id),
    previous_target                     INT NOT NULL,
    proposed_target                     INT NOT NULL,
    reason                              TEXT NOT NULL,
    pms_reviewer_id                     BIGINT REFERENCES core.employees(id),
    pms_decision                        VARCHAR(30) NOT NULL DEFAULT 'PENDING'
                                        CHECK (pms_decision IN ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_APPROVED')),
    decision_notes                      TEXT,
    decided_at                          TIMESTAMPTZ,
    created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_target_adjustments_target ON coaching.target_adjustments(session_target_id, created_at DESC);

-- 4. Coaching Schedule Series (Recurring Meeting Engine)
CREATE TABLE IF NOT EXISTS coaching.schedule_series (
    id                                  BIGSERIAL PRIMARY KEY,
    assignment_id                       BIGINT REFERENCES coaching.coaching_assignments(id) ON DELETE CASCADE,
    skill_request_id                    BIGINT REFERENCES coaching.skill_coaching_requests(id) ON DELETE CASCADE,
    coach_employee_id                   BIGINT NOT NULL REFERENCES core.employees(id),
    title                               VARCHAR(200) NOT NULL,
    cadence_type                        VARCHAR(30) NOT NULL 
                                        CHECK (cadence_type IN ('WEEKLY', 'BIWEEKLY', 'TWICE_WEEKLY', 'CUSTOM')),
    days_of_week                        VARCHAR(60) NOT NULL,
    preferred_start_time                TIME NOT NULL,
    duration_minutes                    INT NOT NULL CHECK (duration_minutes >= 15 AND duration_minutes <= 180),
    meeting_mode                        VARCHAR(30) NOT NULL DEFAULT 'VIRTUAL_VIDEO'
                                        CHECK (meeting_mode IN ('VIRTUAL_VIDEO', 'PHONE_CALL', 'IN_PERSON')),
    meeting_location                    VARCHAR(255),
    first_session_date                  DATE NOT NULL,
    target_occurrences                  INT NOT NULL CHECK (target_occurrences > 0),
    generated_occurrences               INT NOT NULL DEFAULT 0,
    status                              VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
                                        CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED')),
    created_by_user_id                  BIGINT NOT NULL REFERENCES core.users(id),
    created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_series_parent CHECK (
        (assignment_id IS NOT NULL AND skill_request_id IS NULL) OR 
        (assignment_id IS NULL AND skill_request_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_schedule_series_assignment ON coaching.schedule_series(assignment_id);
CREATE INDEX IF NOT EXISTS idx_schedule_series_skill_req ON coaching.schedule_series(skill_request_id);

-- 5. Extend coaching_sessions with series linkage and sequence tracking
ALTER TABLE coaching.coaching_sessions 
    ADD COLUMN IF NOT EXISTS series_id BIGINT REFERENCES coaching.schedule_series(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS sequence_number INT,
    ADD COLUMN IF NOT EXISTS is_extension_session BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_coaching_sessions_series 
    ON coaching.coaching_sessions (series_id, sequence_number);

-- Auto-seed default session_targets for existing assignments
INSERT INTO coaching.session_targets (
    assignment_id, policy_version_id, policy_baseline, approved_target, status, justification_notes, created_at
)
SELECT 
    ca.id,
    pv.id,
    pv.baseline_sessions,
    pv.baseline_sessions,
    'APPROVED',
    'Standard policy target initialized',
    NOW()
FROM coaching.coaching_assignments ca
JOIN coaching.policy_versions pv ON (
    (ca.pathway = 'MANDATORY_PMS' AND pv.policy_name LIKE 'Moderate Remediation%') OR
    (ca.pathway = 'SELF_DEVELOPMENT' AND pv.pathway = 'SELF_DEVELOPMENT')
)
WHERE pv.is_active = TRUE
ON CONFLICT (assignment_id) DO NOTHING;

