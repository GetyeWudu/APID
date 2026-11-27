package com.boa.apid.mentoring.ai.recommendation.dto;

import jakarta.validation.constraints.NotNull;

public record HrMentorRecommendationRequest(
        @NotNull Long matchRequestId
) {
}
