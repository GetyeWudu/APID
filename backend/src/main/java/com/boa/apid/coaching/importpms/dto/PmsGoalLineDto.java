package com.boa.apid.coaching.importpms.dto;

import java.math.BigDecimal;

public record PmsGoalLineDto(
        int sourceRowNumber,
        String goalName,
        String goalTrackingName,
        String targetValue,
        String actualValue,
        BigDecimal goalScore,
        BigDecimal weight,
        BigDecimal lineScore
) {}

