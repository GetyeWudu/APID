CREATE TABLE mentoring.trainer_authorizations (
    id                       BIGSERIAL PRIMARY KEY,
    employee_id              BIGINT NOT NULL REFERENCES core.employees(id) ON DELETE RESTRICT,
    source_type              VARCHAR(30) NOT NULL
                             CHECK (source_type IN ('APPLICATION', 'DIRECT_APPOINTMENT')),
    source_application_id    BIGINT REFERENCES mentoring.mentor_applications(id) ON DELETE RESTRICT,
    status                   VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                             CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
    max_concurrent_trainees  INTEGER NOT NULL CHECK (max_concurrent_trainees BETWEEN 1 AND 100),
    bio                      VARCHAR(2000),
    availability_notes       VARCHAR(1000),
    appointment_reason       VARCHAR(1000),
    authorized_by_user_id    BIGINT REFERENCES core.users(id) ON DELETE RESTRICT,
    status_reason            VARCHAR(1000),
    effective_from           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_trainer_authorization_source CHECK (
        (source_type = 'APPLICATION' AND source_application_id IS NOT NULL)
        OR (source_type = 'DIRECT_APPOINTMENT' AND source_application_id IS NULL)
    )
);

CREATE TABLE mentoring.trainer_authorization_skills (
    trainer_auth_id BIGINT NOT NULL REFERENCES mentoring.trainer_authorizations(id) ON DELETE RESTRICT,
    skill_id        BIGINT NOT NULL REFERENCES core.skills(id) ON DELETE RESTRICT,
    PRIMARY KEY (trainer_auth_id, skill_id)
);

CREATE TABLE mentoring.trainer_status_history (
    id                BIGSERIAL PRIMARY KEY,
    trainer_auth_id   BIGINT NOT NULL REFERENCES mentoring.trainer_authorizations(id) ON DELETE RESTRICT,
    previous_status   VARCHAR(20),
    new_status        VARCHAR(20) NOT NULL CHECK (new_status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
    reason            VARCHAR(1000) NOT NULL,
    changed_by_user_id BIGINT NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
    changed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mentoring.mentor_applications
    ADD COLUMN expertise_summary VARCHAR(2000),
    ADD COLUMN availability_notes VARCHAR(1000),
    ADD COLUMN max_concurrent_trainees INTEGER CHECK (
        max_concurrent_trainees IS NULL OR max_concurrent_trainees BETWEEN 1 AND 100
    );

WITH existing_mentors AS (
    SELECT DISTINCT ON (employee.id)
        employee.id AS employee_id,
        employee.user_id,
        application.id AS application_id
    FROM core.employees employee
    JOIN core.users account ON account.id = employee.user_id AND account.status = 'ACTIVE'
    JOIN core.user_roles user_role ON user_role.user_id = account.id AND user_role.active = TRUE
    JOIN core.roles role ON role.id = user_role.role_id AND role.active = TRUE AND LOWER(role.name) = 'mentor'
    LEFT JOIN mentoring.mentor_applications application
        ON application.applicant_user_id = account.id AND application.status = 'APPROVED'
    WHERE employee.employment_status = 'ACTIVE'
    ORDER BY employee.id, application.submitted_at DESC NULLS LAST, application.id DESC NULLS LAST
)
INSERT INTO mentoring.trainer_authorizations (
    employee_id,
    source_type,
    source_application_id,
    status,
    max_concurrent_trainees,
    appointment_reason,
    effective_from,
    updated_at
)
SELECT
    existing.employee_id,
    CASE WHEN existing.application_id IS NULL THEN 'DIRECT_APPOINTMENT' ELSE 'APPLICATION' END,
    existing.application_id,
    'ACTIVE',
    3,
    'Migrated existing active Mentor authorization.',
    NOW(),
    NOW()
FROM existing_mentors existing;

INSERT INTO mentoring.trainer_authorization_skills (trainer_auth_id, skill_id)
SELECT trainer_auth.id, user_skill.skill_id
FROM mentoring.trainer_authorizations AS trainer_auth
JOIN core.employees employee ON employee.id = trainer_auth.employee_id
JOIN core.user_skills user_skill ON user_skill.user_id = employee.user_id
JOIN core.skills skill ON skill.id = user_skill.skill_id AND skill.active = TRUE;

CREATE INDEX idx_trainer_authorizations_employee_updated
    ON mentoring.trainer_authorizations (employee_id, updated_at DESC, id DESC);

CREATE INDEX idx_trainer_authorizations_status
    ON mentoring.trainer_authorizations (status, updated_at DESC);

CREATE INDEX idx_trainer_authorization_skills_skill
    ON mentoring.trainer_authorization_skills (skill_id, trainer_auth_id);

CREATE INDEX idx_trainer_status_history_auth_changed
    ON mentoring.trainer_status_history (trainer_auth_id, changed_at DESC, id DESC);

CREATE UNIQUE INDEX uq_trainer_authorization_live_employee
    ON mentoring.trainer_authorizations (employee_id)
    WHERE status IN ('ACTIVE', 'SUSPENDED');
