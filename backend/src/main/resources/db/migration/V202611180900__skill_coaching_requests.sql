-- ============================================================================
-- Phase 5.3: Skill-Development Coaching Requests & Approvals
-- Manager-initiated coaching requests for one or multiple employees
-- Reviewed and approved strictly by PMS Administrators
-- ============================================================================

CREATE TABLE IF NOT EXISTS coaching.skill_coaching_requests (
    id                          BIGSERIAL PRIMARY KEY,
    requester_employee_id       BIGINT NOT NULL REFERENCES core.employees(id) ON DELETE RESTRICT,
    proposed_coach_employee_id  BIGINT REFERENCES core.employees(id) ON DELETE RESTRICT,
    coaching_fiscal_quarter_id  BIGINT NOT NULL REFERENCES core.fiscal_quarters(id) ON DELETE RESTRICT,
    skill_title                 VARCHAR(200) NOT NULL,
    business_justification      TEXT NOT NULL,
    status                      VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL' 
                                CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
    reviewed_by_user_id         BIGINT REFERENCES core.users(id) ON DELETE SET NULL,
    review_notes                TEXT,
    reviewed_at                 TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_coaching_req_status 
    ON coaching.skill_coaching_requests (status);

CREATE INDEX IF NOT EXISTS idx_skill_coaching_req_requester 
    ON coaching.skill_coaching_requests (requester_employee_id);

CREATE INDEX IF NOT EXISTS idx_skill_coaching_req_quarter 
    ON coaching.skill_coaching_requests (coaching_fiscal_quarter_id);

CREATE TABLE IF NOT EXISTS coaching.skill_coaching_request_targets (
    id                          BIGSERIAL PRIMARY KEY,
    request_id                  BIGINT NOT NULL REFERENCES coaching.skill_coaching_requests(id) ON DELETE CASCADE,
    employee_id                 BIGINT NOT NULL REFERENCES core.employees(id) ON DELETE RESTRICT,
    created_assignment_id       BIGINT REFERENCES coaching.coaching_assignments(id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_skill_req_target UNIQUE (request_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_req_targets_emp 
    ON coaching.skill_coaching_request_targets (employee_id);

