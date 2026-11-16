package com.boa.apid.mentoring.matching.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record MentoringMatchRequestInput(
        @NotNull Long skillId,
        @Size(max = 1000) String message
) {
}
