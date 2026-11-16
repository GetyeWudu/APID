package com.boa.apid.mentoring.matching.dto;

import jakarta.validation.constraints.NotNull;

public record MentoringDirectMatchInput(
        @NotNull Long mentorUserId,
        @NotNull Long traineeUserId,
        @NotNull Long skillId
) {
}
