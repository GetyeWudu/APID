package com.boa.apid.mentoring.matching.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record MentoringMatchAssignmentInput(
        @NotNull Long trainerUserId,
        boolean overrideCapacity,
        @Size(max = 1000) String overrideReason
) {
}
