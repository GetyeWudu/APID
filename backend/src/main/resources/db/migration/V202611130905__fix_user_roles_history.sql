-- Phase 2: Allow historical UserRole revocation & re-assignment via partial unique index

ALTER TABLE core.user_roles
    DROP CONSTRAINT IF EXISTS uq_user_roles_user_role;

CREATE UNIQUE INDEX uq_active_user_role
    ON core.user_roles (user_id, role_id)
    WHERE active = TRUE;

