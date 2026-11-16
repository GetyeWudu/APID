package com.boa.apid.mentoring.matching.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record MentoringReassignmentInput(
        @NotNull Long trainerUserId,
        @NotBlank @Size(max = 1000) String reason,
        boolean overrideCapacity,
        @Size(max = 1000) String overrideReason,
        @Size(max = 1000) String skillOverrideReason
) {
}
