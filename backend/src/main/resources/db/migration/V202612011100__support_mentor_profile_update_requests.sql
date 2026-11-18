ALTER TABLE mentoring.mentor_applications
    DROP CONSTRAINT IF EXISTS chk_mentor_applications_skill_required,
    ADD CONSTRAINT chk_mentor_applications_skill_required CHECK (
        application_type = 'PROFILE_UPDATE'
        OR catalog_skill_id IS NOT NULL
        OR (custom_skill IS NOT NULL AND BTRIM(custom_skill) <> '')
    ),
    ALTER COLUMN proof_file_id DROP NOT NULL,
    DROP CONSTRAINT IF EXISTS mentor_applications_application_type_check,
    ADD CONSTRAINT mentor_applications_application_type_check
        CHECK (application_type IN ('INITIAL', 'SKILL_ADDITION', 'PROFILE_UPDATE'));

CREATE INDEX idx_mentor_applications_pending_profile_updates
    ON mentoring.mentor_applications (applicant_user_id, submitted_at DESC)
    WHERE application_type = 'PROFILE_UPDATE' AND status = 'PENDING';

ALTER TABLE mentoring.trainer_authorizations
    ADD COLUMN profile_picture_file_id BIGINT
        REFERENCES core.stored_files(id) ON DELETE SET NULL;
