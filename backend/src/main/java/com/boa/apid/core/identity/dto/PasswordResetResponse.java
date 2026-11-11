package com.boa.apid.core.identity.dto;

public record PasswordResetResponse(Long userId, String username, String temporaryPassword) {}

