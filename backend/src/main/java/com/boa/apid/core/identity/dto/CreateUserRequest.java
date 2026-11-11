package com.boa.apid.core.identity.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.Set;

public record CreateUserRequest(
        @NotBlank(message = "Username is required")
        @Size(min = 3, max = 100, message = "Username must be between 3 and 100 characters")
        String username,

        @Size(min = 8, max = 128, message = "Temporary password must be between 8 and 128 characters")
        String temporaryPassword,

        @NotEmpty(message = "At least one role must be assigned")
        Set<Long> roleIds
) {}

