ALTER TABLE mentoring.mentor_applications
    ADD COLUMN review_scope VARCHAR(20) NOT NULL DEFAULT 'HR';

UPDATE mentoring.mentor_applications application
SET review_scope = 'SUPER_ADMIN'
WHERE application.application_type = 'INITIAL'
  AND EXISTS (
      SELECT 1
      FROM core.user_roles user_role
      JOIN core.roles role ON role.id = user_role.role_id
      WHERE user_role.user_id = application.applicant_user_id
        AND LOWER(role.name) = 'hr admin'
        AND user_role.assigned_at <= application.submitted_at
        AND (user_role.revoked_at IS NULL OR user_role.revoked_at >= application.submitted_at)
  );

INSERT INTO core.permissions (code, module, description)
VALUES (
    'TRAINER_APPLICATION_SUPER_REVIEW',
    'MENTORING',
    'Review mentor applications submitted by HR administrators'
)
ON CONFLICT (code) DO UPDATE
SET module = EXCLUDED.module,
    description = EXCLUDED.description;

INSERT INTO core.role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM core.roles role
JOIN core.permissions permission ON permission.code = 'TRAINER_APPLICATION_SUPER_REVIEW'
WHERE role.name = 'Super Admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;
