package com.boa.apid.mentoring.recommendation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MentorRecommendationRequest(
        @NotBlank @Size(max = 1500) String learningGoal
) {
}
