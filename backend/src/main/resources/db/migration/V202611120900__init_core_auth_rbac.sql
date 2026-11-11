-- Phase 1: Core Authentication, RBAC & Refresh Token Lifecycle

CREATE TABLE core.users (
    id                    BIGSERIAL PRIMARY KEY,
    username              VARCHAR(100) NOT NULL,
    password_hash         VARCHAR(255),
    auth_provider         VARCHAR(30)  NOT NULL DEFAULT 'LOCAL',
    external_directory_id VARCHAR(255),
    status                VARCHAR(30)  NOT NULL DEFAULT 'ACTIVE',
    failed_login_attempts INTEGER      NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
    first_failed_login_at TIMESTAMPTZ,
    locked_until          TIMESTAMPTZ,
    must_change_password  BOOLEAN      NOT NULL DEFAULT FALSE,
    token_version         INTEGER      NOT NULL DEFAULT 1 CHECK (token_version >= 1),
    last_login_at         TIMESTAMPTZ,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_users_username_lower ON core.users (LOWER(username));
CREATE INDEX idx_users_status ON core.users (status);

CREATE TABLE core.roles (
    id               BIGSERIAL PRIMARY KEY,
    name             VARCHAR(80)  NOT NULL,
    description      VARCHAR(255),
    system_protected BOOLEAN      NOT NULL DEFAULT FALSE,
    active           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_roles_name_lower ON core.roles (LOWER(name));

CREATE TABLE core.permissions (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(80) NOT NULL UNIQUE,
    module      VARCHAR(40) NOT NULL,
    description VARCHAR(255)
);

CREATE TABLE core.role_permissions (
    role_id       BIGINT NOT NULL REFERENCES core.roles(id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES core.permissions(id) ON DELETE RESTRICT,
    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_permission_id ON core.role_permissions (permission_id);

CREATE TABLE core.user_roles (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
    role_id     BIGINT      NOT NULL REFERENCES core.roles(id) ON DELETE RESTRICT,
    assigned_by BIGINT      REFERENCES core.users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    active      BOOLEAN     NOT NULL DEFAULT TRUE,
    revoked_by  BIGINT      REFERENCES core.users(id) ON DELETE SET NULL,
    revoked_at  TIMESTAMPTZ,
    CONSTRAINT uq_user_roles_user_role UNIQUE (user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON core.user_roles (user_id);
CREATE INDEX idx_user_roles_role_id ON core.user_roles (role_id);

CREATE TABLE core.refresh_tokens (
    id                   BIGSERIAL PRIMARY KEY,
    user_id              BIGINT       NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    family_id            UUID         NOT NULL,
    token_hash           VARCHAR(128) NOT NULL UNIQUE,
    expires_at           TIMESTAMPTZ  NOT NULL,
    revoked              BOOLEAN      NOT NULL DEFAULT FALSE,
    revoked_at           TIMESTAMPTZ,
    revoked_reason       VARCHAR(50),
    replaced_by_token_id BIGINT       REFERENCES core.refresh_tokens(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON core.refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_family_id ON core.refresh_tokens (family_id);
CREATE INDEX idx_refresh_tokens_expires_at ON core.refresh_tokens (expires_at);

