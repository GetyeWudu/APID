-- V202611200900__coaching_policy_and_progress_reports.sql
-- Two-way progress reporting for coachees and system configurations for coaching policy

ALTER TABLE coaching.session_participants
    ADD COLUMN IF NOT EXISTS coachee_progress_notes TEXT,
    ADD COLUMN IF NOT EXISTS coachee_progress_submitted_at TIMESTAMPTZ;

-- Seed configurable coaching policies in core.system_configs
INSERT INTO core.system_configs (config_key, config_value, value_type, description, is_public)
VALUES
    ('coaching.min_sessions_per_quarter', '4', 'INTEGER', 'Minimum mandatory coaching sessions required per employee per quarter', true),
    ('coaching.early_join_window_minutes', '15', 'INTEGER', 'Minutes before meeting start when video call room opens', true),
    ('coaching.min_reschedule_notice_hours', '4', 'INTEGER', 'Minimum hours in advance an employee can request meeting reschedule', true),
    ('coaching.max_reschedules_per_session', '2', 'INTEGER', 'Maximum number of times a session can be rescheduled', true),
    ('coaching.require_decline_reason', 'true', 'BOOLEAN', 'Whether employees must provide a mandatory reason to decline coaching', true)
ON CONFLICT (config_key) DO NOTHING;
