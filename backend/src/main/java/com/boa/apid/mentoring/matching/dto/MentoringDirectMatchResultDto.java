package com.boa.apid.mentoring.matching.dto;

import java.time.Instant;

public record MentoringDirectMatchResultDto(
        Long relationshipId,
        Long mentorUserId,
        String mentorName,
        Long traineeUserId,
        String traineeName,
        Instant startedAt
) {
}
