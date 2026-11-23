-- ============================================================================
-- Standardize Provider-Neutral Meeting Fields for LiveKit Integration
-- Supports LiveKit replacing Daily.co across Coaching and Mentoring sessions
-- ============================================================================

-- Expand coaching meeting_mode constraint to allow ONLINE and HYBRID
ALTER TABLE coaching.coaching_sessions
    DROP CONSTRAINT IF EXISTS coaching_sessions_meeting_mode_check;

ALTER TABLE coaching.coaching_sessions
    ADD CONSTRAINT coaching_sessions_meeting_mode_check
    CHECK (meeting_mode IN ('ONLINE', 'IN_PERSON', 'HYBRID', 'VIRTUAL_VIDEO', 'PHONE_CALL'));

ALTER TABLE coaching.coaching_sessions
    ADD COLUMN IF NOT EXISTS meeting_provider VARCHAR(30) DEFAULT 'LIVEKIT',
    ADD COLUMN IF NOT EXISTS meeting_room_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS meeting_room_url TEXT;

-- Backfill existing coaching sessions from legacy daily columns
UPDATE coaching.coaching_sessions
SET meeting_room_name = daily_room_name,
    meeting_room_url = daily_room_url,
    meeting_provider = 'LIVEKIT'
WHERE meeting_room_name IS NULL AND daily_room_name IS NOT NULL;

ALTER TABLE mentoring.mentoring_sessions
    ADD COLUMN IF NOT EXISTS meeting_provider VARCHAR(30) DEFAULT 'LIVEKIT',
    ADD COLUMN IF NOT EXISTS meeting_room_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS meeting_room_url TEXT;

-- Backfill existing mentoring sessions from meeting_url
UPDATE mentoring.mentoring_sessions
SET meeting_room_url = meeting_url,
    meeting_provider = 'LIVEKIT'
WHERE meeting_room_url IS NULL AND meeting_url IS NOT NULL;

