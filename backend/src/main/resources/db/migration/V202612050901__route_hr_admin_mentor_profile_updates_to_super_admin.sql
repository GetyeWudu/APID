UPDATE mentoring.mentor_applications application
SET review_scope = 'SUPER_ADMIN'
WHERE application.application_type = 'PROFILE_UPDATE'
  AND EXISTS (
      SELECT 1
      FROM core.user_roles user_role
      JOIN core.roles role ON role.id = user_role.role_id
      WHERE user_role.user_id = application.applicant_user_id
        AND LOWER(role.name) = 'hr admin'
        AND user_role.assigned_at <= application.submitted_at
        AND (user_role.revoked_at IS NULL OR user_role.revoked_at >= application.submitted_at)
  );
