package com.boa.apid.mentoring.trainer.dto;

import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRequestType;

import java.time.Instant;
import java.util.List;

public record MentoringPairingReportSummaryDto(
        Long relationshipId,
        Long requestId,
        MentoringRequestType requestType,
        MentoringRelationshipStatus status,
        String mentorName,
        List<String> traineeNames,
        String skillName,
        Instant startedAt,
        Instant endedAt,
        long totalSessions,
        long completedSessions,
        double sessionCompletionRatePct
) {
}
