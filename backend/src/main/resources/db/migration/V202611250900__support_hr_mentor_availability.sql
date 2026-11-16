CREATE TABLE mentoring.mentor_availability_preferences (
    user_id BIGINT PRIMARY KEY REFERENCES core.users(id) ON DELETE CASCADE,
    accepting_new_pairings BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
