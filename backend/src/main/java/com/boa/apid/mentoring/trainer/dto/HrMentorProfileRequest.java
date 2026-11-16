package com.boa.apid.mentoring.trainer.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record HrMentorProfileRequest(
        @NotNull Boolean acceptingNewPairings,
        List<@NotNull Long> skillIds,
        @Min(1) @Max(100) Integer maxConcurrentTrainees
) {
}
