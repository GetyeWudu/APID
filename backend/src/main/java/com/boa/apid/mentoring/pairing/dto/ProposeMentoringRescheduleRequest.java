package com.boa.apid.mentoring.pairing.dto;

import java.time.Instant;

public record ProposeMentoringRescheduleRequest(
        Instant proposedStart,
        Instant proposedEnd,
        String reason
) {
}

