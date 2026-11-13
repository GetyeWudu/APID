package com.boa.apid.coaching.assignment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CloseAssignmentRequest(
        @NotBlank(message = "Closure reason is required")
        @Size(max = 500, message = "Reason cannot exceed 500 characters")
        String reason
) {}

