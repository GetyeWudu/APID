ALTER TABLE mentoring.mentor_applications
    ADD COLUMN reviewed_by_user_id BIGINT REFERENCES core.users(id) ON DELETE SET NULL,
    ADD COLUMN reviewed_at TIMESTAMPTZ,
    ADD COLUMN review_reason TEXT;
