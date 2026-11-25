package com.boa.apid.mentoring.ai.recommendation.dto;

import java.util.List;

public record MentorRecommendationResponse(String overallReason, List<MentorRecommendationDto> recommendations) {
}
