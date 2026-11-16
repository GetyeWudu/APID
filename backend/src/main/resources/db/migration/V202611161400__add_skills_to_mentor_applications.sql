ALTER TABLE mentoring.mentor_applications
    ADD COLUMN catalog_skill_id BIGINT REFERENCES core.skills(id) ON DELETE RESTRICT,
    ADD COLUMN custom_skill VARCHAR(150),
    ADD CONSTRAINT chk_mentor_applications_skill_required CHECK (
        catalog_skill_id IS NOT NULL
        OR (custom_skill IS NOT NULL AND BTRIM(custom_skill) <> '')
    );

CREATE INDEX idx_mentor_applications_catalog_skill
    ON mentoring.mentor_applications (catalog_skill_id);
