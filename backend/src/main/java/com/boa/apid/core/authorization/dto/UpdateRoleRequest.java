package com.boa.apid.core.authorization.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateRoleRequest(
        @NotBlank(message = "Role name is required")
        @Size(max = 80)
        String name,

        @Size(max = 255)
        String description,

        boolean active
) {}

