-- Migration: V202611290900__enhance_mentoring_sessions_and_scheduling.sql
-- Description: Expand mentoring session lifecycle statuses and add decline/reschedule columns

DO $$
BEGIN
    -- Drop any existing status check constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_schema = 'mentoring'
          AND table_name = 'mentoring_sessions'
          AND column_name = 'status'
    ) THEN
        EXECUTE (
            SELECT 'ALTER TABLE mentoring.mentoring_sessions DROP CONSTRAINT ' || quote_ident(constraint_name)
            FROM information_schema.constraint_column_usage
            WHERE table_schema = 'mentoring'
              AND table_name = 'mentoring_sessions'
              AND column_name = 'status'
            LIMIT 1
        );
    END IF;
END $$;

ALTER TABLE mentoring.mentoring_sessions
    ADD CONSTRAINT chk_mentoring_sessions_status
    CHECK (status IN ('SCHEDULED', 'CONFIRMED', 'DECLINED', 'RESCHEDULE_PROPOSED', 'COMPLETED', 'MISSED', 'CANCELLED', 'RESCHEDULED'));

ALTER TABLE mentoring.mentoring_sessions
    ADD COLUMN IF NOT EXISTS location VARCHAR(255),
    ADD COLUMN IF NOT EXISTS decline_reason TEXT,
    ADD COLUMN IF NOT EXISTS reschedule_reason TEXT,
    ADD COLUMN IF NOT EXISTS proposed_start TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS proposed_end TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

