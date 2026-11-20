package com.boa.apid.mentoring.trainer.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record TrainerProfileRequest(
        @Size(max = 2000) String bio,
        @Min(1) @Max(100) Integer maxConcurrentTrainees,
        @Min(0) Integer experienceYears,
        @Size(max = 2000) String mentoringApproach,
        @Min(0) Integer sessionsPerWeek,
        @Size(max = 2000) String changeNote
) {
}
