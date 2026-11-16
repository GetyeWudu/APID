package com.boa.apid.coaching.assignment.dto;

import java.time.Instant;

public record CoachReplacementHistoryDto(
        Long id,
        Long assignmentId,
        Long previousCoachEmployeeId,
        String previousCoachFullName,
        Long newCoachEmployeeId,
        String newCoachFullName,
        String reason,
        Long changedByUserId,
        String changedByUsername,
        Instant changedAt
) {}

