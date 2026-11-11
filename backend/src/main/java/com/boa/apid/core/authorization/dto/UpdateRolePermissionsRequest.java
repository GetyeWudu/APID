package com.boa.apid.core.authorization.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.Set;

public record UpdateRolePermissionsRequest(
        @NotEmpty(message = "At least one permission must be selected")
        Set<String> permissionCodes
) {}

