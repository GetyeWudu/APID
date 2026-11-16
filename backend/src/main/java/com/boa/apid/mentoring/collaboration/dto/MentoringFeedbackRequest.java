package com.boa.apid.mentoring.collaboration.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record MentoringFeedbackRequest(
        @Min(1) @Max(5) int rating,
        @Size(max = 2000) String feedback
) {
}
