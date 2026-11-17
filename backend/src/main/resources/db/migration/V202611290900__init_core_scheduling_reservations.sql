-- V202611230900__init_core_scheduling_reservations.sql
-- Core Scheduling Reservation Authority for cross-module scheduling (Coaching, Mentoring, Training)
-- Concurrency-safe overlap protection via PostgreSQL btree_gist exclusion constraints.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE core.schedule_events (
    id BIGSERIAL PRIMARY KEY,
    source_module VARCHAR(30) NOT NULL,            -- 'COACHING', 'MENTORING', etc.
    source_session_id BIGINT NOT NULL,             -- ID in the owning module
    title VARCHAR(255) NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Africa/Addis_Ababa',
    status VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED', -- 'CONFIRMED', 'CANCELLED', 'RESCHEDULED', 'COMPLETED'
    meeting_mode VARCHAR(30),
    meeting_location VARCHAR(255),
    video_call_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_schedule_source UNIQUE (source_module, source_session_id),
    CONSTRAINT chk_schedule_event_times CHECK (end_at > start_at)
);

CREATE TABLE core.schedule_participants (
    id BIGSERIAL PRIMARY KEY,
    schedule_event_id BIGINT NOT NULL REFERENCES core.schedule_events(id) ON DELETE CASCADE,
    employee_id BIGINT NOT NULL REFERENCES core.employees(id) ON DELETE CASCADE,
    participation_role VARCHAR(30) NOT NULL,       -- 'COACH', 'TALENT', 'MENTOR', 'MENTEE'
    reservation_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'RELEASED'
    time_range TSTZRANGE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_schedule_event_employee UNIQUE (schedule_event_id, employee_id),
    CONSTRAINT ex_employee_no_overlap EXCLUDE USING gist (
        employee_id WITH =,
        time_range WITH &&
    ) WHERE (reservation_status = 'ACTIVE')
);

CREATE INDEX idx_schedule_participants_lookup 
ON core.schedule_participants (employee_id, reservation_status);

CREATE INDEX idx_schedule_events_timerange 
ON core.schedule_events (start_at, end_at, status);

-- Trigger 1: Auto-populate time_range from parent event on participant insert/update
CREATE OR REPLACE FUNCTION core.sync_schedule_participant_range()
RETURNS TRIGGER AS $$
DECLARE
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ;
BEGIN
    SELECT start_at, end_at INTO v_start, v_end
    FROM core.schedule_events
    WHERE id = NEW.schedule_event_id;

    IF v_start IS NOT NULL AND v_end IS NOT NULL THEN
        NEW.time_range := tstzrange(v_start, v_end, '[)');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_schedule_participant_range
BEFORE INSERT OR UPDATE ON core.schedule_participants
FOR EACH ROW
EXECUTE FUNCTION core.sync_schedule_participant_range();

-- Trigger 2: When an event start/end is rescheduled, update all participant time_ranges
CREATE OR REPLACE FUNCTION core.sync_schedule_event_participants()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.start_at IS DISTINCT FROM NEW.start_at) OR (OLD.end_at IS DISTINCT FROM NEW.end_at) THEN
        UPDATE core.schedule_participants
        SET time_range = tstzrange(NEW.start_at, NEW.end_at, '[)')
        WHERE schedule_event_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_schedule_event_participants
AFTER UPDATE ON core.schedule_events
FOR EACH ROW
EXECUTE FUNCTION core.sync_schedule_event_participants();
