-- Migration: Create PMS Referral Cases table for persistent low performers (< 3.0 for 2+ quarters)
CREATE TABLE IF NOT EXISTS coaching.pms_referral_cases (
    id BIGSERIAL PRIMARY KEY,
    coachee_employee_id BIGINT NOT NULL REFERENCES core.employees(id),
    current_coach_employee_id BIGINT REFERENCES core.employees(id),
    assignment_id BIGINT REFERENCES coaching.coaching_assignments(id),
    consecutive_low_quarters_count INT NOT NULL DEFAULT 2,
    latest_scores_json TEXT NOT NULL DEFAULT '[]',
    coaching_sessions_attended INT NOT NULL DEFAULT 0,
    status VARCHAR(40) NOT NULL DEFAULT 'PENDING_ADMIN_ACTION',
    new_coach_employee_id BIGINT REFERENCES core.employees(id),
    pms_admin_user_id BIGINT REFERENCES core.users(id),
    resolution_type VARCHAR(40),
    resolution_notes TEXT,
    escalated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pms_referral_coachee ON coaching.pms_referral_cases(coachee_employee_id);
CREATE INDEX IF NOT EXISTS idx_pms_referral_status ON coaching.pms_referral_cases(status);
