package com.boa.apid.core.authorization.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.Set;

public record CreateRoleRequest(
        @NotBlank(message = "Role name is required")
        @Size(max = 80)
        String name,

        @Size(max = 255)
        String description,

        @NotEmpty(message = "At least one permission must be selected")
        Set<String> permissionCodes
) {}

