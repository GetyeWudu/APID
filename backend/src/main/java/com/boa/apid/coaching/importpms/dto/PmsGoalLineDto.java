package com.boa.apid.coaching.importpms.dto;

import java.math.BigDecimal;

public record PmsGoalLineDto(
        Long id,
        int sourceRowNumber,
        String goalName,
        String goalTrackingName,
        String targetValue,
        String actualValue,
        BigDecimal goalScore,
        BigDecimal weight,
        BigDecimal lineScore
) {
    public PmsGoalLineDto(
            int sourceRowNumber,
            String goalName,
            String goalTrackingName,
            String targetValue,
            String actualValue,
            BigDecimal goalScore,
            BigDecimal weight,
            BigDecimal lineScore
    ) {
        this(null, sourceRowNumber, goalName, goalTrackingName, targetValue, actualValue, goalScore, weight, lineScore);
    }
}

