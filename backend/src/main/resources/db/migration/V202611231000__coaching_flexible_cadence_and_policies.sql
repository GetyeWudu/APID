-- V202611231000__coaching_flexible_cadence_and_policies.sql
-- Supports Flexible Weekly Pacing (1, 2, 3+ sessions/wk, Saturday banking), Joint PMS Group Remediation, and Admin Governance Policies

-- 1. Expand cadence check constraints to support THRICE_WEEKLY and EVERY_SATURDAY
ALTER TABLE coaching.schedule_series DROP CONSTRAINT IF EXISTS schedule_series_cadence_type_check;
ALTER TABLE coaching.schedule_series ADD CONSTRAINT schedule_series_cadence_type_check 
    CHECK (cadence_type IN ('WEEKLY', 'BIWEEKLY', 'TWICE_WEEKLY', 'THRICE_WEEKLY', 'EVERY_SATURDAY', 'CUSTOM'));

ALTER TABLE coaching.policy_versions DROP CONSTRAINT IF EXISTS policy_versions_default_cadence_check;
ALTER TABLE coaching.policy_versions ADD CONSTRAINT policy_versions_default_cadence_check 
    CHECK (default_cadence IN ('WEEKLY', 'BIWEEKLY', 'TWICE_WEEKLY', 'THRICE_WEEKLY', 'EVERY_SATURDAY', 'CUSTOM'));

-- 2. Seed Admin Governance Policies in core.system_configs
INSERT INTO core.system_configs (config_key, config_value, value_type, description, is_public)
VALUES
    ('coaching.max_sessions_per_week', '3', 'INTEGER', 'Maximum coaching sessions allowed per week for an employee or sprint', TRUE),
    ('coaching.allow_saturday_scheduling', 'true', 'BOOLEAN', 'Whether Saturday sessions are permitted for branch operations', TRUE),
    ('coaching.reschedule_scope', 'SAME_WEEK', 'STRING', 'Permitted reschedule timeframe: SAME_DAY_ONLY, SAME_WEEK, or QUARTER_FLEXIBLE', TRUE),
    ('coaching.allow_joint_pms_group', 'true', 'BOOLEAN', 'Allow grouping multiple underperforming talents (< 3.0) into one joint coaching session', TRUE),
    ('coaching.max_joint_group_size', '4', 'INTEGER', 'Maximum number of talents in a joint PMS coaching group', TRUE)
ON CONFLICT (config_key) DO UPDATE 
    SET description = EXCLUDED.description,
        is_public = EXCLUDED.is_public;

