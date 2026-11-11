package com.boa.apid.core.identity.dto;

import com.boa.apid.core.authorization.entity.AuthProvider;
import com.boa.apid.core.authorization.entity.UserStatus;

import java.time.Instant;
import java.util.Set;

public record AdminUserDto(
        Long id,
        String username,
        AuthProvider authProvider,
        UserStatus status,
        boolean temporarilyLocked,
        Instant lockedUntil,
        int failedLoginAttempts,
        boolean mustChangePassword,
        Set<RoleSummary> roles,
        Instant lastLoginAt,
        Instant createdAt
) {
    public record RoleSummary(Long id, String name, boolean systemProtected) {}
}

