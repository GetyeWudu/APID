package com.boa.apid.core.skills.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateSkillStatusRequest(
        @NotNull(message = "Active status is required")
        Boolean active
) {}

