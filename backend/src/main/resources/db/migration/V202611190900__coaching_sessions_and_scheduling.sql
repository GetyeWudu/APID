-- ============================================================================
-- Phase 5.4: Coaching Sessions, Flexible Scheduling & Feedback
-- Supports 1-on-1 Mandatory PMS Coaching and Multi-Participant Skill Cohorts
-- ============================================================================

CREATE TABLE IF NOT EXISTS coaching.coaching_sessions (
    id                          BIGSERIAL PRIMARY KEY,
    assignment_id               BIGINT REFERENCES coaching.coaching_assignments(id) ON DELETE CASCADE,
    skill_request_id            BIGINT REFERENCES coaching.skill_coaching_requests(id) ON DELETE CASCADE,
    coach_employee_id           BIGINT NOT NULL REFERENCES core.employees(id) ON DELETE RESTRICT,
    title                       VARCHAR(200) NOT NULL,
    pathway                     VARCHAR(30) NOT NULL 
                                CHECK (pathway IN ('MANDATORY_PMS', 'SELF_DEVELOPMENT')),
    scheduled_start_time        TIMESTAMPTZ NOT NULL,
    scheduled_end_time          TIMESTAMPTZ NOT NULL,
    duration_minutes            INT NOT NULL CHECK (duration_minutes >= 15 AND duration_minutes <= 180),
    meeting_mode                VARCHAR(30) NOT NULL 
                                CHECK (meeting_mode IN ('VIRTUAL_VIDEO', 'PHONE_CALL', 'IN_PERSON')),
    meeting_location            VARCHAR(255),
    daily_room_name             VARCHAR(120),
    daily_room_url              TEXT,
    status                      VARCHAR(30) NOT NULL DEFAULT 'PROPOSED'
                                CHECK (status IN ('PROPOSED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULE_PENDING', 'EXPIRED')),
    cancellation_reason         TEXT,
    cancelled_by_employee_id    BIGINT REFERENCES core.employees(id) ON DELETE SET NULL,
    cancelled_at                TIMESTAMPTZ,
    target_pms_goal_id          BIGINT REFERENCES coaching.pms_goal_lines(id) ON DELETE SET NULL,
    session_notes_minutes       TEXT,
    action_items                TEXT,
    conducted_at                TIMESTAMPTZ,
    created_by_user_id          BIGINT NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_session_parent 
        CHECK ((assignment_id IS NOT NULL AND skill_request_id IS NULL) OR 
               (assignment_id IS NULL AND skill_request_id IS NOT NULL)),
    CONSTRAINT chk_session_times 
        CHECK (scheduled_end_time > scheduled_start_time),
    CONSTRAINT chk_session_pathway_parent 
        CHECK ((pathway = 'MANDATORY_PMS' AND assignment_id IS NOT NULL) OR 
               (pathway = 'SELF_DEVELOPMENT' AND skill_request_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_coaching_sessions_coach 
    ON coaching.coaching_sessions (coach_employee_id, scheduled_start_time);

CREATE INDEX IF NOT EXISTS idx_coaching_sessions_assignment 
    ON coaching.coaching_sessions (assignment_id);

CREATE INDEX IF NOT EXISTS idx_coaching_sessions_skill_req 
    ON coaching.coaching_sessions (skill_request_id);

CREATE INDEX IF NOT EXISTS idx_coaching_sessions_status 
    ON coaching.coaching_sessions (status);

-- Participants table (invitation, attendance, individual progress & feedback)
CREATE TABLE IF NOT EXISTS coaching.session_participants (
    id                          BIGSERIAL PRIMARY KEY,
    session_id                  BIGINT NOT NULL REFERENCES coaching.coaching_sessions(id) ON DELETE CASCADE,
    employee_id                 BIGINT NOT NULL REFERENCES core.employees(id) ON DELETE RESTRICT,
    role                        VARCHAR(20) NOT NULL CHECK (role IN ('COACH', 'COACHEE')),
    invitation_status           VARCHAR(30) NOT NULL DEFAULT 'PENDING' 
                                CHECK (invitation_status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
    invitation_decline_reason   TEXT,
    responded_at                TIMESTAMPTZ,
    attendance_status           VARCHAR(30) NOT NULL DEFAULT 'PENDING' 
                                CHECK (attendance_status IN ('PENDING', 'ATTENDED', 'MISSED', 'EXCUSED')),
    attendance_marked_by        BIGINT REFERENCES core.employees(id) ON DELETE SET NULL,
    attendance_marked_at        TIMESTAMPTZ,
    coach_assessment            VARCHAR(30) 
                                CHECK (coach_assessment IN ('NEEDS_IMPROVEMENT', 'PROGRESSING', 'ON_TRACK', 'MASTERED')),
    individual_notes            TEXT,
    feedback_rating             SMALLINT CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
    feedback_comment            TEXT,
    feedback_submitted_at       TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_session_participant UNIQUE (session_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_session_participants_emp 
    ON coaching.session_participants (employee_id, session_id);

-- Reschedule proposals history table
CREATE TABLE IF NOT EXISTS coaching.session_schedule_proposals (
    id                          BIGSERIAL PRIMARY KEY,
    session_id                  BIGINT NOT NULL REFERENCES coaching.coaching_sessions(id) ON DELETE CASCADE,
    proposed_by_employee_id     BIGINT NOT NULL REFERENCES core.employees(id) ON DELETE RESTRICT,
    proposed_start_time         TIMESTAMPTZ NOT NULL,
    proposed_end_time           TIMESTAMPTZ NOT NULL,
    reason                      TEXT NOT NULL,
    status                      VARCHAR(30) NOT NULL DEFAULT 'PENDING' 
                                CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN')),
    responded_by_employee_id    BIGINT REFERENCES core.employees(id) ON DELETE SET NULL,
    responded_at                TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_proposal_times CHECK (proposed_end_time > proposed_start_time)
);

CREATE INDEX IF NOT EXISTS idx_session_schedule_proposals_sess 
    ON coaching.session_schedule_proposals (session_id, status);

