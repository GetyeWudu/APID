package com.boa.apid.coaching.report.dto;

import java.util.List;

public record DistrictBranchAnalyticsDto(
        Long fiscalQuarterId,
        String fiscalQuarterName,
        int totalEmployeesMonitored,
        int totalCoachingAssignments,
        int criticalCount,
        int moderateCount,
        int totalTargetSessions,
        int totalCompletedSessions,
        double overallCompletionRate,
        int attentionRequiredCount,
        List<DistrictAnalyticsDto> districts
) {}
