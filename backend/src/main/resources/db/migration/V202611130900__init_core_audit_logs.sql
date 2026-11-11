-- Phase 2: Immutable Audit Logs with JSONB metadata and DB-level update/delete protection

CREATE TABLE core.audit_logs (
    id             BIGSERIAL PRIMARY KEY,
    request_id     VARCHAR(64),
    actor_user_id  BIGINT       REFERENCES core.users(id) ON DELETE SET NULL,
    actor_username VARCHAR(100),
    target_user_id BIGINT       REFERENCES core.users(id) ON DELETE SET NULL,
    module         VARCHAR(40)  NOT NULL,
    action         VARCHAR(80)  NOT NULL,
    result         VARCHAR(20)  NOT NULL DEFAULT 'SUCCESS',
    reason_code    VARCHAR(80),
    entity_type    VARCHAR(60),
    entity_id      VARCHAR(60),
    details_json   JSONB,
    ip_address     VARCHAR(64),
    user_agent     VARCHAR(255),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_created_at ON core.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_module_action ON core.audit_logs (module, action);
CREATE INDEX idx_audit_logs_actor_user_id ON core.audit_logs (actor_user_id);
CREATE INDEX idx_audit_logs_target_user_id ON core.audit_logs (target_user_id);

-- Enforce immutability at PostgreSQL trigger level
CREATE OR REPLACE FUNCTION core.prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'core.audit_logs is immutable: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
    BEFORE UPDATE OR DELETE ON core.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION core.prevent_audit_log_mutation();

