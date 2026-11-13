package com.boa.apid.coaching.assignment.dto;

import com.boa.apid.coaching.assignment.entity.AssignmentClosureReason;
import com.boa.apid.coaching.assignment.entity.AssignmentPathway;
import com.boa.apid.coaching.assignment.entity.AssignmentStatus;

import java.math.BigDecimal;
import java.time.Instant;

public record CoachingAssignmentDto(
        Long id,
        AssignmentPathway pathway,
        AssignmentStatus status,
        AssignmentClosureReason closureReason,
        boolean atRisk,
        int missedSessionsCount,
        // Coachee details
        Long coacheeEmployeeId,
        String coacheeEmployeeNumber,
        String coacheeFullName,
        String coacheeDepartment,
        String coacheePosition,
        // Coach details
        Long coachEmployeeId,
        String coachEmployeeNumber,
        String coachFullName,
        String coachDepartment,
        // Performance record snapshot
        Long performanceRecordId,
        BigDecimal overallFinalRating,
        Short roundedOverallFinalRating,
        // Fiscal quarter IDs and labels
        Long performanceFiscalQuarterId,
        String performanceQuarterLabel,
        Long coachingFiscalQuarterId,
        String coachingQuarterLabel,
        Instant lastActivityAt,
        Instant closedAt,
        Instant createdAt
) {}

