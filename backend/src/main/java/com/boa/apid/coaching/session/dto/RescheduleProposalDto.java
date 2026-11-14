package com.boa.apid.coaching.session.dto;

import com.boa.apid.coaching.session.entity.ProposalStatus;
import java.time.Instant;

public record RescheduleProposalDto(
        Long id,
        Long sessionId,
        Long proposedByEmployeeId,
        String proposedByFullName,
        Instant proposedStartTime,
        Instant proposedEndTime,
        String reason,
        ProposalStatus status,
        Instant createdAt
) {}
