package com.boa.apid.coaching.skillrequest.dto;

import jakarta.validation.constraints.NotNull;

public record AddCohortMemberPayload(
        @NotNull(message = "Employee ID is required")
        Long employeeId
) {}

