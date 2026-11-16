CREATE TABLE mentoring.mentor_application_skills (
    application_id BIGINT NOT NULL
        REFERENCES mentoring.mentor_applications(id) ON DELETE RESTRICT,
    skill_id BIGINT NOT NULL
        REFERENCES core.skills(id) ON DELETE RESTRICT,
    PRIMARY KEY (application_id, skill_id)
);

CREATE TABLE mentoring.mentor_application_evidence (
    application_id BIGINT NOT NULL
        REFERENCES mentoring.mentor_applications(id) ON DELETE RESTRICT,
    file_id BIGINT NOT NULL
        REFERENCES core.stored_files(id) ON DELETE RESTRICT,
    PRIMARY KEY (application_id, file_id)
);

INSERT INTO mentoring.mentor_application_skills (application_id, skill_id)
SELECT id, catalog_skill_id
FROM mentoring.mentor_applications
WHERE catalog_skill_id IS NOT NULL;

INSERT INTO mentoring.mentor_application_evidence (application_id, file_id)
SELECT id, proof_file_id
FROM mentoring.mentor_applications;
