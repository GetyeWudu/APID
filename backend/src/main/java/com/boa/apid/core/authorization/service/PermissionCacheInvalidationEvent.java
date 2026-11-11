package com.boa.apid.core.authorization.service;

import java.util.Objects;

/**
 * Domain event published inside RBAC transactions and consumed AFTER_COMMIT to evict Redis.
 */
public record PermissionCacheInvalidationEvent(Long userId, boolean evictAll) {

    public static PermissionCacheInvalidationEvent forUser(Long userId) {
        return new PermissionCacheInvalidationEvent(Objects.requireNonNull(userId), false);
    }

    public static PermissionCacheInvalidationEvent forAllUsers() {
        return new PermissionCacheInvalidationEvent(null, true);
    }
}

