-- ============================================================================
-- Phase 5.5: In-Meeting Turn Ingestion & Asynchronous Minutes Synthesis
-- Supports real-time turn ingestion and zero-wait post-meeting minutes
-- ============================================================================

CREATE TABLE IF NOT EXISTS coaching.coaching_session_turns (
    id                          BIGSERIAL PRIMARY KEY,
    session_id                  BIGINT NOT NULL REFERENCES coaching.coaching_sessions(id) ON DELETE CASCADE,
    turn_index                  INT NOT NULL,
    speaker_employee_id         VARCHAR(50),
    speaker_name                VARCHAR(120),
    speaker_role                VARCHAR(20) NOT NULL DEFAULT 'COACHEE'
                                CHECK (speaker_role IN ('COACH', 'COACHEE', 'SYSTEM', 'OTHER')),
    start_time_offset_sec       NUMERIC(7,2) DEFAULT 0.0,
    duration_sec                NUMERIC(6,2) DEFAULT 0.0,
    transcript_amharic          TEXT,
    transcript_english          TEXT,
    reconciled_text             TEXT NOT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coaching_session_turns_session_idx 
    ON coaching.coaching_session_turns (session_id, turn_index);

ALTER TABLE coaching.coaching_sessions
    ADD COLUMN IF NOT EXISTS minutes_synthesis_status VARCHAR(30) DEFAULT 'IDLE'
        CHECK (minutes_synthesis_status IN ('IDLE', 'SYNTHESIZING', 'DRAFT_READY', 'FINALIZED')),
    ADD COLUMN IF NOT EXISTS minutes_synthesized_at TIMESTAMPTZ;
