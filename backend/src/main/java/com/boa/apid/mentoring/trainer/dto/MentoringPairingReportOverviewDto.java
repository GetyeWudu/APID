package com.boa.apid.mentoring.trainer.dto;

import java.util.List;

public record MentoringPairingReportOverviewDto(
        long totalPairings,
        long completedPairings,
        double pairingCompletionRatePct,
        long totalSessions,
        long completedSessions,
        double sessionCompletionRatePct,
        List<MentoringPairingReportSummaryDto> pairings
) {
}
