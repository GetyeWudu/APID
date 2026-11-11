package com.boa.apid.core.authorization.entity;

/**
 * Administrator-controlled account status (separated from temporary failed-login lockout).
 */
public enum UserStatus {
    ACTIVE,
    DISABLED,
    ADMIN_LOCKED
}

