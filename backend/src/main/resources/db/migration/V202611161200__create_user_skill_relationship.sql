CREATE TABLE core.user_skills (
    user_id  BIGINT NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    skill_id BIGINT NOT NULL REFERENCES core.skills(id) ON DELETE RESTRICT,
    PRIMARY KEY (user_id, skill_id)
);

CREATE INDEX idx_user_skills_skill_id ON core.user_skills (skill_id);
