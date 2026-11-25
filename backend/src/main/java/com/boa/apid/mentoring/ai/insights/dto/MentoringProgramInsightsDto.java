package com.boa.apid.mentoring.ai.insights.dto;

import java.util.List;

public record MentoringProgramInsightsDto(
        String summary,
        List<String> strengths,
        List<String> attentionAreas,
        List<String> recommendedActions
) {
}
