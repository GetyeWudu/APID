package com.boa.apid.mentoring.pairing.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record MentoringSessionRatingRequest(
        @Min(1) @Max(5) int rating
) {
}
