package com.boa.apid.coaching.report.dto;

public record DirectorateReportSummaryDto(
        String directorate,
        long totalCoached,
        long showingImprovement,
        int approvedSessions,
        int completedSessions,
        long atRiskCount
) {}

