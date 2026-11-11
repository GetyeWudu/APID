package com.boa.apid.core.auth.dto;

public record AuthResponse(
        String accessToken,
        String tokenType,
        long expiresInMs,
        UserProfileDto user
) {}

