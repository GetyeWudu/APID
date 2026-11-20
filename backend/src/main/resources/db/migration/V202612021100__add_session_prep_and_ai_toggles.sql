-- Add pre-session preparation notes, reference materials (books, URLs, documents), and session AI toggles
ALTER TABLE coaching.coaching_sessions
    ADD COLUMN IF NOT EXISTS prep_notes TEXT,
    ADD COLUMN IF NOT EXISTS reference_materials TEXT DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS ai_summarization_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS ai_agent_enabled BOOLEAN NOT NULL DEFAULT FALSE;
