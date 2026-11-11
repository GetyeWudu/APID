package com.boa.apid.core.identity.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.Set;

public record UpdateUserRolesRequest(
        @NotEmpty(message = "At least one role must be assigned")
        Set<Long> roleIds
) {}

