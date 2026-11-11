package com.boa.apid.core.authorization.dto;

import java.util.Set;

public record RoleDto(
        Long id,
        String name,
        String description,
        boolean systemProtected,
        boolean active,
        Set<String> permissions,
        long activeUserCount
) {}

