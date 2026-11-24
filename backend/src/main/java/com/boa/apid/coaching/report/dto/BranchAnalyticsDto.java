package com.boa.apid.coaching.report.dto;

public record BranchAnalyticsDto(
        String branchName,
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
        int activeCoachesCount
) {}
