package com.boa.apid.mentoring.trainer.dto;

import java.util.List;

public record MentoringFeedbackReportDto(
        long responseCount,
        Double averageRating,
        List<RatingDistribution> ratingDistribution,
        List<MonthlyRating> monthlyTrend
) {
    public record RatingDistribution(int rating, long responseCount) {
    }

    public record MonthlyRating(String month, long responseCount, Double averageRating) {
    }
}
