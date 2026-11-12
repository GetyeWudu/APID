package com.boa.apid.core.organization.dto;

import jakarta.validation.constraints.NotNull;

public record LinkEmployeeUserRequest(
        @NotNull(message = "User ID is required")
        Long userId
) {}

