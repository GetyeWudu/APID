ALTER TABLE core.audit_logs
    DROP CONSTRAINT IF EXISTS audit_logs_actor_user_id_fkey,
    DROP CONSTRAINT IF EXISTS audit_logs_target_user_id_fkey;
