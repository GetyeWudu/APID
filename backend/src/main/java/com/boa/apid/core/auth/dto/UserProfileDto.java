package com.boa.apid.core.auth.dto;

import java.util.Set;

public record UserProfileDto(
        Long id,
        String username,
        boolean mustChangePassword,
        Set<String> roles,
        Set<String> permissions
) {}

