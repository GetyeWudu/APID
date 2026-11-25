-- Migration: V202612031100__reset_ad_users_to_default_employee_role.sql
-- Goal: Ensure all AD DS synced accounts default to standard Employee role.
-- Removes automatic assignments of District Director and Branch Manager from all users.
-- District Director and Branch Manager roles remain defined and can be manually assigned by System Admin.

DELETE FROM core.user_roles
WHERE role_id IN (
    SELECT id FROM core.roles WHERE name IN ('District Director', 'Branch Manager')
);
