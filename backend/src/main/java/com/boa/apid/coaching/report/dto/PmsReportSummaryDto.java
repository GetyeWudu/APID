package com.boa.apid.coaching.report.dto;

import java.util.List;

public record PmsReportSummaryDto(
        String fiscalQuarterName,
        long totalInRemediation,
        long criticalCount,
        long moderateCount,
        long showingImprovementCount,
        long masteredCount,
        long onTrackCount,
        long needsImprovementCount,
        long notStartedCount,
        int totalApprovedSessions,
        int totalCompletedSessions,
        double sessionDeliveryRate,
        long attentionRequiredCount,
        List<DirectorateReportSummaryDto> directorateBreakdown
) {}

