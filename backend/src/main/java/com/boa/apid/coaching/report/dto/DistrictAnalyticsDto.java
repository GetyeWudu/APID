package com.boa.apid.coaching.report.dto;

import java.util.List;

public record DistrictAnalyticsDto(
        String districtName,
        int totalStaff,
        int coacheesCount,
        int criticalCount,
        int moderateCount,
        int targetSessions,
        int completedSessions,
        double completionRate,
        int overdueCount,
        double averageStartingScore,
        String primarySkillGap,
        List<BranchAnalyticsDto> branches
) {}
