package com.boa.apid.coaching.assignment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AssignCoachRequest(
        @NotNull(message = "Coach employee ID is required")
        Long coachEmployeeId,

        @NotBlank(message = "Assignment reason is required")
        @Size(max = 500, message = "Reason cannot exceed 500 characters")
        String reason
) {}

