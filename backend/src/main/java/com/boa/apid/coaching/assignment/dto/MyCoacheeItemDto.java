package com.boa.apid.coaching.assignment.dto;

import com.boa.apid.coaching.assignment.entity.AssignmentPathway;
import com.boa.apid.coaching.assignment.entity.AssignmentStatus;

import java.math.BigDecimal;
import java.time.Instant;

public record MyCoacheeItemDto(
        Long assignmentId,
        Long coacheeEmployeeId,
        String coacheeEmployeeNumber,
        String coacheeFullName,
        String coacheeDepartment,
        String coacheePosition,
        String coacheeEmail,
        AssignmentPathway pathway,
        AssignmentStatus status,
        boolean atRisk,
        BigDecimal triggeringRating,
        Short roundedRating,
        String coachingQuarterLabel,
        int goalCount,
        Instant lastActivityAt,
        Instant createdAt
) {}

