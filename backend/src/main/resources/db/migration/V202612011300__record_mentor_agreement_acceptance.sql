ALTER TABLE mentoring.mentor_applications
    ADD COLUMN mentor_agreement_version VARCHAR(40),
    ADD COLUMN mentor_agreement_text TEXT,
    ADD COLUMN mentor_agreement_accepted_at TIMESTAMPTZ,
    ADD CONSTRAINT chk_mentor_application_agreement_snapshot CHECK (
        (mentor_agreement_version IS NULL
            AND mentor_agreement_text IS NULL
            AND mentor_agreement_accepted_at IS NULL)
        OR
        (mentor_agreement_version IS NOT NULL
            AND mentor_agreement_text IS NOT NULL
            AND mentor_agreement_accepted_at IS NOT NULL)
    );

ALTER TABLE core.user_roles
    ADD COLUMN mentor_agreement_version VARCHAR(40),
    ADD COLUMN mentor_agreement_text TEXT,
    ADD COLUMN mentor_agreement_accepted_at TIMESTAMPTZ,
    ADD CONSTRAINT chk_user_role_mentor_agreement_snapshot CHECK (
        (mentor_agreement_version IS NULL
            AND mentor_agreement_text IS NULL
            AND mentor_agreement_accepted_at IS NULL)
        OR
        (mentor_agreement_version IS NOT NULL
            AND mentor_agreement_text IS NOT NULL
            AND mentor_agreement_accepted_at IS NOT NULL)
    );
