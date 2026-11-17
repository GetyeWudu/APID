package com.boa.apid.mentoring.trainer.dto;

import com.boa.apid.mentoring.pairing.entity.MentoringSessionStatus;

import java.time.Instant;
import java.util.List;

public record MentoringPairingReportDetailDto(
        MentoringPairingReportSummaryDto pairing,
        String completionNote,
        List<SessionReport> sessions
) {
    public record SessionReport(
            Long id,
            String title,
            String agenda,
            Instant scheduledStart,
            Instant scheduledEnd,
            MentoringSessionStatus status,
            String reportNote
    ) {
    }
}
