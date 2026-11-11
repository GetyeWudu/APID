package com.boa.apid.core.identity.dto;

import com.boa.apid.core.authorization.entity.UserStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateUserStatusRequest(
        @NotNull(message = "Status is required")
        UserStatus status,

        @Size(max = 255)
        String reason
) {}

