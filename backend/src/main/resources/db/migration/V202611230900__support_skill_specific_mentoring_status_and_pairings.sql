CREATE TABLE mentoring.trainer_authorization_skill_status (
    id              BIGSERIAL PRIMARY KEY,
    trainer_auth_id BIGINT NOT NULL REFERENCES mentoring.trainer_authorizations(id) ON DELETE RESTRICT,
    skill_id        BIGINT NOT NULL REFERENCES core.skills(id) ON DELETE RESTRICT,
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
    status_reason   VARCHAR(1000),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_trainer_authorization_skill_status UNIQUE (trainer_auth_id, skill_id)
);

INSERT INTO mentoring.trainer_authorization_skill_status (
    trainer_auth_id, skill_id, status, status_reason, updated_at
)
SELECT authorization_skill.trainer_auth_id,
       authorization_skill.skill_id,
       trainer_auth.status,
       trainer_auth.status_reason,
       trainer_auth.updated_at
FROM mentoring.trainer_authorization_skills authorization_skill
JOIN mentoring.trainer_authorizations trainer_auth
  ON trainer_auth.id = authorization_skill.trainer_auth_id;

ALTER TABLE mentoring.trainer_status_history
    ADD COLUMN skill_id BIGINT REFERENCES core.skills(id) ON DELETE SET NULL;

ALTER TABLE mentoring.mentoring_relationship_members
    ADD COLUMN skill_id BIGINT REFERENCES core.skills(id) ON DELETE SET NULL;

UPDATE mentoring.mentoring_relationship_members member
SET skill_id = mentoring_request.skill_id
FROM mentoring.mentoring_relationships relationship
JOIN mentoring.mentoring_requests mentoring_request
  ON mentoring_request.id = relationship.request_id
WHERE member.relationship_id = relationship.id;

DROP INDEX mentoring.uq_active_mentoring_pair;

CREATE UNIQUE INDEX uq_active_mentoring_pair_skill
    ON mentoring.mentoring_relationship_members (mentor_user_id, trainee_user_id, skill_id)
    NULLS NOT DISTINCT
    WHERE status = 'ACTIVE';

CREATE INDEX idx_trainer_auth_skill_status
    ON mentoring.trainer_authorization_skill_status (skill_id, status, trainer_auth_id);

CREATE INDEX idx_trainer_status_history_skill_changed
    ON mentoring.trainer_status_history (skill_id, changed_at DESC, id DESC);
